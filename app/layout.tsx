import type { Metadata, Viewport } from "next";
import "./globals.css";
import Script from "next/script";
import PwaRegistration from "@/components/pwa-registration";

// Always render the app shell on the server; do not serve a stale prerendered
// document after a deployment while its JavaScript assets have changed.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1c2b5e",
};

export const metadata: Metadata = {
  title: "AI Content Factory | فضای کاری بازاریابی کسب‌وکارها",
  description: "فضای کاری فارسی برای تولید محتوای متناسب با کانال، مدیریت کمپین، تاریخچه محتوا و سنجش عملکرد بازاریابی.",
  applicationName: "AI Content Factory",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Content Factory",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icons/app-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/app-icon.svg", type: "image/svg+xml" }],
  },
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
        <PwaRegistration />
        <Script id="auth-loading-watchdog" strategy="beforeInteractive">{"window.setTimeout(function () {\n  var node = document.getElementById('auth-loading-state');\n  if (!node) return;\n  node.replaceChildren();\n  node.setAttribute('role', 'alert');\n  var heading = document.createElement('strong');\n  heading.textContent = 'برنامه در این مرورگر بارگذاری نشد.';\n  var detail = document.createElement('p');\n  detail.textContent = 'اتصال صفحه برقرار است، اما اجرای برنامه کامل نشده. صفحه را تازه‌سازی کن یا از نشانی جایگزین استفاده کن.';\n  var link = document.createElement('a');\n  link.href = 'https://ai-content-factory-6m32.onrender.com/';\n  link.target = '_blank';\n  link.rel = 'noopener noreferrer';\n  link.textContent = 'باز کردن نشانی جایگزین برنامه';\n  node.append(heading, detail, link);\n}, 18000);"}</Script>
        {children}
      </body>
    </html>
  );
}
