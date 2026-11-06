"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function InstagramCallbackPage() {
  const [message, setMessage] = useState("در حال تکمیل اتصال امن اینستاگرام...");

  useEffect(() => {
    let cancelled = false;

    async function completeConnection() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const providerError = params.get("error_description") || params.get("error");

      if (providerError || !code || !state) {
        const reason = providerError ? "اجازه اتصال در اینستاگرام تأیید نشد." : "پاسخ دریافتی از اینستاگرام ناقص است.";
        if (!cancelled) setMessage(reason);
        window.setTimeout(() => window.location.replace("/?instagram=error"), 1800);
        return;
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        if (!cancelled) setMessage("نشست برنامه منقضی شده است. ابتدا وارد حساب شو و اتصال را دوباره شروع کن.");
        window.setTimeout(() => window.location.replace("/?instagram=login-required"), 2200);
        return;
      }

      try {
        const response = await fetch("/api/integrations/instagram/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ code, state }),
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.connected) {
          throw new Error(result.error || "اتصال اینستاگرام کامل نشد.");
        }
        if (!cancelled) setMessage(`حساب @${result.username} با موفقیت متصل شد.`);
        window.setTimeout(() => window.location.replace("/?instagram=connected"), 1200);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "اتصال اینستاگرام ناموفق بود.");
        window.setTimeout(() => window.location.replace("/?instagram=error"), 2400);
      }
    }

    void completeConnection();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="instagram-callback-page" dir="rtl">
      <div className="instagram-callback-card">
        <span className="instagram-callback-mark">◎</span>
        <h1>اتصال اینستاگرام</h1>
        <p role="status">{message}</p>
      </div>
    </main>
  );
}
