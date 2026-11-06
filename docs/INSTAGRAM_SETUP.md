> **وضعیت: آرشیوی و غیرفعال.** اتصال اینستاگرام از داشبورد فعلی پنهان است و کاربران امکان اتصال یا انتشار ندارند. این دستورالعمل فقط یادداشت فنی برای توسعه آینده است؛ هیچ مرحله‌ای را در Meta، Render یا Supabase اجرا نکن مگر اینکه قابلیت رسماً دوباره به محصول برگردد.

# راه‌اندازی اتصال اینستاگرام در AI Content Factory

این راهنما برای فعال‌کردن اتصال حساب حرفه‌ای اینستاگرام و انتشار مستقیم/زمان‌بندی‌شده در https://app.eltbabak.ir نوشته شده است.

## ۱. پیش‌نیاز حساب اینستاگرام

- حساب باید از نوع **Business** یا **Creator** باشد؛ حساب Personal پشتیبانی نمی‌شود.
- در نسخه فعلی برنامه، انتشار پست تصویری JPEG و ریلز MP4 پشتیبانی می‌شود.
- محدودیت فعلی آپلود برنامه: تصویر حداکثر ۸ مگابایت و ویدئو حداکثر ۵۰ مگابایت.
- استوری و کاروسل هنوز در نسخه فعلی پیاده‌سازی نشده‌اند.

## ۲. ساخت Meta App

1. وارد [Meta for Developers – Apps](https://developers.facebook.com/apps/) شو.
2. با حساب Facebook خودت وارد شو و در صورت نیاز ثبت‌نام توسعه‌دهنده را کامل کن.
3. یک App جدید بساز و نوع **Business** را انتخاب کن.
4. در Use cases یا Products، گزینه **Instagram API with Instagram Login** را راه‌اندازی کن. اگر رابط جدید Meta گزینه «Manage messaging & content on Instagram» را نشان داد، همان مسیر Instagram را انتخاب کن.
5. در بخش API setup with Instagram Login، دسترسی‌های زیر را اضافه کن:
   - `instagram_business_basic`
   - `instagram_business_content_publish`
6. در تنظیمات Business Login / OAuth، این Redirect URI را دقیقاً ثبت کن:

   `https://app.eltbabak.ir/integrations/instagram/callback`

   دقت کن که اسلش پایانی اضافه یا مسیر متفاوت نباشد.
7. حساب اینستاگرام خودت را به‌عنوان **Instagram Tester** اضافه کن و دعوت را در خود Instagram بپذیر:
   Settings → Website permissions → Apps and websites → Tester invites

برای آزمایش حساب خودت، برنامه می‌تواند در Development Mode بماند؛ فقط حساب‌هایی که نقش مجاز/Tester دارند می‌توانند متصل شوند. برای ارائه اتصال به حساب مشتریان دیگر، بعداً باید دسترسی‌های لازم را از Meta App Review و Advanced Access دریافت کنیم.

## ۳. ثبت متغیرهای Meta در Render

در Render → سرویس **AI-Content-Factory** → Environment، این دو مقدار را اضافه کن:

| Key | Value |
|---|---|
| `INSTAGRAM_APP_ID` | App ID بخش Instagram API with Instagram Login |
| `INSTAGRAM_APP_SECRET` | App Secret همان بخش |

**App Secret را در چت، GitHub، کد یا فایل عمومی قرار نده.** فقط در Environment امن Render ثبت کن.

این دو مقدار از قبل در سرویس تنظیم شده‌اند و لازم نیست تغییرشان بدهی:

- `INSTAGRAM_REDIRECT_URI=https://app.eltbabak.ir/integrations/instagram/callback`
- `INSTAGRAM_GRAPH_API_VERSION=v26.0`

## ۴. ساخت کلید رمزنگاری توکن

برای نگهداری امن Access Token، یک کلید تصادفی ۳۲ بایتی لازم است. در PowerShell ویندوز این دستورات را اجرا کن:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$key = [Convert]::ToBase64String($bytes)
$key
```

**وضعیت استقرار فعلی:** کلید ۳۲ بایتی به‌صورت تصادفی ساخته شده و مقدار یکسان آن هم در Render و هم در Supabase Vault ثبت شده است؛ برای اتصال فعلی نیازی به ساخت کلید جدید نیست. اگر روزی کلید را چرخاندی، باید هر دو محل را هم‌زمان به‌روزرسانی کنی و توجه داشته باش که توکن‌های رمز‌شده قبلی با کلید جدید باز نمی‌شوند.

برای استقرار تازه، خروجی را کپی کن و **همان مقدار** را در دو محل قرار بده:

1. Render → AI-Content-Factory → Environment:
   - Key: `INSTAGRAM_TOKEN_ENCRYPTION_KEY`
   - Value: خروجی PowerShell

2. Supabase → SQL Editor، این دستور را اجرا کن و به‌جای مقدار نمونه، همان کلید را قرار بده:

```sql
select vault.create_secret(
  'PASTE_THE_SAME_BASE64_KEY_HERE',
  'instagram_token_encryption_key',
  'AES-256-GCM key for Instagram access tokens'
);
```

این کلید را در چت ارسال نکن. اگر کلید گم یا عوض شود، توکن‌های ذخیره‌شده قبلی قابل رمزگشایی نخواهند بود و حساب باید دوباره متصل شود.

## ۵. فعال‌سازی انتشار زمان‌بندی‌شده

Edge Function مربوط به worker در Supabase مستقر است. این دو مقدار در Supabase Vault ثبت شده‌اند:

- `supabase_project_url`
- `instagram_publish_cron_secret`

job زمان‌بندی `instagram-publish-every-minute` در pg_cron ثبت شده، اما عمداً `active=false` است. کلید رمزنگاری در Render و Vault هماهنگ است و `INSTAGRAM_SCHEDULER_ENABLED=false` در Render تنظیم شده است. تنها پس از ثبت App ID و App Secret و تأیید اتصال حساب، job را فعال و متغیر زمان‌بندی را روشن می‌کنیم؛ سپس انتشار زمان‌بندی‌شده را end-to-end آزمایش می‌کنیم.

## ۶. آزمون نهایی

پس از تکمیل تنظیمات:

1. وارد https://app.eltbabak.ir شو.
2. در بخش «مدیریت انتشار اینستاگرام»، اتصال حساب حرفه‌ای را انتخاب کن.
3. دسترسی‌های Meta را تأیید کن.
4. ابتدا یک تصویر آزمایشی منتشر کن.
5. سپس یک ریلز آزمایشی منتشر کن.
6. در پایان یک پست را برای چند دقیقه بعد زمان‌بندی کن و نتیجه انتشار خودکار را بررسی کن.

تا وقتی هر سه آزمون انتشار فوری تصویر، ریلز و زمان‌بندی موفق نشده‌اند، اتصال اینستاگرام را آماده بهره‌برداری نهایی اعلام نمی‌کنیم.
