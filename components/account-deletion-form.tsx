"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AccountDeletionForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!window.confirm("حذف حساب و تمام داده‌های وابسته دائمی و غیرقابل بازگشت است. آیا مطمئنی؟")) return;

    setBusy(true);
    setMessage("");
    let authenticated = false;
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError || !authData.session?.access_token) {
        throw new Error("ورود تأیید نشد. ایمیل و رمز عبور فعلی را بررسی کن.");
      }
      authenticated = true;

      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { password },
        headers: { Authorization: `Bearer ${authData.session.access_token}` },
      });
      if (error || data?.deleted !== true) {
        throw new Error("حذف حساب تأیید نشد. حساب حذف نشده است؛ کمی بعد دوباره تلاش کن.");
      }

      await supabase.auth.signOut({ scope: "local" });
      setPassword("");
      setMessage("درخواست با موفقیت انجام شد. حساب کاربری و داده‌های وابسته حذف شدند.");
    } catch (error) {
      if (authenticated) await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      setMessage(error instanceof Error ? error.message : "حذف حساب انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="account-deletion-form" onSubmit={handleSubmit}>
      <label>
        ایمیل حساب کاربری
        <input
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
        />
      </label>
      <label>
        رمز عبور فعلی
        <input
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          maxLength={256}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
        />
      </label>
      <button type="submit" disabled={busy || !email.trim() || !password}>
        {busy ? "در حال بررسی و حذف حساب…" : "حذف دائمی حساب و داده‌ها"}
      </button>
      <p className="account-deletion-message" role="status" aria-live="polite">{message}</p>
    </form>
  );
}
