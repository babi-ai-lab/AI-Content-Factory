import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createInstagramOAuthState, hashInstagramOAuthState } from "@/lib/instagram-security.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!token || !supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "برای اتصال اینستاگرام ابتدا وارد حساب کاربری شو." }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "نشست کاربری معتبر نیست. دوباره وارد حساب شو." }, { status: 401 });
    }

    const appId = process.env.INSTAGRAM_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
    const encryptionKey = process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY;
    if (!appId || !appSecret || !redirectUri || !encryptionKey) {
      return NextResponse.json({
        error: "اتصال اینستاگرام هنوز پیکربندی نشده است. تنظیمات محرمانه Meta باید در محیط امن سرور ثبت شوند.",
        code: "INSTAGRAM_NOT_CONFIGURED",
      }, { status: 503 });
    }

    const now = new Date();
    const { error: cleanupError } = await supabase
      .from("instagram_oauth_states")
      .delete()
      .eq("user_id", user.id)
      .lt("expires_at", now.toISOString());
    if (cleanupError) {
      return NextResponse.json({ error: "پاک‌سازی نشست‌های منقضی‌شده اتصال ناموفق بود." }, { status: 503 });
    }
    const { count: recentAttempts, error: rateLimitError } = await supabase
      .from("instagram_oauth_states")
      .select("state_hash", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", new Date(now.getTime() - 60 * 60 * 1000).toISOString());
    if (rateLimitError) {
      return NextResponse.json({ error: "بررسی محدودیت اتصال اینستاگرام ناموفق بود." }, { status: 503 });
    }
    if ((recentAttempts || 0) >= 10) {
      return NextResponse.json({ error: "حداکثر ۱۰ تلاش برای شروع اتصال اینستاگرام در هر ساعت مجاز است." }, { status: 429 });
    }

    const state = createInstagramOAuthState(user.id, appSecret);
    const stateHash = hashInstagramOAuthState(state);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: stateError } = await supabase.from("instagram_oauth_states").insert({
      user_id: user.id,
      state_hash: stateHash,
      expires_at: expiresAt,
    });
    if (stateError) {
      console.error("Could not store Instagram OAuth state:", stateError);
      return NextResponse.json({ error: "آماده‌سازی اتصال اینستاگرام ناموفق بود." }, { status: 503 });
    }

    const authorizationUrl = new URL("https://www.instagram.com/oauth/authorize");
    authorizationUrl.searchParams.set("client_id", appId);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("scope", "instagram_business_basic,instagram_business_content_publish");
    authorizationUrl.searchParams.set("state", state);

    return NextResponse.json({ authorizationUrl: authorizationUrl.toString() });
  } catch (error) {
    console.error("Instagram connect initialization failed:", error);
    return NextResponse.json({ error: "شروع اتصال اینستاگرام با خطا روبه‌رو شد." }, { status: 500 });
  }
}
