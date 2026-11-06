# پیش‌نویس داخلی فرم Data safety گوگل‌پلی

> این فایل راهنمای آماده‌سازی است، نه پاسخ نهایی قابل ارسال. مالک برنامه باید آن را با تنظیمات واقعی Production، قرارداد پردازشگرها، SDKها و نسخه نهایی اپ تطبیق دهد. مسئولیت صحت پاسخ‌ها با توسعه‌دهنده است.

## شواهد فنی بررسی‌شده

- احراز هویت با Supabase Auth؛ ایمیل حساب و شناسه کاربر پردازش می‌شوند.
- پروفایل برند، ورودی‌های تولید محتوا، تاریخچه، کمپین‌ها و داده‌های تحلیلی دستی در Supabase نگهداری می‌شوند.
- پرامپت تصویر به Cloudflare Workers AI ارسال می‌شود؛ خروجی در bucket خصوصی Supabase ذخیره می‌شود.
- متن ورودی تولید محتوا به Google Gemini API ارسال می‌شود.
- ایمیل‌های تأیید/بازیابی از مسیر SMTP متصل به Supabase و Resend ارسال می‌شوند.
- برنامه روی Render میزبانی می‌شود.
- پرداخت درون‌برنامه‌ای، اشتراک، تبلیغات، دسترسی به موقعیت مکانی، مخاطبان، پیامک/تماس، دوربین یا میکروفون در نسخه فعلی شناسایی نشده‌اند.
- کاربر می‌تواند حساب را از داخل برنامه حذف کند و داده حساب را خروجی بگیرد؛ صفحه عمومی درخواست حذف حساب نیز در مسیر `https://app.eltbabak.ir/account-deletion` پیاده‌سازی شده است.

## دسته‌های داده‌ای که باید در Play Console بررسی شوند

| دسته Google Play | داده‌های محتمل | هدف |
|---|---|---|
| Personal info | Email address، User IDs | مدیریت حساب، ورود، تأیید ایمیل و بازیابی |
| User-generated content | متن prompt، اطلاعات برند، محتوای تولیدشده، نام/توضیح کمپین | قابلیت اصلی تولید و مدیریت محتوا |
| Photos and videos / Files and docs | تصاویر تولیدشده و فایل‌های خروجی/پشتیبان در صورت ذخیره/ارسال توسط کاربر | استودیوی رسانه، ذخیره و خروجی |
| App activity | رویدادها و فراداده عملیاتی تولید، تاریخچه و تعامل با قابلیت‌ها | ارائه قابلیت‌ها، امنیت و محدودسازی سوءاستفاده |
| App info and performance | لاگ خطا و داده‌های تشخیصی زیرساخت، در صورت ثبت در لاگ‌ها | پایش سلامت، رفع خطا و امنیت |

**توجه:** وجود یک دسته در این جدول به معنی الزام قطعی انتخاب همان گزینه در فرم نیست. باید تعریف دقیق Data type در فرم Google و رفتار همه SDKها/کتابخانه‌ها بررسی شود. داده شخصی‌ای که کاربر داخل فیلد آزاد وارد می‌کند نیز می‌تواند به پردازشگر ثالث ارسال شود.

## پردازشگرها و دریافت‌کنندگان احتمالی

- Supabase — Auth، پایگاه داده و ذخیره‌سازی خصوصی
- Render — میزبانی و لاگ‌های سرویس
- Google Gemini API — پردازش ورودی متنی برای تولید محتوا
- Cloudflare Workers AI — پردازش prompt تصویر و تولید تصویر در پیکربندی فعلی
- Resend — ارسال ایمیل تراکنشی از مسیر SMTP

پیش از نهایی‌سازی باید مشخص شود هر شرکت در این جریان «service provider/processor» است یا در شرایط خاص نقش مستقل دارد، داده در کدام منطقه پردازش می‌شود، مدت نگهداری چقدر است و آیا استفاده ثانویه از داده برای آموزش/بهبود محصول مجاز است.

## پاسخ‌هایی که نیاز به تأیید مالک دارند

