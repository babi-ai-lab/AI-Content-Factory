import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readBoundedJsonBody } from "@/lib/server-controls.mjs";
import {
  buildBrandSafeImagePrompt,
  getGeneratedImageExtension,
  validateMediaGenerationInput,
} from "@/lib/media-generation.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImageServicePart = { inlineData?: { mimeType?: string; data?: string }; text?: string };
type ImageServiceResponse = {
  candidates?: Array<{ content?: { parts?: ImageServicePart[] }; finishReason?: string }>;
  error?: { message?: string; code?: number };
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!accessToken || !supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "ابتدا وارد حساب کاربری شو." }, { status: 401 });
  }
  if (!apiKey) return NextResponse.json({ error: "سرویس تولید تصویر هنوز پیکربندی نشده است." }, { status: 503 });

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) return NextResponse.json({ error: "نشست کاربری معتبر نیست." }, { status: 401 });

  const parsed = await readBoundedJsonBody(request.body, 8 * 1024);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: parsed.error === "too_large" ? "حجم درخواست بیش از حد مجاز است." : "ساختار درخواست معتبر نیست." },
      { status: parsed.error === "too_large" ? 413 : 400 },
    );
  }
  const validation = validateMediaGenerationInput(parsed.value);
  if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 });
  const input = validation.value;

  if (input.contentHistoryId) {
    const { data: historyItem, error: historyError } = await supabase
      .from("content_history")
      .select("id")
      .eq("id", input.contentHistoryId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (historyError || !historyItem) {
      return NextResponse.json({ error: "محتوای مرتبط پیدا نشد یا متعلق به این حساب نیست." }, { status: 404 });
    }
  }

  const { data: reserved, error: limitError } = await supabase.rpc("reserve_media_generation");
  if (limitError || typeof reserved !== "number") {
    const message = limitError?.message || "";
    if (/MEDIA_GENERATION_LIMIT/.test(message)) {
      return NextResponse.json({ error: "سهمیه آزمایشی تولید تصویر به سقف ۵ تصویر در ساعت رسیده است. بعداً دوباره تلاش کن." }, { status: 429 });
    }
    console.error("Could not reserve media generation:", limitError);
    return NextResponse.json({ error: "بررسی سهمیه تولید تصویر ناموفق بود." }, { status: 503 });
  }

  let generated: ImageServiceResponse;
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-image:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildBrandSafeImagePrompt(input.prompt) }] }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            responseFormat: { image: { aspectRatio: input.aspectRatio, imageSize: "1K" } },
          },
        }),
        signal: AbortSignal.timeout(90_000),
        cache: "no-store",
      },
    );
    generated = await response.json().catch(() => ({})) as ImageServiceResponse;
    if (!response.ok) {
      console.error("Image generation provider rejected request:", { status: response.status, providerCode: generated.error?.code, providerMessage: generated.error?.message?.slice(0, 500) });
      if (response.status === 429) {
        return NextResponse.json({ error: "ظرفیت سرویس تولید تصویر موقتاً به پایان رسیده است. بعداً دوباره تلاش کن." }, { status: 429 });
      }
      if (response.status === 401 || response.status === 403) {\n        return NextResponse.json({ error: "دسترسی سرویس تولید تصویر موقتاً برقرار نیست. لطفاً کمی بعد دوباره تلاش کن." }, { status: 503 });\n      }\n      if (response.status === 400 || response.status === 404) {\n        return NextResponse.json({ error: "درخواست تولید تصویر با تنظیمات فعلی سازگار نیست. شرح تصویر را ساده‌تر کن یا بعداً دوباره تلاش کن." }, { status: 502 });\n      }\n      return NextResponse.json({ error: "در حال حاضر امکان تولید تصویر وجود ندارد. لطفاً کمی بعد دوباره تلاش کن." }, { status: 502 });
    }
  } catch (error) {
    console.error("Image generation provider request failed:", error);
    return NextResponse.json({ error: "ارتباط با سرویس تولید تصویر برقرار نشد." }, { status: 502 });
  }

  const imagePart = generated.candidates?.flatMap((candidate) => candidate.content?.parts || [])
    .find((part) => Boolean(part.inlineData?.data && part.inlineData.mimeType));
  if (!imagePart?.inlineData?.data || !imagePart.inlineData.mimeType) {
    return NextResponse.json({ error: "مدل تصویر قابل ذخیره‌ای برنگرداند؛ دوباره با شرح ساده‌تری تلاش کن." }, { status: 502 });
  }

  const extension = getGeneratedImageExtension(imagePart.inlineData.mimeType);
  if (!extension) return NextResponse.json({ error: "قالب تصویر برگشتی پشتیبانی نمی‌شود." }, { status: 502 });

  const imageBuffer = Buffer.from(imagePart.inlineData.data, "base64");
  if (!imageBuffer.length || imageBuffer.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "حجم تصویر تولیدشده از حد مجاز بیشتر است." }, { status: 413 });
  }

  const assetId = randomUUID();
  const storagePath = `${user.id}/${assetId}.${extension}`;
  const mimeType = imagePart.inlineData.mimeType.toLowerCase();
  const { error: uploadError } = await supabase.storage
    .from("generated-media")
    .upload(storagePath, imageBuffer, { contentType: mimeType, upsert: false, cacheControl: "3600" });
  if (uploadError) {
    console.error("Generated media upload failed:", uploadError);
    return NextResponse.json({ error: "ذخیره امن تصویر ناموفق بود. تنظیمات فضای رسانه را بررسی کن." }, { status: 503 });
  }

  const { data: asset, error: insertError } = await supabase
    .from("generated_media")
    .insert({
      id: assetId,
      user_id: user.id,
      storage_path: storagePath,
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio,
      mime_type: mimeType,
      byte_size: imageBuffer.length,
      content_history_id: input.contentHistoryId,
    })
    .select("id,storage_path,prompt,aspect_ratio,mime_type,byte_size,created_at")
    .single();

  if (insertError || !asset) {
    await supabase.storage.from("generated-media").remove([storagePath]);
    console.error("Generated media metadata insert failed:", insertError);
    return NextResponse.json({ error: "ثبت مشخصات تصویر ناموفق بود." }, { status: 503 });
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from("generated-media")
    .createSignedUrl(storagePath, 60 * 60);
  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: "تصویر ذخیره شد اما ساخت لینک امن نمایش آن ناموفق بود؛ صفحه را تازه‌سازی کن." }, { status: 503 });
  }

  return NextResponse.json({
    asset,
    imageUrl: signed.signedUrl,
    remainingHourlyAllowance: Math.max(0, 5 - reserved),
  });
}


