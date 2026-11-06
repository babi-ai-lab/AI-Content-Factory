"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { calculateCampaignMetrics, parseCampaignMetric } from "@/lib/campaign-metrics.mjs";

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
  currency_label: string;
  budget_amount: number;
  spend_amount: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  revenue_amount: number;
  created_at: string;
};

type CampaignComparisonEntry = {
  campaign: Campaign;
  metrics: ReturnType<typeof calculateCampaignMetrics>;
};

type CampaignMetricsDraft = {
  currency_label: string;
  budget_amount: string;
  spend_amount: string;
  impressions: string;
  clicks: string;
  leads: string;
  conversions: string;
  revenue_amount: string;
};

function toMetricsDraft(campaign: Campaign): CampaignMetricsDraft {
  return {
    currency_label: campaign.currency_label || "",
    budget_amount: String(campaign.budget_amount ?? 0),
    spend_amount: String(campaign.spend_amount ?? 0),
    impressions: String(campaign.impressions ?? 0),
    clicks: String(campaign.clicks ?? 0),
    leads: String(campaign.leads ?? 0),
    conversions: String(campaign.conversions ?? 0),
    revenue_amount: String(campaign.revenue_amount ?? 0),
  };
}

function formatMetricValue(value: number | null, suffix = "") {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(value)}${suffix}`;
}

function formatMetricAmount(value: number | null, currency: string) {
  if (value === null) return "—";
  const formatted = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(value);
  return currency ? `${formatted} ${currency}` : formatted;
}
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
  const [selectedComparisonIds, setSelectedComparisonIds] = useState<string[]>([]);
  const [metricsDrafts, setMetricsDrafts] = useState<Record<string, CampaignMetricsDraft>>({});
  const [savingMetricsId, setSavingMetricsId] = useState<string | null>(null);
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
  const loadedUserIdRef = useRef<string | null>(null);

  const selectedCampaigns = campaigns.filter((campaign) => selectedComparisonIds.includes(campaign.id));
  const comparisonData: CampaignComparisonEntry[] = selectedCampaigns.map((campaign) => ({
    campaign,
    metrics: calculateCampaignMetrics({
      impressions: campaign.impressions,
      clicks: campaign.clicks,
      leads: campaign.leads,
      conversions: campaign.conversions,
      budget: campaign.budget_amount,
      spend: campaign.spend_amount,
      revenue: campaign.revenue_amount,
    }),
  }));
  const comparisonRows: { label: string; value: (entry: CampaignComparisonEntry) => string }[] = [
    { label: "وضعیت", value: (entry) => statusLabels[entry.campaign.status] },
    { label: "بودجه", value: (entry) => formatMetricAmount(entry.campaign.budget_amount, entry.campaign.currency_label) },
    { label: "هزینه واقعی", value: (entry) => formatMetricAmount(entry.campaign.spend_amount, entry.campaign.currency_label) },
    { label: "درآمد", value: (entry) => formatMetricAmount(entry.campaign.revenue_amount, entry.campaign.currency_label) },
    { label: "نمایش", value: (entry) => formatMetricValue(entry.campaign.impressions) },
    { label: "کلیک", value: (entry) => formatMetricValue(entry.campaign.clicks) },
    { label: "سرنخ", value: (entry) => formatMetricValue(entry.campaign.leads) },
    { label: "تبدیل", value: (entry) => formatMetricValue(entry.campaign.conversions) },
    { label: "نرخ کلیک (CTR)", value: (entry) => formatMetricValue(entry.metrics.ctr, "٪") },
    { label: "هزینه هر سرنخ (CPL)", value: (entry) => formatMetricAmount(entry.metrics.cpl, entry.campaign.currency_label) },
    { label: "هزینه هر تبدیل (CPA)", value: (entry) => formatMetricAmount(entry.metrics.cpa, entry.campaign.currency_label) },
    { label: "نرخ تبدیل", value: (entry) => formatMetricValue(entry.metrics.conversionRate, "٪") },
    { label: "مصرف بودجه", value: (entry) => formatMetricValue(entry.metrics.budgetUtilization, "٪") },
    { label: "بازده هزینه تبلیغ (ROAS)", value: (entry) => formatMetricValue(entry.metrics.roas, "×") },
  ];

  function toggleCampaignComparison(campaignId: string, checked: boolean) {
    if (checked && !selectedComparisonIds.includes(campaignId) && selectedComparisonIds.length >= 4) {
      setNotice("برای مقایسه هم‌زمان حداکثر ۴ کمپین را انتخاب کن.");
      return;
    }
    setSelectedComparisonIds((current) => checked
      ? Array.from(new Set([...current, campaignId])).slice(0, 4)
      : current.filter((id) => id !== campaignId));
  }



  const loadCampaigns = useCallback(async () => {
    if (loadedUserIdRef.current !== userId) {
      loadedUserIdRef.current = userId;
      setMetricsDrafts({});
      setSelectedContentByCampaign({});
      setExpandedId(null);
      setSelectedComparisonIds([]);
    }
    setLoading(true);
    setError("");
    setCampaigns([]);
    setContentLinks([]);
    setContentOptions([]);
    const [campaignResult, linkResult, contentResult] = await Promise.all([
      supabase
        .from("marketing_campaigns")
        .select("id,name,goal,audience,channels,status,stages,currency_label,budget_amount,spend_amount,impressions,clicks,leads,conversions,revenue_amount,created_at")
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

    const loadedCampaigns = (campaignResult.data || []) as Campaign[];
    setCampaigns(loadedCampaigns);
    setMetricsDrafts((current) => {
      const next = { ...current };
      for (const campaign of loadedCampaigns) {
        if (!next[campaign.id]) next[campaign.id] = toMetricsDraft(campaign);
      }
      return next;
    });
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
      .select("id,name,goal,audience,channels,status,stages,currency_label,budget_amount,spend_amount,impressions,clicks,leads,conversions,revenue_amount,created_at")
      .single();
    if (insertError) {
      setError("ساخت کمپین انجام نشد: " + insertError.message);
    } else if (data) {
      setCampaigns((current) => [data as Campaign, ...current]);
      setMetricsDrafts((current) => ({ ...current, [data.id]: toMetricsDraft(data as Campaign) }));
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

  function updateMetricsDraft(id: string, key: keyof CampaignMetricsDraft, value: string) {
    setMetricsDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] || {} as CampaignMetricsDraft), [key]: value },
    }));
  }

  async function saveCampaignMetrics(campaign: Campaign) {
    const draft = metricsDrafts[campaign.id] || toMetricsDraft(campaign);
    const budget = parseCampaignMetric(draft.budget_amount);
    const spend = parseCampaignMetric(draft.spend_amount);
    const impressions = parseCampaignMetric(draft.impressions, { integer: true });
    const clicks = parseCampaignMetric(draft.clicks, { integer: true });
    const leads = parseCampaignMetric(draft.leads, { integer: true });
    const conversions = parseCampaignMetric(draft.conversions, { integer: true });
    const revenue = parseCampaignMetric(draft.revenue_amount);

    if ([budget, spend, impressions, clicks, leads, conversions, revenue].some((value) => value === null)) {
      setError("مقادیر عملکرد باید عددی و نامنفی باشند؛ تعداد نمایش، کلیک، سرنخ و تبدیل باید عدد صحیح باشد.");
      return;
    }
    const currency = draft.currency_label.trim();
    if (currency.length > 20) {
      setError("واحد پول نباید بیشتر از ۲۰ کاراکتر باشد.");
      return;
    }

    setSavingMetricsId(campaign.id);
    setError("");
    setNotice("");
    const changes = {
      currency_label: currency,
      budget_amount: budget as number,
      spend_amount: spend as number,
      impressions: impressions as number,
      clicks: clicks as number,
      leads: leads as number,
      conversions: conversions as number,
      revenue_amount: revenue as number,
    };
    const { data, error: updateError } = await supabase
      .from("marketing_campaigns")
      .update(changes)
      .eq("id", campaign.id)
      .eq("user_id", userId)
      .select("id,name,goal,audience,channels,status,stages,currency_label,budget_amount,spend_amount,impressions,clicks,leads,conversions,revenue_amount,created_at")
      .single();

    if (updateError || !data) {
      setError("ذخیره نتایج کمپین انجام نشد: " + (updateError?.message || "خطای نامشخص"));
    } else {
      const updated = data as Campaign;
      setCampaigns((current) => current.map((item) => item.id === campaign.id ? updated : item));
      setMetricsDrafts((current) => ({ ...current, [campaign.id]: toMetricsDraft(updated) }));
      setNotice("نتایج کمپین ذخیره شد؛ شاخص‌ها بر اساس داده‌های واردشده محاسبه شدند.");
    }
    setSavingMetricsId(null);
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
    setSelectedComparisonIds((current) => current.filter((id) => id !== campaign.id));
    setMetricsDrafts((current) => {
      const next = { ...current };
      delete next[campaign.id];
      return next;
    });
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
    <section id="campaign-manager" className="campaign-section" aria-labelledby="campaign-title">
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

      {selectedCampaigns.length > 0 && (
        <section className="campaign-comparison" aria-label="مقایسه عملکرد کمپین‌ها">
          <div className="campaign-comparison-heading">
            <div>
              <h3>مقایسه عملکرد کمپین‌ها</h3>
              <p>{selectedCampaigns.length.toLocaleString("fa-IR")} از ۴ کمپین انتخاب شده</p>
            </div>
            <button type="button" className="history-backup" onClick={() => setSelectedComparisonIds([])}>پاک کردن انتخاب‌ها</button>
          </div>
          {selectedCampaigns.length < 2 ? (
            <p className="campaign-comparison-hint">برای مشاهده گزارش مقایسه‌ای، حداقل یک کمپین دیگر را انتخاب کن.</p>
          ) : (
            <div className="campaign-comparison-scroll">
              <table className="campaign-comparison-table">
                <thead>
                  <tr>
                    <th scope="col">شاخص</th>
                    {comparisonData.map((entry) => <th scope="col" key={entry.campaign.id}>{entry.campaign.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      {comparisonData.map((entry) => <td key={entry.campaign.id}>{row.value(entry)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

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
                    <label className="campaign-compare-toggle">
                      <input
                        type="checkbox"
                        checked={selectedComparisonIds.includes(campaign.id)}
                        onChange={(event) => toggleCampaignComparison(campaign.id, event.target.checked)}
                        aria-label={`افزودن ${campaign.name} به مقایسه`}
                      />
                      <span>مقایسه</span>
                    </label>
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

                      <div className="campaign-performance">
                        <div className="campaign-content-heading">
                          <h4>ثبت و تحلیل عملکرد کمپین</h4>
                          <span>ورود دستی داده‌ها</span>
                        </div>
                        <p className="campaign-performance-note">آمار را پس از اجرای کمپین وارد کن؛ شاخص‌ها بعد از ذخیره به‌روزرسانی می‌شوند. این بخش به شبکه‌های اجتماعی متصل نیست و داده‌ای را خودکار دریافت نمی‌کند.</p>
                        {(() => {
                          const draft = metricsDrafts[campaign.id] || toMetricsDraft(campaign);
                          const kpis = calculateCampaignMetrics({
                            impressions: campaign.impressions,
                            clicks: campaign.clicks,
                            budget: campaign.budget_amount,
                            leads: campaign.leads,
                            conversions: campaign.conversions,
                            spend: campaign.spend_amount,
                            revenue: campaign.revenue_amount,
                          });
                          return (
                            <>
                              <div className="campaign-metrics-form">
                                <label>واحد پول (اختیاری)<input value={draft.currency_label} onChange={(event) => updateMetricsDraft(campaign.id, "currency_label", event.target.value)} maxLength={20} placeholder="مثلاً تومان یا USD" /></label>
                                <label>بودجه برنامه‌ریزی‌شده<input inputMode="decimal" value={draft.budget_amount} onChange={(event) => updateMetricsDraft(campaign.id, "budget_amount", event.target.value)} placeholder="۰" /></label>
                                <label>هزینه واقعی<input inputMode="decimal" value={draft.spend_amount} onChange={(event) => updateMetricsDraft(campaign.id, "spend_amount", event.target.value)} placeholder="۰" /></label>
                                <label>نمایش‌ها<input inputMode="numeric" value={draft.impressions} onChange={(event) => updateMetricsDraft(campaign.id, "impressions", event.target.value)} placeholder="۰" /></label>
                                <label>کلیک‌ها<input inputMode="numeric" value={draft.clicks} onChange={(event) => updateMetricsDraft(campaign.id, "clicks", event.target.value)} placeholder="۰" /></label>
                                <label>سرنخ‌ها<input inputMode="numeric" value={draft.leads} onChange={(event) => updateMetricsDraft(campaign.id, "leads", event.target.value)} placeholder="۰" /></label>
                                <label>تبدیل‌ها<input inputMode="numeric" value={draft.conversions} onChange={(event) => updateMetricsDraft(campaign.id, "conversions", event.target.value)} placeholder="۰" /></label>
                                <label>درآمد منتسب<input inputMode="decimal" value={draft.revenue_amount} onChange={(event) => updateMetricsDraft(campaign.id, "revenue_amount", event.target.value)} placeholder="۰" /></label>
                              </div>
                              <button type="button" className="primary-button" disabled={savingMetricsId === campaign.id} onClick={() => void saveCampaignMetrics(campaign)}>
                                {savingMetricsId === campaign.id ? "در حال ذخیره..." : "ذخیره نتایج کمپین"}
                              </button>
                              <div className="campaign-kpi-grid">
                                <div><small>نرخ کلیک (CTR)</small><strong>{formatMetricValue(kpis.ctr, "٪")}</strong></div>
                                <div><small>هزینه هر سرنخ (CPL)</small><strong>{formatMetricAmount(kpis.cpl, campaign.currency_label)}</strong></div>
                                <div><small>هزینه هر تبدیل (CPA)</small><strong>{formatMetricAmount(kpis.cpa, campaign.currency_label)}</strong></div>
                                <div><small>نرخ تبدیل کلیک</small><strong>{formatMetricValue(kpis.conversionRate, "٪")}</strong></div>
                                <div><small>مصرف بودجه</small><strong>{formatMetricValue(kpis.budgetUtilization, "٪")}</strong></div>
                                <div><small>بازده هزینه تبلیغ (ROAS)</small><strong>{formatMetricValue(kpis.roas, "×")}</strong></div>
                              </div>
                            </>
                          );
                        })()}
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