- آیا تمام داده‌ها هنگام انتقال رمزنگاری می‌شوند؟ مسیرهای HTTPS استفاده می‌شوند؛ تمام ارتباطات ثالث و مسیرهای ایمیل را نیز تأیید کن.
- آیا تمام داده‌های ذخیره‌شده در حالت سکون رمزنگاری می‌شوند؟ تنظیمات واقعی پلن و منطقه Supabase/Render را بررسی کن.
- آیا داده‌ها برای شخص ثالث به‌جز پردازش سرویس‌دهنده افشا می‌شوند؟ قراردادهای Gemini، Cloudflare و Resend را بازبینی کن.
- آیا حذف حساب همه داده‌های مرتبط و نسخه‌های پشتیبان را در بازه مشخص حذف می‌کند؟ مدت واقعی backup retention هنوز تعیین نشده است.
- آیا داده‌های جمع‌آوری‌شده برای Analytics/Advertising استفاده می‌شوند؟ هیچ SDK تبلیغاتی یا تحلیل شخص ثالث در این بررسی شناسایی نشده، اما وابستگی‌های نهایی باید بازبینی شوند.
- آیا ایجاد حساب اجباری است؟ بخش‌های خصوصی برنامه به حساب و تأیید ایمیل نیاز دارند.
- آیا کاربران می‌توانند داده را حذف کنند؟ مسیر حذف درون‌برنامه‌ای و صفحه عمومی درخواست حذف حساب پیاده‌سازی شده‌اند؛ دسترسی عمومی و آزمون انتها‌به‌انتها باید پیش از ثبت فرم تأیید شود.
- آیا کاربر زیر ۱۸ سال مخاطب هدف است؟ تصمیم نهایی Target audience باید توسط مالک ثبت شود.

## مواردی که نباید بدون شواهد انتخاب شوند

- فروش داده، تبلیغات هدفمند، موقعیت مکانی، اطلاعات پرداخت، مخاطبان، سلامت، پیامک/تماس، ضبط صدا/تصویر و شناسه تبلیغاتی.
- گزینه‌های «not collected»، «not shared»، «encrypted at rest» یا «deleted within a fixed period» بدون بررسی همه پردازشگرها و تنظیمات واقعی.
- اعلام اینکه حذف کامل همه نسخه‌های پشتیبان بلافاصله انجام می‌شود؛ مدت نگهداری پشتیبان هنوز باید مشخص شود.

## بلوکرهای انتشار

1. انتشار سیاست حریم خصوصی در صفحه وب عمومی، غیرقابل‌ویرایش، بدون ورود و قابل دسترسی جهانی؛ افزودن لینک داخل برنامه و Play Console.
2. ایجاد صفحه عمومی درخواست حذف حساب در وب، علاوه بر حذف درون‌برنامه‌ای.
3. تکمیل اطلاعات اپراتور، ایمیل حریم خصوصی/پشتیبانی، مناطق میزبانی و زمان‌های نگهداری.
4. بازبینی شرایط و DPA ارائه‌دهندگان و SDKهای نهایی.
5. تطبیق نهایی این برگه با فرم Data safety و سیاست حریم خصوصی؛ سپس ارسال در Play Console.


## یافته‌های مناطق پردازش (۶ نوامبر ۲۰۲۶؛ برای تکمیل فرم، نه تأیید حقوقی)

- Supabase project: `us-east-1` (AWS Northern Virginia); organization plan: Free. Region is the primary project location, not a guarantee that all ancillary processing stays there.
- Render web service: Oregon, USA; Free plan.
- Resend: its current security/DPA materials state stored data is in the United States; email and log retention is 30 days on Free/Pro/Scale, with remaining customer data deleted within 90 days after account termination. Confirm account-specific applicability.
- Cloudflare Workers AI: standard inference Customer Content is processed only as needed and not retained after delivery; operational metadata may be retained. Logging/caching/stateful features are exceptions. Actual inference geography has not been verified.
- Gemini API: owner confirmed Free / Unpaid Services on 2026-11-06. Google may use submitted prompts/files and generated responses to provide, improve and develop Google products and ML technologies; human reviewers may read/annotate/process API inputs and outputs for quality. Google says it disconnects data from Google Account, API key and Cloud project before human review. Users must be told not to submit sensitive, confidential, or third-party personal information. Do not claim no model-training/product-improvement use or zero data retention. Recheck that billing is not enabled on the exact Cloud project used by the production API key.
- Render log retention and Supabase Free backup lifecycle remain unverified.

**Blocking owner verification:** confirm Free billing state on the exact Gemini Cloud project used by production; actual Cloudflare/Google inference geography; retention settings for Render logs and Supabase backups; final subprocessor/DPA review; and legal review for applicable jurisdictions. Do not mark the form final based on this draft.
