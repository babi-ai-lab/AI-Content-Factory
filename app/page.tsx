"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";
import { analyzeContent } from "@/lib/content-quality.mjs";
import JalaliDateTimePicker from "@/components/jalali-date-time-picker";
import MonthlyContentCalendar from "@/components/monthly-content-calendar";
import CampaignManager from "@/components/campaign-manager";
import PublicLanding from "@/components/public-landing";
import MediaStudio from "@/components/media-studio";
import { canAddBrandProfile, createBrandProfileEntry, normalizeBrandProfileEntries } from "@/lib/brand-profiles.mjs";
import { CONTENT_REVIEW_STATUSES, getContentReviewStatusLabel, normalizeContentReviewStatus } from "@/lib/content-approval.mjs";
import type { ContentReviewStatus } from "@/lib/content-approval.mjs";

type BusinessType =
  | "retail"
  | "services"
  | "restaurant"
  | "real_estate"
  | "construction"
  | "education"
  | "fitness"
  | "personal_brand"
  | "other";

type ContentTemplateId =
  | "balanced"
  | "educational"
  | "product_launch"
  | "customer_story"
  | "faq"
  | "limited_offer"
  | "lead_generation"
  | "brand_awareness"
  | "before_after"
  | "problem_solution";

type ContentChannel =
  | "general"
  | "telegram"
  | "bale"
  | "sms"
  | "website"
  | "email"
  | "instagram"
  | "linkedin"
  | "youtube";

const contentTemplates: { value: ContentTemplateId; label: string; description: string }[] = [
  { value: "balanced", label: "متعادل و عمومی", description: "بسته کامل و متوازن برای معرفی و بازاریابی" },
  { value: "educational", label: "آموزشی و ارزش‌آفرین", description: "آموزش نکته کاربردی و انتقال تخصص" },
  { value: "product_launch", label: "معرفی محصول یا خدمت", description: "معرفی ویژگی‌ها و مزیت‌های واقعی" },
  { value: "customer_story", label: "داستان و تجربه مشتری", description: "اعتمادسازی فقط با تجربه واقعی ارائه‌شده" },
  { value: "faq", label: "پرسش و پاسخ", description: "پاسخ به پرسش‌های متداول مخاطب" },
  { value: "limited_offer", label: "پیشنهاد ویژه و فروش", description: "تمرکز بر پیشنهاد واقعی بدون ساخت تخفیف" },
  { value: "lead_generation", label: "جذب سرنخ و مشاوره", description: "ترغیب مخاطب به تماس یا درخواست مشاوره" },
  { value: "brand_awareness", label: "آگاهی از برند", description: "معرفی هویت، ارزش و تمایز برند" },
  { value: "before_after", label: "قبل و بعد", description: "نمایش تغییر فقط بر اساس اطلاعات واقعی" },
  { value: "problem_solution", label: "مسئله و راه‌حل", description: "توضیح مسئله مخاطب و راه‌حل کسب‌وکار" },
];

const contentChannels: { value: ContentChannel; label: string }[] = [
  { value: "general", label: "عمومی و چندمنظوره" },
  { value: "telegram", label: "کانال تلگرام" },
  { value: "bale", label: "کانال بله" },
  { value: "sms", label: "پیامک تبلیغاتی" },
  { value: "website", label: "وب‌سایت و سئو" },
  { value: "email", label: "ایمیل" },
  { value: "instagram", label: "متن اینستاگرام" },
  { value: "linkedin", label: "لینکدین" },
  { value: "youtube", label: "یوتیوب" },
];

type Product = {
  businessType: BusinessType;
  contentTemplate: ContentTemplateId;
  channel: ContentChannel;
  businessName: string;
  name: string;
  price: string;
  category: string;
  fabric: string;
  colors: string;
  features: string;
  audience: string;
  goal: string;
  tone: string;
  serviceArea: string;
  offer: string;
  differentiators: string;
  additionalInfo: string;
  _factoryMeta?: {
    tags: string[];
    folder: string;
    favorite: boolean;
    scheduledAt?: string;
    reviewStatus?: ContentReviewStatus;
    reviewUpdatedAt?: string;
    reviewNote?: string;
    versionNotes?: Record<string, string>;
  };
};

type BrandProfile = {
  brandName: string;
  tagline: string;
  audience: string;
  valueProposition: string;
  voice: string;
  preferredTerms: string;
  avoidTerms: string;
  cta: string;
  verifiedFacts: string;
  proofPoints: string;
  faq: string;
  prohibitedClaims: string;
};

type BrandProfileEntry = { id: string; name: string; profile: BrandProfile };

const initialBrandProfile: BrandProfile = {
  brandName: "",
  tagline: "",
  audience: "",
  valueProposition: "",
  voice: "",
  preferredTerms: "",
  avoidTerms: "",
  cta: "",
  verifiedFacts: "",
  proofPoints: "",
  faq: "",
  prohibitedClaims: "",
};

function normalizeBrandProfile(value: unknown): BrandProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return initialBrandProfile;
  }

  const input = value as Record<string, unknown>;
  const limits: Record<keyof BrandProfile, number> = {
    brandName: 120,
    tagline: 160,
    audience: 200,
    valueProposition: 320,
    voice: 120,
    preferredTerms: 300,
    avoidTerms: 300,
    cta: 180,
    verifiedFacts: 2000,
    proofPoints: 1200,
    faq: 2000,
    prohibitedClaims: 1200,
  };

  return Object.fromEntries(
    Object.entries(limits).map(([key, maxLength]) => {
      const fieldValue = input[key];
      return [
        key,
        typeof fieldValue === "string" ? fieldValue.trim().slice(0, maxLength) : "",
      ];
    })
  ) as BrandProfile;
}

function getBrandProfileContext(metadata: unknown): { profiles: BrandProfileEntry[]; active: BrandProfileEntry } {
  const data = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {};
  const profiles = normalizeBrandProfileEntries(
    data.aiContentFactoryBrandProfiles,
    data.aiContentFactoryBrandProfile,
  ).map((entry) => ({
    id: entry.id,
    name: entry.name,
    profile: normalizeBrandProfile(entry.profile),
  }));
  const requestedId = typeof data.aiContentFactoryActiveBrandProfileId === "string"
    ? data.aiContentFactoryActiveBrandProfileId
    : "";
  const active = profiles.find((entry) => entry.id === requestedId) || profiles[0];
  return { profiles, active };
}

const businessTypes: { value: BusinessType; label: string }[] = [
  { value: "retail", label: "فروشگاه و خرده‌فروشی" },
  { value: "services", label: "خدمات و مشاغل" },
  { value: "restaurant", label: "رستوران و کافه" },
  { value: "real_estate", label: "املاک" },
  { value: "construction", label: "ساختمان و بازسازی" },
  { value: "education", label: "آموزش و دوره‌های آموزشی" },
  { value: "fitness", label: "ورزش و تناسب اندام" },
  { value: "personal_brand", label: "برند شخصی" },
  { value: "other", label: "سایر کسب‌وکارها" },
];

function businessTypeLabel(value?: string) {
  return businessTypes.find((item) => item.value === value)?.label || "فروشگاه و خرده‌فروشی";
}

function contentChannelLabel(value?: string) {
  return contentChannels.find((item) => item.value === value)?.label || "عمومی و چندمنظوره";
}

function resolveContentChannel(value?: string): ContentChannel {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("تلگرام") || normalized.includes("telegram")) return "telegram";
  if (normalized.includes("بله") || normalized.includes("bale")) return "bale";
  if (normalized.includes("پیامک") || normalized.includes("sms")) return "sms";
  if (normalized.includes("وب‌سایت") || normalized.includes("وب سایت") || normalized.includes("سئو") || normalized.includes("website") || normalized.includes("seo")) return "website";
  if (normalized.includes("ایمیل") || normalized.includes("email")) return "email";
  if (normalized.includes("اینستاگرام") || normalized.includes("instagram")) return "instagram";
  if (normalized.includes("لینکدین") || normalized.includes("linkedin")) return "linkedin";
  if (normalized.includes("یوتیوب") || normalized.includes("youtube")) return "youtube";
  return "general";
}

function normalizeProduct(value: Partial<Product> | null | undefined): Product {
  return { ...initialProduct, ...(value || {}), businessType: value?.businessType || "retail", contentTemplate: value?.contentTemplate || "balanced", channel: value?.channel || "general", _factoryMeta: { tags: [], folder: "عمومی", favorite: false, scheduledAt: "", ...(value?._factoryMeta || {}) } };
}

type Content = {

  caption: string;

  reel: string;

  stories: string[];

  ad: string;

};

type HistoryItem = {

  id: string;

  createdAt: string;

  product: Product;

  content: Content;

};

type DbHistoryRow = {

  id: string;

  product: Product;

  content: Content;

  created_at: string;

};

type DbCalendarRow = {
  id: string;
  product: Product;
  content: Content;
  created_at: string;
  scheduled_at: string;
};

type ContentVersion = {
  id: string;
  historyId: string;
  createdAt: string;
  content: Content;
};

type DbContentVersionRow = {
  id: string;
  history_id: string;
  content: Content;
  created_at: string;
};

type AnalyticsSummary = {
  entries: { length: number };
  trend: { key: string; label: string; count: number }[];
  maxDaily: number;
  byBusiness: { label: string; count: number }[];
  formats: { label: string; count: number }[];
  totalPieces: number;
  favorites: number;
  folders: number;
};

type AnalyticsRpcPayload = {
  entries?: { length?: number };
  trend?: { key?: string; count?: number }[];
  maxDaily?: number;
  byBusiness?: { label?: string; count?: number }[];
  formats?: { label?: string; count?: number }[];
  totalPieces?: number;
  favorites?: number;
  folders?: number;
};

const initialAnalytics: AnalyticsSummary = {
  entries: { length: 0 },
  trend: [],
  maxDaily: 1,
  byBusiness: [],
  formats: [
    { label: "کپشن", count: 0 },
    { label: "سناریوی ریلز", count: 0 },
    { label: "استوری", count: 0 },
    { label: "تبلیغ", count: 0 },
  ],
  totalPieces: 0,
  favorites: 0,
  folders: 0,
};

type AiUsageSummary = {
  generations: number;
  promptTokens: number;
  candidateTokens: number;
  totalTokens: number;
  models: { model: string; generations: number; totalTokens: number }[];
};

type AiUsageRpcPayload = {
  generations?: number;
  promptTokens?: number;
  candidateTokens?: number;
  totalTokens?: number;
  models?: { model?: string; generations?: number; totalTokens?: number }[];
};

const initialAiUsage: AiUsageSummary = {
  generations: 0,
  promptTokens: 0,
  candidateTokens: 0,
  totalTokens: 0,
  models: [],
};

const STORAGE_KEY = "ai-content-factory-history-v1";

const HISTORY_PAGE_SIZE = 50;

const WORKSPACE_DRAFT_KEY = "ai-content-factory-workspace-draft-v1";

function getPersianAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("password") &&
    (normalized.includes("contain") ||
      normalized.includes("lowercase") ||
      normalized.includes("uppercase") ||
      normalized.includes("number") ||
      normalized.includes("symbol") ||
      normalized.includes("character"))
  ) {
    return "رمز عبور باید حداقل ۸ نویسه داشته باشد و شامل حروف انگلیسی کوچک (a-z)، حروف بزرگ (A-Z)، حداقل یک عدد (0-9) و حداقل یک علامت مانند ! @ # $ باشد.";
  }

  if (normalized.includes("password") && normalized.includes("at least")) {
    return "رمز عبور انتخاب‌شده شرایط امنیتی لازم را ندارد. لطفاً از ترکیب حروف کوچک و بزرگ انگلیسی، عدد و علامت استفاده کن.";
  }

  return message || "خطا در ورود یا ثبت‌نام. لطفاً دوباره تلاش کن.";
}

const initialProduct: Product = {
  businessType: "retail",
  contentTemplate: "balanced",
  channel: "general",
  businessName: "",
  name: "",
  price: "",
  category: "مانتو",
  fabric: "",
  colors: "",
  features: "",
  audience: "",
  goal: "افزایش فروش",
  tone: "صمیمی و حرفه‌ای",
  serviceArea: "",
  offer: "",
  differentiators: "",
  additionalInfo: "",
};

