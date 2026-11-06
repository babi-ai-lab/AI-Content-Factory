import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "سیاست حریم خصوصی | AI Content Factory",
  description: "سیاست حریم خصوصی سرویس AI Content Factory",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="account-deletion-page" dir="rtl" lang="fa">
      <article className="account-deletion-card">
        <a className="account-deletion-brand" href="/">AI Content Factory</a>
        <h1>سیاست حریم خصوصی</h1>
        <p>آخرین به‌روزرسانی: ۶ نوامبر ۲۰۲۶</p>
        <h2>مسئول سرویس و تماس</h2>
        <p>نام اپراتور سرویس: Babak Aghamohammadhassani</p>
        <p>کشور محل فعالیت اعلام‌شده: ایران</p>
        <p>ایمیل رسمی پشتیبانی و حریم خصوصی: <a href="mailto:info@eltbabak.ir">info@eltbabak.ir</a></p>
        <h2>اطلاعاتی که پردازش می‌شوند</h2>
        <p>بسته به امکاناتی که استفاده می‌کنی، سرویس ممکن است ایمیل و شناسه حساب، اطلاعات کسب‌وکار و پروفایل برند، دستورهای تولید متن و تصویر، خروجی‌ها و تاریخچه محتوا، اطلاعات کمپین و برنامه‌ریزی، و فراداده فنی و امنیتی درخواست‌ها را پردازش کند.</p>
        <h2>هدف استفاده</h2>
        <p>این اطلاعات برای ایجاد و مدیریت حساب، تولید و ذخیره محتوا، مدیریت کمپین‌ها، ارسال ایمیل‌های ضروری، پشتیبانی، امنیت و رفع خطا استفاده می‌شوند.</p>
        <h2>پردازشگران ثالث</h2>
        <ul>
          <li><strong>Supabase:</strong> احراز هویت، پایگاه داده و ذخیره‌سازی خصوصی.</li>
          <li><strong>Google Gemini API:</strong> پردازش ورودی‌های متنی برای تولید محتوا. شرایط نگهداری و استفاده از داده تابع نوع حساب و شرایط جاری ارائه‌دهنده است.</li>
          <li><strong>Cloudflare Workers AI:</strong> پردازش شرح تصویر برای تولید تصویر.</li>
          <li><strong>Resend:</strong> ارسال ایمیل‌های تراکنشی.</li>
          <li><strong>Render:</strong> میزبانی برنامه و پردازش فراداده‌های فنی و لاگ‌های عملیاتی.</li>
        </ul>
        <p>این پردازشگران ممکن است داده‌ها را خارج از کشور محل فعالیت اپراتور پردازش کنند. جزئیات مناطق پردازش تابع تنظیمات و شرایط هر ارائه‌دهنده است. برای اطلاعات بیشتر به <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">شرایط Gemini API</a>، <a href="https://developers.cloudflare.com/workers-ai/platform/data-usage/" target="_blank" rel="noreferrer">سیاست داده Workers AI</a>، <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">حریم خصوصی Supabase</a>، <a href="https://resend.com/legal/dpa" target="_blank" rel="noreferrer">توافق‌نامه Resend</a> و <a href="https://render.com/privacy" target="_blank" rel="noreferrer">حریم خصوصی Render</a> مراجعه کن.</p>
        <h2>نگهداری و حذف</h2>
        <p>اطلاعات حساب و محتوای ذخیره‌شده تا زمانی که حساب فعال است و برای ارائه سرویس لازم است نگهداری می‌شوند. با درخواست حذف حساب، حذف داده‌های مرتبط از سامانه عملیاتی آغاز می‌شود. نسخه‌های پشتیبان و لاگ‌های پردازشگران ممکن است مطابق چرخه نگهداری مستقل آن‌ها برای مدتی محدود باقی بمانند. مدت دقیق نگهداری هر پردازشگر به سیاست جاری و تنظیمات حساب مربوط وابسته است.</p>
        <h2>امنیت و مسئولیت کاربر</h2>
        <p>سرویس از HTTPS، احراز هویت و کنترل دسترسی مالکیت‌محور استفاده می‌کند. هیچ سامانه‌ای بدون ریسک نیست. رمز عبور، اطلاعات پرداخت، داده‌های هویتی حساس یا اطلاعات محرمانه اشخاص ثالث را در دستورهای تولید وارد نکن.</p>
        <h2>درخواست‌های کاربران</h2>
        <p>برای درخواست دسترسی، اصلاح یا پرسش درباره داده‌ها به <a href="mailto:info@eltbabak.ir">info@eltbabak.ir</a> پیام بده. برای حذف حساب از <a href="/account-deletion">صفحه درخواست حذف حساب</a> استفاده کن. ممکن است برای تأیید مالکیت حساب، احراز هویت لازم باشد.</p>
        <h2>تغییرات و تماس</h2>
        <p>این سیاست ممکن است متناسب با تغییر سرویس یا پردازشگران به‌روزرسانی شود. نسخه جاری در همین نشانی منتشر خواهد شد.</p>
        <p>تماس: <a href="mailto:info@eltbabak.ir">info@eltbabak.ir</a></p>
        <nav className="account-deletion-links">
          <a href="/">بازگشت به برنامه</a>
          <a href="/account-deletion">درخواست حذف حساب</a>
        </nav>
      </article>
    </main>
  );
}
