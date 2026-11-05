# AI Content Factory

وب‌اپلیکیشن فارسی برای تولید و مدیریت محتوای بازاریابی کسب‌وکارها.

## قابلیت‌های فعلی

- ورود و ثبت‌نام با Supabase Auth
- تولید کپشن، سناریوی ریلز، پنج استوری و متن تبلیغاتی با Gemini
- پشتیبانی از ۹ نوع کسب‌وکار
- مدل جایگزین در صورت در دسترس نبودن مدل اصلی
- ذخیره تاریخچه در Supabase با جداسازی داده کاربران از طریق RLS
- ویرایش محتوا، کپی و خروجی TXT/JSON
- جست‌وجوی پیشرفته، پوشه، برچسب، علاقه‌مندی و خروجی گروهی JSON
- رابط فارسی، راست‌چین و واکنش‌گرا
- احراز هویت درخواست تولید و محدودیت اولیه نرخ درخواست

## فناوری‌ها

- Next.js 14 و React 18
- TypeScript
- Supabase Auth و PostgreSQL
- Gemini API

## اجرای محلی

نیازمندی‌ها: Node.js 20 و npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

برنامه در `http://localhost:3000` اجرا می‌شود.

## متغیرهای محیطی

مقادیر واقعی را فقط در فایل محلی نادیده‌گرفته‌شده توسط Git و تنظیمات امن Render وارد کن. هیچ کلیدی را در GitHub یا کد سمت مرورگر قرار نده.

| متغیر | کاربرد |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | آدرس پروژه Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | کلید عمومی anon/publishable برای کلاینت Supabase؛ امنیت داده باید با RLS تضمین شود |
| `GEMINI_API_KEY` | کلید محرمانه Gemini برای تولید واقعی |
| `GEMINI_MODEL` | مدل اصلی؛ پیش‌فرض در کد: `gemini-3.8-flash` |
| `GEMINI_FALLBACK_MODEL` | مدل جایگزین؛ پیش‌فرض در کد: `gemini-3.5-flash-lite` |

اگر کلید Gemini تنظیم نشده باشد، API محتوای نمونه (demo) برمی‌گرداند؛ این خروجی تولید واقعی مدل نیست.

## ساختار اصلی

```text
app/
  api/generate/route.ts   # API سمت سرور، احراز هویت و تولید
  globals.css             # طراحی و واکنش‌گرایی
  layout.tsx              # metadata، زبان فارسی و RTL
  page.tsx                # رابط اصلی فعلی
lib/
  supabase.ts             # کلاینت Supabase
docs/
  ROADMAP.md              # نقشه راه توسعه محصول
.github/
  workflows/ci.yml        # کنترل build در Pull Request و main
```

## ساخت و کنترل کیفیت

```bash
npm ci
npm run build
```

GitHub Actions همین build را برای Pull Request به `main` و push به `main` اجرا می‌کند. مقادیر Supabase در CI صرفاً placeholder هستند و هیچ داده یا سرویس واقعی را لمس نمی‌کنند.

## نکات امنیتی و عملیاتی

- سیاست‌های RLS جدول `content_history` باید برای تمام عملیات SELECT/INSERT/UPDATE/DELETE بر اساس `auth.uid() = user_id` اعمال شوند.
- کلید Gemini فقط باید در محیط سرور نگهداری شود.
- rate limit فعلی در حافظه فرایند است؛ با restart پاک می‌شود و بین چند instance مشترک نیست. پیش از مقیاس‌پذیری باید به ذخیره‌ساز توزیع‌شده منتقل شود.
- پیش از انتشار قابلیت‌های پرداخت، همکاری تیمی یا انتشار خودکار شبکه‌های اجتماعی، نیازمند اتصال، تنظیمات و تأیید جداگانه هستیم.
- خروجی AI باید پیش از انتشار توسط کاربر بازبینی شود.

## نقشه راه

برای مراحل، معیارهای تحویل و اصول تصمیم‌گیری به [نقشه راه محصول](docs/ROADMAP.md) مراجعه کن.


## Runtime and framework

The application targets Node.js 24 LTS, Next.js 16, and React 19.

## Automated tests

Run the built-in Node.js test suite before building:

```bash
npm test
npm run build
```

The test suite covers request body size enforcement, JSON/UTF-8 parsing, business input validation, and the in-memory rate limiter (including expiry and capacity limits).
