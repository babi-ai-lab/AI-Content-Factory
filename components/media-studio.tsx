"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildCarouselSlidePrompts } from "@/lib/carousel-prompts.mjs";

type MediaAsset = { id: string; prompt: string; aspect_ratio: string; mime_type: string; byte_size: number; created_at: string; imageUrl: string | null };

type Props = {
  initialPrompt: string;
  contentHistoryId: string | null;
  stories: string[];
};

const ratios = [
  { value: "4:5", label: "پست عمودی ۴:۵" },
  { value: "1:1", label: "مربع ۱:۱" },
  { value: "9:16", label: "استوری و ریلز ۹:۱۶" },
  { value: "16:9", label: "افقی ۱۶:۹" },
  { value: "3:2", label: "افقی ۳:۲" },
  { value: "2:3", label: "عمودی ۲:۳" },
];

export default function MediaStudio({ initialPrompt, contentHistoryId, stories }: Props) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [aspectRatio, setAspectRatio] = useState("4:5");
  const [imageUrl, setImageUrl] = useState("");
  const [assetId, setAssetId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [carouselLoading, setCarouselLoading] = useState(false);
  const [carouselProgress, setCarouselProgress] = useState(0);
  const [carouselAssets, setCarouselAssets] = useState<MediaAsset[]>([]);

  useEffect(() => {
    let active = true;
    async function loadLibrary() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const response = await fetch("/api/media/generate", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "بارگذاری کتابخانه رسانه ناموفق بود.");
        if (active) setAssets(Array.isArray(result.assets) ? result.assets : []);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "بارگذاری کتابخانه رسانه ناموفق بود.");
      } finally {
        if (active) setLibraryLoading(false);
      }
    }
    void loadLibrary();
    return () => { active = false; };
  }, []);

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
      if (result.asset?.id) setAssets((current) => [{ ...result.asset, imageUrl: result.imageUrl || null }, ...current.filter((asset) => asset.id !== result.asset.id)].slice(0, 40));
      setRemaining(typeof result.remainingHourlyAllowance === "number" ? result.remainingHourlyAllowance : null);
      setNotice("تصویر در فضای خصوصی حساب ذخیره شد. لینک نمایش آن یک ساعت اعتبار دارد.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تولید تصویر ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }


  async function generateCarousel() {
    setCarouselLoading(true);
    setError("");
    setNotice("");
    setCarouselAssets([]);
    setCarouselProgress(0);
    let created: MediaAsset[] = [];
    try {
      const prompts = buildCarouselSlidePrompts(prompt.trim(), stories);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token || !session.user?.id) throw new Error("نشست کاربری معتبر نیست؛ دوباره وارد حساب شو.");
      const { data: allowance, error: allowanceError } = await supabase
        .from("media_generation_allowance")
        .select("request_count,window_started_at")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (allowanceError) throw new Error("بررسی سهمیه تولید کاروسل ناموفق بود.");
      const windowIsCurrent = allowance?.window_started_at
        && Date.now() - new Date(allowance.window_started_at).getTime() < 60 * 60 * 1000;
      const remainingAllowance = windowIsCurrent ? Math.max(0, 5 - allowance.request_count) : 5;
      if (remainingAllowance < 5) throw new Error(`برای ساخت کاروسل کامل به ۵ تصویر نیاز است؛ سهمیه باقی‌مانده این ساعت ${remainingAllowance.toLocaleString("fa-IR")} تصویر است. پس از بازنشانی سهمیه دوباره تلاش کن.`);
      for (let index = 0; index < prompts.length; index += 1) {
        const response = await fetch("/api/media/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ prompt: prompts[index], aspectRatio: "4:5", contentHistoryId }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `تولید اسلاید ${index + 1} ناموفق بود.`);
        const asset = { ...result.asset, imageUrl: result.imageUrl || null } as MediaAsset;
        created = [...created, asset];
        setCarouselAssets(created);
        setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)].slice(0, 40));
        setCarouselProgress(index + 1);
        setRemaining(typeof result.remainingHourlyAllowance === "number" ? result.remainingHourlyAllowance : null);
      }
      setNotice("هر پنج تصویر کاروسل تولید و در کتابخانه خصوصی ذخیره شد. متن هر اسلاید جداگانه زیر تصویر آمده تا بتوانی آن را ویرایش و روی طرح قرار بدهی.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ساخت کاروسل ناموفق بود.");
      if (created.length) setNotice(`${created.length.toLocaleString("fa-IR")} اسلاید از ۵ اسلاید تولید و ذخیره شد؛ اسلایدهای باقی‌مانده را پس از بازنشانی سهمیه بساز.`);
    } finally {
      setCarouselLoading(false);
    }
  }

  async function deleteAsset(id: string) {
    setDeletingId(id);
    setError("");
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error("نشست کاربری معتبر نیست.");
      const response = await fetch("/api/media/generate", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "حذف تصویر ناموفق بود.");
      setAssets((current) => current.filter((asset) => asset.id !== id));
      if (assetId === id) { setAssetId(""); setImageUrl(""); }
      setNotice("تصویر و فایل خصوصی آن حذف شد.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حذف تصویر ناموفق بود.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <section className="media-studio" aria-labelledby="media-studio-title">
      <div className="media-studio-heading">
        <div>
          <span className="step">۰۳ · استودیوی رسانه</span>
          <h3 id="media-studio-title">استودیوی تصویر تبلیغاتی</h3>
          <p>بر اساس محتوای فعلی، تصویر اختصاصی بساز. فایل در فضای خصوصی حساب ذخیره می‌شود.</p>
        </div>
        <span className="media-studio-tag">خروجی باکیفیت · 1K</span>
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
        <div className="media-studio-actions">
          <button type="button" className="generate" onClick={() => void generateImage()} disabled={loading || carouselLoading || prompt.trim().length < 20}>
            {loading ? <><span className="spinner" /> در حال ساخت تصویر...</> : "✦ تولید تصویر"}
          </button>
          <button type="button" className="secondary-button carousel-generate" onClick={() => void generateCarousel()} disabled={loading || carouselLoading || prompt.trim().length < 20 || stories.length !== 5}>
            {carouselLoading ? <><span className="spinner" /> ساخت کاروسل {carouselProgress.toLocaleString("fa-IR")} از ۵...</> : "▦ ساخت کاروسل ۵ اسلایدی"}
          </button>
        </div>
      </div>
      <p className="media-studio-disclosure">هر حساب حداکثر ۵ تصویر در ساعت تولید می‌کند. ظرفیت و محدودیت‌های سرویس ممکن است بر تولید تصویر اثر بگذارند. نوشته‌ها داخل تصویر درج نمی‌شوند تا بتوانی متن فارسی را جداگانه ویرایش کنی.</p>
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
      {carouselAssets.length > 0 && (
        <section className="carousel-studio-result" aria-live="polite">
          <div className="media-library-heading">
            <strong>پیش‌نمایش کاروسل</strong>
            <span>{carouselAssets.length.toLocaleString("fa-IR")} از ۵ اسلاید</span>
          </div>
          <div className="carousel-studio-grid">
            {carouselAssets.map((asset, index) => (
              <article className="carousel-studio-card" key={asset.id}>
                {asset.imageUrl ? <img src={asset.imageUrl} alt={`تصویر اسلاید ${index + 1}`} loading="lazy" /> : <div className="carousel-studio-placeholder">تصویر در کتابخانه ذخیره شد</div>}
                <span>اسلاید {(index + 1).toLocaleString("fa-IR")}</span>
                <p>{stories[index]}</p>
                {asset.imageUrl && <a href={asset.imageUrl} target="_blank" rel="noreferrer">باز کردن تصویر اصلی ↗</a>}
              </article>
            ))}
          </div>
        </section>
      )}
      <div className="media-library">
        <div className="media-library-heading">
          <strong>کتابخانه تصاویر تولیدشده</strong>
          <span>{assets.length.toLocaleString("fa-IR")} از ۴۰ تصویر اخیر</span>
        </div>
        {libraryLoading ? <p className="media-library-empty">در حال بارگذاری فایل‌های خصوصی...</p> : assets.length === 0 ? (
          <p className="media-library-empty">هنوز تصویری تولید نشده است.</p>
        ) : (
          <div className="media-library-grid">
            {assets.map((asset) => (
              <article className={asset.id === assetId ? "media-library-card is-active" : "media-library-card"} key={asset.id}>
                <button type="button" className="media-library-preview" onClick={() => {
                  if (asset.imageUrl) { setImageUrl(asset.imageUrl); setAssetId(asset.id); }
                }} aria-label="نمایش تصویر">
                  {asset.imageUrl ? <img src={asset.imageUrl} alt="تصویر ذخیره‌شده در کتابخانه" loading="lazy" /> : <span>لینک تصویر منقضی شده است؛ صفحه را تازه کن.</span>}
                </button>
                <div className="media-library-meta">
                  <small>{new Date(asset.created_at).toLocaleDateString("fa-IR")}</small>
                  <small dir="ltr">{asset.aspect_ratio} · {(asset.byte_size / 1024).toFixed(0)} KB</small>
                </div>
                <button type="button" className="media-library-delete" disabled={deletingId === asset.id} onClick={() => void deleteAsset(asset.id)}>
                  {deletingId === asset.id ? "در حال حذف..." : "حذف تصویر"}
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
