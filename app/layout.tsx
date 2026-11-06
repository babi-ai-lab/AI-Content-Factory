import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