export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!accessToken || !supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "ابتدا وارد حساب کاربری شو." }, { status: 401 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) return NextResponse.json({ error: "نشست کاربری معتبر نیست." }, { status: 401 });

  const { data: assets, error } = await supabase
    .from("generated_media")
    .select("id,prompt,aspect_ratio,mime_type,byte_size,content_history_id,created_at,storage_path")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    console.error("Could not load generated media library:", error);
    return NextResponse.json({ error: "بارگذاری کتابخانه رسانه ناموفق بود." }, { status: 503 });
  }
  if (!assets?.length) return NextResponse.json({ assets: [] });

  const { data: signedUrls, error: signedError } = await supabase.storage
    .from("generated-media")
    .createSignedUrls(assets.map((asset) => asset.storage_path), 60 * 60);
  if (signedError || !signedUrls) {
    return NextResponse.json({ error: "ساخت لینک امن فایل‌های رسانه ناموفق بود." }, { status: 503 });
  }
  const signedByPath = new Map(signedUrls.map((item) => [item.path, item.signedUrl]));
  return NextResponse.json({
    assets: assets.map((asset) => ({ ...asset, imageUrl: signedByPath.get(asset.storage_path) || null })),
  });
}

export async function DELETE(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!accessToken || !supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "ابتدا وارد حساب کاربری شو." }, { status: 401 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) return NextResponse.json({ error: "نشست کاربری معتبر نیست." }, { status: 401 });

  const parsed = await readBoundedJsonBody(request.body, 2 * 1024);
  if ("error" in parsed || !parsed.value || typeof parsed.value !== "object") {
    return NextResponse.json({ error: "درخواست حذف معتبر نیست." }, { status: 400 });
  }
  const id = (parsed.value as { id?: unknown }).id;
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "شناسه فایل معتبر نیست." }, { status: 400 });
  }

  const { data: asset, error: lookupError } = await supabase
    .from("generated_media")
    .select("id,storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupError || !asset) return NextResponse.json({ error: "فایل پیدا نشد یا متعلق به این حساب نیست." }, { status: 404 });

  const { error: storageError } = await supabase.storage
    .from("generated-media")
    .remove([asset.storage_path]);
  if (storageError) {
    console.error("Could not delete generated media file:", storageError);
    return NextResponse.json({ error: "حذف فایل از فضای خصوصی ناموفق بود." }, { status: 503 });
  }
  const { error: rowError } = await supabase
    .from("generated_media")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (rowError) {
    console.error("Could not delete generated media metadata:", rowError);
    return NextResponse.json({ error: "فایل حذف شد اما ثبت مشخصات آن پاک نشد؛ دوباره تلاش کن." }, { status: 503 });
  }
  return NextResponse.json({ deleted: true, id });
}
