import type { Metadata } from "next";
import styles from "./download.module.css";
import AddToHomeScreen from "./add-to-home-screen";

const downloadUrl =
  "https://github.com/babi-ai-lab/AI-Content-Factory/releases/download/v1.0.0/AI-Content-Factory-1.0.0.apk";
const pageUrl = "https://app.eltbabak.ir/download";
const qrUrl =
  "https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=https%3A%2F%2Fapp.eltbabak.ir%2Fdownload";

export const metadata: Metadata = {
  title: "دانلود AI Content Factory برای اندروید",
  description:
    "دانلود رسمی اپلیکیشن AI Content Factory نسخه 1.0.0 برای اندروید، همراه با QR Code و راهنمای نصب.",
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "دانلود AI Content Factory",
    description: "نسخه رسمی اندروید؛ دانلود مستقیم و راهنمای نصب.",
    url: pageUrl,
    siteName: "AI Content Factory",
    locale: "fa_IR",
    type: "website",
  },
};

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v11m0 0 4-4m-4 4-4-4M4 17v3h16v-3" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </svg>
  );
}

export default function DownloadPage() {
  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.container}>
        <header className={styles.header}>
          <a className={styles.brand} href="/" aria-label="صفحه اصلی AI Content Factory">
            <span className={styles.brandMark}>CF</span>
            <span>
              <strong>AI CONTENT FACTORY</strong>
              <small>فضای کاری هوشمند بازاریابی</small>
            </span>
          </a>
          <a className={styles.homeLink} href="/">ورود به برنامه <span aria-hidden="true">←</span></a>
        </header>

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}><i /> نسخه رسمی اندروید</span>
            <h1>ایده‌هایت را به<br /><em>محتوای حرفه‌ای</em> تبدیل کن.</h1>
            <p>
              با AI Content Factory، تولید و مدیریت محتوای بازاریابی کسب‌وکارت را
              در یک فضای کاری فارسی و یکپارچه انجام بده.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href={downloadUrl}>
                <DownloadIcon />
                <span>دانلود اپلیکیشن اندروید</span>
                <b>↓</b>
              </a>
              <span className={styles.versionNote}>نسخه 1.0.0 <span>·</span> فایل APK</span>
            </div>
            <div className={styles.trustLine}>
              <ShieldIcon />
              <span>لینک دانلود مستقیم از مخزن رسمی GitHub پروژه</span>
            </div>
          </div>

          <aside className={styles.downloadCard} aria-label="اطلاعات نسخه و QR Code">
            <div className={styles.cardTop}>
              <div className={styles.appIcon}><span>AI</span><b>CF</b></div>
              <div>
                <strong>AI Content Factory</strong>
                <small>Android application</small>
              </div>
              <span className={styles.releaseBadge}>منتشرشده</span>
            </div>
            <div className={styles.qrArea}>
              <div className={styles.qrFrame}>
                <img src={qrUrl} alt="QR Code صفحه دانلود رسمی AI Content Factory" width="220" height="220" />
              </div>
              <strong>اسکن کن و در گوشی باز کن</strong>
              <span>با دوربین موبایل، این کد را اسکن کن.</span>
            </div>
            <div className={styles.cardMeta}>
              <div><span>نسخه</span><b>1.0.0</b></div>
              <div><span>سیستم‌عامل</span><b>Android</b></div>
              <div><span>حجم فایل</span><b>حدود 1.71 MB</b></div>
            </div>
          </aside>
        </section>

        <AddToHomeScreen />

        <section className={styles.details} aria-label="مشخصات فایل">
          <div className={styles.detailItem}><span className={styles.detailIcon}>✓</span><div><b>نسخه رسمی</b><small>منتشرشده در GitHub Releases</small></div></div>
          <div className={styles.detailItem}><span className={styles.detailIcon}>⌁</span><div><b>دانلود مستقیم</b><small>بدون واسطه و لینک کوتاه‌کننده</small></div></div>
          <div className={styles.detailItem}><span className={styles.detailIcon}>▣</span><div><b>مخصوص اندروید</b><small>نصب از طریق فایل APK</small></div></div>
        </section>

        <section className={styles.installSection} id="install">
          <div className={styles.sectionHeading}>
            <span>راهنمای نصب</span>
            <h2>در چند قدم ساده نصبش کن</h2>
            <p>اگر اولین بار است برنامه‌ای را خارج از Google Play نصب می‌کنی، مراحل زیر را دنبال کن.</p>
          </div>
          <div className={styles.steps}>
            <article className={styles.stepCard}>
              <span className={styles.stepNumber}>01</span>
              <div className={styles.stepSymbol}>↓</div>
              <h3>دانلود فایل</h3>
              <p>روی دکمه دانلود بزن و فایل <bdi>AI-Content-Factory-1.0.0.apk</bdi> را دریافت کن.</p>
            </article>
            <article className={styles.stepCard}>
              <span className={styles.stepNumber}>02</span>
              <div className={styles.stepSymbol}>⌕</div>
              <h3>اجازه نصب</h3>
              <p>اگر گوشی هشدار داد، برای مرورگر یا برنامه مدیریت فایل، اجازه «نصب برنامه‌های ناشناس» را فعال کن.</p>
            </article>
            <article className={styles.stepCard}>
              <span className={styles.stepNumber}>03</span>
              <div className={styles.stepSymbol}>✓</div>
              <h3>نصب و اجرا</h3>
              <p>فایل دانلودشده را باز کن، گزینه نصب را بزن و پس از پایان، برنامه را اجرا کن.</p>
            </article>
          </div>
          <div className={styles.installTip}>
            <span aria-hidden="true">ⓘ</span>
            <p><b>نکته امنیتی:</b> اجازه نصب برنامه ناشناس را فقط برای همان مرورگر یا فایل‌منیجری فعال کن که فایل را از آن باز کرده‌ای. پس از نصب، در صورت تمایل این اجازه را دوباره غیرفعال کن. نام گزینه‌ها ممکن است در گوشی‌های مختلف کمی متفاوت باشد.</p>
          </div>
        </section>

        <section className={styles.checkSection}>
          <div>
            <span className={styles.sectionKicker}>بررسی اصالت فایل</span>
            <h2>مشخصات نسخه منتشرشده</h2>
            <p>برای اطمینان از یکسان بودن فایل دریافت‌شده با نسخه رسمی، می‌توانی مقدار SHA-256 را بررسی کنی.</p>
          </div>
          <dl className={styles.fileFacts}>
            <div><dt>نام فایل</dt><dd dir="ltr">AI-Content-Factory-1.0.0.apk</dd></div>
            <div><dt>شناسه برنامه</dt><dd dir="ltr">ir.eltbabak.contentfactory</dd></div>
            <div><dt>حجم دقیق</dt><dd dir="ltr">1,795,862 bytes</dd></div>
            <div className={styles.hashRow}><dt>SHA-256</dt><dd dir="ltr">1C46E2EC8119768AF320A796B8824318BB99E5A77D97676637965B8FD3A4A0EC</dd></div>
          </dl>
          <a className={styles.releaseLink} href="https://github.com/babi-ai-lab/AI-Content-Factory/releases/tag/v1.0.0" target="_blank" rel="noopener noreferrer">مشاهده صفحه انتشار و جزئیات در GitHub <span aria-hidden="true">↗</span></a>
        </section>

        <section className={styles.finalCta}>
          <div><span>آماده‌ای شروع کنی؟</span><h2>کارخانه محتوای کسب‌وکارت را همراهت داشته باش.</h2></div>
          <a className={styles.primaryButton} href={downloadUrl}><DownloadIcon /><span>دانلود نسخه اندروید</span><b>↓</b></a>
        </section>

        <footer className={styles.footer}>
          <a className={styles.footerBrand} href="/">AI Content Factory</a>
          <span>ابزار هوشمند تولید و مدیریت محتوای بازاریابی</span>
          <span>© {new Date().getFullYear()} AI Content Factory</span>
        </footer>
      </div>
    </main>
  );
}
