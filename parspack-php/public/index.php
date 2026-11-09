<?php
declare(strict_types=1);

require dirname(__DIR__) . '/app/bootstrap.php';

$path = request_path();
$method = request_method();

if (auth_route($path, $method)) {
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
      <p id="welcome-message" class="muted"></p>
      <div id="ai-consent" class="notice hidden"><strong>اطلاعیه پردازش داده هوش مصنوعی</strong><p>اطلاعات کسب‌وکار و درخواست تولید محتوا برای پردازش به ارائه‌دهنده هوش مصنوعی پیکربندی‌شده ارسال می‌شود. اطلاعات ورود و رمز عبور ارسال نمی‌شوند. با انتخاب دکمه زیر، این موضوع را می‌پذیری.</p><button id="accept-ai-notice" class="primary" type="button">مطالعه کردم و می‌پذیرم</button></div>
      <div class="notice"><strong>زیرساخت PHP در حال انتقال است.</strong><p>ورود و مدیریت حساب در این مرحله آماده‌سازی شده‌اند. ماژول‌های تولید محتوا، تاریخچه، کمپین و رسانه پس از انتقال و آزمون به این پنل متصل می‌شوند.</p></div>
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
