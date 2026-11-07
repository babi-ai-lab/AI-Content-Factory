import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encryptInstagramToken, hashInstagramOAuthState, verifyInstagramOAuthState } from "@/lib/instagram-security.mjs";
import { readBoundedJsonBody } from "@/lib/server-controls.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InstagramTokenResponse = {
  access_token?: string;
  user_id?: number | string;
  expires_in?: number;
  error_message?: string;
};

type InstagramProfileResponse = {
  user_id?: number | string;
  id?: number | string;
  username?: string;
  error?: { message?: string };
};

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!token || !supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "نشست کاربری معتبر نیست." }, { status: 401 });
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
      return NextResponse.json({ error: "تنظیمات اتصال اینستاگرام کامل نیست." }, { status: 503 });
    }

    const parsedBody = await readBoundedJsonBody(request.body, 8 * 1024);
    if ("error" in parsedBody) {
      return NextResponse.json(
        { error: parsedBody.error === "too_large" ? "حجم درخواست بیش از حد مجاز است." : "ساختار درخواست معتبر نیست." },
        { status: parsedBody.error === "too_large" ? 413 : 400 },
      );
    }
    const body = parsedBody.value && typeof parsedBody.value === "object" && !Array.isArray(parsedBody.value)
      ? parsedBody.value as { code?: unknown; state?: unknown }
      : null;
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const state = typeof body?.state === "string" ? body.state : "";
    if (!code || code.length > 4096 || !state || state.length > 2048) {
      return NextResponse.json({ error: "پاسخ دریافتی از اینستاگرام معتبر نیست." }, { status: 400 });
    }

    const verifiedState = verifyInstagramOAuthState(state, appSecret);
    if (!verifiedState || verifiedState.userId !== user.id) {
      return NextResponse.json({ error: "اعتبار درخواست اتصال منقضی یا نامعتبر است. دوباره تلاش کن." }, { status: 400 });
    }

    const { data: consumedState, error: stateError } = await supabase
      .from("instagram_oauth_states")
      .delete()
      .eq("user_id", user.id)
      .eq("state_hash", hashInstagramOAuthState(state))
      .gt("expires_at", new Date().toISOString())
      .select("state_hash")
      .maybeSingle();
    if (stateError || !consumedState) {
      return NextResponse.json({ error: "درخواست اتصال قبلاً استفاده شده یا منقضی شده است. دوباره تلاش کن." }, { status: 400 });
    }

    const shortTokenForm = new URLSearchParams();
    shortTokenForm.set("client_id", appId);
    shortTokenForm.set("client_secret", appSecret);
    shortTokenForm.set("grant_type", "authorization_code");
    shortTokenForm.set("redirect_uri", redirectUri);
    shortTokenForm.set("code", code);

    const shortTokenResponse = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: shortTokenForm,
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    const shortTokenData = await shortTokenResponse.json().catch(() => ({})) as InstagramTokenResponse;
    if (!shortTokenResponse.ok || !shortTokenData.access_token) {
      console.error("Instagram short-lived token exchange failed:", shortTokenData.error_message || shortTokenResponse.status);
      return NextResponse.json({ error: "دریافت مجوز از اینستاگرام ناموفق بود. دوباره اتصال را شروع کن." }, { status: 502 });
    }

    const longTokenUrl = new URL("https://graph.instagram.com/access_token");
    longTokenUrl.searchParams.set("grant_type", "ig_exchange_token");
    longTokenUrl.searchParams.set("client_secret", appSecret);
    longTokenUrl.searchParams.set("access_token", shortTokenData.access_token);
    const longTokenResponse = await fetch(longTokenUrl, {
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    const longTokenData = await longTokenResponse.json().catch(() => ({})) as InstagramTokenResponse;
    if (!longTokenResponse.ok || !longTokenData.access_token) {
      console.error("Instagram long-lived token exchange failed:", longTokenData.error_message || longTokenResponse.status);
      return NextResponse.json({ error: "تبدیل مجوز اینستاگرام به دسترسی بلندمدت ناموفق بود." }, { status: 502 });
    }

    const graphVersion = process.env.INSTAGRAM_GRAPH_API_VERSION || "v26.0";
    const profileUrl = new URL(`https://graph.instagram.com/${graphVersion}/me`);
    profileUrl.searchParams.set("fields", "user_id,username");
    profileUrl.searchParams.set("access_token", longTokenData.access_token);
    const profileResponse = await fetch(profileUrl, {
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    const profile = await profileResponse.json().catch(() => ({})) as InstagramProfileResponse;
    const instagramUserId = profile.user_id || profile.id || shortTokenData.user_id || longTokenData.user_id;
    if (!profileResponse.ok || !instagramUserId || !profile.username) {
      console.error("Instagram profile lookup failed:", profile.error?.message || profileResponse.status);
      return NextResponse.json({ error: "حساب اینستاگرام شناسایی نشد. نوع حساب و مجوزهای دسترسی را بررسی کن." }, { status: 502 });
    }

    const encryptedAccessToken = encryptInstagramToken(longTokenData.access_token, encryptionKey);
    const expiresIn = Math.max(60, Number(longTokenData.expires_in) || 5184000);
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const { error: saveError } = await supabase.from("instagram_connections").upsert({
      user_id: user.id,
      instagram_user_id: String(instagramUserId),
      username: profile.username.slice(0, 100),
      encrypted_access_token: encryptedAccessToken,
      token_expires_at: tokenExpiresAt,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (saveError) {
      console.error("Could not save Instagram connection:", saveError);
      return NextResponse.json({ error: "حساب متصل شد، اما ذخیره امن اتصال ناموفق بود." }, { status: 503 });
    }

    return NextResponse.json({ connected: true, username: profile.username });
  } catch (error) {
    console.error("Instagram OAuth callback failed:", error);
    return NextResponse.json({ error: "تکمیل اتصال اینستاگرام با خطای غیرمنتظره روبه‌رو شد." }, { status: 500 });
  }
}
