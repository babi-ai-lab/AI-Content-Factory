<?php
declare(strict_types=1);

require dirname(__DIR__) . '/app/bootstrap.php';

$path = request_path();
$method = request_method();

if (auth_route($path, $method)) {
    exit;
}

if (history_route($path, $method)) {
    exit;
}

if (campaign_route($path, $method)) {
    exit;
}

if (analytics_calendar_route($path, $method)) {
    exit;
}

if (media_route($path, $method)) {
    exit;
}

if (brand_profile_route($path, $method)) {
    exit;
}

if (account_route($path, $method)) {
    exit;
}

if ($path === '/api/generate' && $method === 'POST') {
    handle_content_generation();
}

if ($path === '/api/health' && $method === 'GET') {
    try {
        db()->query('SELECT 1');
        json_response(['ok' => true, 'app' => 'AI Content Factory', 'runtime' => 'php', 'database' => 'connected']);
    } catch (Throwable $error) {
        error_log('[AI Content Factory] Database health check failed: ' . $error->getMessage());
        json_response(['ok' => false, 'error' => ['code' => 'DATABASE_UNAVAILABLE', 'message' => 'ارتباط با پایگاه داده برقرار نیست.']], 503);
    }
}

if ($path === '/' && $method === 'GET') {
    $csrf = json_encode(csrf_token(), JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#101a3a">
  <title>AI Content Factory | کارخانه هوشمند تولید محتوا</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <main class="page">
    <section class="brand">
      <div class="brand-mark">AI</div>
      <p class="eyebrow">AI CONTENT FACTORY</p>
      <h1>کارخانه هوشمند<br><span>تولید محتوا</span></h1>
      <p class="intro">فضای کاری یکپارچه برای تولید و مدیریت محتوای بازاریابی کسب‌وکار شما.</p>
      <div class="feature-list"><span>تولید محتوای تخصصی</span><span>مدیریت برند و کمپین</span><span>تقویم و کتابخانه محتوا</span></div>
    </section>
    <section class="auth-card" id="auth-card">
      <div class="tabs" role="tablist" aria-label="ورود یا ثبت‌نام">
        <button class="tab active" id="login-tab" type="button">ورود</button>
        <button class="tab" id="register-tab" type="button">ساخت حساب</button>
      </div>
      <form id="login-form" class="auth-form">
        <h2>خوش برگشتی</h2><p class="muted">برای ورود به فضای کاری ایمیل و رمز عبورت را وارد کن.</p>
        <label for="login-email">ایمیل</label><input id="login-email" name="email" type="email" autocomplete="email" required>
        <label for="login-password">رمز عبور</label><input id="login-password" name="password" type="password" autocomplete="current-password" required>
        <button class="primary" type="submit">ورود به حساب</button>
        <button class="text-button" id="forgot-button" type="button">رمز عبورم را فراموش کرده‌ام</button>
      </form>
      <form id="register-form" class="auth-form hidden">
        <h2>حساب جدید بساز</h2><p class="muted">برای شروع، اطلاعات زیر را وارد کن.</p>
        <label for="register-name">نام نمایشی</label><input id="register-name" name="displayName" type="text" maxlength="120" autocomplete="name" required>
        <label for="register-email">ایمیل</label><input id="register-email" name="email" type="email" autocomplete="email" required>
        <label for="register-password">رمز عبور</label><input id="register-password" name="password" type="password" autocomplete="new-password" required>
        <p class="hint">حداقل ۱۰ نویسه، شامل حرف کوچک و بزرگ انگلیسی، عدد و علامت.</p>
        <button class="primary" type="submit">ایجاد حساب کاربری</button>
      </form>
      <form id="reset-form" class="auth-form hidden">
        <h2>تعیین رمز جدید</h2><p class="muted">رمز عبور جدیدت را وارد کن.</p>
        <label for="reset-password">رمز عبور جدید</label><input id="reset-password" name="password" type="password" autocomplete="new-password" required>
        <p class="hint">حداقل ۱۰ نویسه، شامل حرف کوچک و بزرگ انگلیسی، عدد و علامت.</p>
        <button class="primary" type="submit">ذخیره رمز جدید</button>
      </form>
      <div id="message" class="message" role="status" aria-live="polite"></div>
    </section>
    <section id="workspace" class="auth-card hidden">
      <div class="workspace-head"><div><p class="eyebrow">WORKSPACE</p><h2>حساب کاربری فعال است</h2></div><button id="logout-button" class="secondary" type="button">خروج</button></div>
      <p id="welcome-message" class="muted"></p><div id="workspace-message" class="message" role="status" aria-live="polite"></div>
      <div id="ai-consent" class="notice hidden"><strong>اطلاعیه پردازش داده هوش مصنوعی</strong><p>اطلاعات کسب‌وکار و درخواست تولید محتوا برای پردازش به ارائه‌دهنده هوش مصنوعی پیکربندی‌شده ارسال می‌شود. اطلاعات ورود و رمز عبور ارسال نمی‌شوند. با انتخاب دکمه زیر، این موضوع را می‌پذیری.</p><button id="accept-ai-notice" class="primary" type="button">مطالعه کردم و می‌پذیرم</button></div>
      <div id="app-modules" class="hidden">
        <section class="module-card">
          <h2>تولید محتوای جدید</h2>
          <p class="muted">اطلاعات واقعی کسب‌وکار را وارد کن؛ خروجی پس از تولید در کتابخانه ذخیره می‌شود.</p>
          <form id="generate-form" class="generator-form">
            <div class="form-grid">
              <div><label for="brand-profile-id">پروفایل برند ذخیره‌شده</label><select id="brand-profile-id" name="brandProfileId"><option value="">بدون پروفایل</option></select></div>
              <div><label for="business-name">نام کسب‌وکار</label><input id="business-name" name="businessName" maxlength="120"></div>
              <div><label for="business-type">حوزه فعالیت</label><select id="business-type" name="businessType"><option value="retail">فروشگاه و خرده‌فروشی</option><option value="services">خدمات</option><option value="restaurant">رستوران و کافه</option><option value="real_estate">املاک</option><option value="construction">ساختمان و بازسازی</option><option value="education">آموزش</option><option value="fitness">ورزش و تناسب اندام</option><option value="personal_brand">برند شخصی</option><option value="other">سایر</option></select></div>
              <div><label for="content-channel">کانال انتشار</label><select id="content-channel" name="channel"><option value="general">عمومی</option><option value="instagram">اینستاگرام</option><option value="telegram">تلگرام</option><option value="bale">بله</option><option value="sms">پیامک</option><option value="website">وب‌سایت</option><option value="email">ایمیل</option><option value="linkedin">لینکدین</option><option value="youtube">یوتیوب</option></select></div>
              <div><label for="content-template">الگوی محتوا</label><select id="content-template" name="contentTemplate"><option value="balanced">متعادل</option><option value="educational">آموزشی</option><option value="product_launch">معرفی محصول یا خدمت</option><option value="customer_story">داستان مشتری</option><option value="faq">پرسش‌های متداول</option><option value="limited_offer">پیشنهاد ویژه</option><option value="lead_generation">جذب سرنخ</option><option value="brand_awareness">آگاهی از برند</option><option value="before_after">قبل و بعد</option><option value="problem_solution">مسئله و راه‌حل</option></select></div>
              <div><label for="item-name">نام محصول یا خدمت</label><input id="item-name" name="name" maxlength="120" required></div>
              <div><label for="item-price">قیمت (اختیاری)</label><input id="item-price" name="price" maxlength="100"></div>
              <div><label for="item-audience">مخاطب هدف</label><input id="item-audience" name="audience" maxlength="160"></div>
              <div><label for="item-goal">هدف محتوا</label><input id="item-goal" name="goal" maxlength="100" placeholder="مثلاً افزایش تماس"></div>
              <div><label for="item-tone">لحن</label><input id="item-tone" name="tone" maxlength="100" placeholder="مثلاً حرفه‌ای و صمیمی"></div>
              <div><label for="scheduled-at">زمان پیشنهادی انتشار</label><input id="scheduled-at" name="scheduledAt" type="datetime-local"></div>
            </div>
            <label for="item-features">توضیحات و ویژگی‌های واقعی</label><textarea id="item-features" name="features" rows="4" maxlength="1800" required></textarea>
            <label for="item-differentiators">مزیت‌های واقعی (اختیاری)</label><textarea id="item-differentiators" name="differentiators" rows="2" maxlength="220"></textarea>
            <label for="item-service-area">محدوده فعالیت (اختیاری)</label><input id="item-service-area" name="serviceArea" maxlength="160">
            <label for="item-offer">پیشنهاد ثبت‌شده (اختیاری)</label><input id="item-offer" name="offer" maxlength="180">
            <label for="item-additional">اطلاعات تکمیلی (اختیاری)</label><textarea id="item-additional" name="additionalInfo" rows="2" maxlength="1000"></textarea>
            <button class="primary" type="submit">تولید محتوای هوشمند</button>
          </form>
          <div id="generation-message" class="message" role="status" aria-live="polite"></div>
          <div id="generated-output" class="output-grid hidden">
            <article class="output-card"><div class="output-head"><h3>کپشن / متن اصلی</h3><button data-copy="caption" type="button" class="copy-button">کپی</button></div><pre id="output-caption"></pre></article>
            <article class="output-card"><div class="output-head"><h3>سناریوی ویدیو</h3><button data-copy="reel" type="button" class="copy-button">کپی</button></div><pre id="output-reel"></pre></article>
            <article class="output-card"><div class="output-head"><h3>پنج استوری</h3><button data-copy="stories" type="button" class="copy-button">کپی</button></div><pre id="output-stories"></pre></article>
            <article class="output-card"><div class="output-head"><h3>متن تبلیغاتی</h3><button data-copy="ad" type="button" class="copy-button">کپی</button></div><pre id="output-ad"></pre></article>
          </div>
        </section>
        <section class="module-card">
          <div class="section-head"><div><h2>کتابخانه محتوا</h2><p class="muted">محتواهای ذخیره‌شده در حساب کاربری</p></div><input id="history-search" class="search-input" type="search" placeholder="جست‌وجو در تاریخچه"></div>
          <div id="history-items" class="history-list"></div>
          <button id="history-more" class="secondary hidden" type="button">نمایش موارد بیشتر</button>
        </section>
        <section class="module-card">
          <div class="section-head"><div><h2>تحلیل عملکرد</h2><p class="muted">آمار تولید محتوا و مصرف مدل هوش مصنوعی</p></div><select id="analytics-period" class="period-select"><option value="7">۷ روز</option><option value="30" selected>۳۰ روز</option><option value="all">همه زمان‌ها</option></select></div>
          <div id="analytics-stats" class="analytics-stats"></div>
          <div id="analytics-trend" class="analytics-trend"></div>
          <div id="analytics-business" class="analytics-business"></div>
        </section>
        <section class="module-card">
          <h2>مدیریت کمپین‌ها</h2>
          <p class="muted">هدف، مراحل اجرا و محتواهای مرتبط هر کمپین را مدیریت کن.</p>
          <form id="campaign-form" class="generator-form">
            <div class="form-grid">
              <div><label for="campaign-name">نام کمپین</label><input id="campaign-name" maxlength="120" required></div>
              <div><label for="campaign-audience">مخاطب هدف</label><input id="campaign-audience" maxlength="500"></div>
            </div>
            <label for="campaign-goal">هدف کمپین</label><textarea id="campaign-goal" rows="2" maxlength="500" required></textarea>
            <label for="campaign-channels">کانال‌ها (با ویرگول جدا کن)</label><input id="campaign-channels" maxlength="500" placeholder="اینستاگرام، تلگرام، وب‌سایت">
            <button class="primary" type="submit">ساخت کمپین</button>
          </form>
          <div id="campaign-message" class="message" role="status" aria-live="polite"></div>
          <div id="campaign-items" class="campaign-list"></div>
        </section>
        <section class="module-card">
          <h2>تقویم محتوای ۳۰ روز آینده</h2>
          <p class="muted">محتواهایی که زمان انتشار برای آن‌ها تعیین کرده‌ای.</p>
          <button id="calendar-export" class="secondary" type="button">خروجی تقویم (ICS)</button>
          <div id="calendar-items" class="history-list"></div>
        </section>
        <section class="module-card">
          <h2>مدیریت حساب و داده‌ها</h2>
          <p class="muted">می‌توانی نسخه‌ای از داده‌های حساب خود دریافت کنی یا حساب را به‌صورت دائمی حذف کنی.</p>
          <a class="export-link" href="/api/account/export">دریافت خروجی اطلاعات حساب (JSON)</a>
          <form id="delete-account-form" class="generator-form danger-form">
            <label for="delete-password">رمز عبور فعلی</label><input id="delete-password" type="password" autocomplete="current-password" required>
            <label for="delete-confirmation">برای تأیید، عبارت DELETE را وارد کن</label><input id="delete-confirmation" type="text" autocomplete="off" required>
            <button class="danger-button" type="submit">حذف دائمی حساب و اطلاعات</button>
          </form>
          <div id="account-message" class="message" role="status" aria-live="polite"></div>
        </section>
        <section class="module-card">
          <h2>پروفایل‌های برند</h2>
          <p class="muted">اطلاعات تأییدشده برند را یک‌بار ذخیره کن تا در تولیدهای بعدی استفاده شود. حداکثر ۱۰ پروفایل.</p>
          <form id="brand-form" class="generator-form">
            <div class="form-grid">
              <div><label for="brand-name">نام برند</label><input id="brand-name" name="brandName" maxlength="120" required></div>
              <div><label for="brand-type">حوزه فعالیت</label><select id="brand-type" name="businessType"><option value="retail">فروشگاه</option><option value="services">خدمات</option><option value="restaurant">رستوران و کافه</option><option value="real_estate">املاک</option><option value="construction">ساختمان و بازسازی</option><option value="education">آموزش</option><option value="fitness">ورزش</option><option value="personal_brand">برند شخصی</option><option value="other">سایر</option></select></div>
              <div><label for="brand-tagline">شعار برند</label><input id="brand-tagline" name="tagline" maxlength="160"></div>
              <div><label for="brand-audience">مخاطب اصلی</label><input id="brand-audience" name="audience" maxlength="200"></div>
              <div><label for="brand-value">ارزش پیشنهادی</label><input id="brand-value" name="valueProposition" maxlength="320"></div>
              <div><label for="brand-voice">لحن برند</label><input id="brand-voice" name="voice" maxlength="120"></div>
              <div><label for="brand-terms">واژگان ترجیحی</label><input id="brand-terms" name="preferredTerms" maxlength="300"></div>
              <div><label for="brand-avoid">واژگان ممنوع</label><input id="brand-avoid" name="avoidTerms" maxlength="300"></div>
              <div><label for="brand-cta">دعوت به اقدام ترجیحی</label><input id="brand-cta" name="cta" maxlength="180"></div>
            </div>
            <label for="brand-facts">واقعیت‌های تأییدشده</label><textarea id="brand-facts" name="verifiedFacts" rows="3" maxlength="2000"></textarea>
            <label for="brand-proof">شواهد و نمونه‌های قابل استناد</label><textarea id="brand-proof" name="proofPoints" rows="2" maxlength="1200"></textarea>
            <label for="brand-faq">پرسش و پاسخ‌های معتبر</label><textarea id="brand-faq" name="faq" rows="3" maxlength="2000"></textarea>
            <label for="brand-prohibited">ادعاهای ممنوع</label><textarea id="brand-prohibited" name="prohibitedClaims" rows="2" maxlength="1200"></textarea>
            <button class="primary" type="submit">ذخیره پروفایل برند</button>
          </form>
          <div id="brand-message" class="message" role="status" aria-live="polite"></div>
          <div id="brand-items" class="history-list"></div>
        </section>
        <section class="module-card">
          <h2>تولید و کتابخانه تصویر</h2>
          <p class="muted">تصویر پس از تولید در فضای خصوصی همین هاست ذخیره می‌شود.</p>
          <form id="image-form" class="generator-form">
            <label for="image-prompt">توضیحات تصویر</label>
            <textarea id="image-prompt" rows="3" maxlength="3000" minlength="20" required placeholder="صحنه، سوژه، سبک بصری، نور و جزئیات موردنظر را توصیف کن..."></textarea>
            <div class="form-grid">
              <div><label for="image-ratio">نسبت تصویر</label><select id="image-ratio"><option value="4:5">عمودی ۴:۵</option><option value="1:1">مربع ۱:۱</option><option value="9:16">استوری ۹:۱۶</option><option value="16:9">افقی ۱۶:۹</option><option value="3:2">افقی ۳:۲</option><option value="2:3">عمودی ۲:۳</option></select></div>
            </div>
            <button class="primary" type="submit">تولید تصویر</button>
          </form>
          <div id="media-message" class="message" role="status" aria-live="polite"></div>
          <div id="media-items" class="media-grid"></div>
        </section>
      </div>
    </section>
    <footer>© AI Content Factory · ELTBabak</footer>
  </main>
  <script>window.AICF_CSRF = ' . $csrf . ';</script>
  <script src="/auth.js" defer></script>
</body>
</html>';
    exit;
}

json_response(['ok' => false, 'error' => ['code' => 'NOT_FOUND', 'message' => 'مسیر موردنظر پیدا نشد.']], 404);
