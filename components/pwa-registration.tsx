"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PwaRegistration() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleAppInstalled = () => setInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    let loadHandler: (() => void) | undefined;
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const register = () => {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
          // PWA enhancements must never block the core application.
        });
      };
      if (document.readyState === "complete") register();
      else {
        loadHandler = register;
        window.addEventListener("load", register, { once: true });
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (loadHandler) window.removeEventListener("load", loadHandler);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } finally {
      setInstallPrompt(null);
    }
  };

  if (!installPrompt || dismissed) return null;

  return (
    <aside
      dir="rtl"
      role="region"
      aria-label="نصب اپلیکیشن"
      style={{
        position: "fixed",
        zIndex: 1000,
        insetInline: 16,
        bottom: "max(16px, env(safe-area-inset-bottom))",
        maxWidth: 520,
        marginInline: "auto",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 14,
        border: "1px solid rgba(28,43,94,.14)",
        borderRadius: 18,
        background: "#fff",
        color: "#1c2b5e",
        boxShadow: "0 12px 40px rgba(14,25,60,.18)",
      }}
    >
      <div
        aria-hidden="true"
        style={{ width: 42, height: 42, flex: "0 0 42px", borderRadius: 12, background: "#1c2b5e", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}
      >
        CF
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: 14 }}>نسخه اپلیکیشن را نصب کن</strong>
        <span style={{ display: "block", fontSize: 12, color: "#5d6680", marginTop: 3 }}>دسترسی سریع‌تر از صفحه اصلی گوشی</span>
      </div>
      <button type="button" onClick={() => void install()} style={{ border: 0, borderRadius: 10, padding: "10px 14px", background: "#1c2b5e", color: "#fff", font: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        نصب
      </button>
      <button type="button" aria-label="بستن پیشنهاد نصب" onClick={() => setDismissed(true)} style={{ border: 0, background: "transparent", color: "#65708b", fontSize: 20, cursor: "pointer", padding: 4 }}>
        ×
      </button>
    </aside>
  );
}
