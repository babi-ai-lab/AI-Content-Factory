"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildCarouselSlidePrompts, compactCarouselCopy } from "@/lib/carousel-prompts.mjs";
import { createZipStore } from "@/lib/zip-store.mjs";

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
  const [slideTexts, setSlideTexts] = useState<string[]>(() => stories.map((story) => compactCarouselCopy(story)));
  const [downloadingSlide, setDownloadingSlide] = useState(0);
  const [downloadingZip, setDownloadingZip] = useState(false);

  useEffect(() => {
    setSlideTexts(stories.map((story) => compactCarouselCopy(story)));
  }, [stories]);

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

  async function renderCarouselSlidePng(asset: MediaAsset, index: number): Promise<Blob> {
    if (!asset.imageUrl) throw new Error("لینک امن تصویر منقضی شده است؛ صفحه را تازه‌سازی کن.");
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = asset.imageUrl;
    await image.decode();
    await document.fonts.ready;

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("ساخت تصویر خروجی در این مرورگر پشتیبانی نمی‌شود.");

    const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    context.drawImage(image, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);

    const gradient = context.createLinearGradient(0, 560, 0, 1350);
    gradient.addColorStop(0, "rgba(12, 20, 42, 0)");
    gradient.addColorStop(0.35, "rgba(12, 20, 42, 0.42)");
    gradient.addColorStop(1, "rgba(12, 20, 42, 0.92)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1080, 1350);

    const copy = (slideTexts[index] || "").trim();
    context.direction = "rtl";
    context.textAlign = "right";
    context.textBaseline = "top";
    context.font = 'bold 44px "Vazirmatn", Tahoma, sans-serif';
    context.fillStyle = "#ffffff";
    context.shadowColor = "rgba(0,0,0,.24)";
    context.shadowBlur = 8;
    context.shadowOffsetY = 2;

    const lines: string[] = [];
    let line = "";
    for (const word of copy.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > 900) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    if (lines.length > 7) {
      lines.length = 7;
      lines[6] = `${lines[6].slice(0, Math.max(8, lines[6].length - 2))}…`;
    }
    const lineHeight = 62;
    const startY = Math.max(780, 1270 - lines.length * lineHeight);
    lines.forEach((text, lineIndex) => context.fillText(text, 960, startY + lineIndex * lineHeight, 900));

    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
    context.fillStyle = "#FFD54F";
    context.fillRect(120, 1270, 90, 5);
    context.fillStyle = "#ffffff";
    context.font = '600 25px "Vazirmatn", Tahoma, sans-serif';
    context.fillText(`اسلاید ${(index + 1).toLocaleString("fa-IR")} از ${carouselAssets.length.toLocaleString("fa-IR")}`, 960, 1300);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("ساخت فایل PNG ناموفق بود.")), "image/png");
    });
  }

  function downloadBlob(blob: Blob, filename: string) {
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
  }

  async function downloadCarouselSlide(asset: MediaAsset, index: number) {
    setDownloadingSlide(index + 1);
    setError("");
    try {
      const blob = await renderCarouselSlidePng(asset, index);
      downloadBlob(blob, `ai-content-factory-carousel-${index + 1}.png`);
      setNotice(`فایل PNG اسلاید ${(index + 1).toLocaleString("fa-IR")} آماده شد.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ساخت فایل PNG ناموفق بود. لینک تصویر یا پشتیبانی مرورگر را بررسی کن.");
    } finally {
      setDownloadingSlide(0);
    }
  }

  async function downloadCarouselZip() {
    if (!carouselAssets.length || carouselAssets.some((asset) => !asset.imageUrl)) {
      setError("برای ساخت فایل ZIP، لینک امن همه تصاویر باید معتبر باشد؛ صفحه را تازه‌سازی کن.");
      return;
    }
    setDownloadingZip(true);
    setError("");
    try {
      const entries = await Promise.all(carouselAssets.map(async (asset, index) => {
        const blob = await renderCarouselSlidePng(asset, index);
        return {
          name: `slide-${String(index + 1).padStart(2, "0")}.png`,
          data: new Uint8Array(await blob.arrayBuffer()),
        };
      }));
      const archive = createZipStore(entries);
      const archiveBlob = new Blob([new Uint8Array(archive).buffer as ArrayBuffer], { type: "application/zip" });
      downloadBlob(archiveBlob, `ai-content-factory-carousel-${new Date().toISOString().slice(0, 10)}.zip`);
      setNotice(`فایل ZIP شامل ${entries.length.toLocaleString("fa-IR")} اسلاید نهایی با متن فارسی آماده شد.`);
    } catch (cause) {
      setError(cause instanceof Error
        ? `ساخت فایل ZIP ناموفق بود: ${cause.message} برای دریافت جداگانه هر اسلاید از دکمه PNG استفاده کن.`
        : "ساخت فایل ZIP ناموفق بود؛ هر اسلاید را جداگانه دریافت کن.");
    } finally {
      setDownloadingZip(false);
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
            <div className="carousel-download-actions">
              <span>{carouselAssets.length.toLocaleString("fa-IR")} از ۵ اسلاید</span>
              <button
                type="button"
                className="carousel-download-all"
                disabled={downloadingZip || downloadingSlide > 0 || carouselAssets.some((asset) => !asset.imageUrl)}
                onClick={() => void downloadCarouselZip()}
              >
                {downloadingZip ? "در حال آماده‌سازی ZIP..." : `دانلود همه ${carouselAssets.length.toLocaleString("fa-IR")} اسلاید (ZIP)`}
              </button>
            </div>
          </div>
          <div className="carousel-studio-grid">
            {carouselAssets.map((asset, index) => (
              <article className="carousel-studio-card" key={asset.id}>
                {asset.imageUrl ? <img src={asset.imageUrl} alt={`تصویر اسلاید ${index + 1}`} loading="lazy" /> : <div className="carousel-studio-placeholder">تصویر در کتابخانه ذخیره شد</div>}
                <span>اسلاید {(index + 1).toLocaleString("fa-IR")}</span>
                <textarea
                  className="carousel-slide-copy"
                  value={slideTexts[index] || ""}
                  maxLength={220}
                  rows={4}
                  onChange={(event) => setSlideTexts((current) => current.map((value, textIndex) => textIndex === index ? event.target.value : value))}
                  aria-label={`متن اسلاید ${index + 1}`}
                />
                <small className="carousel-copy-count">{(slideTexts[index] || "").length.toLocaleString("fa-IR")} از ۲۲۰ نویسه</small>
                <button type="button" className="carousel-download" disabled={!asset.imageUrl || downloadingSlide > 0 || downloadingZip} onClick={() => void downloadCarouselSlide(asset, index)}>
                  {downloadingSlide === index + 1 ? "در حال ساخت PNG..." : "دانلود PNG با متن فارسی"}
                </button>
                {asset.imageUrl && <a href={asset.imageUrl} target="_blank" rel="noreferrer">باز کردن تصویر بدون متن ↗</a>}
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
