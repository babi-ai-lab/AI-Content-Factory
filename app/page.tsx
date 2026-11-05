 "use client";

import { useMemo, useState } from "react";

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

export default function Home() {
  const [product, setProduct] = useState<Product>(initialProduct);
  const [content, setContent] = useState<Content | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("caption");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  const filled = useMemo(() => product.name.trim().length > 1 && product.features.trim().length > 2, [product]);

  function update<K extends keyof Product>(key: K, value: Product[K]) {
    setProduct((old) => ({ ...old, [key]: value }));
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
      if (!response.ok) throw new Error(data.error || "خطا در تولید محتوا");
      setContent(data.content);
      setActiveTab("caption");
      setHistory((old) => [product.name, ...old].slice(0, 5));
      setNotice(data.mode === "demo" ? "نسخه نمایشی: خروجی نمونه تولید شد. برای اتصال مدل واقعی، کلید API را تنظیم کن." : "محتوا تولید شد.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "خطای نامشخص");
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("متن کپی شد.");
    } catch {
      setNotice("کپی خودکار در این مرورگر در دسترس نیست؛ متن را دستی انتخاب کن.");
    }
  }

  const currentText = content
    ? activeTab === "caption" ? content.caption
      : activeTab === "reel" ? content.reel
      : activeTab === "stories" ? content.stories.map((s, i) => `${i + 1}. ${s}`).join("\n\n")
      : content.ad
    : "";

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark">✳</span><span>AI Content Factory</span></a>
        <span className="top-tag">نسخه آزمایشی ۰٫۱</span>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">استودیوی محتوای فروشگاهی</div>
          <h1>از مشخصات محصول،<br /><em>محتوای آماده انتشار</em> بساز.</h1>
          <p>اطلاعات محصولت را وارد کن و یک بسته محتوایی فارسی شامل کپشن، ریلز، استوری و متن تبلیغاتی بگیر.</p>
        </div>
        <div className="hero-orb"><span>✦</span><small>CONTENT<br/>STUDIO</small></div>
      </section>

      <div className="workspace">
        <section className="panel form-panel">
          <div className="section-head">
            <div><span className="step">۰۱</span><h2>اطلاعات محصول</h2></div>
            <span className="muted">حدود ۱ دقیقه</span>
          </div>

          <div className="form-grid">
            <label className="full">نام محصول<input value={product.name} onChange={(e) => update("name", e.target.value)} placeholder="مثلاً مانتو لینن" /></label>
            <label>قیمت<input value={product.price} onChange={(e) => update("price", e.target.value)} placeholder="مثلاً ۱٬۲۰۰٬۰۰۰ تومان" /></label>
            <label>دسته‌بندی<select value={product.category} onChange={(e) => update("category", e.target.value)}><option>مانتو</option><option>شلوار</option><option>شومیز</option><option>کیف</option><option>کفش</option><option>اکسسوری</option><option>سایر</option></select></label>
            <label>جنس<input value={product.fabric} onChange={(e) => update("fabric", e.target.value)} placeholder="مثلاً کتان" /></label>
            <label>رنگ‌ها<input value={product.colors} onChange={(e) => update("colors", e.target.value)} placeholder="مثلاً مشکی، سفید" /></label>
            <label className="full">ویژگی‌های واقعی محصول<textarea rows={3} value={product.features} onChange={(e) => update("features", e.target.value)} placeholder="ویژگی‌هایی را بنویس که واقعاً درباره محصول می‌دانی." /></label>
            <label>مخاطب هدف<input value={product.audience} onChange={(e) => update("audience", e.target.value)} placeholder="مثلاً خانم‌های ۲۰ تا ۳۵ سال" /></label>
            <label>هدف محتوا<select value={product.goal} onChange={(e) => update("goal", e.target.value)}><option>افزایش فروش</option><option>معرفی محصول جدید</option><option>افزایش تعامل</option><option>آگاهی از برند</option></select></label>
            <label className="full">لحن برند<select value={product.tone} onChange={(e) => update("tone", e.target.value)}><option>صمیمی و حرفه‌ای</option><option>لوکس و مینیمال</option><option>جوان و پرانرژی</option><option>رسمی و قابل اعتماد</option></select></label>
          </div>

          <button className="generate" onClick={generate} disabled={loading || !filled}>
            {loading ? <><span className="spinner"/> در حال ساخت محتوا...</> : <>✦ ساخت بسته محتوایی <span>←</span></>}
          </button>
          <p className="privacy-note">اطلاعات محصول فقط برای تولید محتوای همین درخواست استفاده می‌شود؛ در این نسخه ذخیره دائمی نداریم.</p>
        </section>

        <section className="panel output-panel">
          <div className="section-head">
            <div><span className="step">۰۲</span><h2>استودیوی محتوا</h2></div>
            <span className="live-dot">● آماده</span>
          </div>

          {!content ? (
            <div className="empty-state">
              <div className="empty-icon">✧</div>
              <h3>محتوای کمپین اینجا نمایش داده می‌شود</h3>
              <p>فرم محصول را تکمیل کن و روی «ساخت بسته محتوایی» بزن.</p>
              <div className="preview-chips"><span>کپشن</span><span>ریلز</span><span>استوری</span><span>تبلیغ</span></div>
            </div>
          ) : (
            <>
              <nav className="tabs">{tabs.map((tab) => <button key={tab.id} className={activeTab === tab.id ? "tab active" : "tab"} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</nav>
              <div className="content-card">
                <div className="content-label">{tabs.find((t) => t.id === activeTab)?.label}</div>
                <pre>{currentText}</pre>
                <button className="copy-button" onClick={() => copy(currentText)}>کپی متن ↗</button>
              </div>
              <button className="secondary-button" onClick={generate} disabled={loading}>ساخت نسخه جدید</button>
            </>
          )}
          {notice && <div className="notice" role="status">{notice}</div>}
        </section>
      </div>

      <section className="bottom-row">
        <div className="mini-card"><span className="mini-icon">◷</span><div><b>تاریخچه آزمایشی</b><small>{history.length ? history.join(" · ") : "پس از تولید محتوا، نام محصولات اینجا دیده می‌شود."}</small></div></div>
        <div className="mini-card"><span className="mini-icon">◎</span><div><b>مخصوص فروشگاه‌های مد</b><small>نسخه اول برای پوشاک و اکسسوری طراحی شده است.</small></div></div>
      </section>

      <footer>AI Content Factory <span>·</span> MVP 0.1 <span>·</span> ساخته‌شده برای آزمایش بازار</footer>
    </main>
  );
}
