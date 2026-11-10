# API اولیه PHP

Base URL: همان origin اپلیکیشن، مثلاً `https://app.eltbabak.ir`.
تمام پاسخ‌ها JSON هستند. زمان‌ها UTC هستند.

## نشست و احراز هویت
- `GET /api/csrf` — دریافت توکن CSRF و ایجاد نشست ناشناس.
- `POST /api/auth/login` — body شامل `email` و `password`؛ هدر `X-CSRF-Token` لازم است.
- `GET /api/auth/me` — اطلاعات حساب فعال و توکن CSRF.
- `POST /api/auth/logout` — هدر CSRF لازم است.

ثبت‌نام عمومی هنوز باز نشده است؛ تا زمان تکمیل تأیید ایمیل، فعال‌کردن آن امن نیست.

## برندها
- `GET /api/brands`
- `POST /api/brands` — `name`، اختیاری: `business_type`، `profile`، `verified_facts`، `evidence`، `faq`، `forbidden_claims`.
- `PATCH /api/brands/{uuid}`
- `DELETE /api/brands/{uuid}`

هر حساب حداکثر ۱۰ برند می‌تواند داشته باشد. تمام عملیات با مالکیت user_id محدود شده‌اند.

## محتوا
- `GET /api/content?limit=25&offset=0&type=...`
- `POST /api/content` — `content_type` و `content` لازم؛ اختیاری: `title`، `brand_id`، `prompt`، `plain_text`.
- `GET /api/content/{uuid}`
- `GET /api/content/{uuid}/versions` — تاریخچه نسخه‌ها، فقط برای مالک محتوا.
- `PATCH /api/content/{uuid}` — ویرایش محتوا یک نسخه جدید ثبت می‌کند.
- `DELETE /api/content/{uuid}` — حذف نرم.

## کمپین‌ها
- `GET /api/campaigns`
- `POST /api/campaigns` — `name` لازم؛ اختیاری: `objective`، `audience`، `channels`، `checklist`، `starts_on`، `ends_on`.
- `DELETE /api/campaigns/{uuid}`

## امنیت و محدودیت
- ورود: حداکثر ۸ تلاش از یک IP در بازه ۱۵ دقیقه‌ای، با شمارنده اتمیک MySQL.
- تمام مسیرهای داده به نشست فعال و رکورد معتبر در `user_sessions` نیاز دارند.
- همه عملیات تغییردهنده داده به CSRF نیاز دارند.
- ورودی JSON تا یک مگابایت محدود شده است.
- تمام queryهای داده با PDO prepared statements اجرا می‌شوند.
- rate limiting، تأیید ایمیل، reset password، نسخه‌بندی قابل‌بازیابی، API تولید AI و تست‌های end-to-end هنوز در scope بعدی‌اند؛ این APIها به‌تنهایی جایگزین کامل محصول نیستند.
