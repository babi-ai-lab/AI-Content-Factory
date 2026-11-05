"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";
import { analyzeContent } from "@/lib/content-quality.mjs";

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

type Product = {
  businessType: BusinessType;
  contentTemplate: ContentTemplateId;
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
  _factoryMeta?: { tags: string[]; folder: string; favorite: boolean; scheduledAt?: string };
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
};

const initialBrandProfile: BrandProfile = {
  brandName: "",
  tagline: "",
  audience: "",
  valueProposition: "",
  voice: "",
  preferredTerms: "",
  avoidTerms: "",
  cta: "",
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

function normalizeProduct(value: Partial<Product> | null | undefined): Product {
  return { ...initialProduct, ...(value || {}), businessType: value?.businessType || "retail", contentTemplate: value?.contentTemplate || "balanced", _factoryMeta: { tags: [], folder: "عمومی", favorite: false, scheduledAt: "", ...(value?._factoryMeta || {}) } };
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

const STORAGE_KEY = "ai-content-factory-history-v1";

const MAX_HISTORY = 50;

const initialProduct: Product = {
  businessType: "retail",
  contentTemplate: "balanced",
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

  { id: "caption", label: "کپشن فروش" },

  { id: "reel", label: "سناریوی ریلز" },

  { id: "stories", label: "استوری‌ها" },

  { id: "ad", label: "متن تبلیغاتی" },

] as const;

type TabId = (typeof tabs)[number]["id"];

function createId() {

  return typeof crypto !== "undefined" && "randomUUID" in crypto

    ? crypto.randomUUID()

    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

}

function toLocalDateTimeInput(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function formatDate(value: string) {

  return new Date(value).toLocaleString("fa-IR", {

    year: "numeric",

    month: "short",

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

  return [

    "AI CONTENT FACTORY",

    "بسته محتوایی کسب‌وکار",

    "========================================",

    "",

    "مشخصات کسب‌وکار و موضوع",

    "----------------------------------------",

    `نام محصول یا خدمت: ${product.name}`,

    `قیمت: ${product.price || "ثبت نشده"}`,

    `نوع کسب‌وکار: ${businessTypeLabel(product.businessType)}`,
    `نام برند/کسب‌وکار: ${product.businessName || "ثبت نشده"}`,
    `دسته‌بندی/موضوع: ${product.category || "ثبت نشده"}`,

    `جنس: ${product.fabric || "ثبت نشده"}`,

    `رنگ‌ها: ${product.colors || "ثبت نشده"}`,
    `محدوده فعالیت: ${product.serviceArea || "ثبت نشده"}`,
    `پیشنهاد ویژه: ${product.offer || "ثبت نشده"}`,
    `مزیت رقابتی: ${product.differentiators || "ثبت نشده"}`,
    `اطلاعات تکمیلی: ${product.additionalInfo || "ثبت نشده"}`,

    `ویژگی‌ها: ${product.features}`,

    `مخاطب هدف: ${product.audience || "ثبت نشده"}`,

    `هدف محتوا: ${product.goal}`,
    `قالب تولید: ${contentTemplates.find((item) => item.value === product.contentTemplate)?.label || "متعادل و عمومی"}`,

    `لحن برند: ${product.tone}`,

    "",

    "۱. کپشن معرفی و بازاریابی",

    "----------------------------------------",

    content.caption,

    "",

    "۲. سناریوی ریلز",

    "----------------------------------------",

    content.reel,

    "",

    "۳. استوری‌ها",

    "----------------------------------------",

    ...content.stories.map((story, i) => `استوری ${i + 1}\n${story}\n`),

    "",

    "۴. متن تبلیغاتی",

    "----------------------------------------",

    content.ad,

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

  const [product, setProduct] = useState<Product>(initialProduct);
  const [brandProfile, setBrandProfile] = useState<BrandProfile>(initialBrandProfile);
  const [brandProfileSaving, setBrandProfileSaving] = useState(false);
  const [brandProfileNotice, setBrandProfileNotice] = useState("");

  const [content, setContent] = useState<Content | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>("caption");

  const [draftText, setDraftText] = useState("");

  const [loading, setLoading] = useState(false);

  const [notice, setNotice] = useState("");

  const [noticeType, setNoticeType] = useState<"success" | "error" | "info">("info");

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<{ createdAt: string; id: string } | null>(null);
  const [contentVersions, setContentVersions] = useState<ContentVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState("");
  const versionsRequestRef = useRef(0);

  const [historyReady, setHistoryReady] = useState(false);

  const [selectedHistoryId, setSelectedHistoryId] = useState("");

  const [historySearch, setHistorySearch] = useState("");
  const [historyFolderFilter, setHistoryFolderFilter] = useState("همه پوشه‌ها");
  const [historyFavoritesOnly, setHistoryFavoritesOnly] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);

  const [analyticsPeriod, setAnalyticsPeriod] = useState<"7" | "30" | "all">("30");

  function showNotice(message: string, type: "success" | "error" | "info" = "info") {

    setNotice(message);

    setNoticeType(type);

  }

  // بررسی نشست کاربر و گوش دادن به تغییر وضعیت ورود

  useEffect(() => {

    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {

      if (!mounted) return;

      if (error) {

        setAuthMessage(error.message);

      }

      setUser(

        data.session?.user

          ? { id: data.session.user.id, email: data.session.user.email }

          : null

      );
      setBrandProfile(normalizeBrandProfile(data.session?.user.user_metadata?.aiContentFactoryBrandProfile));

      setAuthReady(true);

    });

    const {

      data: { subscription },

    } = supabase.auth.onAuthStateChange((event, session) => {

      if (!mounted) return;

      const nextUser = session?.user
        ? { id: session.user.id, email: session.user.email }
        : null;

      setUser((current) => {
        if (current?.id === nextUser?.id && current?.email === nextUser?.email) {
          return current;
        }
        return nextUser;
      });

      setBrandProfile(normalizeBrandProfile(session?.user.user_metadata?.aiContentFactoryBrandProfile));

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

      subscription.unsubscribe();

    };

  }, []);

  // بارگذاری تاریخچه کاربر و انتقال تاریخچه قدیمی مرورگر در صورت نیاز

  useEffect(() => {

    if (!user) {

      setHistory([]);
      versionsRequestRef.current += 1;
        setContentVersions([]);
      setVersionsError("");

      setHistoryReady(false);
      setBrandProfile(initialBrandProfile);

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
          .limit(MAX_HISTORY);

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

                const records = oldItems.slice(0, MAX_HISTORY).map((item) => ({

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
            .limit(MAX_HISTORY);

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
          setHistoryHasMore(rows.length === MAX_HISTORY);

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
        .limit(MAX_HISTORY);

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
      setHistoryHasMore(rows.length === MAX_HISTORY);
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

    if (authPassword.length < 6) {

      setAuthMessage("رمز عبور باید حداقل ۶ کاراکتر باشد.");

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

      setAuthMessage(

        error instanceof Error ? error.message : "خطا در ورود یا ثبت‌نام."

      );

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
      const { error } = await supabase.auth.updateUser({
        data: { aiContentFactoryBrandProfile: normalized },
      });

      if (error) throw error;
      setBrandProfile(normalized);
      setBrandProfileNotice("پروفایل برند در حساب کاربری ذخیره شد و در تولیدهای بعدی استفاده می‌شود.");
    } catch (error) {
      setBrandProfileNotice(
        error instanceof Error ? error.message : "ذخیره پروفایل برند انجام نشد."
      );
    } finally {
      setBrandProfileSaving(false);
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
    setBrandProfileNotice("");

    setHistory([]);
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
      const meta = item.product._factoryMeta || { tags: [], folder: "عمومی", favorite: false };
      const searchable = [item.product.name, item.product.category, item.product.goal, item.product.businessName, item.product.businessType, item.product.contentTemplate, item.product.serviceArea, ...meta.tags, meta.folder, meta.scheduledAt || "", item.content.caption, item.content.reel, item.content.ad, ...item.content.stories].join(" ").toLowerCase();
      const matchesSearch = !term || searchable.includes(term);
      const matchesFolder = historyFolderFilter === "همه پوشه‌ها" || meta.folder === historyFolderFilter;
      const matchesFavorite = !historyFavoritesOnly || meta.favorite;
      return matchesSearch && matchesFolder && matchesFavorite;
    });
  }, [history, historySearch, historyFolderFilter, historyFavoritesOnly]);

  const analytics = useMemo(() => {
    const now = new Date();
    const cutoff = analyticsPeriod === "all"
      ? null
      : new Date(now.getTime() - Number(analyticsPeriod) * 24 * 60 * 60 * 1000);
    const entries = history.filter((item) => {
      const date = new Date(item.createdAt);
      return !Number.isNaN(date.getTime()) && (!cutoff || date >= cutoff);
    });
    const countByDay = new Map<string, number>();
    const dayLabels = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return { key, label: date.toLocaleDateString("fa-IR", { weekday: "short" }) };
    });
    entries.forEach((item) => {
      const date = new Date(item.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      countByDay.set(key, (countByDay.get(key) || 0) + 1);
    });
    const trend = dayLabels.map((day) => ({ ...day, count: countByDay.get(day.key) || 0 }));
    const maxDaily = Math.max(1, ...trend.map((day) => day.count));
    const byBusiness = businessTypes
      .map((type) => ({
        label: type.label,
        count: entries.filter((item) => item.product.businessType === type.value).length,
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
    const formats = [
      { label: "کپشن", count: entries.filter((item) => Boolean(item.content.caption?.trim())).length },
      { label: "سناریوی ریلز", count: entries.filter((item) => Boolean(item.content.reel?.trim())).length },
      { label: "استوری", count: entries.reduce((sum, item) => sum + (item.content.stories?.length || 0), 0) },
      { label: "تبلیغ", count: entries.filter((item) => Boolean(item.content.ad?.trim())).length },
    ];
    const totalPieces = formats.reduce((sum, item) => sum + item.count, 0);
    const favorites = entries.filter((item) => item.product._factoryMeta?.favorite).length;
    const folders = new Set(entries.map((item) => item.product._factoryMeta?.folder || "عمومی")).size;
    return { entries, trend, maxDaily, byBusiness, formats, totalPieces, favorites, folders };
  }, [history, analyticsPeriod]);

  const qualityAnalysis = useMemo(() => {
    if (!content) return null;
    const editedContent = updateTabContent(content, activeTab, draftText);
    return analyzeContent(editedContent, brandProfile);
  }, [content, activeTab, draftText, brandProfile]);

  const scheduledItems = useMemo(() => history
    .filter((item) => {
      const value = item.product._factoryMeta?.scheduledAt;
      return Boolean(value && !Number.isNaN(new Date(value).getTime()));
    })
    .sort((a, b) =>
      new Date(a.product._factoryMeta!.scheduledAt!).getTime() -
      new Date(b.product._factoryMeta!.scheduledAt!).getTime()
    ), [history]);

  const upcomingItems = scheduledItems.filter((item) =>
    new Date(item.product._factoryMeta!.scheduledAt!).getTime() >= Date.now()
  );
  const overdueItems = scheduledItems.filter((item) =>
    new Date(item.product._factoryMeta!.scheduledAt!).getTime() < Date.now()
  );

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

          ? "خروجی نمونه ساخته و در حساب تو ذخیره شد. برای تولید واقعی، تنظیمات Gemini را بررسی کن."

          : `محتوا با موفقیت تولید و آنلاین ذخیره شد${data.model ? ` (${data.model})` : ""}.`,

        data.mode === "demo" ? "info" : "success"

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

    const previousItem = history.find((item) => item.id === selectedHistoryId);
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

  async function restoreContentVersion(version: ContentVersion) {
    if (!selectedHistoryId || !user?.id) return;

    const currentItem = history.find((item) => item.id === selectedHistoryId);
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
    setDraftText(getTabText(version.content, activeTab));
    setHistory((old) =>
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

          content: working,

        },

        null,

        2

      ),

      "application/json"

    );

    showNotice("فایل JSON دانلود شد.", "success");

  }

  async function updateHistoryMeta(item: HistoryItem, patch: Partial<{ tags: string[]; folder: string; favorite: boolean; scheduledAt: string }>) {
    const current = item.product._factoryMeta || { tags: [], folder: "عمومی", favorite: false, scheduledAt: "" };
    const nextProduct = { ...item.product, _factoryMeta: { ...current, ...patch } };
    const { error } = await supabase.from("content_history").update({ product: nextProduct }).eq("id", item.id);
    if (error) return showNotice("ذخیره مشخصات کتابخانه ناموفق بود: " + error.message, "error");
    setHistory((old) => old.map((entry) => entry.id === item.id ? { ...entry, product: nextProduct } : entry));
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

    if (selectedHistoryId === id) {

      setSelectedHistoryId("");
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
    versionsRequestRef.current += 1;
        setContentVersions([]);
    setVersionsError("");

    setSelectedHistoryId("");

    setContent(null);

    showNotice("تاریخچه حساب کاربری پاک شد.", "success");

  }

  function exportHistory() {

    if (!history.length) return showNotice("تاریخچه خالی است.", "error");

    downloadFile(

      "AI-Content-Factory-History.json",

      JSON.stringify(history, null, 2),

      "application/json"

    );

    showNotice("نسخه پشتیبان تاریخچه دانلود شد.", "success");

  }

  if (!authReady) {

    return (

      <main className="shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>

        <div className="panel">در حال بررسی حساب کاربری...</div>

      </main>

    );

  }

  if (!user) {

    return (

      <main

        className="shell"

        style={{

          minHeight: "100vh",

          display: "grid",

          placeItems: "center",

          paddingTop: 35,

          paddingBottom: 35,

        }}

      >

        <section className="panel" style={{ width: "100%", maxWidth: 460, padding: 30 }}>

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

                placeholder="حداقل ۶ کاراکتر"

                autoComplete={authMode === "signup" ? "new-password" : "current-password"}

                minLength={6}

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

          <span className="brand-mark">✳</span>

          <span>AI Content Factory</span>

        </a>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

          <span className="top-tag" dir="ltr">{user.email}</span>

          <button className="history-backup" onClick={logout}>خروج</button>

        </div>

      </header>

      <section className="hero">

        <div>

          <div className="eyebrow">استودیوی هوشمند تولید محتوای کسب‌وکارها</div>

          <h1>

            از اطلاعات کسب‌وکارت،
            <br />

            <em>محتوای آماده انتشار</em> بساز.

          </h1>

          <p>

            برای هر نوع کسب‌وکار کپشن، سناریوی ریلز، پنج استوری و متن تبلیغاتی تولید کن؛

            ویرایش کن، ذخیره کن و خروجی بگیر.

          </p>

        </div>

        <div className="hero-orb">

          <span>✦</span>

          <small>CONTENT<br />STUDIO</small>

        </div>

      </section>

      <details className="brand-profile-section">
        <summary className="brand-profile-summary">
          <div>
            <span className="step">پروفایل برند</span>
            <h2>هویت ثابت کسب‌وکار</h2>
            <p>یک‌بار مشخصات برند را ثبت کن تا در تولیدهای بعدی به‌صورت خودکار رعایت شود.</p>
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
            <p>آمار بر اساس ۵۰ محتوای اخیر بارگذاری‌شده از تاریخچه همین حساب محاسبه می‌شود.</p>
          </div>
          <div className="analytics-period" role="group" aria-label="بازه آماری">
            <button type="button" className={analyticsPeriod === "7" ? "active" : ""} onClick={() => setAnalyticsPeriod("7")}>۷ روز</button>
            <button type="button" className={analyticsPeriod === "30" ? "active" : ""} onClick={() => setAnalyticsPeriod("30")}>۳۰ روز</button>
            <button type="button" className={analyticsPeriod === "all" ? "active" : ""} onClick={() => setAnalyticsPeriod("all")}>همه زمان‌ها</button>
          </div>
        </div>

        {!user ? (
          <div className="analytics-empty">برای مشاهده آمار اختصاصی، ابتدا وارد حساب کاربری شو.</div>
        ) : !historyReady ? (
          <div className="analytics-empty">در حال محاسبه آمار...</div>
        ) : (
          <>
            <div className="analytics-kpis">
              <article className="analytics-kpi"><span>محتوای ذخیره‌شده</span><strong>{analytics.entries.length.toLocaleString("fa-IR")}</strong><small>در بازه انتخاب‌شده</small></article>
              <article className="analytics-kpi"><span>خروجی متنی</span><strong>{analytics.totalPieces.toLocaleString("fa-IR")}</strong><small>کپشن، ریلز، استوری و تبلیغ</small></article>
              <article className="analytics-kpi"><span>محتوای منتخب</span><strong>{analytics.favorites.toLocaleString("fa-IR")}</strong><small>ذخیره‌شده در علاقه‌مندی‌ها</small></article>
              <article className="analytics-kpi"><span>پوشه‌های فعال</span><strong>{analytics.folders.toLocaleString("fa-IR")}</strong><small>در بازه انتخاب‌شده</small></article>
            </div>

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
            <p>برای ۵۰ محتوای اخیر زمان انتشار تعیین کن؛ این بخش برنامه‌ریزی می‌کند و انتشار خودکار انجام نمی‌دهد.</p>
          </div>
          <div className="planner-total"><strong>{scheduledItems.length.toLocaleString("fa-IR")}</strong><span>محتوای زمان‌بندی‌شده</span></div>
        </div>

        {scheduledItems.length === 0 ? (
          <div className="planner-empty">هنوز محتوایی زمان‌بندی نشده است. از قسمت تاریخچه برای هر بسته زمان انتشار تعیین کن.</div>
        ) : (
          <div className="planner-columns">
            <div className="planner-column">
              <h3>انتشارهای پیش‌رو <span>{upcomingItems.length.toLocaleString("fa-IR")}</span></h3>
              {upcomingItems.length ? upcomingItems.slice(0, 5).map((item) => (
                <div className="planner-item" key={item.id}>
                  <div><b>{item.product.name || "محتوا بدون نام"}</b><small>{formatDate(item.product._factoryMeta!.scheduledAt!)}</small></div>
                  <button className="history-open" onClick={() => openHistory(item)}>باز کردن</button>
                </div>
              )) : <p className="planner-empty-inline">برنامه‌ای برای آینده ثبت نشده است.</p>}
            </div>
            <div className="planner-column">
              <h3>موعدهای گذشته <span>{overdueItems.length.toLocaleString("fa-IR")}</span></h3>
              {overdueItems.length ? overdueItems.slice(-3).reverse().map((item) => (
                <div className="planner-item overdue" key={item.id}>
                  <div><b>{item.product.name || "محتوا بدون نام"}</b><small>{formatDate(item.product._factoryMeta!.scheduledAt!)}</small></div>
                  <button className="history-open" onClick={() => openHistory(item)}>باز کردن</button>
                </div>
              )) : <p className="planner-empty-inline">موردی با موعد گذشته وجود ندارد.</p>}
            </div>
          </div>
        )}
      </section>

      <div className="workspace">

        <section className="panel form-panel">

          <div className="section-head">

            <div><span className="step">۰۱</span><h2>اطلاعات کسب‌وکار</h2></div>

            <span className="muted">اطلاعات واقعی و دقیق وارد کن</span>

          </div>

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
              قالب تخصصی تولید محتوا
              <select value={product.contentTemplate} onChange={(e) => update("contentTemplate", e.target.value as ContentTemplateId)}>
                {contentTemplates.map((template) => (
                  <option key={template.value} value={template.value}>{template.label} — {template.description}</option>
                ))}
              </select>
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
          <button className="generate" onClick={generate} disabled={loading || !filled}>

            {loading ? <><span className="spinner" /> در حال تولید محتوا...</> : <>✦ ساخت بسته محتوایی <span>←</span></>}

          </button>

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
                            </div>
                            <button className="history-open" onClick={() => restoreContentVersion(version)}>بازگردانی</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              )}

              {qualityAnalysis && (
                <details className="quality-panel">
                  <summary className="quality-summary">
                    <div>
                      <b>بررسی کیفیت ساختاری محتوا</b>
                      <small>کپشن، CTA، استوری‌ها، ریلز و هماهنگی با برند</small>
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

                {tabs.map((tab) => (

                  <button key={tab.id} className={activeTab === tab.id ? "tab active" : "tab"} onClick={() => selectTab(tab.id)}>

                    {tab.label}

                  </button>

                ))}

              </nav>

              <div className="content-card">

                <div className="content-label">{tabs.find((t) => t.id === activeTab)?.label}</div>

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

            <button className="history-backup" onClick={exportHistory} disabled={!history.length}>پشتیبان تاریخچه</button>

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
                  </div>
                </div>

                <div className="history-item-actions">
                  <button className="history-backup" title="علاقه‌مندی" onClick={() => updateHistoryMeta(item, { favorite: !(item.product._factoryMeta?.favorite || false) })}>{item.product._factoryMeta?.favorite ? "★" : "☆"}</button>
                  <button className="history-backup" onClick={() => {
                    const raw = window.prompt("برچسب‌ها را با ویرگول جدا کن:", (item.product._factoryMeta?.tags || []).join(", "));
                    if (raw !== null) updateHistoryMeta(item, { tags: Array.from(new Set(raw.split(",").map((tag) => tag.trim()).filter(Boolean))).slice(0, 12) });
                  }}>برچسب</button>
                  <button className="history-backup" onClick={() => {
                    const folder = window.prompt("نام پوشه:", item.product._factoryMeta?.folder || "عمومی");
                    if (folder !== null && folder.trim()) updateHistoryMeta(item, { folder: folder.trim().slice(0, 40) });
                  }}>پوشه</button>

                  <label className="schedule-control">
                    <span>زمان انتشار</span>
                    <input
                      type="datetime-local"
                      aria-label={`زمان انتشار ${item.product.name || "محتوا"}`}
                      value={toLocalDateTimeInput(item.product._factoryMeta?.scheduledAt)}
                      onChange={(e) => updateHistoryMeta(item, { scheduledAt: toIsoDateTime(e.target.value) })}
                    />
                  </label>

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