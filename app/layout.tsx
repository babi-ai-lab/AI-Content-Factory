import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";

// Always render the app shell on the server; do not serve a stale prerendered
// document after a deployment while its JavaScript assets have changed.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Content Factory | فضای کاری بازاریابی کسب‌وکارها",
  description: "فضای کاری فارسی برای تولید محتوای متناسب با کانال، مدیریت کمپین، تاریخچه محتوا و سنجش عملکرد بازاریابی.",
  applicationName: "AI Content Factory",
  openGraph: {
    title: "AI Content Factory | فضای کاری بازاریابی کسب‌وکارها",
    description: "از پروفایل برند و تولید محتوای کانال‌محور تا مدیریت کمپین و سنجش عملکرد.",
    locale: "fa_IR",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <Script id="auth-loading-watchdog" strategy="beforeInteractive">{"window.setTimeout(function () {\n  var nodes = document.querySelectorAll('main.shell .panel');\n  for (var i = 0; i < nodes.length; i++) {\n    var node = nodes[i];\n    if (node.textContent && node.textContent.indexOf('در حال بررسی حساب کاربری...') !== -1) {\n      node.textContent = '';\n      var heading = document.createElement('strong');\n      heading.textContent = 'برنامه در مرورگر بارگذاری نشده است.';\n      var detail = document.createElement('p');\n      detail.textContent = 'پاسخ سرور دریافت شده، اما کدهای اجرایی برنامه در این مرورگر اجرا نشده‌اند.';\n      var link = document.createElement('a');\n      link.href = 'https://ai-content-factory-6m32.onrender.com/';\n      link.textContent = 'باز کردن نشانی جایگزین برنامه';\n      node.append(heading, detail, link);\n      break;\n    }\n  }\n}, 18000);"}</Script>
        {children}
      </body>
    </html>
  );
}
