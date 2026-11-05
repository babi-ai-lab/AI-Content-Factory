"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type CampaignStatus = "draft" | "active" | "paused" | "completed";
type CampaignStage = { id: string; title: string; done: boolean };
type Campaign = {
  id: string;
  name: string;
  goal: string;
  audience: string;
  channels: string[];
  status: CampaignStatus;
  stages: CampaignStage[];
  created_at: string;
};
type ContentOption = {
  id: string;
  product: Record<string, unknown>;
  created_at: string;
};
type CampaignContentLink = {
  id: string;
  campaign_id: string;
  content_id: string;
  notes: string;
  created_at: string;
};

const defaultStages: CampaignStage[] = [
  { id: "brief", title: "تعیین هدف، پیشنهاد و پیام اصلی", done: false },
  { id: "plan", title: "طراحی برنامه و تقویم محتوا", done: false },
  { id: "produce", title: "تولید متن و محتوای کمپین", done: false },
  { id: "review", title: "بازبینی و تأیید محتوا", done: false },
  { id: "publish", title: "انتشار در کانال‌های انتخاب‌شده", done: false },
  { id: "measure", title: "بررسی نتایج و جمع‌بندی", done: false },
];

const statusLabels: Record<CampaignStatus, string> = {
  draft: "پیش‌نویس",
  active: "در حال اجرا",
  paused: "متوقف‌شده",
  completed: "تکمیل‌شده",
};

