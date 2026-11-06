"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import JalaliDateTimePicker from "@/components/jalali-date-time-picker";

type InstagramConnection = {
  username: string;
  token_expires_at: string;
  connected_at: string;
};

type InstagramJob = {
  id: string;
  media_type: "image" | "reel";
  status: "queued" | "publishing" | "published" | "failed";
  caption: string;
  published_media_id: string | null;
  error_message: string | null;
  created_at: string;
  scheduled_at: string | null;
};

type Props = { userId: string };

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export default function InstagramIntegration({ userId }: Props) {
  const [connection, setConnection] = useState<InstagramConnection | null>(null);
  const [configured, setConfigured] = useState(false);
  const [schedulerEnabled, setSchedulerEnabled] = useState(false);
  const [jobs, setJobs] = useState<InstagramJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "reel">("image");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPath, setMediaPath] = useState("");
  const [caption, setCaption] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [requestId, setRequestId] = useState("");

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error("نشست کاربری معتبر نیست.");
      const response = await fetch("/api/integrations/instagram/status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "خواندن وضعیت اتصال اینستاگرام ناموفق بود.");
      setConnection(result.connection || null);
      setConfigured(Boolean(result.configured));
      setSchedulerEnabled(Boolean(result.schedulerEnabled));

      const { data, error } = await supabase
        .from("instagram_publish_jobs")
        .select("id,media_type,status,caption,published_media_id,error_message,created_at,scheduled_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw new Error("خواندن تاریخچه انتشار اینستاگرام ناموفق بود.");
      setJobs((data || []) as InstagramJob[]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "وضعیت اینستاگرام دریافت نشد.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadWorkspace();
    const params = new URLSearchParams(window.location.search);
    const status = params.get("instagram");
    if (status === "connected") setNotice("حساب اینستاگرام با موفقیت متصل شد.");
    if (status === "error") setNotice("اتصال اینستاگرام کامل نشد. دوباره تلاش کن.");
    if (status === "login-required") setNotice("برای تکمیل اتصال، ابتدا وارد حساب برنامه شو.");
    if (status) window.history.replaceState({}, "", window.location.pathname);
  }, [loadWorkspace]);

  async function getAccessToken() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.access_token) throw new Error("نشست کاربری معتبر نیست. دوباره وارد حساب شو.");
    return session.access_token;
  }

  async function connectAccount() {
    setBusy(true);
    setNotice("");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/integrations/instagram/connect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.authorizationUrl) {
        throw new Error(result.error || "شروع اتصال اینستاگرام ناموفق بود.");
      }
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "شروع اتصال اینستاگرام ناموفق بود.");
      setBusy(false);
    }
  }

  function validateFile(file: File) {
    if (mediaType === "image") {
      return file.type === "image/jpeg" && file.size <= MAX_IMAGE_BYTES;
    }
    return file.type === "video/mp4" && file.size <= MAX_VIDEO_BYTES;
  }

  async function uploadMedia() {
    if (!mediaFile) throw new Error("ابتدا یک فایل تصویر یا ویدئو انتخاب کن.");
    if (!validateFile(mediaFile)) {
      throw new Error(mediaType === "image"
        ? "برای پست تصویری فقط JPEG تا ۸ مگابایت مجاز است."
        : "برای ریلز فقط MP4 تا ۵۰ مگابایت مجاز است.");
    }
    if (mediaPath) return mediaPath;

    const safeName = mediaFile.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
    const objectPath = `${userId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from("instagram-media").upload(objectPath, mediaFile, {
      contentType: mediaFile.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw new Error(error.message || "بارگذاری رسانه ناموفق بود.");
    setMediaPath(objectPath);
    return objectPath;
  }

  function resetComposer() {
    setMediaFile(null);
    setMediaPath("");
    setCaption("");
    setScheduleAt("");
    setRequestId("");
  }

  async function publishNow() {
    if (!connection) {
      setNotice("ابتدا حساب حرفه‌ای اینستاگرام را متصل کن.");
      return;
    }
    setBusy(true);
    setNotice("در حال بارگذاری رسانه و آماده‌سازی انتشار...");
    const idempotencyKey = requestId || crypto.randomUUID();
    setRequestId(idempotencyKey);
    try {
      const token = await getAccessToken();
      const path = await uploadMedia();
      const response = await fetch("/api/integrations/instagram/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mediaPath: path, mediaType, caption, requestId: idempotencyKey }),
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.published) throw new Error(result.error || "انتشار در اینستاگرام ناموفق بود.");
      setNotice("محتوا با موفقیت در اینستاگرام منتشر شد.");
      resetComposer();
      await loadWorkspace();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "انتشار در اینستاگرام ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function schedulePost() {
    if (!connection) {
      setNotice("ابتدا حساب حرفه‌ای اینستاگرام را متصل کن.");
      return;
    }
    if (!scheduleAt) {
      setNotice("تاریخ و ساعت انتشار را انتخاب کن.");
      return;
    }
    setBusy(true);
    setNotice("در حال آماده‌سازی انتشار زمان‌بندی‌شده...");
    const idempotencyKey = requestId || crypto.randomUUID();
    setRequestId(idempotencyKey);
    try {
      const token = await getAccessToken();
      const path = await uploadMedia();
      const response = await fetch("/api/integrations/instagram/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mediaPath: path, mediaType, caption, requestId: idempotencyKey, scheduledAt: scheduleAt }),
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.scheduled) throw new Error(result.error || "زمان‌بندی انتشار ناموفق بود.");
      setNotice("انتشار محتوا با موفقیت زمان‌بندی شد.");
      resetComposer();
      await loadWorkspace();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "زمان‌بندی انتشار ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelScheduled(jobId: string) {
    if (!window.confirm("این انتشار زمان‌بندی‌شده لغو شود؟")) return;
    const { error } = await supabase
      .from("instagram_publish_jobs")
      .delete()
      .eq("id", jobId)
      .eq("user_id", userId)
      .eq("status", "queued");
    if (error) {
      setNotice("لغو انتشار زمان‌بندی‌شده ناموفق بود.");
      return;
    }
    setNotice("انتشار زمان‌بندی‌شده لغو شد.");
    await loadWorkspace();
  }

  async function disconnectAccount() {
    if (!window.confirm("اتصال اینستاگرام قطع شود؟ انتشارهای زمان‌بندی‌شده لغو خواهند شد.")) return;
    setBusy(true);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/integrations/instagram/disconnect", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.disconnected) throw new Error(result.error || "قطع اتصال ناموفق بود.");
      setNotice("اتصال اینستاگرام قطع شد.");
      await loadWorkspace();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "قطع اتصال ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel instagram-integration-section" aria-labelledby="instagram-integration-title">
      <div className="instagram-integration-head">
        <div>
          <span className="step">اتصال شبکه اجتماعی</span>
          <h2 id="instagram-integration-title">مدیریت انتشار اینستاگرام</h2>
          <p>حساب حرفه‌ای Business یا Creator را متصل کن؛ سپس تصویر یا ریلز را مستقیم منتشر یا زمان‌بندی کن.</p>
        </div>
        <div className={connection ? "instagram-connection-status connected" : "instagram-connection-status"}>
          {loading ? "در حال بررسی..." : connection ? `متصل به @${connection.username}` : "حساب متصل نیست"}
        </div>
      </div>

      <div className="instagram-integration-actions">
        {!connection ? (
          <button type="button" className="primary-button" onClick={connectAccount} disabled={busy || loading}>
            {busy ? "در حال اتصال..." : "اتصال حساب حرفه‌ای اینستاگرام"}
          </button>
        ) : (
          <>
            <span className="instagram-connected-name" dir="ltr">@{connection.username}</span>
            <button type="button" className="secondary-button" onClick={() => void loadWorkspace()} disabled={busy || loading}>به‌روزرسانی وضعیت</button>
            <button type="button" className="secondary-button" onClick={disconnectAccount} disabled={busy}>قطع اتصال</button>
          </>
        )}
      </div>

      {connection && (
        <div className="instagram-publish-form">
          <div className="instagram-publish-type" role="group" aria-label="نوع رسانه">
            <button type="button" className={mediaType === "image" ? "active" : ""} onClick={() => { setMediaType("image"); setMediaFile(null); setMediaPath(""); setRequestId(""); }} disabled={busy}>پست تصویر</button>
            <button type="button" className={mediaType === "reel" ? "active" : ""} onClick={() => { setMediaType("reel"); setMediaFile(null); setMediaPath(""); setRequestId(""); }} disabled={busy}>ریلز</button>
          </div>
          <label className="instagram-upload-label">
            {mediaType === "image" ? "انتخاب تصویر JPEG (حداکثر ۸ مگابایت)" : "انتخاب ویدئوی MP4 (حداکثر ۵۰ مگابایت)"}
            <input
              type="file"
              accept={mediaType === "image" ? "image/jpeg" : "video/mp4"}
              onChange={(event) => {
                setMediaFile(event.target.files?.[0] || null);
                setMediaPath("");
                setRequestId(crypto.randomUUID());
              }}
              disabled={busy}
            />
          </label>
          {mediaFile && <span className="instagram-file-name">{mediaFile.name} · {(mediaFile.size / (1024 * 1024)).toFixed(1)} MB</span>}
          <JalaliDateTimePicker value={scheduleAt} onChange={setScheduleAt} label="زمان انتشار خودکار (اختیاری)" />
          <label>
            کپشن اینستاگرام
            <textarea rows={4} maxLength={2200} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="متن کپشن، هشتگ‌ها و دعوت به اقدام..." disabled={busy} />
            <small>{caption.length.toLocaleString("fa-IR")} / ۲۲۰۰ نویسه</small>
          </label>
          <div className="instagram-publish-buttons">
            <button type="button" className="primary-button" onClick={publishNow} disabled={busy || !mediaFile}>
              {busy ? "در حال انجام..." : "انتشار فوری"}
            </button>
            <button type="button" className="secondary-button" onClick={schedulePost} disabled={busy || !mediaFile || !scheduleAt}>
              زمان‌بندی انتشار
            </button>
          </div>
        </div>
      )}

      {notice && <p className="instagram-notice" role="status" aria-live="polite">{notice}</p>}

      <p className="privacy-note">رسانه‌ها در فضای خصوصی ذخیره می‌شوند و فقط هنگام انتشار، لینک کوتاه‌عمر برای دریافت توسط Meta ساخته می‌شود. فقط فایل‌هایی را منتشر کن که مجوز استفاده از آن‌ها را داری.</p>

      {connection && (
        <div className="instagram-publish-history">
          <h3>آخرین انتشارها و زمان‌بندی‌ها</h3>
          {jobs.length === 0 ? (
            <p className="privacy-note">هنوز محتوایی از طریق اینستاگرام منتشر یا زمان‌بندی نشده است.</p>
          ) : (
            <ul>
              {jobs.map((job) => (
                <li key={job.id}>
                  <span className={`instagram-job-status ${job.status}`}>
                    {job.status === "published" ? "منتشر شد" : job.status === "failed" ? "ناموفق" : job.status === "queued" ? "زمان‌بندی شد" : "در حال انتشار"}
                  </span>
                  <span>{job.media_type === "reel" ? "ریلز" : "تصویر"} · {new Date(job.scheduled_at || job.created_at).toLocaleString("fa-IR")}</span>
                  <small>{job.caption || "بدون کپشن"}</small>
                  {job.error_message && <small className="instagram-job-error">{job.error_message}</small>}
                  {job.published_media_id && <small>شناسه رسانه: {job.published_media_id}</small>}
                  {job.status === "queued" && <button type="button" className="instagram-cancel-schedule" onClick={() => void cancelScheduled(job.id)}>لغو زمان‌بندی</button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
