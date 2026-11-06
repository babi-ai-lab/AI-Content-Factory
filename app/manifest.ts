import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "AI Content Factory",
    short_name: "Content Factory",
    description: "فضای کاری فارسی برای تولید و مدیریت محتوای بازاریابی کسب‌وکارها.",
    lang: "fa",
    dir: "rtl",
    start_url: "/?source=android",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#f7f8fc",
    theme_color: "#1c2b5e",
    categories: ["business", "productivity", "utilities"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/app-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
    ]
  };
}
