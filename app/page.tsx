"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

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

type Product = {
  businessType: BusinessType;
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
  _factoryMeta?: { tags: string[]; folder: string; favorite: boolean };
};

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
  return { ...initialProduct, ...(value || {}), businessType: value?.businessType || "retail", _factoryMeta: { tags: [], folder: "عمومی", favorite: false, ...(value?._factoryMeta || {}) } };
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

const STORAGE_KEY = "ai-content-factory-history-v1";

const MAX_HISTORY = 50;

const initialProduct: Product = {
  businessType: "retail",
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

  const [content, setContent] = useState<Content | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>("caption");

  const [draftText, setDraftText] = useState("");

  const [loading, setLoading] = useState(false);

  const [notice, setNotice] = useState("");

  const [noticeType, setNoticeType] = useState<"success" | "error" | "info">("info");

  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [historyReady, setHistoryReady] = useState(false);

  const [selectedHistoryId, setSelectedHistoryId] = useState("");

  const [historySearch, setHistorySearch] = useState("");
  const [historyFolderFilter, setHistoryFolderFilter] = useState("همه پوشه‌ها");
  const [historyFavoritesOnly, setHistoryFavoritesOnly] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);

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

      setAuthReady(true);

    });

    const {

      data: { subscription },

    } = supabase.auth.onAuthStateChange((_event, session) => {

      if (!mounted) return;

      setUser(

        session?.user

          ? { id: session.user.id, email: session.user.email }

          : null

      );

      setHistory([]);

      setHistoryReady(false);

      setSelectedHistoryId("");

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

      setHistoryReady(false);

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

  async function logout() {

    const { error } = await supabase.auth.signOut();

    if (error) {

      showNotice(`خطا در خروج: ${error.message}`, "error");

      return;

    }

    setContent(null);

    setProduct(initialProduct);

    setHistory([]);

    setSelectedHistoryId("");

    showNotice("از حساب کاربری خارج شدی.", "success");

  }

  const filled = useMemo(

    () => product.name.trim().length > 1 && product.features.trim().length > 2,

    [product.name, product.features]

  );

  const filteredHistory = useMemo(() => {

    const term = historySearch.trim().toLowerCase();

    if (!term) return history;

    return history.filter((item) => {
      const meta = item.product._factoryMeta || { tags: [], folder: "عمومی", favorite: false };
      const searchable = [item.product.name, item.product.category, item.product.goal, item.product.businessName, item.product.businessType, item.product.serviceArea, ...meta.tags, meta.folder, item.content.caption, item.content.reel, item.content.ad, ...item.content.stories].join(" ").toLowerCase();
      return (!term || searchable.includes(term)) && (historyFolderFilter === "همه پوشه‌ها" || meta.folder === historyFolderFilter) && (!historyFavoritesOnly || meta.favorite);
    });
  }, [history, historySearch, historyFolderFilter, historyFavoritesOnly]);

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
  body: JSON.stringify(product),
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

      setHistory((old) => [newItem, ...old].slice(0, MAX_HISTORY));

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

    const updatedContent = currentWorkingContent();

    if (!updatedContent) return;
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

    showNotice("تغییرات در دیتابیس آنلاین ذخیره شد.", "success");

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

  async function updateHistoryMeta(item: HistoryItem, patch: Partial<{ tags: string[]; folder: string; favorite: boolean }>) {
    const current = item.product._factoryMeta || { tags: [], folder: "عمومی", favorite: false };
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

      setContent(null);

    }

    showNotice("بسته از تاریخچه آنلاین حذف شد.", "success");

  }

  async function clearHistory() {

    if (!history.length) return;

    if (!window.confirm("تمام تاریخچه حساب کاربری حذف شود؟ این کار قابل بازگشت نیست.")) return;

    const ids = history.map((item) => item.id);

    const { error } = await supabase

      .from("content_history")

      .delete()

      .in("id", ids);

    if (error) {

      showNotice(`پاک کردن تاریخچه ناموفق بود: ${error.message}`, "error");

      return;

    }

    setHistory([]);

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

            <span className="history-count">{history.length.toLocaleString("fa-IR")} از {MAX_HISTORY}</span>
            <button className="history-backup" onClick={exportSelectedHistory} disabled={!selectedBulkIds.length}>خروجی انتخاب‌شده ({selectedBulkIds.length})</button>

            <button className="history-backup" onClick={exportHistory} disabled={!history.length}>پشتیبان تاریخچه</button>

            <button className="clear-history" onClick={clearHistory} disabled={!history.length}>پاک کردن همه</button>

          </div>

        </div>

        {history.length > 0 && (
          <div className="history-toolbar">
            <input className="history-search" style={{ margin: 0 }} value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="جست‌وجو در نام، موضوع، برچسب یا پوشه..." />
            <select value={historyFolderFilter} onChange={(e) => setHistoryFolderFilter(e.target.value)} aria-label="فیلتر پوشه">
              <option>همه پوشه‌ها</option>
              {[...new Set(history.map((item) => item.product._factoryMeta?.folder || "عمومی"))].sort().map((folder) => <option key={folder}>{folder}</option>)}
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
                    if (raw !== null) updateHistoryMeta(item, { tags: [...new Set(raw.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 12) });
                  }}>برچسب</button>
                  <button className="history-backup" onClick={() => {
                    const folder = window.prompt("نام پوشه:", item.product._factoryMeta?.folder || "عمومی");
                    if (folder !== null && folder.trim()) updateHistoryMeta(item, { folder: folder.trim().slice(0, 40) });
                  }}>پوشه</button>

                  <button className="history-open" onClick={() => openHistory(item)}>باز کردن</button>

                  <button className="history-delete" onClick={() => deleteHistory(item.id)}>حذف</button>

                </div>

              </article>

            ))}

          </div>

        )}

        <p className="privacy-note">تاریخچه به حساب کاربری تو متصل است و پس از ورود از دستگاه‌های دیگر نیز قابل دسترسی خواهد بود.</p>

      </section>

      <section className="bottom-row">

        <div className="mini-card"><span className="mini-icon">✎</span><div><b>ویرایش و ذخیره</b><small>متن هر بخش را تغییر بده و در تاریخچه نگه دار.</small></div></div>

        <div className="mini-card"><span className="mini-icon">↓</span><div><b>خروجی و پشتیبان</b><small>دانلود بسته‌ها به صورت TXT و JSON.</small></div></div>

      </section>

      <footer>AI Content Factory <span>·</span> نسخه ۲.۰ <span>·</span> ابزار تولید محتوای کسب‌وکارها</footer>

    </main>

  );

}