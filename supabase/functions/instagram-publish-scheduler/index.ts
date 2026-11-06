import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PublishJob = {
  id: string;
  user_id: string;
  request_id: string;
  media_type: "image" | "reel";
  media_url: string;
  caption: string;
  container_id: string | null;
  attempt_count: number;
  created_at: string;
};

type ApiError = { error?: { message?: string; code?: number } };
type Container = { id?: string; status_code?: string; status?: string } & ApiError;
type Published = { id?: string } & ApiError;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function decryptInstagramToken(value: string, encodedKey: string): Promise<string> {
  const parts = value.split(".");
  const version = parts[0], ivText = parts[1], tagText = parts[2], encryptedText = parts[3];
  if (version !== "v1" || !ivText || !tagText || !encryptedText || parts.length !== 4) {
    throw new Error("Unsupported encrypted token format");
  }
  const rawKey = Uint8Array.from(atob(encodedKey), (character) => character.charCodeAt(0));
  if (rawKey.length !== 32) throw new Error("Instagram token encryption key must be 32 bytes");
  const key = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const encrypted = decodeBase64Url(encryptedText);
  const tag = decodeBase64Url(tagText);
  const combined = new Uint8Array(encrypted.length + tag.length);
  combined.set(encrypted);
  combined.set(tag, encrypted.length);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64Url(ivText), tagLength: 128 },
    key,
    combined
  );
  return new TextDecoder().decode(plain);
}

function equalHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

async function verifyCronRequest(body: { timestamp?: string; signature?: string }) {
  if (!body.timestamp || !/^\d{10}$/.test(body.timestamp) || !body.signature || !/^[a-f0-9]{64}$/i.test(body.signature)) return false;
  const timestamp = Number(body.timestamp);
  if (Math.abs(Date.now() / 1000 - timestamp) > 180) return false;
  const { data: secret, error } = await supabase.rpc("get_instagram_worker_secret", {
    p_name: "instagram_publish_cron_secret",
  });
  if (error || typeof secret !== "string" || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body.timestamp)));
  const expected = Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return equalHex(expected, body.signature.toLowerCase());
}

async function graphRequest<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T }> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({})) as T;
  return { ok: response.ok, status: response.status, data };
}

async function reschedule(job: PublishJob, patch: Record<string, unknown> = {}) {
  const { error } = await supabase.from("instagram_publish_jobs").update({
    status: "queued",
    scheduled_at: new Date(Date.now() + 60 * 1000).toISOString(),
    started_at: null,
    ...patch,
  }).eq("id", job.id);
  if (error) throw new Error("Could not reschedule Instagram media processing");
}

