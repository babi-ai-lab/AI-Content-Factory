"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  name: string;
  price: string;
  category: string;
  fabric: string;
  colors: string;
  features: string;
  audience: string;
  goal: string;
  tone: string;
};

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

const STORAGE_KEY = "ai-content-factory-history-v1";
const MAX_HISTORY = 50;

const initialProduct: Product = {
  name: "",
  price: "",
  category: "مانتو",
  fabric: "",
  colors: "",
  features: "",
  audience: "",
  goal: "افزایش فروش",
  tone: "صمیمی و حرفه‌ای",
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
    .map((story) => story.replace(/^\s*\d+[\.\)\-]\s*/, "").trim())
    .filter(Boolean);

  return { ...content, stories };
}

function safeFileName(name: string) {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
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
    "بسته محتوایی محصول",
    "========================================",
    "",
    "مشخصات محصول",
    "----------------------------------------",
    `نام محصول: ${product.name}`,
    `قیمت: ${product.price || "ثبت نشده"}`,
    `دسته‌بندی: ${product.category}`,
    `جنس: ${product.fabric || "ثبت نشده"}`,
    `رنگ‌ها: ${product.colors || "ثبت نشده"}`,
    `ویژگی‌ها: ${product.features}`,
    `مخاطب هدف: ${product.audience || "ثبت نشده"}`,
    `هدف محتوا: ${product.goal}`,
    `لحن برند: ${product.tone}`,
    "",
    "۱. کپشن فروش",
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setHistory(parsed.slice(0, MAX_HISTORY));
        }
      }
    } catch (error) {
      console.error("History read error:", error);
    } finally {
      setHistoryReady(true);
    }
  }, []);

  useEffect(() => {
    if (!historyReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error("History save error:", error);
      showNotice("فضای ذخیره مرورگر کافی نیست؛ چند مورد از تاریخچه را حذف کن.", "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, historyReady]);

  const filled = useMemo(
    () => product.name.trim().length > 1 && product.features.trim().length > 2,
    [product.name, product.features]
  );

  const filteredHistory = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    if (!term) return history;
    return history.filter((item) =>
      `${item.product.name} ${item.product.category} ${item.product.goal}`
        .toLowerCase()
        .includes(term)
    );
  }, [history, historySearch]);

  function showNotice(message: string, type: "success" | "error" | "info" = "info") {
    setNotice(message);
    setNoticeType(type);
  }

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
      showNotice("نام محصول و ویژگی‌های واقعی آن را وارد کن.", "error");
      return;
    }

    setLoading(true);
    showNotice("در حال ارتباط با هوش مصنوعی و ساخت محتوا...", "info");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      const newItem: HistoryItem = {
        id: createId(),
        createdAt: new Date().toISOString(),
        product: { ...product },
        content: generated,
      };

      setContent(generated);
      setActiveTab("caption");
      setDraftText(generated.caption);
      setSelectedHistoryId(newItem.id);
      setHistory((old) => [newItem, ...old].slice(0, MAX_HISTORY));

      showNotice(
        data.mode === "demo"
          ? "خروجی نمونه ساخته شد؛ برای تولید هوش مصنوعی کلید Gemini را در تنظیمات سرور قرار بده."
          : `محتوا با موفقیت تولید شد${data.model ? ` (${data.model})` : ""} و در تاریخچه ذخیره شد.`,
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

  function saveEdits() {
    if (!content) return;
    const updatedContent = currentWorkingContent();
    if (!updatedContent) return;

    setContent(updatedContent);
    setHistory((old) =>
      old.map((item) =>
        item.id === selectedHistoryId
          ? { ...item, product: { ...product }, content: updatedContent }
          : item
      )
    );
    setDraftText(getTabText(updatedContent, activeTab));
    showNotice("تغییرات این بسته ذخیره شد.", "success");
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showNotice("متن کپی شد.", "success");
    } catch {
      showNotice("کپی خودکار در این مرورگر فعال نیست؛ متن را دستی انتخاب کن.", "error");
    }
  }

  function exportTXT() {
    const working = currentWorkingContent();
    if (!working) return showNotice("ابتدا یک بسته محتوایی تولید کن.", "error");
    const name = safeFileName(product.name);
    downloadFile(
      `AI-Content-${name}.txt`,
      buildTextExport(product, working),
      "text/plain"
    );
    showNotice("فایل TXT دانلود شد.", "success");
  }

  function exportJSON() {
    const working = currentWorkingContent();
    if (!working) return showNotice("ابتدا یک بسته محتوایی تولید کن.", "error");

    const exportData = {
      application: "AI Content Factory",
      version: "1.0",
      exportedAt: new Date().toISOString(),
      product,
      content: working,
    };

    downloadFile(
      `AI-Content-${safeFileName(product.name)}.json`,
      JSON.stringify(exportData, null, 2),
      "application/json"
    );
    showNotice("فایل JSON دانلود شد.", "success");
  }

  function openHistory(item: HistoryItem) {
    setProduct(item.product);
    setContent(item.content);
    setActiveTab("caption");
    setDraftText(item.content.caption);
    setSelectedHistoryId(item.id);
    showNotice("بسته ذخیره‌شده بارگذاری شد.", "success");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteHistory(id: string) {
    if (!window.confirm("این بسته محتوایی از تاریخچه حذف شود؟")) return;
    setHistory((old) => old.filter((item) => item.id !== id));
    if (selectedHistoryId === id) setSelectedHistoryId("");
    showNotice("بسته از تاریخچه حذف شد.", "success");
  }

  function clearHistory() {
    if (!history.length) return;
    if (!window.confirm("تمام تاریخچه حذف شود؟ این کار قابل بازگشت نیست.")) return;
    setHistory([]);
    setSelectedHistoryId("");
    showNotice("تاریخچه پاک شد.", "success");
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

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="AI Content Factory">
          <span className="brand-mark">✳</span>
          <span>AI Content Factory</span>
        </a>
        <span className="top-tag">نسخه ۱.۰</span>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">استودیوی هوشمند محتوای فروشگاهی</div>
          <h1>
            از مشخصات محصول،
            <br />
            <em>محتوای آماده انتشار</em> بساز.
          </h1>
          <p>
            برای محصولات فروشگاهت کپشن، سناریوی ریلز، پنج استوری و متن تبلیغاتی تولید کن؛
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
            <div><span className="step">۰۱</span><h2>اطلاعات محصول</h2></div>
            <span className="muted">اطلاعات واقعی وارد کن</span>
          </div>

          <div className="form-grid">
            <label className="full">
              نام محصول *
              <input value={product.name} onChange={(e) => update("name", e.target.value)} placeholder="مثلاً مانتو لینن تابستانی" maxLength={120} />
            </label>

            <label>
              قیمت
              <input value={product.price} onChange={(e) => update("price", e.target.value)} placeholder="مثلاً ۱٬۲۰۰٬۰۰۰ تومان" maxLength={80} />
            </label>

            <label>
              دسته‌بندی
              <select value={product.category} onChange={(e) => update("category", e.target.value)}>
                <option>مانتو</option><option>شلوار</option><option>شومیز</option>
                <option>لباس</option><option>کیف</option><option>کفش</option>
                <option>اکسسوری</option><option>سایر</option>
              </select>
            </label>

            <label>
              جنس
              <input value={product.fabric} onChange={(e) => update("fabric", e.target.value)} placeholder="مثلاً لینن یا کتان" maxLength={100} />
            </label>

            <label>
              رنگ‌ها
              <input value={product.colors} onChange={(e) => update("colors", e.target.value)} placeholder="مثلاً مشکی، سفید، کرم" maxLength={120} />
            </label>

            <label className="full">
              ویژگی‌های واقعی محصول *
              <textarea rows={4} value={product.features} onChange={(e) => update("features", e.target.value)} placeholder="جنس، کاربرد، جزئیات دوخت، مزیت‌ها و هر نکته‌ای که واقعاً درباره محصول می‌دانی..." maxLength={1200} />
            </label>

            <label>
              مخاطب هدف
              <input value={product.audience} onChange={(e) => update("audience", e.target.value)} placeholder="مثلاً خانم‌های ۲۰ تا ۳۵ سال" maxLength={120} />
            </label>

            <label>
              هدف محتوا
              <select value={product.goal} onChange={(e) => update("goal", e.target.value)}>
                <option>افزایش فروش</option><option>معرفی محصول جدید</option>
                <option>افزایش تعامل</option><option>آگاهی از برند</option>
                <option>اعتمادسازی</option>
              </select>
            </label>

            <label className="full">
              لحن برند
              <select value={product.tone} onChange={(e) => update("tone", e.target.value)}>
                <option>صمیمی و حرفه‌ای</option><option>لوکس و مینیمال</option>
                <option>جوان و پرانرژی</option><option>رسمی و قابل اعتماد</option>
                <option>خلاق و جسور</option>
              </select>
            </label>
          </div>

          <button className="generate" onClick={generate} disabled={loading || !filled}>
            {loading ? <><span className="spinner" /> در حال تولید محتوا...</> : <>✦ ساخت بسته محتوایی <span>←</span></>}
          </button>
          <p className="privacy-note">نام محصول و ویژگی‌های واقعی الزامی هستند. اطلاعات این فرم برای تولید محتوا به سرور ارسال می‌شود.</p>
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
              <p>مشخصات محصول را وارد کن و روی ساخت بسته محتوایی بزن.</p>
              <div className="preview-chips"><span>کپشن</span><span>ریلز</span><span>۵ استوری</span><span>تبلیغ</span></div>
            </div>
          ) : (
            <>
              <div className="loaded-label">
                {selectedHistoryId ? "این بسته در تاریخچه ذخیره شده است." : "این محتوا هنوز در تاریخچه ثبت نشده است."}
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
                    <span>همه بخش‌ها همراه با مشخصات محصول و آخرین ویرایش فعلی</span>
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
            <button className="history-backup" onClick={exportHistory} disabled={!history.length}>پشتیبان تاریخچه</button>
            <button className="clear-history" onClick={clearHistory} disabled={!history.length}>پاک کردن همه</button>
          </div>
        </div>

        {history.length > 0 && (
          <input className="history-search" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="جست‌وجو در تاریخچه بر اساس نام محصول یا دسته‌بندی..." />
        )}

        {!historyReady ? (
          <div className="history-empty">در حال بارگذاری تاریخچه...</div>
        ) : history.length === 0 ? (
          <div className="history-empty"><span className="history-empty-icon">◷</span><b>هنوز محتوایی ذخیره نشده است.</b><p>بعد از اولین تولید، بسته‌ها در این قسمت نگهداری می‌شوند.</p></div>
        ) : filteredHistory.length === 0 ? (
          <div className="history-empty">موردی با این عبارت پیدا نشد.</div>
        ) : (
          <div className="history-list">
            {filteredHistory.map((item) => (
              <article className="history-item" key={item.id}>
                <div className="history-info">
                  <b>{item.product.name || "محصول بدون نام"}</b>
                  <span>{item.product.category} · {item.product.goal}</span>
                  <small>{formatDate(item.createdAt)}</small>
                </div>
                <div className="history-item-actions">
                  <button className="history-open" onClick={() => openHistory(item)}>باز کردن</button>
                  <button className="history-delete" onClick={() => deleteHistory(item.id)}>حذف</button>
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="privacy-note">تاریخچه فعلاً فقط در همین مرورگر و همین دستگاه ذخیره می‌شود؛ با پاک‌کردن داده‌های مرورگر ممکن است حذف شود.</p>
      </section>

      <section className="bottom-row">
        <div className="mini-card"><span className="mini-icon">✎</span><div><b>ویرایش و ذخیره</b><small>متن هر بخش را تغییر بده و در تاریخچه نگه دار.</small></div></div>
        <div className="mini-card"><span className="mini-icon">↓</span><div><b>خروجی و پشتیبان</b><small>دانلود بسته‌ها به صورت TXT و JSON.</small></div></div>
      </section>

      <footer>AI Content Factory <span>·</span> نسخه ۱.۰ <span>·</span> ابزار تولید محتوای فروشگاهی</footer>
    </main>
  );
}
