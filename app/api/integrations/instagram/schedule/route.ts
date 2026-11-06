import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readBoundedJsonBody } from "@/lib/server-controls.mjs";
import {
  validateInstagramMediaPath,
  validateInstagramPublishInput,
  validateInstagramScheduleTime,
} from "@/lib/instagram-publishing.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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
  if (process.env.INSTAGRAM_SCHEDULER_ENABLED !== "true") {
    return NextResponse.json({ error: "زمان‌بندی خودکار هنوز فعال نشده است؛ تنظیمات امن worker باید تکمیل شود." }, { status: 503 });
  }

  const parsed = await readBoundedJsonBody(request.body, 12 * 1024);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error === "too_large" ? "حجم درخواست بیش از حد مجاز است." : "ساختار درخواست معتبر نیست." }, { status: parsed.error === "too_large" ? 413 : 400 });
  }
  const validation = validateInstagramPublishInput(parsed.value);
  if (!validation.valid || !validation.value) {
    return NextResponse.json({ error: validation.error || "اطلاعات انتشار معتبر نیست." }, { status: 400 });
  }
  const input = validation.value!;
  const scheduledAt = validateInstagramScheduleTime((parsed.value as { scheduledAt?: string })?.scheduledAt);
  if (!scheduledAt) {
    return NextResponse.json({ error: "زمان انتشار باید حداقل دو دقیقه و حداکثر ۹۰ روز بعد باشد." }, { status: 400 });
  }
  if (!validateInstagramMediaPath(input.mediaPath, user.id, input.mediaType)) {
    return NextResponse.json({ error: "فقط فایل‌های بارگذاری‌شده در فضای رسانه همین حساب قابل زمان‌بندی هستند." }, { status: 400 });
  }

  const { data: connection, error: connectionError } = await supabase
    .from("instagram_connections")
    .select("instagram_user_id,token_expires_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (connectionError || !connection) {
    return NextResponse.json({ error: "ابتدا حساب اینستاگرام را متصل کن." }, { status: 409 });
  }
  if (new Date(connection.token_expires_at).getTime() <= Date.now() + 60_000) {
    return NextResponse.json({ error: "مجوز اینستاگرام منقضی شده است؛ حساب را دوباره متصل کن." }, { status: 409 });
  }
  if (Date.parse(scheduledAt) >= Date.parse(connection.token_expires_at) - 60 * 60 * 1000) {
    return NextResponse.json({ error: "زمان انتشار باید دست‌کم یک ساعت پیش از پایان اعتبار مجوز اینستاگرام باشد." }, { status: 400 });
  }

  const requestId = input.requestId || randomUUID();
  const { data: prior } = await supabase
    .from("instagram_publish_jobs")
    .select("id,status")
    .eq("user_id", user.id)
    .eq("request_id", requestId)
    .maybeSingle();
  if (prior) {
    return NextResponse.json({ error: "این درخواست زمان‌بندی قبلاً ثبت شده است.", jobId: prior.id }, { status: 409 });
  }

  const { data: job, error: insertError } = await supabase
    .from("instagram_publish_jobs")
    .insert({
      user_id: user.id,
      request_id: requestId,
      media_type: input.mediaType,
      media_url: input.mediaPath,
      caption: input.caption,
      status: "queued",
      scheduled_at: scheduledAt,
    })
    .select("id,status,scheduled_at")
    .single();

  if (insertError || !job) {
    console.error("Could not schedule Instagram publish:", insertError);
    return NextResponse.json({ error: "ثبت زمان انتشار ناموفق بود." }, { status: 503 });
  }

  return NextResponse.json({ scheduled: true, job });
}
