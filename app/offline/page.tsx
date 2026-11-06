export const metadata = {
  title: "عدم اتصال | AI Content Factory",
  robots: { index: false, follow: false },
};
export default function OfflinePage() {
  return (
    <main dir="rtl" style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: 24, background: "#f7f8fc", color: "#1c2b5e", textAlign: "center" }}>
      <section style={{ maxWidth: 420 }}>
        <div aria-hidden="true" style={{ fontSize: 48, marginBottom: 16 }}>⌁</div>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>اتصال اینترنت برقرار نیست</h1>
        <p style={{ lineHeight: 1.9, color: "#536078" }}>برای حفظ امنیت حساب، اطلاعات خصوصی و محتوای شما به‌صورت آفلاین ذخیره نمی‌شود. پس از اتصال دوباره، صفحه را تازه‌سازی کنید.</p>
        <a href="/" style={{ display: "inline-block", marginTop: 20, borderRadius: 12, padding: "12px 22px", background: "#1c2b5e", color: "white", textDecoration: "none" }}>تلاش دوباره</a>
      </section>
    </main>
  );
}
