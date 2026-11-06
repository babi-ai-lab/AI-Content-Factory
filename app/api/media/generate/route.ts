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

type GeminiPart = { inlineData?: { mimeType?: string; data?: string }; text?: string };
type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
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

  let generated: GeminiResponse;
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
    generated = await response.json().catch(() => ({})) as GeminiResponse;
    if (!response.ok) {
      console.error("Gemini image generation failed:", response.status, generated.error?.code);
      if (response.status === 429) {
        return NextResponse.json({ error: "ظرفیت سرویس تولید تصویر موقتاً به پایان رسیده است. بعداً دوباره تلاش کن." }, { status: 429 });
      }
      return NextResponse.json({ error: "تولید تصویر توسط سرویس هوش مصنوعی ناموفق بود. تنظیمات مدل و سهمیه Gemini را بررسی کن." }, { status: 502 });
    }
  } catch (error) {
    console.error("Gemini image generation request failed:", error);
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
