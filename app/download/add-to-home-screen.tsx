"use client";

import { useEffect, useState } from "react";
import styles from "./download.module.css";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function AddToHomeScreen() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(isStandalone);

    const ua = window.navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) setPlatform("ios");
    else if (/Android/i.test(ua)) setPlatform("android");

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowHelp(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") setInstalled(true);
      else setShowHelp(true);
      return;
    }
    setShowHelp((visible) => !visible);
  };

  return (
    <section className={styles.homeScreen} aria-label="افزودن برنامه به صفحه اصلی گوشی">
      <div className={styles.homeScreenIcon} aria-hidden="true">＋</div>
      <div className={styles.homeScreenCopy}>
        <strong>{installed ? "برنامه به صفحه اصلی اضافه شده است" : "دسترسی سریع‌تر از صفحه اصلی گوشی"}</strong>
        <p>
          {installed
            ? "می‌توانی AI Content Factory را مستقیماً از صفحه اصلی گوشی باز کنی."
            : "نسخه وب را به صفحه اصلی اضافه کن تا هر بار نیاز به جست‌وجو در مرورگر نداشته باشی."}
        </p>
      </div>
      {!installed && (
        <button className={styles.homeScreenButton} type="button" onClick={handleInstall}>
          {installPrompt ? "نصب اپلیکیشن" : "افزودن به صفحه اصلی"}
        </button>
      )}
      {showHelp && !installed && (
        <div className={styles.homeScreenHelp} role="status">
          {platform === "ios" ? (
            <p><b>در iPhone یا iPad:</b> صفحه را در Safari باز کن، دکمه Share (اشتراک‌گذاری) را بزن و گزینه <bdi>Add to Home Screen</bdi> یا «افزودن به صفحه اصلی» را انتخاب کن؛ سپس Add را بزن.</p>
          ) : platform === "android" ? (
            <p><b>در Android:</b> صفحه را در Chrome باز کن، منوی سه‌نقطه را بزن و گزینه «Install app» یا «افزودن به صفحه اصلی» را انتخاب کن. نام گزینه بسته به مرورگر ممکن است متفاوت باشد.</p>
          ) : (
            <p><b>برای افزودن میان‌بر:</b> منوی مرورگر را باز کن و گزینه «Install app» یا «Add to Home Screen» را انتخاب کن. در iPhone و iPad این کار از منوی Share در Safari انجام می‌شود.</p>
          )}
        </div>
      )}
    </section>
  );
}
