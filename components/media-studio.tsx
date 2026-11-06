"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  initialPrompt: string;
  contentHistoryId: string | null;
};

const ratios = [
  { value: "4:5", label: "پست عمودی ۴:۵" },
  { value: "1:1", label: "مربع ۱:۱" },
  { value: "9:16", label: "استوری و ریلز ۹:۱۶" },
  { value: "16:9", label: "افقی ۱۶:۹" },
  { value: "3:2", label: "افقی ۳:۲" },
  { value: "2:3", label: "عمودی ۲:۳" },
];

export default function MediaStudio({ initialPrompt, contentHistoryId }: Props) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [aspectRatio, setAspectRatio] = useState("4:5");
  const [imageUrl, setImageUrl] = useState("");
  const [assetId, setAssetId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);

  async function generateImage() {
    if (prompt.trim().length < 20 || prompt.trim().length > 3000) {
      setError("شرح تصویر باید بین ۲۰ تا ۳۰۰۰ نویسه باشد.");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error("نشست کاربری معتبر نیست؛ دوباره وارد حساب شو.");
      const response = await fetch("/api/media/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ prompt: prompt.trim(), aspectRatio, contentHistoryId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "تولید تصویر ناموفق بود.");
      setImageUrl(result.imageUrl || "");
      setAssetId(result.asset?.id || "");
      setRemaining(typeof result.remainingHourlyAllowance === "number" ? result.remainingHourlyAllowance : null);
      setNotice("تصویر در فضای خصوصی حساب ذخیره شد. لینک نمایش آن یک ساعت اعتبار دارد.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تولید تصویر ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="media-studio" aria-labelledby="media-studio-title">
      <div className="media-studio-heading">
        <div>
          <span className="step">۰۳ · استودیوی رسانه</span>
          <h3 id="media-studio-title">تولید تصویر تبلیغاتی با هوش مصنوعی</h3>
          <p>بر اساس محتوای فعلی، تصویر اختصاصی بساز. فایل در فضای خصوصی حساب ذخیره می‌شود.</p>
        </div>
        <span className="media-studio-tag">Gemini Image · 1K</span>
      </div>
      <label className="media-studio-prompt">
        شرح و جهت هنری تصویر
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} maxLength={3000} placeholder="موضوع، سبک بصری، رنگ‌ها، سوژه و ترکیب‌بندی را شرح بده..." />
        <small>{prompt.length.toLocaleString("fa-IR")} از ۳۰۰۰ نویسه</small>
      </label>
      <div className="media-studio-controls">
        <label>
          نسبت تصویر
          <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)}>
            {ratios.map((ratio) => <option key={ratio.value} value={ratio.value}>{ratio.label}</option>)}
          </select>
        </label>
        <button type="button" className="generate" onClick={() => void generateImage()} disabled={loading || prompt.trim().length < 20}>
          {loading ? <><span className="spinner" /> در حال ساخت تصویر...</> : "✦ تولید تصویر"}
        </button>
      </div>
      <p className="media-studio-disclosure">هر حساب حداکثر ۵ تصویر در ساعت تولید می‌کند. تولید تصویر ممکن است از سهمیه و اعتبار API گوگل استفاده کند. مدل متن داخل تصویر را تولید نمی‌کند تا بتوانی نوشته فارسی را جداگانه ویرایش کنی.</p>
      {error && <div className="notice error" role="alert">{error}</div>}
      {notice && <div className="notice info" role="status">{notice}{remaining !== null ? ` · سهمیه باقی‌مانده این ساعت: ${remaining.toLocaleString("fa-IR")}` : ""}</div>}
      {imageUrl && (
        <div className="media-studio-result">
          {/* The signed URL is private and expires after one hour. */}
          <img src={imageUrl} alt="تصویر تبلیغاتی تولیدشده برای محتوای فعلی" />
          <div className="media-studio-result-meta">
            <span>شناسه دارایی: <b dir="ltr">{assetId}</b></span>
            <a href={imageUrl} target="_blank" rel="noreferrer">باز کردن تصویر اصلی ↗</a>
          </div>
        </div>
      )}
    </section>
  );
}