async function processJob(job: PublishJob, encryptionKey: string) {
  if (Date.now() - new Date(job.created_at).getTime() > 30 * 60 * 1000 || job.attempt_count > 30) {
    throw new Error("پردازش رسانه در Meta بیش از ۳۰ دقیقه طول کشید.");
  }

  const { data: connection, error: connectionError } = await supabase
    .from("instagram_connections")
    .select("instagram_user_id,encrypted_access_token,token_expires_at")
    .eq("user_id", job.user_id)
    .maybeSingle();

  if (connectionError || !connection) throw new Error("Instagram account is no longer connected");
  if (new Date(connection.token_expires_at).getTime() <= Date.now() + 60_000) {
    throw new Error("Instagram access token expired; reconnect the account");
  }

  const token = await decryptInstagramToken(connection.encrypted_access_token, encryptionKey);
  const version = Deno.env.get("INSTAGRAM_GRAPH_API_VERSION") || "v26.0";
  const graphBase = "https://graph.instagram.com/" + version;

  let containerId = job.container_id;
  if (!containerId) {
    const { data: signedMedia, error: signedError } = await supabase.storage
      .from("instagram-media")
      .createSignedUrl(job.media_url, 15 * 60);
    if (signedError || !signedMedia?.signedUrl) throw new Error("Could not create a short-lived media URL");

    const createForm = new URLSearchParams();
    if (job.media_type === "image") {
      createForm.set("image_url", signedMedia.signedUrl);
    } else {
      createForm.set("media_type", "REELS");
      createForm.set("video_url", signedMedia.signedUrl);
      createForm.set("share_to_feed", "true");
    }
    if (job.caption) createForm.set("caption", job.caption);
    createForm.set("access_token", token);

    const created = await graphRequest<Container>(
      graphBase + "/" + encodeURIComponent(connection.instagram_user_id) + "/media",
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: createForm }
    );
    if (!created.ok || !created.data.id) {
      throw new Error(created.data.error?.message || "Meta could not create the media container");
    }
    containerId = created.data.id;
    await reschedule(job, { container_id: containerId, error_code: null, error_message: null });
    return "processing";
  }

  const statusUrl = new URL(graphBase + "/" + encodeURIComponent(containerId));
  statusUrl.searchParams.set("fields", "status_code,status");
  statusUrl.searchParams.set("access_token", token);
  const status = await graphRequest<Container>(statusUrl.toString());
  if (!status.ok) throw new Error(status.data.error?.message || "Could not check media processing status");

  if (status.data.status_code === "ERROR" || status.data.status_code === "EXPIRED") {
    throw new Error(status.data.status || "Meta media processing failed");
  }
  if (status.data.status_code !== "FINISHED") {
    await reschedule(job);
    return "processing";
  }

  const publishForm = new URLSearchParams();
  publishForm.set("creation_id", containerId);
  publishForm.set("access_token", token);
  const published = await graphRequest<Published>(
    graphBase + "/" + encodeURIComponent(connection.instagram_user_id) + "/media_publish",
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: publishForm }
  );
  if (!published.ok || !published.data.id) {
    throw new Error(published.data.error?.message || "Instagram publish failed");
  }

  const { error } = await supabase.from("instagram_publish_jobs").update({
    status: "published",
    published_media_id: published.data.id,
    error_code: null,
    error_message: null,
    completed_at: new Date().toISOString(),
    started_at: null,
  }).eq("id", job.id);
  if (error) throw new Error("Published, but failed to record the result");
  return "published";
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const body = await request.json().catch(() => ({}));
    if (!await verifyCronRequest(body)) {
      return Response.json({ error: "Unauthorized scheduler request" }, { status: 401 });
    }

    const { data: encryptionKey, error: keyError } = await supabase.rpc("get_instagram_worker_secret", {
      p_name: "instagram_token_encryption_key",
    });
    if (keyError || typeof encryptionKey !== "string" || !encryptionKey) {
      return Response.json({ error: "Instagram encryption key is not configured in Supabase Vault" }, { status: 503 });
    }

    const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await supabase.from("instagram_publish_jobs").update({
      status: "failed",
      error_code: "WORKER_TIMEOUT",
      error_message: "پردازش انتشار بیش از ۱۵ دقیقه بدون نتیجه باقی ماند.",
      completed_at: new Date().toISOString(),
      started_at: null,
    }).eq("status", "publishing").lt("started_at", staleBefore);

    const { data: jobs, error: claimError } = await supabase.rpc("claim_due_instagram_publish_jobs", {
      p_limit: 1,
    });
    if (claimError) {
      console.error("Could not claim due Instagram jobs:", claimError.message);
      return Response.json({ error: "Could not claim scheduled jobs" }, { status: 503 });
    }

    const results = await Promise.all((jobs || []).map(async (job: PublishJob) => {
      try {
        const status = await processJob(job, encryptionKey);
        return { id: job.id, status };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Instagram scheduled publish failed";
        await supabase.from("instagram_publish_jobs").update({
          status: "failed",
          error_code: "SCHEDULED_PUBLISH_FAILED",
          error_message: message.slice(0, 500),
          completed_at: new Date().toISOString(),
          started_at: null,
        }).eq("id", job.id);
        return { id: job.id, status: "failed" };
      }
    }));

    return Response.json({ processed: results.length, results });
  } catch (error) {
    console.error("Instagram scheduler failed:", error);
    return Response.json({ error: "Instagram scheduler failed" }, { status: 500 });
  }
});
