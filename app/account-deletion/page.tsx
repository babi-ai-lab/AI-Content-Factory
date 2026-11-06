import type { Metadata } from "next";
import AccountDeletionForm from "@/components/account-deletion-form";

export const metadata: Metadata = {
  title: "درخواست حذف حساب | AI Content Factory",
  description: "درخواست حذف دائمی حساب کاربری AI Content Factory و داده‌های وابسته.",
  robots: { index: true, follow: true },
};

export default function AccountDeletionPage() {
  return (
    <main className="account-deletion-page" dir="rtl" lang="fa">
      <section className="account-deletion-card">
        <a className="account-deletion-brand" href="/">AI Content Factory</a>
        <span className="account-deletion-eyebrow">حریم خصوصی و کنترل داده</span>
        <h1>درخواست حذف حساب کاربری</h1>
        <p>
          می‌توانی از این صفحه، بدون ورود به داشبورد برنامه، حذف دائمی حساب و داده‌های وابسته را درخواست و تأیید کنی.
        </p>
        <div className="account-deletion-warning">
          این عملیات برگشت‌ناپذیر است. محتوای ذخیره‌شده، پروفایل‌های برند، کمپین‌ها و داده‌های مرتبط با حساب حذف می‌شوند.
        </div>
        <AccountDeletionForm />
        <p className="account-deletion-help">
          برای تأیید مالکیت حساب، ایمیل و رمز عبور فعلی لازم است. اگر رمز را فراموش کرده‌ای، ابتدا از
          <a href="/"> صفحه ورود و بازیابی رمز</a> استفاده کن و سپس به این صفحه برگرد.
        </p>
        <nav className="account-deletion-links" aria-label="پیوندهای مرتبط">
          <a href="/">بازگشت به برنامه</a>
          <a href="/privacy">سیاست حریم خصوصی</a>
        </nav>
      </section>
    </main>
  );
}