function formatCampaignDate(value: string) {
  return new Date(value).toLocaleDateString("fa-IR-u-ca-persian", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function getContentTitle(option: ContentOption) {
  const product = option.product || {};
  for (const key of ["name", "businessName", "category"]) {
    const value = product[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "محتوای ذخیره‌شده";
}

export default function CampaignManager({ userId, onUseCampaign, refreshKey = 0 }: { userId: string; refreshKey?: number; onUseCampaign?: (campaign: Pick<Campaign, "id" | "name" | "goal" | "audience" | "channels">) => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contentOptions, setContentOptions] = useState<ContentOption[]>([]);
  const [contentLinks, setContentLinks] = useState<CampaignContentLink[]>([]);
  const [selectedContentByCampaign, setSelectedContentByCampaign] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linkingCampaignId, setLinkingCampaignId] = useState<string | null>(null);
  const [removingLinkId, setRemovingLinkId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [channels, setChannels] = useState("تلگرام، وب‌سایت، پیامک");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError("");
    const [campaignResult, linkResult, contentResult] = await Promise.all([
      supabase
        .from("marketing_campaigns")
        .select("id,name,goal,audience,channels,status,stages,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("marketing_campaign_content")
        .select("id,campaign_id,content_id,notes,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("content_history")
        .select("id,product,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (campaignResult.error || linkResult.error || contentResult.error) {
      const failure = campaignResult.error || linkResult.error || contentResult.error;
      setError("بارگذاری کمپین‌ها یا محتواهای مرتبط انجام نشد: " + (failure?.message || "خطای نامشخص"));
      setCampaigns([]);
      setContentLinks([]);
      setContentOptions([]);
      setLoading(false);
      return;
    }

    const links = (linkResult.data || []) as CampaignContentLink[];
    const recentContent = (contentResult.data || []) as ContentOption[];
    const recentIds = new Set(recentContent.map((item) => item.id));
    const missingLinkedIds = Array.from(new Set(links.map((link) => link.content_id)))
      .filter((id) => !recentIds.has(id));

    let allContent = recentContent;
    if (missingLinkedIds.length) {
      const { data: linkedContent, error: linkedContentError } = await supabase
        .from("content_history")
        .select("id,product,created_at")
        .eq("user_id", userId)
        .in("id", missingLinkedIds);
      if (!linkedContentError && linkedContent) {
        allContent = [...recentContent, ...(linkedContent as ContentOption[])];
      }
    }

    setCampaigns((campaignResult.data || []) as Campaign[]);
    setContentLinks(links);
    setContentOptions(allContent);
    setLoading(false);
  }, [userId, refreshKey]);

  useEffect(() => { void loadCampaigns(); }, [loadCampaigns]);

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !goal.trim()) {
      setError("نام کمپین و هدف آن را وارد کن.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const selectedChannels = Array.from(new Set(channels.split(/[،,]/).map((item) => item.trim()).filter(Boolean))).slice(0, 8);
    const { data, error: insertError } = await supabase
      .from("marketing_campaigns")
      .insert({
        user_id: userId,
        name: name.trim().slice(0, 120),
        goal: goal.trim().slice(0, 500),
        audience: audience.trim().slice(0, 500),
        channels: selectedChannels,
        status: "draft",
        stages: defaultStages,
      })
      .select("id,name,goal,audience,channels,status,stages,created_at")
      .single();
    if (insertError) {
      setError("ساخت کمپین انجام نشد: " + insertError.message);
    } else if (data) {
      setCampaigns((current) => [data as Campaign, ...current]);
      setName("");
      setGoal("");
      setAudience("");
      setNotice("کمپین جدید ساخته شد. حالا می‌توانی محتواهای ذخیره‌شده را به آن متصل کنی.");
      setExpandedId(data.id);
    }
    setSaving(false);
  }

  async function updateCampaign(id: string, changes: Partial<Pick<Campaign, "status" | "stages">>) {
    setError("");
    const { error: updateError } = await supabase
      .from("marketing_campaigns")
      .update(changes)
      .eq("id", id)
      .eq("user_id", userId);
    if (updateError) {
      setError("ذخیره تغییرات کمپین انجام نشد: " + updateError.message);
      return;
    }
    setCampaigns((current) => current.map((campaign) => campaign.id === id ? { ...campaign, ...changes } : campaign));
  }

  async function addContentToCampaign(campaignId: string) {
    const contentId = selectedContentByCampaign[campaignId];
    if (!contentId) {
      setError("ابتدا یک محتوای ذخیره‌شده انتخاب کن.");
      return;
    }
    setLinkingCampaignId(campaignId);
    setError("");
    setNotice("");
    const { data, error: insertError } = await supabase
      .from("marketing_campaign_content")
      .insert({ user_id: userId, campaign_id: campaignId, content_id: contentId })
      .select("id,campaign_id,content_id,notes,created_at")
      .single();

    if (insertError) {
      setError(insertError.code === "23505"
        ? "این محتوا قبلاً به همین کمپین اضافه شده است."
        : "اتصال محتوا به کمپین انجام نشد: " + insertError.message);
    } else if (data) {
      setContentLinks((current) => [data as CampaignContentLink, ...current]);
      setSelectedContentByCampaign((current) => ({ ...current, [campaignId]: "" }));
      setNotice("محتوا به کمپین اضافه شد.");
    }
    setLinkingCampaignId(null);
  }

  async function removeContentLink(link: CampaignContentLink) {
    setRemovingLinkId(link.id);
    setError("");
    const { error: deleteError } = await supabase
      .from("marketing_campaign_content")
      .delete()
      .eq("id", link.id)
      .eq("user_id", userId);
    if (deleteError) {
      setError("حذف ارتباط محتوا با کمپین انجام نشد: " + deleteError.message);
    } else {
      setContentLinks((current) => current.filter((item) => item.id !== link.id));
      setNotice("ارتباط محتوا با کمپین حذف شد؛ خود محتوا در تاریخچه باقی می‌ماند.");
    }
    setRemovingLinkId(null);
  }

  async function deleteCampaign(campaign: Campaign) {
    if (!window.confirm(`کمپین «${campaign.name}» حذف شود؟ این عملیات قابل بازگشت نیست.`)) return;
    const { error: deleteError } = await supabase
      .from("marketing_campaigns")
      .delete()
      .eq("id", campaign.id)
      .eq("user_id", userId);
    if (deleteError) {
      setError("حذف کمپین انجام نشد: " + deleteError.message);
      return;
    }
    setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
    setContentLinks((current) => current.filter((item) => item.campaign_id !== campaign.id));
    setNotice("کمپین حذف شد. محتواهای ذخیره‌شده حذف نشده‌اند.");
  }

  function toggleStage(campaign: Campaign, stageId: string) {
    const stages = campaign.stages.map((stage) =>
      stage.id === stageId ? { ...stage, done: !stage.done } : stage
    );
    void updateCampaign(campaign.id, { stages });
  }

  return (
    <section className="campaign-section" aria-labelledby="campaign-title">
      <div className="campaign-heading">
        <div>
          <span className="step">مدیریت بازاریابی</span>
          <h2 id="campaign-title">کمپین‌های بازاریابی</h2>
          <p>برای هر هدف بازاریابی یک کمپین بساز و مسیر اجرا را از برنامه‌ریزی تا تحلیل نتیجه دنبال کن؛ مستقل از اتصال شبکه‌های اجتماعی.</p>
        </div>
        <div className="campaign-count"><strong>{campaigns.length.toLocaleString("fa-IR")}</strong><span>کمپین ثبت‌شده</span></div>
      </div>

      <form className="campaign-form" onSubmit={createCampaign}>
        <h3>ساخت کمپین جدید</h3>
        <div className="campaign-form-grid">
          <label>نام کمپین<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="مثلاً کمپین معرفی خدمات پاییز" required /></label>
          <label>هدف اصلی<input value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={500} placeholder="مثلاً دریافت درخواست مشاوره یا افزایش فروش" required /></label>
          <label>مخاطب هدف<input value={audience} onChange={(event) => setAudience(event.target.value)} maxLength={500} placeholder="مثلاً صاحبان کسب‌وکارهای کوچک در تهران" /></label>
          <label>کانال‌های بازاریابی<input value={channels} onChange={(event) => setChannels(event.target.value)} maxLength={300} placeholder="تلگرام، وب‌سایت، پیامک" /><small>نام کانال‌ها را با ویرگول جدا کن.</small></label>
        </div>
        <button className="primary-button" type="submit" disabled={saving}>{saving ? "در حال ذخیره..." : "ساخت کمپین"}</button>
      </form>

      {error && <p className="campaign-message error" role="alert">{error}</p>}
      {notice && <p className="campaign-message success" role="status">{notice}</p>}

      {loading ? <div className="campaign-empty">در حال بارگذاری کمپین‌ها...</div> :
        campaigns.length === 0 ? (
          <div className="campaign-empty">هنوز کمپینی نساخته‌ای. اولین کمپین را از فرم بالا ایجاد کن.</div>
        ) : (
          <div className="campaign-list">
            {campaigns.map((campaign) => {
              const completed = campaign.stages.filter((stage) => stage.done).length;
              const progress = campaign.stages.length ? Math.round((completed / campaign.stages.length) * 100) : 0;
              const expanded = expandedId === campaign.id;
              const linked = contentLinks.filter((link) => link.campaign_id === campaign.id);
              const linkedIds = new Set(linked.map((link) => link.content_id));
              const available = contentOptions.filter((option) => !linkedIds.has(option.id));
              return (
                <article className="campaign-card" key={campaign.id}>
                  <div className="campaign-card-top">
                    <div className="campaign-card-main">
                      <h3>{campaign.name}</h3>
                      <p>{campaign.goal}</p>
                      <small>مخاطب: {campaign.audience || "هنوز مشخص نشده"} · کانال‌ها: {campaign.channels.join("، ") || "مشخص نشده"}</small>
                    </div>
                    <select aria-label={`وضعیت کمپین ${campaign.name}`} value={campaign.status} onChange={(event) => void updateCampaign(campaign.id, { status: event.target.value as CampaignStatus })}>
                      {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <div className="campaign-progress-line">
                    <div className="campaign-progress-track"><span style={{ width: `${progress}%` }} /></div>
                    <b>{progress.toLocaleString("fa-IR")}٪</b>
                    <small>{completed.toLocaleString("fa-IR")} از {campaign.stages.length.toLocaleString("fa-IR")} مرحله</small>
                  </div>
                  <div className="campaign-card-actions">
                    <span>ایجاد: {formatCampaignDate(campaign.created_at)} · {linked.length.toLocaleString("fa-IR")} محتوای مرتبط</span>
                    {onUseCampaign && (
                      <button type="button" className="history-open" onClick={() => onUseCampaign({ id: campaign.id, name: campaign.name, goal: campaign.goal, audience: campaign.audience, channels: campaign.channels })}>
                        تولید محتوا برای این کمپین
                      </button>
                    )}
                    <button type="button" className="history-open" onClick={() => setExpandedId(expanded ? null : campaign.id)}>{expanded ? "بستن جزئیات" : "مدیریت محتوا و مراحل"}</button>
                    <button type="button" className="campaign-delete" onClick={() => void deleteCampaign(campaign)}>حذف کمپین</button>
                  </div>
                  {expanded && (
                    <div className="campaign-expanded">
                      <div className="campaign-stages">
                        <h4>مراحل اجرای کمپین</h4>
                        {campaign.stages.map((stage) => (
                          <label className={stage.done ? "campaign-stage done" : "campaign-stage"} key={stage.id}>
                            <input type="checkbox" checked={stage.done} onChange={() => toggleStage(campaign, stage.id)} />
                            <span>{stage.title}</span>
                          </label>
                        ))}
                      </div>

                      <div className="campaign-content">
                        <div className="campaign-content-heading">
                          <h4>محتواهای مرتبط با کمپین</h4>
                          <span>{linked.length.toLocaleString("fa-IR")} مورد</span>
                        </div>
                        {linked.length > 0 ? (
                          <div className="campaign-linked-list">
                            {linked.map((link) => {
                              const option = contentOptions.find((item) => item.id === link.content_id);
                              return (
                                <div className="campaign-linked-item" key={link.id}>
                                  <div className="campaign-link-copy">
                                    <strong>{option ? getContentTitle(option) : "محتوای مرتبط"}</strong>
                                    <small>{option ? formatCampaignDate(option.created_at) : "تاریخچه محتوا"}</small>
                                  </div>
                                  <button type="button" className="campaign-unlink" disabled={removingLinkId === link.id} onClick={() => void removeContentLink(link)}>
                                    {removingLinkId === link.id ? "در حال حذف..." : "حذف ارتباط"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="campaign-content-empty">هنوز محتوایی به این کمپین متصل نشده است.</p>
                        )}
                        <div className="campaign-content-add">
                          <select
                            aria-label={`انتخاب محتوا برای کمپین ${campaign.name}`}
                            value={selectedContentByCampaign[campaign.id] || ""}
                            onChange={(event) => setSelectedContentByCampaign((current) => ({ ...current, [campaign.id]: event.target.value }))}
                          >
                            <option value="">انتخاب از تاریخچه محتوا</option>
                            {available.map((option) => (
                              <option key={option.id} value={option.id}>{getContentTitle(option)} · {formatCampaignDate(option.created_at)}</option>
                            ))}
                          </select>
                          <button type="button" className="primary-button" disabled={!selectedContentByCampaign[campaign.id] || linkingCampaignId === campaign.id} onClick={() => void addContentToCampaign(campaign.id)}>
                            {linkingCampaignId === campaign.id ? "در حال اتصال..." : "افزودن محتوا"}
                          </button>
                        </div>
                        {contentOptions.length === 0 && <small className="campaign-content-hint">برای افزودن محتوا، ابتدا از بخش تولید محتوا یک خروجی را ذخیره کن.</small>}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
    </section>
  );
}
