import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function DELETE(request: NextRequest) {
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

  const { error } = await supabase.from("instagram_connections").delete().eq("user_id", user.id);
  if (error) {
    console.error("Instagram disconnect failed:", error);
    return NextResponse.json({ error: "قطع اتصال اینستاگرام ناموفق بود." }, { status: 503 });
  }
  return NextResponse.json({ disconnected: true });
}