const tabs = [
  { id: "caption", label: "متن اصلی کانال" },
  { id: "reel", label: "سناریوی ریلز" },
  { id: "stories", label: "استوری‌ها" },
  { id: "ad", label: "متن تبلیغاتی" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function getTabsForChannel(channel: ContentChannel) {
  const ids: TabId[] =
    channel === "general" || channel === "instagram"
      ? ["caption", "reel", "stories", "ad"]
      : channel === "youtube"
        ? ["caption", "reel", "ad"]
        : ["caption", "ad"];

  const mainLabels: Partial<Record<ContentChannel, string>> = {
    telegram: "متن کانال تلگرام",
    bale: "متن کانال بله",
    sms: "متن پیامک",
    website: "متن وب‌سایت و سئو",
    email: "متن ایمیل",
    instagram: "کپشن اینستاگرام",
    linkedin: "پست لینکدین",
    youtube: "توضیحات یوتیوب",
  };

  return tabs.filter((tab) => ids.includes(tab.id)).map((tab) => ({
    ...tab,
    label: tab.id === "caption"
      ? mainLabels[channel] || tab.label
      : tab.id === "reel" && channel === "youtube"
        ? "سناریوی ویدیو"
        : tab.label,
  }));
}

function getVisibleContent(content: Content, channel: ContentChannel) {
  return Object.fromEntries(getTabsForChannel(channel).map((tab) => [tab.id, content[tab.id]]));
}

function createId() {

  return typeof crypto !== "undefined" && "randomUUID" in crypto

    ? crypto.randomUUID()

    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

}

function formatDate(value: string) {

  return new Date(value).toLocaleString("fa-IR-u-ca-persian", {
    calendar: "persian",
    numberingSystem: "arab",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

}

function getTabText(content: Content, tab: TabId) {

  if (tab === "caption") return content.caption;

  if (tab === "reel") return content.reel;

  if (tab === "ad") return content.ad;

  return content.stories.map((story, i) => `${i + 1}. ${story}`).join("\n\n");

}

function updateTabContent(content: Content, tab: TabId, text: string): Content {
  if (tab === "caption") return { ...content, caption: text };
  if (tab === "reel") return { ...content, reel: text };
  if (tab === "ad") return { ...content, ad: text };

  const stories = text
    .split(/\n\s*\n/)
    .map((story) => story.replace(/^\s*\d+[.)\-]\s*/, "").trim())
    .filter(Boolean);

  return { ...content, stories };
}

function safeFileName(name: string) {

  const cleaned = name

    .trim()

    .replace(/[**\\\\**/:\*?"<>|]/g, "-")

    .replace(/\s+/g, "-")

    .slice(0, 50);

  return cleaned || "content";

}

function downloadFile(filename: string, text: string, mime: string) {

  const blob = new Blob(["\uFEFF", text], { type: `${mime};charset=utf-8` });

  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");

  anchor.href = url;

  anchor.download = filename;

  document.body.appendChild(anchor);

  anchor.click();

  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

}

function buildTextExport(product: Product, content: Content) {
  const sections = getTabsForChannel(product.channel).map((tab, index) => {
    const heading = String(index + 1) + ". " + tab.label;
    const body = tab.id === "stories"
      ? content.stories.map((story, storyIndex) => "استوری " + String(storyIndex + 1) + "\n" + story).join("\n\n")
      : String(content[tab.id] ?? "");
    return heading + "\n----------------------------------------\n" + body;
  });

  return [
    "AI CONTENT FACTORY",
    "بسته محتوایی کسب‌وکار",
    "========================================",
    "",
    "مشخصات کسب‌وکار و موضوع",
    "----------------------------------------",
    "نام محصول یا خدمت: " + product.name,
    "قیمت: " + (product.price || "ثبت نشده"),
    "نوع کسب‌وکار: " + businessTypeLabel(product.businessType),
    "نام برند/کسب‌وکار: " + (product.businessName || "ثبت نشده"),
    "دسته‌بندی/موضوع: " + (product.category || "ثبت نشده"),
    "جنس: " + (product.fabric || "ثبت نشده"),
    "رنگ‌ها: " + (product.colors || "ثبت نشده"),
    "محدوده فعالیت: " + (product.serviceArea || "ثبت نشده"),
    "پیشنهاد ویژه: " + (product.offer || "ثبت نشده"),
    "مزیت رقابتی: " + (product.differentiators || "ثبت نشده"),
    "اطلاعات تکمیلی: " + (product.additionalInfo || "ثبت نشده"),
    "ویژگی‌ها: " + product.features,
    "مخاطب هدف: " + (product.audience || "ثبت نشده"),
    "هدف محتوا: " + product.goal,
    "قالب تولید: " + (contentTemplates.find((item) => item.value === product.contentTemplate)?.label || "متعادل و عمومی"),
    "کانال اصلی: " + contentChannelLabel(product.channel),
    "لحن برند: " + product.tone,
    "",
    ...sections,
    "",
    "========================================",
    "ساخته‌شده با AI Content Factory",
  ].join("\n");
}

export default function Home() {

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);

  const [authReady, setAuthReady] = useState(false);

  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const [authEmail, setAuthEmail] = useState("");

  const [authPassword, setAuthPassword] = useState("");

  const [authLoading, setAuthLoading] = useState(false);

  const [authMessage, setAuthMessage] = useState("");
  const [showAccountDeletion, setShowAccountDeletion] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [accountExportLoading, setAccountExportLoading] = useState(false);
  const [dataProcessingNoticeAccepted, setDataProcessingNoticeAccepted] = useState(false);
  const [dataNoticeSaving, setDataNoticeSaving] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [product, setProduct] = useState<Product>(initialProduct);
  const [activeCampaignForGeneration, setActiveCampaignForGeneration] = useState<{ id: string; name: string } | null>(null);
  const [campaignRefreshKey, setCampaignRefreshKey] = useState(0);
  const activeCampaignUserIdRef = useRef<string | null>(null);
  const [brandProfile, setBrandProfile] = useState<BrandProfile>(initialBrandProfile);
  const [brandProfiles, setBrandProfiles] = useState<BrandProfileEntry[]>([{ id: "default", name: "برند اول", profile: initialBrandProfile }]);
  const [activeBrandProfileId, setActiveBrandProfileId] = useState("default");
  const [brandProfileSaving, setBrandProfileSaving] = useState(false);
  const [brandProfileNotice, setBrandProfileNotice] = useState("");
  const [content, setContent] = useState<Content | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>("caption");

  const [draftText, setDraftText] = useState("");
  const [workspaceDraftReady, setWorkspaceDraftReady] = useState(false);

  const [loading, setLoading] = useState(false);

  const [notice, setNotice] = useState("");

  const [noticeType, setNoticeType] = useState<"success" | "error" | "info">("info");

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [calendarHistory, setCalendarHistory] = useState<HistoryItem[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const calendarRequestRef = useRef(0);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyBackupLoading, setHistoryBackupLoading] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<{ createdAt: string; id: string } | null>(null);
  const [contentVersions, setContentVersions] = useState<ContentVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState("");
  const [compareVersionId, setCompareVersionId] = useState("");

  const comparingVersion = useMemo(
    () => contentVersions.find((version) => version.id === compareVersionId) || null,
    [contentVersions, compareVersionId],
  );
  const versionCompareFields = useMemo(() => {
    if (!comparingVersion || !content) return [];
    const fields = [
      { id: "caption", label: "کپشن", previous: comparingVersion.content.caption, current: content.caption },
      { id: "reel", label: "سناریوی ریلز", previous: comparingVersion.content.reel, current: content.reel },
      { id: "ad", label: "متن تبلیغ", previous: comparingVersion.content.ad, current: content.ad },
    ];
    const storyCount = Math.max(comparingVersion.content.stories.length, content.stories.length);
    for (let index = 0; index < storyCount; index += 1) {
      fields.push({
        id: `story-${index}`,
        label: `استوری ${(index + 1).toLocaleString("fa-IR")}`,
        previous: comparingVersion.content.stories[index] || "",
        current: content.stories[index] || "",
      });
    }
    return fields;
  }, [comparingVersion, content]);
  const versionsRequestRef = useRef(0);

  const [historyReady, setHistoryReady] = useState(false);

  const [selectedHistoryId, setSelectedHistoryId] = useState("");

  const [historySearch, setHistorySearch] = useState("");
  const [historyFolderFilter, setHistoryFolderFilter] = useState("همه پوشه‌ها");
  const [historyReviewFilter, setHistoryReviewFilter] = useState<ContentReviewStatus | "all">("all");
  const [historyFavoritesOnly, setHistoryFavoritesOnly] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);

  const [analyticsPeriod, setAnalyticsPeriod] = useState<"7" | "30" | "all">("30");
  const [analytics, setAnalytics] = useState<AnalyticsSummary>(initialAnalytics);
  const [analyticsReady, setAnalyticsReady] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [aiUsage, setAiUsage] = useState<AiUsageSummary>(initialAiUsage);
  const [aiUsageReady, setAiUsageReady] = useState(false);
  const [aiUsageError, setAiUsageError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setAnalytics(initialAnalytics);
      setAnalyticsReady(false);
      setAnalyticsError("");
      return () => { cancelled = true; };
    }

    async function loadAnalytics() {
      setAnalyticsReady(false);
      setAnalyticsError("");
      try {
        const { data, error } = await supabase.rpc("get_content_analytics", {
          p_period_days: analyticsPeriod === "all" ? null : Number(analyticsPeriod),
        });
        if (error) throw error;
        if (cancelled) return;

        const result = (data || {}) as AnalyticsRpcPayload;
        const trend = Array.isArray(result.trend)
          ? result.trend.map((day) => {
              const date = new Date(`${day.key || ""}T12:00:00`);
              return {
                key: day.key || "",
                label: Number.isNaN(date.getTime())
                  ? ""
                  : date.toLocaleDateString("fa-IR", { weekday: "short" }),
                count: Math.max(0, Number(day.count) || 0),
              };
            })
          : [];

        setAnalytics({
          entries: { length: Math.max(0, Number(result.entries?.length) || 0) },
          trend,
          maxDaily: Math.max(1, Number(result.maxDaily) || 1),
          byBusiness: Array.isArray(result.byBusiness)
            ? result.byBusiness.map((item) => ({ label: item.label || "سایر کسب‌وکارها", count: Math.max(0, Number(item.count) || 0) }))
            : [],
          formats: Array.isArray(result.formats)
            ? result.formats.map((item) => ({ label: item.label || "", count: Math.max(0, Number(item.count) || 0) }))
            : initialAnalytics.formats,
          totalPieces: Math.max(0, Number(result.totalPieces) || 0),
          favorites: Math.max(0, Number(result.favorites) || 0),
          folders: Math.max(0, Number(result.folders) || 0),
        });
      } catch (error) {
        if (cancelled) return;
        setAnalyticsError(error instanceof Error ? error.message : "محاسبه آمار انجام نشد.");
        setAnalytics(initialAnalytics);
      } finally {
        if (!cancelled) setAnalyticsReady(true);
      }
    }

    void loadAnalytics();
    return () => { cancelled = true; };
  }, [user?.id, analyticsPeriod]);

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setAiUsage(initialAiUsage);
      setAiUsageReady(false);
      setAiUsageError("");
      return () => { cancelled = true; };
    }

    async function loadAiUsage() {
      setAiUsageReady(false);
      setAiUsageError("");
      try {
        const { data, error } = await supabase.rpc("get_ai_usage_summary", {
          p_period_days: analyticsPeriod === "all" ? null : Number(analyticsPeriod),
        });
        if (error) throw error;
        if (cancelled) return;
        const result = (data || {}) as AiUsageRpcPayload;
        setAiUsage({
          generations: Math.max(0, Number(result.generations) || 0),
          promptTokens: Math.max(0, Number(result.promptTokens) || 0),
          candidateTokens: Math.max(0, Number(result.candidateTokens) || 0),
          totalTokens: Math.max(0, Number(result.totalTokens) || 0),
          models: Array.isArray(result.models)
            ? result.models.map((item) => ({
                model: item.model || "نامشخص",
                generations: Math.max(0, Number(item.generations) || 0),
                totalTokens: Math.max(0, Number(item.totalTokens) || 0),
              }))
            : [],
        });
      } catch (error) {
        if (cancelled) return;
        setAiUsageError(error instanceof Error ? error.message : "بارگذاری آمار مصرف هوش مصنوعی ناموفق بود.");
        setAiUsage(initialAiUsage);
      } finally {
        if (!cancelled) setAiUsageReady(true);
      }
    }

    void loadAiUsage();
    return () => { cancelled = true; };
  }, [user?.id, analyticsPeriod]);

  const loadCalendarMonth = useCallback(async (startIso: string, endIso: string) => {
    if (!user?.id) {
      calendarRequestRef.current += 1;
      setCalendarHistory([]);
      setCalendarLoading(false);
      setCalendarError("");
      return;
    }

    const requestId = ++calendarRequestRef.current;
    setCalendarLoading(true);
    setCalendarError("");

    try {
      const { data, error } = await supabase.rpc("get_scheduled_content_for_range", {
        p_start_iso: startIso,
        p_end_iso: endIso,
      });
      if (error) throw error;
      if (requestId !== calendarRequestRef.current) return;

      const rows = (data || []) as DbCalendarRow[];
      setCalendarHistory(rows.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        product: normalizeProduct(row.product),
        content: row.content,
      })));
    } catch (error) {
      if (requestId !== calendarRequestRef.current) return;
      setCalendarHistory([]);
      setCalendarError(error instanceof Error ? error.message : "بارگذاری برنامه‌های این ماه ناموفق بود.");
    } finally {
      if (requestId === calendarRequestRef.current) setCalendarLoading(false);
    }
  }, [user?.id]);

  function showNotice(message: string, type: "success" | "error" | "info" = "info") {

    setNotice(message);

    setNoticeType(type);

  }

  // بازیابی خودکار فرم و پیش‌نویس محتوای کاربر از همین مرورگر
  useEffect(() => {
    const storageKey = `${WORKSPACE_DRAFT_KEY}:${user?.id || "guest"}`;
    setWorkspaceDraftReady(false);

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as {
          product?: Partial<Product>;
          content?: Content | null;
          activeTab?: TabId;
          draftText?: string;
          brandProfile?: Partial<BrandProfile>;
          brandProfiles?: BrandProfileEntry[];
          activeBrandProfileId?: string;
        };

        if (saved.product && typeof saved.product === "object") {
          setProduct(normalizeProduct(saved.product));
        }
        if (saved.content && typeof saved.content === "object") {
          setContent(saved.content);
        }
        if (typeof saved.activeTab === "string" && tabs.some((tab) => tab.id === saved.activeTab)) {
          setActiveTab(saved.activeTab);
        }
        if (typeof saved.draftText === "string") setDraftText(saved.draftText);
        if (saved.brandProfile && typeof saved.brandProfile === "object") {
          setBrandProfile(normalizeBrandProfile(saved.brandProfile));
        }
        if (Array.isArray(saved.brandProfiles)) setBrandProfiles(saved.brandProfiles);
        if (typeof saved.activeBrandProfileId === "string") {
          setActiveBrandProfileId(saved.activeBrandProfileId);
        }
      }
    } catch (error) {
      console.warn("Workspace draft restore failed:", error);
    } finally {
      setWorkspaceDraftReady(true);
    }
  }, [user?.id]);

  // ذخیره فوری تغییرات؛ حتی اگر مرورگر یا سیستم صفحه را در پس‌زمینه ببندد
  useEffect(() => {
    if (!workspaceDraftReady) return;

    const storageKey = `${WORKSPACE_DRAFT_KEY}:${user?.id || "guest"}`;
    const saveDraft = () => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({
          product,
          content,
          activeTab,
          draftText,
          brandProfile,
          brandProfiles,
          activeBrandProfileId,
          savedAt: new Date().toISOString(),
        }));
      } catch (error) {
        console.warn("Workspace draft save failed:", error);
      }
    };

    saveDraft();
    window.addEventListener("pagehide", saveDraft);
    document.addEventListener("visibilitychange", saveDraft);
    return () => {
      window.removeEventListener("pagehide", saveDraft);
      document.removeEventListener("visibilitychange", saveDraft);
    };
  }, [workspaceDraftReady, user?.id, product, content, activeTab, draftText, brandProfile, brandProfiles, activeBrandProfileId]);

  // بررسی نشست کاربر و گوش دادن به تغییر وضعیت ورود
  useEffect(() => {
    let mounted = true;
    // An auth event is authoritative if it arrives while the initial session
    // request is still pending; never let that older snapshot overwrite it.
    let authEventReceived = false;
    let authReadyTimeout: number | undefined;

    // جلوگیری از ماندن بی‌نهایت صفحه روی وضعیت بررسی حساب
    authReadyTimeout = window.setTimeout(() => {
      if (!mounted) return;
      setAuthMessage("بررسی نشست بیشتر از حد معمول طول کشید؛ فرم ورود نمایش داده می‌شود و اگر اتصال کامل شود، وضعیت حساب به‌صورت خودکار به‌روزرسانی خواهد شد.");
      setAuthReady(true);
    }, 4000);

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!mounted || authEventReceived) return;
        if (authReadyTimeout !== undefined) window.clearTimeout(authReadyTimeout);

        if (error) setAuthMessage(error.message);

        setUser(
          data.session?.user
            ? { id: data.session.user.id, email: data.session.user.email }
            : null
        );
        const brandContext = getBrandProfileContext(data.session?.user.user_metadata);
        setBrandProfiles(brandContext.profiles);
        setActiveBrandProfileId(brandContext.active.id);
        setBrandProfile(brandContext.active.profile);
        setDataProcessingNoticeAccepted(Boolean(data.session?.user.user_metadata?.aiContentFactoryDataProcessingNoticeAcceptedAt));
        setAuthReady(true);
      })
      .catch((error: unknown) => {
        if (!mounted || authEventReceived) return;
        if (authReadyTimeout !== undefined) window.clearTimeout(authReadyTimeout);
        setUser(null);
        setAuthMessage(error instanceof Error ? error.message : "بررسی نشست کاربری ناموفق بود. دوباره تلاش کن.");
        setAuthReady(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      authEventReceived = true;
      if (authReadyTimeout !== undefined) window.clearTimeout(authReadyTimeout);
      setAuthReady(true);

      const nextUser = session?.user
        ? { id: session.user.id, email: session.user.email }
        : null;

      setUser((current) => {
        if (current?.id === nextUser?.id && current?.email === nextUser?.email) {
          return current;
        }
        return nextUser;
      });

      const brandContext = getBrandProfileContext(session?.user.user_metadata);
      setBrandProfiles(brandContext.profiles);
      setActiveBrandProfileId(brandContext.active.id);
      setBrandProfile(brandContext.active.profile);
      setDataProcessingNoticeAccepted(Boolean(session?.user.user_metadata?.aiContentFactoryDataProcessingNoticeAcceptedAt));

      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
        setAuthMessage("لینک بازیابی معتبر است. رمز عبور جدیدت را وارد کن.");
      }

      if (event !== "USER_UPDATED") {
        setBrandProfileNotice("");
        setHistory([]);
        setHistoryHasMore(false);
        setHistoryCursor(null);
        versionsRequestRef.current += 1;
        setContentVersions([]);
        setVersionsError("");
        setHistoryReady(false);
        setSelectedHistoryId("");
      }
    });

    return () => {
      mounted = false;
      if (authReadyTimeout !== undefined) window.clearTimeout(authReadyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (activeCampaignUserIdRef.current !== currentUserId) {
      setActiveCampaignForGeneration(null);
      activeCampaignUserIdRef.current = currentUserId;
    }
  }, [user?.id]);

  // بارگذاری تاریخچه کاربر و انتقال تاریخچه قدیمی مرورگر در صورت نیاز

  useEffect(() => {

    if (!user) {

      setHistory([]);
      setHistoryHasMore(false);
      setHistoryCursor(null);
      versionsRequestRef.current += 1;
        setContentVersions([]);
      setVersionsError("");

      setHistoryReady(false);
      setBrandProfile(initialBrandProfile);
      setBrandProfiles([{ id: "default", name: "برند اول", profile: initialBrandProfile }]);
      setActiveBrandProfileId("default");

      return;

    }

    let cancelled = false;

    async function loadHistory() {

      setHistoryReady(false);

      try {

        const { data, error } = await supabase

          .from("content_history")

          .select("id, product, content, created_at")

          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(HISTORY_PAGE_SIZE);

        if (error) throw error;

        let rows = (data || []) as DbHistoryRow[];

        const migrationKey = `ai-content-factory-migrated-${user!.id}`;
        const alreadyMigrated = localStorage.getItem(migrationKey);

        if (rows.length === 0 && !alreadyMigrated) {

          const saved = localStorage.getItem(STORAGE_KEY);

          if (saved) {

            try {

              const oldItems = JSON.parse(saved) as HistoryItem[];

              if (Array.isArray(oldItems) && oldItems.length > 0) {

                const records = oldItems.slice(0, HISTORY_PAGE_SIZE).map((item) => ({

                  user_id: user!.id,

                  product: item.product,

                  content: item.content,

                  created_at: item.createdAt || new Date().toISOString(),

                }));

                const { error: migrationError } = await supabase

                  .from("content_history")

                  .insert(records);

                if (migrationError) throw migrationError;

              }

            } catch (migrationError) {

              console.error("History migration error:", migrationError);

              throw migrationError;

            }

          }

          localStorage.setItem(migrationKey, "true");

          const { data: refreshed, error: refreshError } = await supabase

            .from("content_history")

            .select("id, product, content, created_at")

            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(HISTORY_PAGE_SIZE);

          if (refreshError) throw refreshError;

          rows = (refreshed || []) as DbHistoryRow[];

        }

        if (!cancelled) {

          setHistory(

            rows.map((row) => ({

              id: row.id,

              createdAt: row.created_at,

              product: normalizeProduct(row.product),

              content: row.content,

            }))

          );
          const lastRow = rows[rows.length - 1];
          setHistoryCursor(lastRow ? { createdAt: lastRow.created_at, id: lastRow.id } : null);
          setHistoryHasMore(rows.length === HISTORY_PAGE_SIZE);

        }

      } catch (error) {

        console.error("History load error:", error);

        if (!cancelled) {

          showNotice(

            "بارگذاری تاریخچه انجام نشد. اتصال Supabase و تنظیمات جدول را بررسی کن.",

            "error"

          );

        }

      } finally {

        if (!cancelled) setHistoryReady(true);

      }

    }

    loadHistory();

    return () => {

      cancelled = true;

    };

  }, [user]);

  async function loadMoreHistory() {
    if (!user || !historyHasMore || historyLoadingMore || !historyCursor) return;

    setHistoryLoadingMore(true);
    try {
      const cursor = historyCursor;
      const { data, error } = await supabase
        .from("content_history")
        .select("id, product, content, created_at")
        .or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(HISTORY_PAGE_SIZE);

      if (error) throw error;

      const rows = (data || []) as DbHistoryRow[];
      const existingIds = new Set(history.map((item) => item.id));
      const nextItems = rows
        .filter((row) => !existingIds.has(row.id))
        .map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          product: normalizeProduct(row.product),
          content: row.content,
        }));

      setHistory((old) => [...old, ...nextItems]);

      const lastRow = rows[rows.length - 1];
      if (lastRow) setHistoryCursor({ createdAt: lastRow.created_at, id: lastRow.id });
      setHistoryHasMore(rows.length === HISTORY_PAGE_SIZE);
    } catch (error) {
      showNotice(
        error instanceof Error ? `بارگذاری موارد قدیمی‌تر ناموفق بود: ${error.message}` : "بارگذاری موارد قدیمی‌تر ناموفق بود.",
        "error"
      );
    } finally {
      setHistoryLoadingMore(false);
    }
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    if (!authEmail.trim() || !authPassword) {

      setAuthMessage("ایمیل و رمز عبور را وارد کن.");

      return;

    }

    const minimumPasswordLength = authMode === "signup" ? 8 : 6;
    if (authPassword.length < minimumPasswordLength) {
      setAuthMessage(
        authMode === "signup"
          ? "برای ساخت حساب، رمز عبور باید حداقل ۸ کاراکتر باشد."
          : "رمز عبور باید حداقل ۶ کاراکتر باشد."
      );
      return;
    }

    setAuthLoading(true);

    setAuthMessage("");

    try {

      if (authMode === "signup") {

        const { data, error } = await supabase.auth.signUp({

          email: authEmail.trim(),

          password: authPassword,

        });

        if (error) throw error;

        if (data.session) {

          setAuthMessage("ثبت‌نام با موفقیت انجام شد.");

        } else {

          setAuthMessage(

            "ثبت‌نام انجام شد. ایمیل خود را بررسی کن و لینک تأیید را باز کن؛ سپس وارد حساب شو."

          );

          setAuthMode("login");

        }

      } else {

        const { error } = await supabase.auth.signInWithPassword({

          email: authEmail.trim(),

          password: authPassword,

        });

        if (error) throw error;

        setAuthMessage("ورود موفقیت‌آمیز بود.");

      }

    } catch (error) {

      setAuthMessage(getPersianAuthError(error));

    } finally {

      setAuthLoading(false);

    }

  }

  async function revokeDataProcessingNotice() {
    setDataNoticeSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { aiContentFactoryDataProcessingNoticeAcceptedAt: null },
      });
      if (error) throw error;
      setDataProcessingNoticeAccepted(false);
      showNotice("تأییدیه لغو شد؛ برای تولید جدید باید دوباره اطلاعیه را تأیید کنی.", "success");
    } catch (error) {
      showNotice(
        error instanceof Error ? `لغو تأییدیه ناموفق بود: ${error.message}` : "لغو تأییدیه ناموفق بود.",
        "error"
      );
    } finally {
      setDataNoticeSaving(false);
    }
  }

  async function acceptDataProcessingNotice() {
    setDataNoticeSaving(true);
    try {
      const acceptedAt = new Date().toISOString();
      const { error } = await supabase.auth.updateUser({
        data: { aiContentFactoryDataProcessingNoticeAcceptedAt: acceptedAt },
      });
      if (error) throw error;
      setDataProcessingNoticeAccepted(true);
      showNotice("اطلاعیه پردازش داده تأیید شد. اکنون می‌توانی تولید محتوا را آغاز کنی.", "success");
    } catch (error) {
      showNotice(
        error instanceof Error ? `ثبت تأییدیه ناموفق بود: ${error.message}` : "ثبت تأییدیه ناموفق بود.",
        "error"
      );
    } finally {
      setDataNoticeSaving(false);
    }
  }

  async function handleForgotPassword() {
    if (!authEmail.trim()) {
      setAuthMessage("ابتدا ایمیل حساب کاربری را وارد کن.");
      return;
    }

    setAuthLoading(true);
    setAuthMessage("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setAuthMessage("اگر حسابی با این ایمیل وجود داشته باشد، لینک بازیابی رمز عبور برایت ارسال می‌شود. صندوق ورودی و پوشه هرزنامه را بررسی کن.");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "ارسال لینک بازیابی ناموفق بود.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handlePasswordRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setAuthMessage("رمز عبور جدید باید حداقل ۸ کاراکتر باشد.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setAuthMessage("تکرار رمز عبور با رمز جدید یکسان نیست.");
      return;
    }

    setAuthLoading(true);
    setAuthMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setIsPasswordRecovery(false);
      setNewPassword("");
      setConfirmNewPassword("");
      setAuthMessage("");
      showNotice("رمز عبور با موفقیت تغییر کرد.", "success");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "تغییر رمز عبور ناموفق بود. لینک بازیابی ممکن است منقضی شده باشد.");
    } finally {
      setAuthLoading(false);
    }
  }

  function updateBrandProfile<K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) {
    setBrandProfile((current) => ({ ...current, [key]: value }));
    setBrandProfileNotice("");
  }

  async function saveBrandProfile() {
    setBrandProfileSaving(true);
    setBrandProfileNotice("");

    try {
      const normalized = normalizeBrandProfile(brandProfile);
      const nextProfiles = brandProfiles.map((entry) => entry.id === activeBrandProfileId
        ? { ...entry, name: normalized.brandName || entry.name, profile: normalized }
        : entry);
      const { error } = await supabase.auth.updateUser({
        data: {
          aiContentFactoryBrandProfile: normalized,
          aiContentFactoryBrandProfiles: nextProfiles,
          aiContentFactoryActiveBrandProfileId: activeBrandProfileId,
        },
      });

      if (error) throw error;
      setBrandProfile(normalized);
      setBrandProfiles(nextProfiles);
      setBrandProfileNotice("پروفایل برند فعال همراه با فهرست برندهای حساب ذخیره شد.");
    } catch (error) {
      setBrandProfileNotice(
        error instanceof Error ? error.message : "ذخیره پروفایل برند انجام نشد."
      );
    } finally {
      setBrandProfileSaving(false);
    }
  }

  function switchBrandProfile(id: string) {
    const selected = brandProfiles.find((entry) => entry.id === id);
    if (!selected) return;
    setActiveBrandProfileId(selected.id);
    setBrandProfile(selected.profile);
    setBrandProfileNotice("");
  }

  function addBrandProfile() {
    if (!canAddBrandProfile(brandProfiles.length)) {
      setBrandProfileNotice("حداکثر ۱۰ پروفایل برند برای هر حساب قابل تعریف است.");
      return;
    }
    const id = crypto.randomUUID();
    const entry = createBrandProfileEntry(id, brandProfiles.length + 1, initialBrandProfile);
    setBrandProfiles((current) => [...current, entry]);
    setActiveBrandProfileId(id);
    setBrandProfile(initialBrandProfile);
    setBrandProfileNotice("پروفایل جدید ساخته شد؛ اطلاعات آن را تکمیل و ذخیره کن.");
  }

  async function deleteBrandProfile() {
    if (brandProfiles.length <= 1) {
      setBrandProfileNotice("حداقل یک پروفایل برند باید در حساب باقی بماند.");
      return;
    }
    if (!window.confirm("پروفایل برند فعال حذف شود؟ این کار قابل بازگشت نیست.")) return;
    const nextProfiles = brandProfiles.filter((entry) => entry.id !== activeBrandProfileId);
    const nextActive = nextProfiles[0];
    setBrandProfileSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          aiContentFactoryBrandProfiles: nextProfiles,
          aiContentFactoryActiveBrandProfileId: nextActive.id,
          aiContentFactoryBrandProfile: nextActive.profile,
        },
      });
      if (error) throw error;
      setBrandProfiles(nextProfiles);
      setActiveBrandProfileId(nextActive.id);
      setBrandProfile(nextActive.profile);
      setBrandProfileNotice("پروفایل برند حذف شد.");
    } catch (error) {
      setBrandProfileNotice(error instanceof Error ? error.message : "حذف پروفایل برند انجام نشد.");
    } finally {
      setBrandProfileSaving(false);
    }
  }

  async function deleteAccount() {
    if (!deleteAccountPassword) {
      showNotice("برای حذف حساب، رمز عبور فعلی را وارد کن.", "error");
      return;
    }
    if (!window.confirm("حذف حساب کاربری و تمام محتواها، کمپین‌ها و داده‌های مرتبط دائمی است و قابل بازگشت نیست. ادامه می‌دهی؟")) {
      return;
    }

    setDeleteAccountLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error("نشست معتبر نیست. دوباره وارد حساب شو.");
      }

      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { password: deleteAccountPassword },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error || data?.deleted !== true) {
        throw new Error("حذف حساب انجام نشد. رمز عبور فعلی و وضعیت سرویس را بررسی کن.");
      }

      await supabase.auth.signOut({ scope: "local" });
      setDeleteAccountPassword("");
      setShowAccountDeletion(false);
      setAuthMode("login");
      setAuthMessage("حساب کاربری و داده‌های مرتبط با موفقیت حذف شدند.");
      setUser(null);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "حذف حساب انجام نشد.", "error");
    } finally {
      setDeleteAccountLoading(false);
    }
  }

  async function downloadAccountData() {
    if (accountExportLoading) return;
    setAccountExportLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error("نشست معتبر نیست. دوباره وارد حساب شو.");
      }

      const response = await fetch("/api/account/export", {
        method: "GET",
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === "string" ? payload.error : "دریافت نسخه پشتیبان انجام نشد.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ai-content-factory-account-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      showNotice("نسخه پشتیبان اطلاعات حساب آماده و دانلود شد.", "success");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "دریافت نسخه پشتیبان انجام نشد.", "error");
    } finally {
      setAccountExportLoading(false);
    }
  }

  async function logout() {

    const { error } = await supabase.auth.signOut();

    if (error) {

      showNotice(`خطا در خروج: ${error.message}`, "error");

      return;

    }

    setContent(null);

    setProduct(initialProduct);
    setBrandProfile(initialBrandProfile);
    setBrandProfiles([{ id: "default", name: "برند اول", profile: initialBrandProfile }]);
    setActiveBrandProfileId("default");
    setBrandProfileNotice("");

    setHistory([]);
    setCalendarHistory([]);
    setHistoryHasMore(false);
    setHistoryCursor(null);
    versionsRequestRef.current += 1;
        setContentVersions([]);
    setVersionsError("");

    setSelectedHistoryId("");

    showNotice("از حساب کاربری خارج شدی.", "success");

  }

  const filled = useMemo(

    () => product.name.trim().length > 1 && product.features.trim().length > 2,

    [product.name, product.features]

  );

  const filteredHistory = useMemo(() => {

    const term = historySearch.trim().toLowerCase();

    return history.filter((item) => {
      const meta = item.product._factoryMeta || { tags: [], folder: "عمومی", favorite: false, reviewStatus: "draft" as ContentReviewStatus };
      const searchable = [item.product.name, item.product.category, item.product.goal, item.product.businessName, item.product.businessType, item.product.contentTemplate, item.product.channel, item.product.serviceArea, ...meta.tags, meta.folder, meta.scheduledAt || "", meta.reviewNote || "", item.content.caption, item.content.reel, item.content.ad, ...item.content.stories].join(" ").toLowerCase();
      const matchesSearch = !term || searchable.includes(term);
      const matchesFolder = historyFolderFilter === "همه پوشه‌ها" || meta.folder === historyFolderFilter;
      const matchesFavorite = !historyFavoritesOnly || meta.favorite;
      const matchesReviewStatus = historyReviewFilter === "all"
        || normalizeContentReviewStatus(meta.reviewStatus) === historyReviewFilter;
      return matchesSearch && matchesFolder && matchesFavorite && matchesReviewStatus;
    });
  }, [history, historySearch, historyFolderFilter, historyReviewFilter, historyFavoritesOnly]);

  const qualityAnalysis = useMemo(() => {
    if (!content) return null;
    const editedContent = updateTabContent(content, activeTab, draftText);
    return analyzeContent(editedContent, brandProfile, product.channel);
  }, [content, activeTab, draftText, brandProfile, product.channel]);

  const visibleTabs = useMemo(() => getTabsForChannel(product.channel), [product.channel]);

  useEffect(() => {
    if (visibleTabs.some((tab) => tab.id === activeTab)) return;
    const nextTab = visibleTabs[0]?.id || "caption";
    setActiveTab(nextTab);
    if (content) setDraftText(getTabText(content, nextTab));
  }, [visibleTabs, activeTab, content]);


  function update<K extends keyof Product>(key: K, value: Product[K]) {

    setProduct((old) => ({ ...old, [key]: value }));

  }

  function currentWorkingContent() {

    if (!content) return null;

    return updateTabContent(content, activeTab, draftText);

  }

  function selectTab(nextTab: TabId) {

    if (content) {

      const updated = currentWorkingContent();

      if (updated) setContent(updated);

      setDraftText(getTabText(updated || content, nextTab));

    }

    setActiveTab(nextTab);

  }

  async function generate() {

    if (!dataProcessingNoticeAccepted) {
      showNotice("برای ادامه، ابتدا اطلاعیه پردازش داده‌های هوش مصنوعی را تأیید کن.", "error");
      return;
    }

    if (!filled) {

      showNotice("نام محصول، خدمت یا موضوع و ویژگی‌های واقعی آن را وارد کن.", "error");

      return;

    }

    setLoading(true);

    showNotice("در حال ارتباط با هوش مصنوعی و ساخت محتوا...", "info");

    try {

      // دریافت نشست و توکن معتبر کاربر از Supabase
const {
  data: { session },
  error: sessionError,
} = await supabase.auth.getSession();

if (sessionError || !session?.access_token) {
  throw new Error("نشست کاربری معتبر نیست. لطفاً دوباره وارد حساب شو.");
}

// ارسال درخواست همراه با توکن احراز هویت
const response = await fetch("/api/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({ ...product, brandProfile }),
});

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {

        throw new Error(data.error || `خطای سرور (${response.status})`);

      }

      const generated = data.content as Content;

      if (

        !generated ||

        typeof generated.caption !== "string" ||

        typeof generated.reel !== "string" ||

        !Array.isArray(generated.stories) ||

        typeof generated.ad !== "string"

      ) {

        throw new Error("ساختار پاسخ هوش مصنوعی معتبر نیست. دوباره تلاش کن.");

      }

      setContent(generated);

      setActiveTab("caption");

      setDraftText(generated.caption);

      setSelectedHistoryId("");

      const { data: savedRow, error: saveError } = await supabase

        .from("content_history")

        .insert({

          user_id: user!.id,

          product: { ...product, _factoryMeta: product._factoryMeta || { tags: [], folder: "عمومی", favorite: false } },

          content: generated,

        })

        .select("id, product, content, created_at")

        .single();

      if (saveError) {

        console.error("Save history error:", saveError);

        showNotice(

          "محتوا تولید شد، اما ذخیره آنلاین آن ناموفق بود. دوباره تلاش کن.",

          "error"

        );

        return;

      }

      let campaignLinkMessage = "";
      let campaignLinkFailed = false;
      if (activeCampaignForGeneration) {
        const { error: campaignLinkError } = await supabase
          .from("marketing_campaign_content")
          .insert({
            user_id: user!.id,
            campaign_id: activeCampaignForGeneration.id,
            content_id: savedRow.id,
          });

        if (campaignLinkError) {
          campaignLinkFailed = true;
          campaignLinkMessage = ` اتصال خودکار به کمپین «${activeCampaignForGeneration.name}» انجام نشد؛ محتوا در تاریخچه ذخیره شده و می‌توانی آن را دستی متصل کنی.`;
        } else {
          campaignLinkMessage = ` و به کمپین «${activeCampaignForGeneration.name}» متصل شد.`;
          setCampaignRefreshKey((value) => value + 1);
        }
        setActiveCampaignForGeneration(null);
      }

      const newItem: HistoryItem = {

        id: savedRow.id,

        createdAt: savedRow.created_at,

        product: savedRow.product,

        content: savedRow.content,

      };

      setSelectedHistoryId(newItem.id);
      versionsRequestRef.current += 1;
        setContentVersions([]);
      setVersionsError("");

      setHistory((old) => [newItem, ...old]);

      showNotice(
        data.mode === "demo"
          ? `خروجی نمونه ساخته و در حساب تو ذخیره شد. برای تولید واقعی، تنظیمات سرویس تولید محتوا را بررسی کن.${campaignLinkMessage}`
          : `محتوا با موفقیت تولید و آنلاین ذخیره شد.${campaignLinkMessage}`,
        campaignLinkFailed || data.mode === "demo" ? "info" : "success"
      );

    } catch (error) {

      showNotice(

        error instanceof Error ? error.message : "خطای نامشخص در تولید محتوا",

        "error"

      );

    } finally {

      setLoading(false);

    }

  }

  async function saveEdits() {
    if (!content || !selectedHistoryId) {
      showNotice("ابتدا یک بسته ذخیره‌شده را انتخاب کن.", "error");
      return;
    }
    if (!user?.id) {
      showNotice("نشست کاربری معتبر نیست. دوباره وارد حساب شو.", "error");
      return;
    }

    const updatedContent = currentWorkingContent();
    if (!updatedContent) return;

    const previousItem = history.find((item) => item.id === selectedHistoryId)
      || calendarHistory.find((item) => item.id === selectedHistoryId);
    const hasContentChanges =
      previousItem && JSON.stringify(previousItem.content) !== JSON.stringify(updatedContent);

    const { error } = await supabase
      .from("content_history")
      .update({
        product: { ...product },
        content: updatedContent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedHistoryId);

    if (error) {
      showNotice(`ذخیره تغییرات ناموفق بود: ${error.message}`, "error");
      return;
    }

    setContent(updatedContent);
    setHistory((old) =>
      old.map((item) =>
        item.id === selectedHistoryId
          ? { ...item, product: { ...product }, content: updatedContent }
          : item
      )
    );
    setCalendarHistory((old) =>
      old.map((item) =>
        item.id === selectedHistoryId
          ? { ...item, product: { ...product }, content: updatedContent }
          : item
      )
    );
    setDraftText(getTabText(updatedContent, activeTab));

    if (hasContentChanges && previousItem) {
      const { error: versionError } = await supabase.from("content_versions").insert({
        history_id: selectedHistoryId,
        user_id: user.id,
        content: previousItem.content,
      });

      if (versionError) {
        showNotice("محتوا ذخیره شد، اما ثبت نسخه قبلی ناموفق بود: " + versionError.message, "error");
        return;
      }

      await loadContentVersions(selectedHistoryId);
      showNotice("تغییرات ذخیره شد و نسخه قبلی در تاریخچه نسخه‌ها نگهداری شد.", "success");
      return;
    }

    showNotice("تغییرات در دیتابیس آنلاین ذخیره شد.", "success");
  }

  async function loadContentVersions(historyId: string) {
    const requestId = ++versionsRequestRef.current;
    setVersionsLoading(true);
    setVersionsError("");

    const { data, error } = await supabase
      .from("content_versions")
      .select("id, history_id, content, created_at")
      .eq("history_id", historyId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (requestId !== versionsRequestRef.current) return;

    if (error) {
      versionsRequestRef.current += 1;
        setContentVersions([]);
      setVersionsError("بارگذاری نسخه‌های قبلی انجام نشد: " + error.message);
      setVersionsLoading(false);
      return;
    }

    setContentVersions(
      ((data || []) as DbContentVersionRow[]).map((row) => ({
        id: row.id,
        historyId: row.history_id,
        createdAt: row.created_at,
        content: row.content,
      }))
    );
    setVersionsLoading(false);
  }

  function editContentVersionNote(version: ContentVersion) {
    const currentItem = history.find((item) => item.id === version.historyId)
      || calendarHistory.find((item) => item.id === version.historyId);
    if (!currentItem) {
      showNotice("محتوای مرتبط با این نسخه پیدا نشد.", "error");
      return;
    }
    const currentNotes = currentItem.product._factoryMeta?.versionNotes || {};
    const note = window.prompt(
      "یادداشت این نسخه (حداکثر ۵۰۰ نویسه):",
      currentNotes[version.id] || "",
    );
    if (note === null) return;
    const nextNotes = { ...currentNotes };
    const normalized = note.trim().slice(0, 500);
    if (normalized) nextNotes[version.id] = normalized;
    else delete nextNotes[version.id];
    const boundedNotes = Object.fromEntries(Object.entries(nextNotes).slice(-10));
    void updateHistoryMeta(currentItem, { versionNotes: boundedNotes });
  }

  async function restoreContentVersion(version: ContentVersion) {
    if (!selectedHistoryId || !user?.id) return;

    const currentItem = history.find((item) => item.id === selectedHistoryId)
      || calendarHistory.find((item) => item.id === selectedHistoryId);
    if (!currentItem) return;

    if (JSON.stringify(currentItem.content) === JSON.stringify(version.content)) {
      showNotice("این نسخه هم‌اکنون نسخه فعال محتواست.", "info");
      return;
    }

    const { error: snapshotError } = await supabase.from("content_versions").insert({
      history_id: selectedHistoryId,
      user_id: user.id,
      content: currentItem.content,
    });

    if (snapshotError) {
      showNotice("پیش از بازگردانی، ذخیره نسخه فعلی ناموفق بود: " + snapshotError.message, "error");
      return;
    }

    const { error } = await supabase
      .from("content_history")
      .update({ content: version.content, updated_at: new Date().toISOString() })
      .eq("id", selectedHistoryId);

    if (error) {
      showNotice("بازگردانی نسخه ناموفق بود: " + error.message, "error");
      return;
    }

    setContent(version.content);
    setCompareVersionId("");
    setDraftText(getTabText(version.content, activeTab));
    setHistory((old) =>
      old.map((item) =>
        item.id === selectedHistoryId ? { ...item, content: version.content } : item
      )
    );
    setCalendarHistory((old) =>
      old.map((item) =>
        item.id === selectedHistoryId ? { ...item, content: version.content } : item
      )
    );
    await loadContentVersions(selectedHistoryId);
    showNotice("نسخه انتخاب‌شده با موفقیت بازگردانی شد.", "success");
  }

  async function copyText(text: string) {

    try {

      await navigator.clipboard.writeText(text);

      showNotice("متن کپی شد.", "success");

    } catch {

      showNotice("کپی خودکار فعال نیست؛ متن را دستی انتخاب کن.", "error");

    }

  }

  function exportTXT() {

    const working = currentWorkingContent();

    if (!working) return showNotice("ابتدا یک بسته محتوایی تولید کن.", "error");

    downloadFile(

      `AI-Content-${safeFileName(product.name)}.txt`,

      buildTextExport(product, working),

      "text/plain"

    );

    showNotice("فایل TXT دانلود شد.", "success");

  }

  function exportJSON() {

    const working = currentWorkingContent();

    if (!working) return showNotice("ابتدا یک بسته محتوایی تولید کن.", "error");

    downloadFile(

      `AI-Content-${safeFileName(product.name)}.json`,

      JSON.stringify(

        {

          application: "AI Content Factory",

          version: "2.0",

          exportedAt: new Date().toISOString(),

          product,

          content: getVisibleContent(working, product.channel),

        },

        null,

        2

      ),

      "application/json"

    );

    showNotice("فایل JSON دانلود شد.", "success");

  }

  async function updateHistoryMeta(item: HistoryItem, patch: Partial<{ tags: string[]; folder: string; favorite: boolean; scheduledAt: string; reviewStatus: ContentReviewStatus; reviewNote: string; versionNotes: Record<string, string> }>) {
    const current = item.product._factoryMeta || { tags: [], folder: "عمومی", favorite: false, scheduledAt: "", reviewStatus: "draft" as ContentReviewStatus, reviewUpdatedAt: undefined };
    const nextMeta = { ...current, ...patch };
    if (patch.reviewStatus || patch.reviewNote !== undefined) nextMeta.reviewUpdatedAt = new Date().toISOString();
    const nextProduct = { ...item.product, _factoryMeta: nextMeta };
    const { error } = await supabase.from("content_history").update({ product: nextProduct }).eq("id", item.id);
    if (error) return showNotice("ذخیره مشخصات کتابخانه ناموفق بود: " + error.message, "error");
    setHistory((old) => old.map((entry) => entry.id === item.id ? { ...entry, product: nextProduct } : entry));
    setCalendarHistory((old) => old.map((entry) => entry.id === item.id ? { ...entry, product: nextProduct } : entry));
    if (selectedHistoryId === item.id) setProduct(nextProduct);
    showNotice("مشخصات کتابخانه ذخیره شد.", "success");
  }

  function toggleBulkSelection(id: string) {
    setSelectedBulkIds((old) => old.includes(id) ? old.filter((value) => value !== id) : [...old, id]);
  }

  function exportSelectedHistory() {
    const selected = history.filter((item) => selectedBulkIds.includes(item.id));
    if (!selected.length) return showNotice("ابتدا حداقل یک محتوا را انتخاب کن.", "error");
    downloadFile("AI-Content-Factory-Selected.json", JSON.stringify(selected, null, 2), "application/json");
    showNotice(selected.length + " محتوا خروجی گرفته شد.", "success");
  }

  function openHistory(item: HistoryItem) {

    setProduct(normalizeProduct(item.product));

    setContent(item.content);

    setActiveTab("caption");

    setDraftText(item.content.caption);

    setSelectedHistoryId(item.id);
    setCompareVersionId("");
    versionsRequestRef.current += 1;
        setContentVersions([]);
    setVersionsError("");
    void loadContentVersions(item.id);

    showNotice("بسته ذخیره‌شده بارگذاری شد.", "success");

    window.scrollTo({ top: 0, behavior: "smooth" });

  }

  async function deleteHistory(id: string) {

    if (!window.confirm("این بسته محتوایی از تاریخچه حذف شود؟")) return;

    const { error } = await supabase

      .from("content_history")

      .delete()

      .eq("id", id);

    if (error) {

      showNotice(`حذف ناموفق بود: ${error.message}`, "error");

      return;

    }

    setHistory((old) => old.filter((item) => item.id !== id));
    setCalendarHistory((old) => old.filter((item) => item.id !== id));

    if (selectedHistoryId === id) {

      setSelectedHistoryId("");
      setCompareVersionId("");
      versionsRequestRef.current += 1;
        setContentVersions([]);
      setVersionsError("");

      setContent(null);

    }

    showNotice("بسته از تاریخچه آنلاین حذف شد.", "success");

  }

  async function clearHistory() {

    if (!history.length) return;

    if (!window.confirm("تمام تاریخچه حساب کاربری حذف شود؟ این کار قابل بازگشت نیست.")) return;

    const { error } = await supabase
      .from("content_history")
      .delete()
      .eq("user_id", user!.id);

    if (error) {

      showNotice(`پاک کردن تاریخچه ناموفق بود: ${error.message}`, "error");

      return;

    }

    setHistory([]);
    setCalendarHistory([]);
    setHistoryHasMore(false);
    setHistoryCursor(null);
    versionsRequestRef.current += 1;
        setContentVersions([]);
    setVersionsError("");

    setSelectedHistoryId("");

    setContent(null);

    showNotice("تاریخچه حساب کاربری پاک شد.", "success");

  }

  async function exportHistory() {
    if (!user) return showNotice("برای تهیه پشتیبان وارد حساب کاربری شو.", "error");
    if (!history.length) return showNotice("تاریخچه خالی است.", "error");

    setHistoryBackupLoading(true);
    showNotice("در حال دریافت همه صفحات تاریخچه برای تهیه پشتیبان...", "info");

    try {
      const pageSize = 100;
      const maxRows = 10000;
      const allItems: HistoryItem[] = [];
      let cursor: { createdAt: string; id: string } | null = null;
      let hasMore = true;

      while (hasMore && allItems.length < maxRows) {
        let query = supabase
          .from("content_history")
          .select("id, product, content, created_at")
          .eq("user_id", user.id);

        if (cursor) {
          query = query.or(
            `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
          );
        }

        const { data, error } = await query
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(pageSize);

        if (error) throw error;

        const rows = (data || []) as DbHistoryRow[];
        allItems.push(...rows.map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          product: normalizeProduct(row.product),
          content: row.content,
        })));

        const lastRow = rows[rows.length - 1];
        if (lastRow) cursor = { createdAt: lastRow.created_at, id: lastRow.id };
        hasMore = rows.length === pageSize;
      }

      if (!allItems.length) {
        showNotice("تاریخچه‌ای برای پشتیبان‌گیری پیدا نشد.", "info");
        return;
      }

      downloadFile(
        "AI-Content-Factory-Content-History.json",
        JSON.stringify(allItems, null, 2),
        "application/json"
      );

      showNotice(
        allItems.length >= maxRows
          ? "پشتیبان ۱۰٬۰۰۰ مورد اخیر دانلود شد؛ برای تاریخچه بزرگ‌تر با پشتیبانی تماس بگیر."
          : `پشتیبان ${allItems.length.toLocaleString("fa-IR")} بسته محتوا دانلود شد؛ نسخه‌های قبلی ویرایش در جدول نسخه‌ها نگهداری می‌شوند.`,
        "success"
      );
    } catch (error) {
      showNotice(
        error instanceof Error ? `تهیه پشتیبان ناموفق بود: ${error.message}` : "تهیه پشتیبان ناموفق بود.",
        "error"
      );
    } finally {
      setHistoryBackupLoading(false);
    }
  }

  if (!authReady) {

    return (

      <main className="shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>

        <section id="auth-loading-state" className="panel" role="status" aria-live="polite" style={{ width: "100%", maxWidth: 460, padding: 32, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <span className="spinner" aria-hidden="true" />
          </div>
          <strong style={{ display: "block", fontSize: 16 }}>در حال آماده‌سازی فضای کاری...</strong>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "8px 0 0" }}>لطفاً چند لحظه صبر کن.</p>
        </section>

      </main>

    );

  }

  if (isPasswordRecovery) {
    return (
      <main className="shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", paddingTop: 35, paddingBottom: 35 }}>
        <section className="panel" style={{ width: "100%", maxWidth: 460, padding: 30 }}>
          <div style={{ textAlign: "center", marginBottom: 25 }}>
            <div className="brand-mark" style={{ margin: "0 auto 12px", width: 48, height: 48, fontSize: 28 }}>✳</div>
            <h1 style={{ fontSize: 25, letterSpacing: 0 }}>تنظیم رمز عبور جدید</h1>
            <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 2 }}>یک رمز عبور جدید برای حساب خود انتخاب کن.</p>
          </div>
          <form onSubmit={handlePasswordRecovery} style={{ display: "grid", gap: 14 }}>
            <label>
              رمز عبور جدید
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} autoComplete="new-password" required />
            </label>
            <label>
              تکرار رمز عبور جدید
              <input type="password" value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} minLength={8} autoComplete="new-password" required />
            </label>
            <button className="generate" type="submit" disabled={authLoading}>
              {authLoading ? "در حال ذخیره..." : "ذخیره رمز عبور جدید"}
            </button>
            <button type="button" className="secondary-button" onClick={() => { setIsPasswordRecovery(false); setAuthMessage(""); }}>
              بازگشت
            </button>
          </form>
          {authMessage && <div className="notice info" role="status" style={{ marginTop: 15 }}>{authMessage}</div>}
        </section>
      </main>
    );
  }

  if (!user) {

    return (

      <main className="shell public-shell">
        <PublicLanding />
        <section id="auth-form" className="panel public-auth-panel" style={{ width: "100%", maxWidth: 460, padding: 30 }}>

          <div style={{ textAlign: "center", marginBottom: 25 }}>

            <div className="brand-mark" style={{ margin: "0 auto 12px", width: 48, height: 48, fontSize: 28 }}>✳</div>

            <h1 style={{ fontSize: 27, letterSpacing: 0 }}>AI Content Factory</h1>

            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 2 }}>

              برای استفاده از استودیوی محتوا وارد حساب خود شو یا ثبت‌نام کن.

            </p>

          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>

            <button

              type="button"

              className={authMode === "login" ? "generate" : "secondary-button"}

              style={{ flex: 1, justifyContent: "center", margin: 0 }}

              onClick={() => {

                setAuthMode("login");

                setAuthMessage("");

              }}

            >

              ورود

            </button>

            <button

              type="button"

              className={authMode === "signup" ? "generate" : "secondary-button"}

              style={{ flex: 1, justifyContent: "center", margin: 0 }}

              onClick={() => {

                setAuthMode("signup");

                setAuthMessage("");

              }}

            >

              ثبت‌نام

            </button>

          </div>

          <form onSubmit={handleAuth} style={{ display: "grid", gap: 14 }}>

            <label>

              ایمیل

              <input

                type="email"

                value={authEmail}

                onChange={(e) => setAuthEmail(e.target.value)}

                placeholder="name@example.com"

                autoComplete="email"

                required

              />

            </label>

            <label>

              رمز عبور

              <input

                type="password"

                value={authPassword}

                onChange={(e) => setAuthPassword(e.target.value)}

                placeholder={authMode === "signup" ? "حداقل ۸ کاراکتر" : "رمز عبور فعلی"}

                autoComplete={authMode === "signup" ? "new-password" : "current-password"}

                minLength={authMode === "signup" ? 8 : 6}

                required

              />

            </label>

            <button className="generate" type="submit" disabled={authLoading}>

              {authLoading

                ? "لطفاً صبر کن..."

                : authMode === "signup"

                  ? "ساخت حساب کاربری"

                  : "ورود به حساب"}

            </button>

          </form>

          {authMode === "login" && (
            <button
              type="button"
              className="secondary-button"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={authLoading}
              onClick={() => void handleForgotPassword()}
            >
              {authLoading ? "لطفاً صبر کن..." : "فراموشی رمز عبور؟ ارسال لینک بازیابی"}
            </button>
          )}

          {authMessage && (

            <div className="notice info" role="status" style={{ marginTop: 15 }}>

              {authMessage}

            </div>

          )}

          <p className="privacy-note" style={{ textAlign: "center", marginTop: 20 }}>

            تاریخچه محتواها در حساب کاربری تو ذخیره می‌شود و با حساب دیگران مشترک نیست.

          </p>

        </section>

      </main>

    );

  }

  return (

    <main className="shell">

      <header className="topbar">

        <a className="brand" href="#" aria-label="AI Content Factory">

          <img className="brand-mark" src="/icons/app-icon-192.png" alt="" width="38" height="38" />

          <span>AI Content Factory</span>

        </a>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

          <span className="top-tag" dir="ltr">{user.email}</span>
          <button className="history-backup" disabled={accountExportLoading} onClick={() => void downloadAccountData()}>
            {accountExportLoading ? "در حال آماده‌سازی..." : "دریافت نسخه پشتیبان"}
          </button>
          <button className="campaign-delete" onClick={() => setShowAccountDeletion((value) => !value)}>
            {showAccountDeletion ? "بستن" : "حذف حساب"}
          </button>
          <button className="history-backup" onClick={logout}>خروج</button>

        </div>

      </header>

      {showAccountDeletion && (
        <section className="account-delete-panel" role="dialog" aria-modal="false" aria-labelledby="delete-account-title">
          <div>
            <strong id="delete-account-title">حذف دائمی حساب کاربری</strong>
            <p>با این کار حساب، تاریخچه محتوا، نسخه‌ها، کمپین‌ها و آمار مصرف مرتبط حذف می‌شوند. این عملیات قابل بازگشت نیست.</p>
          </div>
          <label>
            برای تأیید، رمز عبور فعلی را وارد کن
            <input
              type="password"
              value={deleteAccountPassword}
              onChange={(event) => setDeleteAccountPassword(event.target.value)}
              autoComplete="current-password"
              minLength={6}
              maxLength={256}
            />
          </label>
          <div className="account-delete-actions">
            <button type="button" className="campaign-delete" disabled={deleteAccountLoading} onClick={() => void deleteAccount()}>
              {deleteAccountLoading ? "در حال حذف..." : "حذف دائمی حساب و داده‌ها"}
            </button>
            <button type="button" className="secondary-button" disabled={deleteAccountLoading} onClick={() => { setShowAccountDeletion(false); setDeleteAccountPassword(""); }}>
              انصراف
            </button>
          </div>
        </section>
      )}

      <section className="hero">

        <div>

          <div className="eyebrow">استودیوی هوشمند تولید محتوای کسب‌وکارها</div>

          <h1>

            از اطلاعات کسب‌وکارت،
            <br />

            <em>محتوای آماده انتشار</em> بساز.

          </h1>

          <p>

            برای هر نوع کسب‌وکار و کانال انتخاب‌شده متن اصلی، سناریوی ویدیو، پنج استوری و متن تبلیغاتی متناسب تولید کن؛

            ویرایش کن، ذخیره کن و خروجی بگیر.

          </p>

        </div>

        <div className="hero-orb">

          <span>✦</span>

          <small>CONTENT<br />STUDIO</small>

        </div>

      </section>

      {historyReady && history.length === 0 && (
        <section className="quick-start-panel" aria-labelledby="quick-start-title">
          <div className="quick-start-intro">
            <span className="step">شروع سریع</span>
            <h2 id="quick-start-title">در سه گام، اولین جریان بازاریابی‌ات را بساز</h2>
            <p>لازم نیست همه تنظیمات را از ابتدا کامل کنی؛ با اطلاعات واقعی کسب‌وکارت شروع کن و بعد خروجی‌ها را به کمپین وصل کن.</p>
          </div>
          <div className="quick-start-steps">
            <button type="button" onClick={() => {
              const section = document.getElementById("brand-profile") as HTMLDetailsElement | null;
              if (section) section.open = true;
              section?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}>
              <b>۱</b><span><strong>هویت برند را ثبت کن</strong><small>هویت، دانش معتبر، لحن و دعوت به اقدام</small></span><span>←</span>
            </button>
            <button type="button" onClick={() => document.getElementById("content-generator")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              <b>۲</b><span><strong>محتوای کانال‌محور بساز</strong><small>اطلاعیه پردازش داده را مطالعه کن و خروجی را بررسی کن</small></span><span>←</span>
            </button>
            <button type="button" onClick={() => document.getElementById("campaign-manager")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              <b>۳</b><span><strong>کمپین را مدیریت کن</strong><small>هدف، کانال و محتواهای مرتبط را کنار هم نگه دار</small></span><span>←</span>
            </button>
          </div>
        </section>
      )}

      <div className="brand-profile-switcher">
        <label>
          برند فعال
          <select value={activeBrandProfileId} onChange={(event) => switchBrandProfile(event.target.value)}>
            {brandProfiles.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </label>
        <button type="button" className="secondary-button" onClick={addBrandProfile} disabled={!canAddBrandProfile(brandProfiles.length)}>+ افزودن برند</button>
        <button type="button" className="brand-profile-delete" onClick={() => void deleteBrandProfile()} disabled={brandProfiles.length <= 1 || brandProfileSaving}>حذف برند فعال</button>
        <span>{brandProfiles.length.toLocaleString("fa-IR")} از ۱۰ برند</span>
      </div>
      <details id="brand-profile" className="brand-profile-section">
        <summary className="brand-profile-summary">
          <div>
            <span className="step">پروفایل برند</span>
            <h2>هویت ثابت کسب‌وکار</h2>
            <p>یک‌بار هویت، واقعیت‌های تأییدشده، شواهد و ادعاهای ممنوع را ثبت کن تا در تولیدهای بعدی رعایت شوند.</p>
          </div>
          <span className="brand-profile-toggle">ویرایش پروفایل <span>⌄</span></span>
        </summary>

        <div className="brand-profile-grid">
          <label>
            نام برند
            <input value={brandProfile.brandName} onChange={(e) => updateBrandProfile("brandName", e.target.value)} placeholder="مثلاً آکادمی آفتاب" maxLength={120} />
          </label>
          <label>
            شعار یا پیام اصلی برند
            <input value={brandProfile.tagline} onChange={(e) => updateBrandProfile("tagline", e.target.value)} placeholder="یک جمله کوتاه که برند را معرفی می‌کند" maxLength={160} />
          </label>
          <label>
            مخاطب اصلی برند
            <input value={brandProfile.audience} onChange={(e) => updateBrandProfile("audience", e.target.value)} placeholder="مثلاً مدیران و صاحبان کسب‌وکارهای کوچک" maxLength={200} />
          </label>
          <label>
            لحن و شخصیت برند
            <input value={brandProfile.voice} onChange={(e) => updateBrandProfile("voice", e.target.value)} placeholder="مثلاً تخصصی، مطمئن، صمیمی و لوکس" maxLength={120} />
          </label>
          <label className="full">
            ارزش پیشنهادی و تمایز برند
            <textarea rows={2} value={brandProfile.valueProposition} onChange={(e) => updateBrandProfile("valueProposition", e.target.value)} placeholder="چرا مشتری باید این برند را انتخاب کند؟ چه ارزشی ارائه می‌دهد؟" maxLength={320} />
          </label>
          <label>
            واژگان و عبارت‌های ترجیحی
            <textarea rows={2} value={brandProfile.preferredTerms} onChange={(e) => updateBrandProfile("preferredTerms", e.target.value)} placeholder="عبارت‌هایی که بهتر است در محتوا استفاده شوند" maxLength={300} />
          </label>
          <label>
            واژگان و ادعاهای ممنوع
            <textarea rows={2} value={brandProfile.avoidTerms} onChange={(e) => updateBrandProfile("avoidTerms", e.target.value)} placeholder="عبارت‌ها یا ادعاهایی که نباید استفاده شوند" maxLength={300} />
          </label>
          <label className="full">
            دعوت به اقدام پیش‌فرض (CTA)
            <input value={brandProfile.cta} onChange={(e) => updateBrandProfile("cta", e.target.value)} placeholder="مثلاً برای مشاوره با ما تماس بگیرید." maxLength={180} />
          </label>
          <div className="brand-knowledge-heading full">
            <strong>دانش معتبر برند</strong>
            <p>این اطلاعات به مدل کمک می‌کند محتوای دقیق‌تری بسازد و از ساختن آمار، مجوز، تضمین یا تجربه مشتری جلوگیری کند.</p>
          </div>
          <label className="full">
            اطلاعات تأییدشده درباره برند، محصولات و خدمات
            <textarea rows={4} value={brandProfile.verifiedFacts} onChange={(e) => updateBrandProfile("verifiedFacts", e.target.value)} placeholder="آدرس شعب، ساعات کاری، سال شروع فعالیت، محدوده خدمات، مشخصات قطعی محصولات و هر واقعیت قابل تأیید..." maxLength={2000} />
          </label>
          <label className="full">
            شواهد و مزیت‌های قابل اثبات
            <textarea rows={3} value={brandProfile.proofPoints} onChange={(e) => updateBrandProfile("proofPoints", e.target.value)} placeholder="گواهی‌های واقعی، نمونه‌کارهای قابل نمایش، نتایج مستند، ضمانت‌های واقعی یا مدارک معتبر..." maxLength={1200} />
          </label>
          <label className="full">
            پرسش‌های متداول و پاسخ‌های تأییدشده
            <textarea rows={4} value={brandProfile.faq} onChange={(e) => updateBrandProfile("faq", e.target.value)} placeholder={"پرسش: ...\nپاسخ: ...\nپرسش: ...\nپاسخ: ..."} maxLength={2000} />
          </label>
          <label className="full">
            ادعاهای ممنوع یا نیازمند مدرک
            <textarea rows={3} value={brandProfile.prohibitedClaims} onChange={(e) => updateBrandProfile("prohibitedClaims", e.target.value)} placeholder="مثلاً بهترین در ایران، تضمین نتیجه، رتبه رسمی، درصد رضایت مشتری یا هر ادعای بدون مدرک..." maxLength={1200} />
          </label>
        </div>

        <div className="brand-profile-actions">
          <button className="secondary-button" onClick={saveBrandProfile} disabled={brandProfileSaving}>
            {brandProfileSaving ? "در حال ذخیره..." : "ذخیره پروفایل برند"}
          </button>
          <span className="privacy-note">اطلاعات در پروفایل حساب کاربری Supabase ذخیره می‌شود؛ برای هر حساب جداگانه است.</span>
        </div>
        {brandProfileNotice && <div className="notice info" role="status">{brandProfileNotice}</div>}
      </details>

      <section className="analytics-section" aria-labelledby="analytics-title">
        <div className="analytics-heading">
          <div>
            <span className="step">مرکز آمار</span>
            <h2 id="analytics-title">عملکرد محتوای شما</h2>
            <p>گزارش مستقیماً از تمام سوابق ذخیره‌شده حساب در پایگاه داده محاسبه می‌شود.</p>
          </div>
          <div className="analytics-period" role="group" aria-label="بازه آماری">
            <button type="button" className={analyticsPeriod === "7" ? "active" : ""} onClick={() => setAnalyticsPeriod("7")}>۷ روز</button>
            <button type="button" className={analyticsPeriod === "30" ? "active" : ""} onClick={() => setAnalyticsPeriod("30")}>۳۰ روز</button>
            <button type="button" className={analyticsPeriod === "all" ? "active" : ""} onClick={() => setAnalyticsPeriod("all")}>همه زمان‌ها</button>
          </div>
        </div>

        {!user ? (
          <div className="analytics-empty">برای مشاهده آمار اختصاصی، ابتدا وارد حساب کاربری شو.</div>
        ) : !analyticsReady ? (
          <div className="analytics-empty">در حال محاسبه آمار...</div>
        ) : analyticsError ? (
          <div className="analytics-empty" role="alert">محاسبه آمار ناموفق بود: {analyticsError}</div>
        ) : (
          <>
            <div className="analytics-kpis">
              <article className="analytics-kpi"><span>محتوای ذخیره‌شده</span><strong>{analytics.entries.length.toLocaleString("fa-IR")}</strong><small>در بازه انتخاب‌شده</small></article>
              <article className="analytics-kpi"><span>خروجی متنی</span><strong>{analytics.totalPieces.toLocaleString("fa-IR")}</strong><small>کپشن، ریلز، استوری و تبلیغ</small></article>
              <article className="analytics-kpi"><span>محتوای منتخب</span><strong>{analytics.favorites.toLocaleString("fa-IR")}</strong><small>ذخیره‌شده در علاقه‌مندی‌ها</small></article>
              <article className="analytics-kpi"><span>پوشه‌های فعال</span><strong>{analytics.folders.toLocaleString("fa-IR")}</strong><small>در بازه انتخاب‌شده</small></article>
              <article className="analytics-kpi analytics-usage-kpi">
                <span>تولیدهای موفق هوش مصنوعی</span>
                <strong>{aiUsageReady ? aiUsage.generations.toLocaleString("fa-IR") : "…"}</strong>
                <small>{aiUsageReady ? `مصرف ${aiUsage.totalTokens.toLocaleString("fa-IR")} توکن` : "در حال دریافت آمار مصرف"}</small>
              </article>
            </div>
            {aiUsageError && <p className="analytics-usage-note" role="status">آمار مصرف هوش مصنوعی در دسترس نیست: {aiUsageError}</p>}
            <p className="analytics-usage-note">مصرف توکن‌ها ثبت می‌شود؛ سقف ماهانه و بسته‌های اعتباری هنوز تنظیم نشده‌اند.</p>

            <div className="analytics-grid">
              <article className="analytics-card">
                <div className="analytics-card-head"><h3>روند تولید در ۷ روز اخیر</h3><span>تعداد محتوا</span></div>
                {analytics.entries.length === 0 ? <div className="analytics-empty">برای نمایش نمودار، ابتدا محتوا تولید و ذخیره کن.</div> : (
                  <div className="analytics-chart" role="img" aria-label="نمودار تعداد محتوای ذخیره‌شده در هفت روز اخیر">
                    {analytics.trend.map((day) => (
                      <div className="analytics-bar-column" key={day.key}>
                        <strong>{day.count.toLocaleString("fa-IR")}</strong>
                        <div className="analytics-bar-track"><span style={{ height: `${Math.max(day.count ? 10 : 3, (day.count / analytics.maxDaily) * 100)}%` }} /></div>
                        <small>{day.label}</small>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article className="analytics-card">
                <div className="analytics-card-head"><h3>ترکیب قالب‌های محتوا</h3><span>تعداد خروجی</span></div>
                <div className="analytics-breakdown">
                  {analytics.formats.map((item) => (
                    <div className="analytics-breakdown-row" key={item.label}>
                      <div><span>{item.label}</span><b>{item.count.toLocaleString("fa-IR")}</b></div>
                      <div className="analytics-progress"><span style={{ width: `${analytics.totalPieces ? (item.count / analytics.totalPieces) * 100 : 0}%` }} /></div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="analytics-card analytics-business-card">
                <div className="analytics-card-head"><h3>حوزه‌های پرتکرار</h3><span>بر اساس کسب‌وکار</span></div>
                {analytics.byBusiness.length ? analytics.byBusiness.slice(0, 5).map((item) => (
                  <div className="analytics-business-row" key={item.label}><span>{item.label}</span><b>{item.count.toLocaleString("fa-IR")}</b></div>
                )) : <div className="analytics-empty">هنوز داده‌ای برای تحلیل وجود ندارد.</div>}
              </article>
            </div>
          </>
        )}
      </section>

      <section className="planner-section">
        <div className="planner-heading">
          <div>
            <span className="step">برنامه‌ریزی</span>
            <h2>تقویم محتوایی</h2>
            <p>نمای ماهانه هجری شمسی با بارگذاری تمام برنامه‌های همان ماه از کل تاریخچه حساب، مشاهده برنامه‌های هر روز و تغییر سریع زمان انتشار. انتشار خودکار هنوز فعال نیست.</p>
          </div>
          <div className="planner-total"><strong>{calendarHistory.length.toLocaleString("fa-IR")}</strong><span>برنامه در ماه جاری</span></div>
        </div>

        <MonthlyContentCalendar
          items={calendarHistory.map((item) => ({
            id: item.id,
            name: item.product.name || item.product.businessName || "محتوای بدون نام",
            scheduledAt: item.product._factoryMeta?.scheduledAt || "",
          }))}
          loading={calendarLoading}
          error={calendarError}
          onMonthChange={loadCalendarMonth}
          onOpen={(id) => {
            const item = calendarHistory.find((entry) => entry.id === id);
            if (item) openHistory(item);
          }}
          onReschedule={(id, scheduledAt) => {
            const item = calendarHistory.find((entry) => entry.id === id);
            if (item) void updateHistoryMeta(item, { scheduledAt });
          }}
        />
      </section>

      {user?.id && (
        <CampaignManager
          userId={user.id}
          refreshKey={campaignRefreshKey}
          onUseCampaign={(campaign) => {
            setActiveCampaignForGeneration({ id: campaign.id, name: campaign.name });
            setProduct((current) => ({
              ...current,
              goal: campaign.goal,
              audience: campaign.audience || current.audience,
              channel: resolveContentChannel(campaign.channels?.[0]),
              businessName: current.businessName || brandProfile.brandName,
            }));
            showNotice(`هدف و مخاطب کمپین «${campaign.name}» به فرم تولید محتوا منتقل شد.`, "success");
            document.getElementById("content-generator")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      )}

      <div className="workspace">

        <section id="content-generator" className="panel form-panel">

          <div className="section-head">

            <div><span className="step">۰۱</span><h2>اطلاعات کسب‌وکار</h2></div>

            <span className="muted">اطلاعات واقعی و دقیق وارد کن</span>

          </div>

          {activeCampaignForGeneration && (
            <div className="active-campaign-note">
              <span>این خروجی پس از ذخیره به کمپین <strong>«{activeCampaignForGeneration.name}»</strong> متصل می‌شود.</span>
              <button type="button" onClick={() => setActiveCampaignForGeneration(null)}>لغو اتصال خودکار</button>
            </div>
          )}
          <div className="form-grid">
            <label className="full">
              نوع کسب‌وکار *
              <select
                value={product.businessType}
                onChange={(e) => {
                  const nextType = e.target.value as BusinessType;
                  setProduct((old) => ({
                    ...old,
                    businessType: nextType,
                    category: nextType === "retail" ? "مانتو" : "",
                  }));
                }}
              >
                {businessTypes.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            <label>
              نام برند یا کسب‌وکار
              <input value={product.businessName} onChange={(e) => update("businessName", e.target.value)} placeholder="مثلاً آکادمی آفتاب یا کافه ویونا" maxLength={120} />
            </label>

            <label>
              {product.businessType === "retail" ? "نام محصول *" :
                product.businessType === "restaurant" ? "نام غذا یا آیتم منو *" :
                product.businessType === "real_estate" ? "عنوان ملک یا فایل *" :
                product.businessType === "construction" ? "نام خدمت یا پروژه *" :
                product.businessType === "education" ? "نام دوره یا برنامه آموزشی *" :
                product.businessType === "fitness" ? "نام برنامه یا خدمت ورزشی *" :
                product.businessType === "personal_brand" ? "موضوع یا عنوان محتوا *" : "نام محصول یا خدمت *"}
              <input value={product.name} onChange={(e) => update("name", e.target.value)} placeholder="مثلاً مشاوره کسب‌وکار، بازسازی کامل منزل، دوره آیلتس..." maxLength={120} />
            </label>

            <label>
              قیمت یا بازه قیمت
              <input value={product.price} onChange={(e) => update("price", e.target.value)} placeholder="مثلاً ۱٬۲۰۰٬۰۰۰ تومان یا توافقی" maxLength={100} />
            </label>

            <label>
              دسته‌بندی یا حوزه فعالیت
              <input value={product.category} onChange={(e) => update("category", e.target.value)} placeholder={product.businessType === "retail" ? "مثلاً پوشاک، کیف، کفش" : "مثلاً مشاوره، طراحی داخلی، زبان انگلیسی"} maxLength={120} />
            </label>

            {(product.businessType === "retail") && (
              <>
                <label>
                  جنس یا متریال
                  <input value={product.fabric} onChange={(e) => update("fabric", e.target.value)} placeholder="مثلاً لینن یا کتان" maxLength={100} />
                </label>
                <label>
                  رنگ‌ها یا تنوع
                  <input value={product.colors} onChange={(e) => update("colors", e.target.value)} placeholder="مثلاً مشکی، سفید، کرم" maxLength={120} />
                </label>
              </>
            )}

            {(product.businessType === "services" || product.businessType === "real_estate" || product.businessType === "construction" || product.businessType === "restaurant") && (
              <label>
                محدوده فعالیت یا موقعیت
                <input value={product.serviceArea} onChange={(e) => update("serviceArea", e.target.value)} placeholder="مثلاً تهران، منطقه ۵" maxLength={160} />
              </label>
            )}

            <label className="full">
              ویژگی‌ها و جزئیات واقعی *
              <textarea rows={4} value={product.features} onChange={(e) => update("features", e.target.value)} placeholder="ویژگی‌ها، امکانات، مراحل کار، مزایا، مواد اولیه، سرفصل‌ها یا هر اطلاعات واقعی مرتبط را بنویس..." maxLength={1800} />
            </label>

            <label>
              مخاطب هدف
              <input value={product.audience} onChange={(e) => update("audience", e.target.value)} placeholder="مثلاً خانواده‌ها، مدیران، زبان‌آموزان" maxLength={160} />
            </label>

            <label>
              هدف محتوا
              <select value={product.goal} onChange={(e) => update("goal", e.target.value)}>
                <option>افزایش فروش</option>
                <option>جذب مشتری یا ثبت‌نام</option>
                <option>معرفی محصول یا خدمت جدید</option>
                <option>افزایش تعامل</option>
                <option>آگاهی از برند</option>
                <option>اعتمادسازی</option>
                <option>دریافت تماس و مشاوره</option>
              </select>
            </label>

            <label className="full">
              کانال اصلی تولید محتوا
              <select value={product.channel} onChange={(e) => update("channel", e.target.value as ContentChannel)}>
                {contentChannels.map((channel) => (
                  <option key={channel.value} value={channel.value}>{channel.label}</option>
                ))}
              </select>
              <small>متن اصلی و تبلیغ بر اساس این کانال تنظیم می‌شوند. سناریو و استوری خروجی‌های اختیاری‌اند و انتشار خودکار انجام نمی‌شود.</small>
            </label>

            <label className="full">
              قالب تخصصی تولید محتوا
              <select value={product.contentTemplate} onChange={(e) => update("contentTemplate", e.target.value as ContentTemplateId)}>
                {contentTemplates.map((template) => (
                  <option key={template.value} value={template.value}>{template.label} — {template.description}</option>
                ))}
              </select>
            </label>

            <label>
              پیشنهاد ویژه
              <input value={product.offer} onChange={(e) => update("offer", e.target.value)} placeholder="مثلاً مشاوره اولیه رایگان، تخفیف افتتاحیه" maxLength={180} />
            </label>

            <label>
              مزیت رقابتی
              <input value={product.differentiators} onChange={(e) => update("differentiators", e.target.value)} placeholder="چه چیزی شما را متمایز می‌کند؟" maxLength={220} />
            </label>

            <label className="full">
              لحن برند
              <select value={product.tone} onChange={(e) => update("tone", e.target.value)}>
                <option>صمیمی و حرفه‌ای</option>
                <option>لوکس و مینیمال</option>
                <option>جوان و پرانرژی</option>
                <option>رسمی و قابل اعتماد</option>
                <option>خلاق و جسور</option>
                <option>آموزشی و تخصصی</option>
              </select>
            </label>

            <label className="full">
              اطلاعات تکمیلی (اختیاری)
              <textarea rows={3} value={product.additionalInfo} onChange={(e) => update("additionalInfo", e.target.value)} placeholder="هر نکته‌ای که به تولید محتوای دقیق‌تر کمک می‌کند..." maxLength={1000} />
            </label>
          </div>
          <button className="generate" onClick={generate} disabled={loading || !filled || !dataProcessingNoticeAccepted}>

            {loading ? <><span className="spinner" /> در حال تولید محتوا...</> : <>✦ ساخت بسته محتوایی <span>←</span></>}

          </button>

          <div className="provider-disclosure" role="note">
            <strong>شفافیت پردازش داده‌ها</strong>
            <p>
              اطلاعات کسب‌وکار، مخاطب و پروفایل برند برای تولید محتوا از طریق زیرساخت پردازش هوشمند و پردازشگرهای فنی مورد استفاده این سرویس پردازش می‌شوند. داده‌های ارسالی ممکن است مطابق شرایط و سیاست‌های پردازش این زیرساخت‌ها نگهداری یا برای ارائه، ایمن‌سازی و بهبود خدمات استفاده شوند.
              اطلاعات محرمانه مشتریان، رمزها یا داده‌های شخصی حساس را وارد نکن.
            </p>
            <span className="provider-disclosure-link-note">با تأیید این اطلاعیه، پردازش داده‌ها برای تولید محتوا را می‌پذیری.</span>
            {dataProcessingNoticeAccepted ? (
              <div className="provider-disclosure-accepted-row">
                <span className="provider-disclosure-accepted">اطلاعیه را تأیید کرده‌ای.</span>
                <button type="button" className="provider-disclosure-revoke" disabled={dataNoticeSaving} onClick={() => void revokeDataProcessingNotice()}>
                  {dataNoticeSaving ? "در حال ثبت..." : "لغو تأیید"}
                </button>
              </div>
            ) : (
              <button type="button" className="secondary-button" disabled={dataNoticeSaving} onClick={() => void acceptDataProcessingNotice()}>
                {dataNoticeSaving ? "در حال ثبت..." : "مطالعه کردم و تأیید می‌کنم"}
              </button>
            )}
          </div>
          <p className="privacy-note">نام موضوع و ویژگی‌های واقعی الزامی هستند. تاریخچه در حساب کاربری تو ذخیره می‌شود.</p>

        </section>

        <section className="panel output-panel">

          <div className="section-head">

            <div><span className="step">۰۲</span><h2>استودیوی محتوا</h2></div>

            <span className="live-dot">● آماده</span>

          </div>

          {!content ? (

            <div className="empty-state">

              <div className="empty-icon">✧</div>

              <h3>بسته محتوایی اینجا نمایش داده می‌شود</h3>

              <p>اطلاعات کسب‌وکارت را وارد کن و روی ساخت بسته محتوایی بزن.</p>

              <div className="preview-chips"><span>کپشن</span><span>ریلز</span><span>۵ استوری</span><span>تبلیغ</span></div>

            </div>

          ) : (

            <>

              <div className="loaded-label">

                {selectedHistoryId ? "این بسته در حساب کاربری ذخیره شده است." : "این محتوا هنوز در تاریخچه ثبت نشده است."}

              </div>

              {selectedHistoryId && (
                <details className="versions-panel">
                  <summary className="versions-summary">
                    <div>
                      <b>تاریخچه نسخه‌های محتوا</b>
                      <small>نسخه‌های قبلی را مشاهده یا بازگردانی کن.</small>
                    </div>
                    <span>{contentVersions.length.toLocaleString("fa-IR")} نسخه</span>
                  </summary>
                  <div className="versions-body">
                    <div className="versions-toolbar">
                      <small>حداکثر ۱۰ نسخه اخیر نگهداری و نمایش داده می‌شود.</small>
                      <button className="history-backup" onClick={() => loadContentVersions(selectedHistoryId)} disabled={versionsLoading}>
                        {versionsLoading ? "در حال بارگذاری..." : "به‌روزرسانی"}
                      </button>
                    </div>
                    {versionsError && <div className="notice error">{versionsError}</div>}
                    {versionsLoading ? (
                      <div className="versions-empty">در حال بارگذاری نسخه‌ها...</div>
                    ) : contentVersions.length === 0 ? (
                      <div className="versions-empty">هنوز نسخه قبلی ثبت نشده است. با اولین ذخیره تغییرات، نسخه فعلی اینجا نگهداری می‌شود.</div>
                    ) : (
                      <div className="versions-list">
                        {contentVersions.map((version, index) => (
                          <div className="version-row" key={version.id}>
                            <div>
                              <b>نسخه قبلی {contentVersions.length - index}</b>
                              <small>{formatDate(version.createdAt)}</small>
                              <p>{(version.content.caption || "").slice(0, 110)}{(version.content.caption || "").length > 110 ? "…" : ""}</p>
                              {product._factoryMeta?.versionNotes?.[version.id] ? (
                                <small className="version-note">یادداشت: {product._factoryMeta.versionNotes[version.id]}</small>
                              ) : null}
                            </div>
                            <div className="version-row-actions">
                              <button className="history-backup" onClick={() => editContentVersionNote(version)}>یادداشت</button>
                              <button className="history-backup" onClick={() => setCompareVersionId(version.id)}>مقایسه</button>
                              <button className="history-open" onClick={() => restoreContentVersion(version)}>بازگردانی</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {comparingVersion && (
                      <section className="version-compare" aria-live="polite">
                        <div className="version-compare-heading">
                          <div>
                            <b>مقایسه نسخه قبلی با نسخه فعلی ذخیره‌شده</b>
                            <small>{formatDate(comparingVersion.createdAt)}</small>
                          </div>
                          <button className="history-backup" onClick={() => setCompareVersionId("")}>بستن مقایسه</button>
                        </div>
                        {versionCompareFields.map((field) => (
                          <article className="version-compare-field" key={field.id}>
                            <h4>{field.label}</h4>
                            <div className="version-compare-grid">
                              <div className="version-compare-column previous">
                                <b>نسخه قبلی</b>
                                <p>{field.previous || "—"}</p>
                              </div>
                              <div className="version-compare-column current">
                                <b>نسخه فعلی</b>
                                <p>{field.current || "—"}</p>
                              </div>
                            </div>
                          </article>
                        ))}
                      </section>
                    )}
                  </div>
                </details>
              )}

              {qualityAnalysis && (
                <details className="quality-panel">
                  <summary className="quality-summary">
                    <div>
                      <b>بررسی کیفیت ساختاری محتوا</b>
                      <small>بررسی متناسب با کانال، دعوت به اقدام و هماهنگی با برند</small>
                    </div>
                    <span className={qualityAnalysis.score >= 80 ? "quality-score good" : qualityAnalysis.score >= 60 ? "quality-score medium" : "quality-score low"}>
                      {qualityAnalysis.score.toLocaleString("fa-IR")} از ۱۰۰
                    </span>
                  </summary>
                  <div className="quality-checks">
                    {qualityAnalysis.checks.map((check) => (
                      <div className="quality-check" key={check.id}>
                        <span className={check.passed ? "quality-check-icon passed" : "quality-check-icon failed"}>{check.passed ? "✓" : "!"}</span>
                        <div>
                          <b>{check.label}</b>
                          <small>{check.detail}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="quality-disclaimer">این امتیاز یک بررسی خودکار و ساختاری است؛ صحت ادعاها و تناسب نهایی محتوا همچنان باید انسانی بازبینی شود.</p>
                </details>
              )}

              <nav className="tabs" aria-label="بخش‌های محتوا">

                {visibleTabs.map((tab) => (

                  <button key={tab.id} className={activeTab === tab.id ? "tab active" : "tab"} onClick={() => selectTab(tab.id)}>

                    {tab.label}

                  </button>

                ))}

              </nav>

              <div className="content-card">

                <div className="content-label">{visibleTabs.find((t) => t.id === activeTab)?.label || tabs.find((t) => t.id === activeTab)?.label}</div>

                <textarea

                  className="editor"

                  value={draftText}

                  onChange={(e) => setDraftText(e.target.value)}

                  rows={13}

                  dir="rtl"

                  aria-label="ویرایش محتوای تولیدشده"

                />

                {activeTab === "stories" && <p className="privacy-note">برای جدا کردن استوری‌ها، بین متن هر استوری یک خط خالی قرار بده.</p>}

                <div className="editor-actions">

                  <button className="copy-button" onClick={() => copyText(draftText)}>کپی این بخش</button>

                  <button className="secondary-button" onClick={saveEdits}>ذخیره تغییرات</button>

                </div>

                <div className="export-area">

                  <div className="export-heading">

                    <b>دانلود بسته کامل</b>

                    <span>همه بخش‌ها همراه با مشخصات کسب‌وکار و آخرین ویرایش فعلی</span>

                  </div>

                  <div className="export-buttons">

                    <button className="export-button" onClick={exportTXT}><span>↓</span> دانلود TXT</button>

                    <button className="export-button json" onClick={exportJSON}><span>↓</span> دانلود JSON</button>

                  </div>

                </div>

              </div>

              <MediaStudio
                key={`${selectedHistoryId || "draft"}-${(content.caption || "").slice(0, 48)}`}
                contentHistoryId={selectedHistoryId || null}
                stories={content.stories}
                initialPrompt={`یک تصویر تبلیغاتی حرفه‌ای برای برند ${product.businessName || brandProfile.brandName || "کسب‌وکار"} بساز. موضوع: ${product.name}. حوزه: ${product.category}. ویژگی‌های تأییدشده: ${product.features}. مخاطب: ${product.audience || brandProfile.audience}. هدف: ${product.goal}. لحن بصری: ${brandProfile.voice || product.tone}. ارزش پیشنهادی: ${brandProfile.valueProposition}. پیام اصلی محتوا: ${(content.caption || "").slice(0, 1000)}. از ساختن نوشته، قیمت، لوگو یا ادعای جدید خودداری کن.`.slice(0, 3000)}
              />

              <button className="secondary-button regenerate" onClick={generate} disabled={loading}>

                {loading ? "در حال تولید..." : "تولید یک نسخه جدید"}

              </button>

            </>

          )}

          {notice && <div className={`notice ${noticeType}`} role="status">{notice}</div>}

        </section>

      </div>

      <section className="history-section">

        <div className="history-heading">

          <div><span className="step">۰۳</span><h2>تاریخچه محتواها</h2></div>

          <div className="history-actions">

            <span className="history-count">{history.length.toLocaleString("fa-IR")} مورد بارگذاری‌شده</span>
            <button className="history-backup" onClick={exportSelectedHistory} disabled={!selectedBulkIds.length}>خروجی انتخاب‌شده ({selectedBulkIds.length})</button>

            <button className="history-backup" onClick={exportHistory} disabled={!history.length || historyBackupLoading}>{historyBackupLoading ? "در حال تهیه پشتیبان..." : "پشتیبان همه محتواها"}</button>

            <button className="clear-history" onClick={clearHistory} disabled={!history.length}>پاک کردن همه</button>

          </div>

        </div>

        {history.length > 0 && (
          <div className="history-toolbar">
            <input className="history-search" style={{ margin: 0 }} value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="جست‌وجو در محتواهای بارگذاری‌شده..." />
            <select value={historyFolderFilter} onChange={(e) => setHistoryFolderFilter(e.target.value)} aria-label="فیلتر پوشه">
              <option>همه پوشه‌ها</option>
              {Array.from(new Set(history.map((item) => item.product._factoryMeta?.folder || "عمومی"))).sort().map((folder) => <option key={folder}>{folder}</option>)}
            </select>
            <select value={historyReviewFilter} onChange={(e) => setHistoryReviewFilter(e.target.value as ContentReviewStatus | "all")} aria-label="فیلتر وضعیت بازبینی">
              <option value="all">همه وضعیت‌ها</option>
              {CONTENT_REVIEW_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
            <button className={historyFavoritesOnly ? "history-open" : "history-backup"} onClick={() => setHistoryFavoritesOnly((value) => !value)}>★ منتخب‌ها</button>
            <button className="history-backup" onClick={() => setSelectedBulkIds(filteredHistory.map((item) => item.id))} disabled={!filteredHistory.length}>انتخاب نتایج</button>
            <button className="history-backup" onClick={() => setSelectedBulkIds([])} disabled={!selectedBulkIds.length}>لغو انتخاب</button>
          </div>
        )}

        {!historyReady ? (

          <div className="history-empty">در حال بارگذاری تاریخچه...</div>

        ) : history.length === 0 ? (

          <div className="history-empty"><span className="history-empty-icon">◷</span><b>هنوز محتوایی ذخیره نشده است.</b><p>بعد از اولین تولید، بسته‌ها در حساب کاربری تو نگهداری می‌شوند.</p></div>

        ) : filteredHistory.length === 0 ? (

          <div className="history-empty">موردی با این عبارت پیدا نشد.</div>

        ) : (

          <div className="history-list">

            {filteredHistory.map((item) => (

              <article className="history-item" key={item.id}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0, flex: 1 }}>
                  <input type="checkbox" aria-label="انتخاب محتوا برای خروجی گروهی" checked={selectedBulkIds.includes(item.id)} onChange={() => toggleBulkSelection(item.id)} style={{ width: 17, marginTop: 4 }} />
                  <div className="history-info">

                  <b>{item.product.name || "محتوا بدون نام"}</b>

                  <span>{businessTypeLabel(item.product.businessType)} · {item.product.category || item.product.goal}</span>

                  <small>{formatDate(item.createdAt)}</small>
                  <small>پوشه: {item.product._factoryMeta?.folder || "عمومی"} · برچسب‌ها: {(item.product._factoryMeta?.tags || []).join("، ") || "ندارد"}</small>
                  <small>وضعیت بازبینی: {getContentReviewStatusLabel(item.product._factoryMeta?.reviewStatus)}
                    {item.product._factoryMeta?.reviewUpdatedAt ? ` · آخرین تغییر: ${formatDate(item.product._factoryMeta.reviewUpdatedAt)}` : ""}
                  </small>
                  {item.product._factoryMeta?.reviewNote ? (
                    <small className="history-review-note" title={item.product._factoryMeta.reviewNote}>
                      یادداشت بازبینی: {item.product._factoryMeta.reviewNote}
                    </small>
                  ) : null}
                  </div>
                </div>

                <div className="history-item-actions">
                  <select
                    className="history-review-select"
                    value={normalizeContentReviewStatus(item.product._factoryMeta?.reviewStatus)}
                    onChange={(e) => {
                      const reviewStatus = normalizeContentReviewStatus(e.target.value);
                      if (reviewStatus === "changes_requested") {
                        const note = window.prompt("توضیح اصلاحات لازم (حداکثر ۵۰۰ نویسه):", item.product._factoryMeta?.reviewNote || "");
                        if (note === null) return;
                        updateHistoryMeta(item, { reviewStatus, reviewNote: note.trim().slice(0, 500) });
                      } else {
                        updateHistoryMeta(item, { reviewStatus });
                      }
                    }}
                    aria-label={`وضعیت بازبینی — ${item.product.name || "محتوا"}`}
                  >
                    {CONTENT_REVIEW_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                  <button className="history-backup" title="علاقه‌مندی" onClick={() => updateHistoryMeta(item, { favorite: !(item.product._factoryMeta?.favorite || false) })}>{item.product._factoryMeta?.favorite ? "★" : "☆"}</button>
                  <button className="history-backup" onClick={() => {
                    const note = window.prompt("یادداشت بازبینی (حداکثر ۵۰۰ نویسه):", item.product._factoryMeta?.reviewNote || "");
                    if (note !== null) updateHistoryMeta(item, { reviewNote: note.trim().slice(0, 500) });
                  }}>یادداشت</button>
                  <button className="history-backup" onClick={() => {
                    const raw = window.prompt("برچسب‌ها را با ویرگول جدا کن:", (item.product._factoryMeta?.tags || []).join(", "));
                    if (raw !== null) updateHistoryMeta(item, { tags: Array.from(new Set(raw.split(",").map((tag) => tag.trim()).filter(Boolean))).slice(0, 12) });
                  }}>برچسب</button>
                  <button className="history-backup" onClick={() => {
                    const folder = window.prompt("نام پوشه:", item.product._factoryMeta?.folder || "عمومی");
                    if (folder !== null && folder.trim()) updateHistoryMeta(item, { folder: folder.trim().slice(0, 40) });
                  }}>پوشه</button>

                  <JalaliDateTimePicker
                    value={item.product._factoryMeta?.scheduledAt || ""}
                    onChange={(scheduledAt) => updateHistoryMeta(item, { scheduledAt })}
                    label={`زمان انتشار — ${item.product.name || "محتوا"}`}
                  />

                  <button className="history-open" onClick={() => openHistory(item)}>باز کردن</button>

                  <button className="history-delete" onClick={() => deleteHistory(item.id)}>حذف</button>

                </div>

              </article>

            ))}

          </div>

        )}

        {historyHasMore && historyReady && (
          <div className="history-load-more">
            <button className="history-backup" onClick={loadMoreHistory} disabled={historyLoadingMore}>
              {historyLoadingMore ? "در حال بارگذاری..." : "بارگذاری ۵۰ محتوای قدیمی‌تر"}
            </button>
          </div>
        )}

        <p className="privacy-note">تاریخچه به‌صورت صفحه‌ای بارگذاری می‌شود؛ جست‌وجو، آمار و تقویم بر اساس موارد بارگذاری‌شده محاسبه می‌شوند.</p>

      </section>

      <section className="bottom-row">

        <div className="mini-card"><span className="mini-icon">✎</span><div><b>ویرایش و ذخیره</b><small>متن هر بخش را تغییر بده و در تاریخچه نگه دار.</small></div></div>

        <div className="mini-card"><span className="mini-icon">↓</span><div><b>خروجی و پشتیبان</b><small>دانلود بسته‌ها به صورت TXT و JSON.</small></div></div>

      </section>

      <footer>AI Content Factory <span>·</span> نسخه ۲.۰ <span>·</span> ابزار تولید محتوای کسب‌وکارها</footer>

    </main>

  );

}