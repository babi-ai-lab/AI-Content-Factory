import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { decryptInstagramToken } from "@/lib/instagram-security.mjs";
import { validateInstagramMediaUrl, validateInstagramPublishInput } from "@/lib/instagram-publishing.mjs";
import { readBoundedJsonBody } from "@/lib/server-controls.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InstagramApiError = { error?: { message?: string; type?: string; code?: number } };
type InstagramContainer = { id?: string; status_code?: string; status?: string } & InstagramApiError;
type InstagramPublishedMedia = { id?: string } & InstagramApiError;

async function graphRequest<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T }> {
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(25000) });
  const data = await response.json().catch(() => ({})) as T;
  return { ok: response.ok, status: response.status, data };
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const encryptionKey = process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY;
  if (!accessToken || !supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "ابتدا وارد حساب کاربری شو." }, { status: 401 });
  }
  if (!encryptionKey) return NextResponse.json({ error: "کلید امن اتصال اینستاگرام تنظیم نشده است." }, { status: 503 });

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) return NextResponse.json({ error: "نشست کاربری معتبر نیست." }, { status: 401 });

  const parsedBody = await readBoundedJsonBody(request.body, 12 * 1024);
  if ("error" in parsedBody) {
    if (parsedBody.error === "too_large") {
      return NextResponse.json({ error: "حجم درخواست بیش از حد مجاز است." }, { status: 413 });
    }
    return NextResponse.json({ error: "ساختار درخواست معتبر نیست." }, { status: 400 });
  }
  const validation = validateInstagramPublishInput(parsedBody.value);
  if (!validation.valid || !validation.value) return NextResponse.json({ error: validation.error || "درخواست انتشار معتبر نیست." }, { status: 400 });
  const input = validation.value!;
  if (!validateInstagramMediaUrl(input.mediaUrl, supabaseUrl, user.id)) {
    return NextResponse.json({ error: "فقط فایل‌های بارگذاری‌شده در فضای رسانه همین حساب قابل انتشار هستند." }, { status: 400 });
  }

  const { data: credentials, error: credentialError } = await supabase
    .from("instagram_connections")
    .select("instagram_user_id,encrypted_access_token,token_expires_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (credentialError || !credentials?.encrypted_access_token || !credentials?.instagram_user_id) {
    return NextResponse.json({ error: "حساب اینستاگرام متصل نیست یا دسترسی آن منقضی شده است." }, { status: 409 });
  }
  if (new Date(credentials.token_expires_at).getTime() <= Date.now() + 60_000) {
    return NextResponse.json({ error: "مجوز اینستاگرام منقضی شده است؛ حساب را دوباره متصل کن." }, { status: 409 });
  }

  const requestId = input.requestId || randomUUID();
  const { data: priorJob, error: priorError } = await supabase
    .from("instagram_publish_jobs")
    .select("id,status,published_media_id")
    .eq("user_id", user.id)
    .eq("request_id", requestId)
    .maybeSingle();
  if (priorError) return NextResponse.json({ error: "بررسی وضعیت انتشار ناموفق بود." }, { status: 503 });
  if (priorJob?.status === "published") {
    return NextResponse.json({ published: true, mediaId: priorJob.published_media_id, jobId: priorJob.id, duplicate: true });
  }
  if (priorJob?.status === "failed") {
    const { error: removeFailedJobError } = await supabase
      .from("instagram_publish_jobs")
      .delete()
      .eq("id", priorJob.id)
      .eq("user_id", user.id);
    if (removeFailedJobError) {
      return NextResponse.json({ error: "پاک‌سازی تلاش ناموفق قبلی انجام نشد؛ درخواست جدیدی بساز." }, { status: 409 });
    }
  } else if (priorJob) {
    return NextResponse.json({ error: "این درخواست قبلاً ثبت شده و در حال پردازش یا بررسی است.", jobId: priorJob.id }, { status: 409 });
  }

  const { data: job, error: insertError } = await supabase.from("instagram_publish_jobs").insert({
    user_id: user.id,
    request_id: requestId,
    media_type: input.mediaType,
    media_url: input.mediaUrl,
    caption: input.caption,
    status: "publishing",
    started_at: new Date().toISOString(),
  }).select("id").single();
  if (insertError || !job) {
    return NextResponse.json({ error: "ثبت درخواست انتشار ناموفق بود." }, { status: 503 });
  }

  const finishJob = async (status: "published" | "failed", details: Record<string, unknown>) => {
    const { error } = await supabase.from("instagram_publish_jobs").update({
      status,
      ...details,
      completed_at: new Date().toISOString(),
    }).eq("id", job.id).eq("user_id", user.id);
    if (error) console.error("Could not persist Instagram publish result:", error);
  };

  try {
    const token = decryptInstagramToken(credentials.encrypted_access_token, encryptionKey);
    const version = process.env.INSTAGRAM_GRAPH_API_VERSION || "v26.0";
    const graphBase = `https://graph.instagram.com/${version}`;
    const createForm = new URLSearchParams();
    if (input.mediaType === "image") {
      createForm.set("image_url", input.mediaUrl);
    } else {
      createForm.set("media_type", "REELS");
      createForm.set("video_url", input.mediaUrl);
      createForm.set("share_to_feed", "true");
    }
    if (input.caption) createForm.set("caption", input.caption);
    createForm.set("access_token", token);

    const created = await graphRequest<InstagramContainer>(
      `${graphBase}/${encodeURIComponent(credentials.instagram_user_id)}/media`,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: createForm }
    );
    if (!created.ok || !created.data.id) {
      const message = created.data.error?.message || "Meta نتوانست رسانه را پردازش کند.";
      await finishJob("failed", { error_message: message.slice(0, 500), error_code: String(created.data.error?.code || created.status) });
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const containerId = created.data.id;
    let ready = false;
    for (let attempt = 0; attempt < 18; attempt++) {
      const statusUrl = new URL(`${graphBase}/${encodeURIComponent(containerId)}`);
      statusUrl.searchParams.set("fields", "status_code,status");
      statusUrl.searchParams.set("access_token", token);
      const statusResult = await graphRequest<InstagramContainer>(statusUrl.toString());
      if (!statusResult.ok) throw new Error(statusResult.data.error?.message || "بررسی آماده‌شدن رسانه ناموفق بود.");
      const code = statusResult.data.status_code;
      if (code === "FINISHED") { ready = true; break; }
      if (code === "ERROR" || code === "EXPIRED") throw new Error(statusResult.data.status || "پردازش رسانه در Meta ناموفق بود.");
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    if (!ready) throw new Error("پردازش رسانه بیش از زمان مجاز طول کشید؛ دوباره تلاش کن.");

    const publishForm = new URLSearchParams();
    publishForm.set("creation_id", containerId);
    publishForm.set("access_token", token);
    const published = await graphRequest<InstagramPublishedMedia>(
      `${graphBase}/${encodeURIComponent(credentials.instagram_user_id)}/media_publish`,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: publishForm }
    );
    if (!published.ok || !published.data.id) {
      throw new Error(published.data.error?.message || "انتشار نهایی در اینستاگرام ناموفق بود.");
    }

    await finishJob("published", { published_media_id: published.data.id });
    return NextResponse.json({ published: true, mediaId: published.data.id, jobId: job.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "انتشار اینستاگرام ناموفق بود.";
    await finishJob("failed", { error_message: message.slice(0, 500), error_code: "PUBLISH_FAILED" });
    return NextResponse.json({ error: message, jobId: job.id }, { status: 502 });
  }
}
