import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return NextResponse.json({ error: "ابتدا وارد حساب کاربری شو." }, { status: 401 });

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "نشست کاربری معتبر نیست." }, { status: 401 });

  const { data, error } = await supabase
    .from("instagram_connections")
    .select("instagram_user_id,username,token_expires_at,connected_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("Instagram connection status lookup failed:", error);
    return NextResponse.json({ error: "خواندن وضعیت اتصال اینستاگرام ناموفق بود." }, { status: 503 });
  }
  return NextResponse.json({ connected: Boolean(data), connection: data || null });
}
