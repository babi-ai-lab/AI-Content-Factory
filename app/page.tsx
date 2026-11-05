
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
  name: "مانتو لینن تابستانی",
  price: "۱٬۴۵۰٬۰۰۰ تومان",
  category: "مانتو",
  fabric: "لینن",
  colors: "کرم، مشکی، سبز",
  features: "پارچه خنک، سبک، مناسب استفاده روزمره",
  audience: "خانم‌های ۲۰ تا ۳۵ سال",
  goal: "افزایش فروش",
  tone: "صمیمی و حرفه‌ای",
};

const tabs = [
  { id: "caption", label: "کپشن فروش" },
  { id: "reel", label: "سناریوی ریلز" },
  { id: "stories", label: "استوری" },
  { id: "ad", label: "متن تبلیغاتی" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("fa-IR", {
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

  return content.stories
    .map((story, index) => `${index + 1}. ${story}`)
    .join("\n\n");
}

function updateTabContent(
  content: Content,
  tab: TabId,
  text: string
): Content {
  if (tab === "caption") {
    return { ...content, caption: text };
  }

  if (tab === "reel") {
    return { ...content, reel: text };
  }

  if (tab === "ad") {
    return { ...content, ad: text };
  }

  const stories = text
    .split(/\n\s*\n/)
    .map((story) => story.replace(/^\s*\d+[\.\)\-]\s*/, "").trim())
    .filter(Boolean);

  return { ...content, stories };
}

export default function Home() {
  const [product, setProduct] = useState<Product>(initialProduct);
  const [content, setContent] = useState<Content | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("caption");
  const [draftText, setDraftText] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setHistory(parsed);
      }
    } catch (error) {
      console.error("خطا در خواندن تاریخچه:", error);
    } finally {
      setHistoryReady(true);
    }
  }, []);

  useEffect(() => {
    if (!historyReady) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error("خطا در ذخیره تاریخچه:", error);
      setNotice("فضای ذخیره مرورگر کافی نیست.");
    }
  }, [history, historyReady]);

  const filled = useMemo(
    () => product.name.trim().length > 1 && product.features.trim().length > 2,
    [product]
  );

  function update<K extends keyof Product>(key: K, value: Product[K]) {
    setProduct((old) => ({ ...old, [key]: value }));
  }

  function selectTab(tab: TabId) {
    setActiveTab(tab);

    if (content) {
      setDraftText(getTabText(content, tab));
    }
  }

  async function generate() {
    if (!filled) {
      setNotice("نام محصول و ویژگی‌های آن را وارد کن.");
      return;
    }

    setLoading(true);
    setNotice("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "خطا در تولید محتوا");
      }

      const generatedContent = data.content as Content;

      const newItem: HistoryItem = {
        id: createId(),
        createdAt: new Date().toISOString(),
        product: { ...product },
        content: generatedContent,
      };

      setContent(generatedContent);
      setActiveTab("caption");
      setDraftText(getTabText(generatedContent, "caption"));
      setSelectedHistoryId(newItem.id);
      setHistory((old) => [newItem, ...old].slice(0, MAX_HISTORY));

      setNotice(
        data.mode === "demo"
          ? "خروجی نمونه تولید شد."
          : "محتوا با موفقیت تولید و ذخیره شد."
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "خطای نامشخص");
    } finally {
      setLoading(false);
    }
  }

  function saveEdits() {
    if (!content) return;

    const updatedContent = updateTabContent(
      content,
      activeTab,
      draftText
    );

    setContent(updatedContent);

    if (selectedHistoryId) {
      setHistory((old) =>
        old.map((item) =>
          item.id === selectedHistoryId
            ? { ...item, content: updatedContent }
            : item
        )
      );
    }

    setDraftText(getTabText(updatedContent, activeTab));
    setNotice("تغییرات ذخیره شدند.");
  }

  function openHistory(item: HistoryItem) {
    setProduct(item.product);
    setContent(item.content);
    setActiveTab("caption");
    setDraftText(getTabText(item.content, "caption"));
    setSelectedHistoryId(item.id);
    setNotice("محتوای ذخیره‌شده بارگذاری شد.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteHistory(id: string) {
    if (!window.confirm("این بسته محتوایی حذف شود؟")) return;

    setHistory((old) => old.filter((item) => item.id !== id));

    if (selectedHistoryId === id) {
      setSelectedHistoryId("");
    }

    setNotice("محتوا از تاریخچه حذف شد.");
  }

  function clearHistory() {
    if (history.length === 0) return;

    if (
      !window.confirm(
        "تمام تاریخچه حذف شود؟ این عملیات قابل بازگشت نیست."
      )
    ) {
      return;
    }

    setHistory([]);
    setSelectedHistoryId("");
    setNotice("تمام تاریخچه پاک شد.");
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("متن کپی شد.");
    } catch {
      setNotice("کپی خودکار در دسترس نیست؛ متن را دستی انتخاب کن.");
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-mark">✳</span>
          <span>AI Content Factory</span>
        </a>
        <span className="top-tag">نسخه آزمایشی ۰٫۳</span>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">استودیوی محتوای فروشگاهی</div>
          <h1>
            از مشخصات محصول،
            <br />
            <em>محتوای آماده انتشار</em> بساز.
          </h1>
          <p>
            اطلاعات محصولت را وارد کن و یک بسته محتوایی فارسی شامل کپشن،
            ریلز، استوری و متن تبلیغاتی بگیر.
          </p>
        </div>

        <div className="hero-orb">
          <span>✦</span>
          <small>
            CONTENT
            <br />
            STUDIO
          </small>
        </div>
      </section>

      <div className="workspace">
        <section className="panel form-panel">
          <div className="section-head">
            <div>
              <span className="step">۰۱</span>
              <h2>اطلاعات محصول</h2>
            </div>
            <span className="muted">حدود ۱ دقیقه</span>
          </div>

          <div className="form-grid">
            <label className="full">
              نام محصول
              <input
                value={product.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="مثلاً مانتو لینن"
              />
            </label>

            <label>
              قیمت
              <input
                value={product.price}
                onChange={(e) => update("price", e.target.value)}
                placeholder="مثلاً ۱٬۲۰۰٬۰۰۰ تومان"
              />
            </label>

            <label>
              دسته‌بندی
              <select
                value={product.category}
                onChange={(e) => update("category", e.target.value)}
              >
                <option>مانتو</option>
                <option>شلوار</option>
                <option>شومیز</option>
                <option>کیف</option>
                <option>کفش</option>
                <option>اکسسوری</option>
                <option>سایر</option>
              </select>
            </label>

            <label>
              جنس
              <input
                value={product.fabric}
                onChange={(e) => update("fabric", e.target.value)}
                placeholder="مثلاً کتان"
              />
            </label>

            <label>
              رنگ‌ها
              <input
                value={product.colors}
                onChange={(e) => update("colors", e.target.value)}
                placeholder="مثلاً مشکی، سفید"
              />
            </label>

            <label className="full">
              ویژگی‌های واقعی محصول
              <textarea
                rows={3}
                value={product.features}
                onChange={(e) => update("features", e.target.value)}
                placeholder="ویژگی‌هایی را بنویس که واقعاً درباره محصول می‌دانی."
              />
            </label>

            <label>
              مخاطب هدف
              <input
                value={product.audience}
                onChange={(e) => update("audience", e.target.value)}
                placeholder="مثلاً خانم‌های ۲۰ تا ۳۵ سال"
              />
            </label>

            <label>
              هدف محتوا
              <select
                value={product.goal}
                onChange={(e) => update("goal", e.target.value)}
              >
                <option>افزایش فروش</option>
                <option>معرفی محصول جدید</option>
                <option>افزایش تعامل</option>
                <option>آگاهی از برند</option>
              </select>
            </label>

            <label className="full">
              لحن برند
              <select
                value={product.tone}
                onChange={(e) => update("tone", e.target.value)}
              >
                <option>صمیمی و حرفه‌ای</option>
                <option>لوکس و مینیمال</option>
                <option>جوان و پرانرژی</option>
                <option>رسمی و قابل اعتماد</option>
              </select>
            </label>
          </div>

          <button
            className="generate"
            onClick={generate}
            disabled={loading || !filled}
          >
            {loading ? (
              <>
                <span className="spinner" /> در حال ساخت محتوا...
              </>
            ) : (
              <>
                ✦ ساخت بسته محتوایی <span>←</span>
              </>
            )}
          </button>

          <p className="privacy-note">
            بسته‌های تولیدشده در حافظه همین مرورگر ذخیره می‌شوند.
          </p>
        </section>

        <section className="panel output-panel">
          <div className="section-head">
            <div>
              <span className="step">۰۲</span>
              <h2>استودیوی محتوا</h2>
            </div>
            <span className="live-dot">● آماده</span>
          </div>

          {!content ? (
            <div className="empty-state">
              <div className="empty-icon">✧</div>
              <h3>محتوای کمپین اینجا نمایش داده می‌شود</h3>
              <p>
                فرم محصول را تکمیل کن و روی «ساخت بسته محتوایی» بزن.
              </p>
              <div className="preview-chips">
                <span>کپشن</span>
                <span>ریلز</span>
                <span>استوری</span>
                <span>تبلیغ</span>
              </div>
            </div>
          ) : (
            <>
              {selectedHistoryId && (
                <div className="loaded-label">
                  این محتوا در تاریخچه ذخیره شده است.
                </div>
              )}

              <nav className="tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={activeTab === tab.id ? "tab active" : "tab"}
                    onClick={() => selectTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              <div className="content-card">
                <div className="content-label">
                  {tabs.find((t) => t.id === activeTab)?.label}
                </div>

                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  rows={12}
                  dir="rtl"
                  aria-label="ویرایش محتوای تولیدشده"
                  style={{
                    width: "100%",
                    minHeight: "280px",
                    lineHeight: 2.2,
                    fontSize: "13px",
                    padding: "14px",
                    marginTop: "8px",
                    resize: "vertical",
                    whiteSpace: "pre-wrap",
                  }}
                />

                {activeTab === "stories" && (
                  <p className="privacy-note">
                    برای جدا کردن استوری‌ها، بین متن هر استوری یک خط خالی قرار بده.
                  </p>
                )}

                <button
                  className="copy-button"
                  onClick={() => copy(draftText)}
                >
                  کپی متن ↗
                </button>

                <button
                  className="secondary-button"
                  onClick={saveEdits}
                >
                  ذخیره تغییرات
                </button>
              </div>

              <button
                className="secondary-button"
                onClick={generate}
                disabled={loading}
              >
                ساخت نسخه جدید
              </button>
            </>
          )}

          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
        </section>
      </div>

      <section className="history-section">
        <div className="history-heading">
          <div>
            <span className="step">۰۳</span>
            <h2>تاریخچه محتواها</h2>
          </div>

          <div className="history-actions">
            <span className="history-count">
              {history.length.toLocaleString("fa-IR")} از ۵۰
            </span>

            <button
              className="clear-history"
              onClick={clearHistory}
              disabled={history.length === 0}
            >
              پاک کردن همه
            </button>
          </div>
        </div>

        {!historyReady ? (
          <div className="history-empty">
            در حال بارگذاری تاریخچه...
          </div>
        ) : history.length === 0 ? (
          <div className="history-empty">
            <span className="history-empty-icon">◷</span>
            <b>هنوز محتوایی ذخیره نشده است.</b>
            <p>
              بعد از اولین تولید، بسته‌های محتوایی اینجا نمایش داده می‌شوند.
            </p>
          </div>
        ) : (
          <div className="history-list">
            {history.map((item) => (
              <article className="history-item" key={item.id}>
                <div className="history-info">
                  <b>{item.product.name || "محصول بدون نام"}</b>
                  <span>
                    {item.product.category} · {item.product.goal}
                  </span>
                  <small>{formatDate(item.createdAt)}</small>
                </div>

                <div className="history-item-actions">
                  <button
                    className="history-open"
                    onClick={() => openHistory(item)}
                  >
                    مشاهده محتوا
                  </button>

                  <button
                    className="history-delete"
                    onClick={() => deleteHistory(item.id)}
                    aria-label="حذف محتوا"
                    title="حذف"
                  >
                    حذف
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="bottom-row">
        <div className="mini-card">
          <span className="mini-icon">✎</span>
          <div>
            <b>ویرایش محتوا</b>
            <small>متن تولیدشده را قبل از انتشار اصلاح و ذخیره کن.</small>
          </div>
        </div>

        <div className="mini-card">
          <span className="mini-icon">◎</span>
          <div>
            <b>مخصوص فروشگاه‌های مد</b>
            <small>نسخه اول برای پوشاک و اکسسوری طراحی شده است.</small>
          </div>
        </div>
      </section>

      <footer>
        AI Content Factory <span>·</span> MVP 0.3 <span>·</span> ساخته‌شده برای آزمایش بازار
      </footer>
    </main>
  );
}
