# چک‌لیست عرضه AI Content Factory

این چک‌لیست وضعیت فنی را از اقداماتی که فقط مالک حساب می‌تواند انجام دهد جدا می‌کند. هیچ مورد هزینه‌دار بدون تأیید مالک انجام نمی‌شود.

## انجام‌شده در کد و زیرساخت

- [x] CI شامل audit وابستگی‌های production، تست‌ها، TypeScript و build
- [x] تولید محتوا، تاریخچه، نسخه‌بندی، تحلیل مصرف و تقویم شمسی
- [x] مدیریت کمپین و اتصال محتواهای ذخیره‌شده به کمپین
- [x] RLS و کنترل مالکیت برای کمپین‌ها و ارتباط محتوا با کمپین
- [x] محدودسازی دسترسی anon به جدول‌های محتوایی
- [x] نمونه اولیه backend اینستاگرام در مخزن موجود است؛ رابط کاربری آن از داشبورد پنهان و قابلیت برای کاربران غیرفعال است.
- [x] کلید رمزنگاری نمونه اولیه در Render و Supabase Vault ثبت شده است؛ این مورد به معنی فعال‌بودن انتشار برای کاربران نیست.
- [x] job زمان‌بندی نمونه اولیه به‌صورت غیرفعال نگه داشته می‌شود؛ `INSTAGRAM_SCHEDULER_ENABLED=false` است.
- [ ] بازگرداندن قابلیت اینستاگرام تصمیم محصول جداگانه است و تا آن زمان نباید در رابط یا مستندات عمومی به‌عنوان قابلیت موجود معرفی شود.
- [x] endpoint سلامت `/api/health`
- [x] جلوگیری از نمایش محتوای demo به‌عنوان تولید واقعی در محیط Production
- [x] اطلاع‌رسانی درباره پردازش داده در سرویس تولید محتوا و ثبت تأیید کاربر قبل از تولید
- [x] بازبینی ساختاری دیتابیس در 2026-11-06: هر ۱۰ جدول public دارای RLS و سیاست‌های مالکیت‌محور هستند؛ چهار تابع SECURITY DEFINER فقط برای postgres و service_role قابل اجرا هستند و view عمومی وجود ندارد.
- [x] اجرای موفق آزمون smoke Production برای دامنه سفارشی و دامنه Render؛ سلامت API، رد درخواست‌های بدون ورود، پوسته عمومی و فایل‌های JavaScript بررسی شدند.
- [x] خروجی ICS تقویم شمسی: زمان UTC، مدت پیش‌فرض ۳۰ دقیقه، escape متن و شکستن خطوط UTF-8؛ تست واحد، typecheck و build موفق.
- [x] نگاشت نسبت تصویر و اندازه خروجی تصویر به مقادیر معتبر در تست‌های خودکار.
- [x] تشخیص سهمیه صفر در سرویس تصویر و پیام خنثی اختصاصی؛ نام پردازشگر در رابط نمایش داده نمی‌شود.
- [x] خروجی JSON داده‌های حساب با نشست معتبر، RLS، allowlist فیلدها، سقف اندازه و حذف توکن‌ها/اطلاعات محرمانه؛ فایل‌های باینری رسانه جداگانه دانلود می‌شوند.

## اقداماتی که به حضور مالک نیاز دارند

### ۰. فعال‌سازی تولید تصویر
- [ ] در پنل حساب سرویس تصویر، ظرفیت و اعتبار قابل استفاده برای مدل متصل را فعال کن؛ لاگ Production محدودیت سهمیه صفر را نشان داده است و صرفاً منتظر بازنشانی ساعتی نیست.
- [ ] پس از فعال‌سازی، با یک حساب واردشده یک تصویر ۴:۵ تولید و ذخیره خصوصی آن را بررسی کن.
- [ ] سپس کاروسل پنج‌اسلایدی، خروجی PNG/ZIP و محدودیت پنج تصویر در ساعت را آزمون کن.
- [ ] کلید یا رمز محرمانه را در چت یا GitHub ارسال نکن؛ فقط در تنظیمات امن سرویس ثبت شود.

### ۱. Supabase Auth و ایمیل

- [x] Site URL و Redirect URL دامنه `https://app.eltbabak.ir` برای جریان ورود/تأیید ایمیل تنظیم و آزمون شده‌اند.
- [x] SMTP اختصاصی تنظیم شده و ایمیل تأیید واقعی به دست مالک رسیده است.
- [x] ثبت‌نام، تأیید ایمیل و ورود با حساب واقعی توسط مالک تأیید شده‌اند.
- [ ] مسیر بازیابی رمز عبور را جداگانه با حساب آزمایشی آزمون کن.
- [ ] حداقل طول رمز عبور Supabase Auth را روی ۸ کاراکتر یا بیشتر قرار بده؛ رابط برنامه برای رمزهای جدید حداقل ۸ کاراکتر می‌خواهد.
- [x] Confirm Email فعال است و لینک تأیید ایمیل واقعی با موفقیت آزمون شده است.
- [ ] زمان انقضای لینک/OTP را جداگانه بررسی کن و در صورت نیاز حداکثر یک ساعت تنظیم کن.
- [ ] CAPTCHA را فعلاً فعال نکن؛ ابتدا باید توکن CAPTCHA به مسیرهای ثبت‌نام، ورود، بازیابی رمز و تأیید حذف حساب متصل شود. پس از پیاده‌سازی و آزمون این اتصال، فعال‌سازی را انجام بده.
- [ ] MFA را برای حساب مالک Supabase و GitHub فعال کن.
- [ ] هشدار Supabase درباره pg_net در schema عمومی را با مستندات و وابستگی‌های cron بررسی کن؛ بدون بررسی، extension را جابه‌جا یا حذف نکن.
- [ ] SSL Enforcement پایگاه داده را در Supabase بررسی و فعال بودنش را تأیید کن؛ Network Restrictions را متناسب با روش اتصال بررسی کن.
- [ ] در صورت پشتیبانی طرح فعلی، Leaked Password Protection را فعال کن. این قابلیت طبق مستندات Supabase به Pro و بالاتر نیاز دارد؛ هیچ ارتقای پولی بدون تأیید انجام نده.

### ۲. Meta / Instagram (مرحله بعدی اتصال انتشار)

- [ ] اپلیکیشن Meta Developer بساز و Instagram API with Instagram Login را اضافه کن.
- [ ] Redirect URI دقیق `https://app.eltbabak.ir/integrations/instagram/callback` را در تنظیمات Meta ثبت کن.
- [ ] دسترسی‌های `instagram_business_basic` و `instagram_business_content_publish` را اضافه کن؛ حساب خودت را به‌عنوان Instagram Tester ثبت و دعوت را بپذیر.
- [ ] App ID و App Secret را فقط در متغیرهای محیطی امن Render ثبت کن؛ Secret را در GitHub یا چت قرار نده.
- [ ] اتصال حساب حرفه‌ای را با Instagram Tester تأیید کن.
- [ ] انتشار فوری تصویر JPEG را آزمایش کن.
- [ ] انتشار فوری ریلز MP4 را آزمایش کن.
- [ ] پس از اتصال موفق حساب، cron job غیرفعال را فعال کن و اجرای خودکار worker را آزمایش کن.

### ۳. Render

- [x] مسیر Health Check برابر `/api/health` در تنظیمات Render ثبت و تأیید شده است.
- [x] Build Command روی `npm ci && npm run build` تنظیم شده است.
- [ ] در GitHub برای شاخه `main` محافظت فعال کن: فقط Pull Request، الزام موفقیت CI، و منع force-push. این تنظیم در صورت نداشتن مجوز Admin باید توسط مالک در تنظیمات مخزن انجام شود.
- [x] Auto-Deploy روی After CI Checks Pass تنظیم شده است؛ استقرار پس از موفقیت CI انجام می‌شود.

- [ ] محدودیت پلن Free را در نظر بگیر: سرویس پس از بی‌کاری ممکن است متوقف شود و درخواست بعدی cold start داشته باشد. برای دسترس‌پذیری ۲۴/۷ نیاز به تصمیم جداگانه درباره زیرساخت و هزینه است.

### ۴. آزمون پذیرش با یک حساب آزمایشی

- [ ] تأیید اطلاعیه پردازش داده؛ بررسی اینکه تولید قبل از تأیید مسدود و پس از تأیید فعال می‌شود
- [ ] لغو تأییدیه؛ بررسی اینکه تولید جدید دوباره مسدود می‌شود
- [ ] صفحه معرفی عمومی در موبایل و دسکتاپ؛ CTA به فرم ورود/ثبت‌نام و FAQ را بررسی کن.
- [ ] ورود با حساب بدون تاریخچه؛ بررسی نمایش راهنمای شروع سریع و کارکرد سه مسیر میانبر
- [ ] پس از ذخیره اولین محتوا، بررسی ناپدیدشدن راهنمای شروع سریع
- [ ] ثبت‌نام و تأیید ایمیل
- [ ] ورود و خروج
- [ ] تولید واقعی محتوا و ذخیره آن
- [ ] ویرایش، حذف و بازگردانی نسخه
- [ ] ساخت کمپین، انتقال هدف/مخاطب/کانال به فرم تولید، اتصال خودکار خروجی ذخیره‌شده و قطع اتصال آن
- [ ] آزمایش خروجی کانال‌های SMS، تلگرام، ایمیل، وب‌سایت و لینکدین از نظر قالب و طول متن
- [ ] ثبت داده آزمایشی کمپین و بررسی محاسبه CTR، CPL، CPA، نرخ تبدیل، مصرف بودجه و ROAS؛ ورودی خالی و صفر نباید تقسیم بر صفر ایجاد کند
- [ ] اعداد فارسی/عربی و جداکننده هزارگان را در ورودی شاخص‌های کمپین آزمایش کن
- [ ] حذف کمپین و اطمینان از باقی‌ماندن محتوا در تاریخچه
- [ ] درخواست بازیابی رمز و ثبت رمز جدید
- [ ] آزمون حذف حساب فقط با یک حساب آزمایشی؛ بررسی حذف محتوا، کمپین‌ها و داده‌های مصرف
- [ ] اجرای health check و اطمینان از پاسخ 200 در مسیر `/api/health`
- [ ] بررسی اینکه پس از خروج، داده‌های حساب در دسترس نیستند
- [ ] آزمون عملی جداسازی داده با دو حساب مستقل؛ بازبینی ساختاری RLS جایگزین این آزمون نیست.

### ۵. تصمیم‌های مالک محصول

- [ ] تکمیل [پیش‌نویس حریم خصوصی](PRIVACY_POLICY_DRAFT.md) و [شرایط استفاده](TERMS_DRAFT.md) با نام حقوقی، ایمیل پشتیبانی، کشور/قلمرو، مناطق میزبانی، نگهداری داده و بازبینی حقوقی.
- [ ] بازبینی شرایط حریم خصوصی پردازشگر متصل، سطح دسترسی و محدودیت‌های مصرف قبل از استفاده با داده واقعی مشتریان؛ تأیید داخل برنامه جایگزین بررسی حقوقی و سیاست حریم خصوصی نیست. هیچ ارتقای پولی یا تغییر صورتحساب انجام نشده است.
- [ ] بازبینی حذف حساب با حساب آزمایشی و اطمینان از اینکه رمز اشتباه حذف را متوقف می‌کند.
- [ ] زیرساخت قدیمی اینستاگرام: bucket رسانه private و خالی است؛ جدول‌های اتصال/انتشار قدیمی رکورد ندارند. رابط از داشبورد پنهان است، اما کدهای backend هنوز در مخزن وجود دارند و Edge Function زمان‌بندی پاسخ 410 می‌دهد. حذف جدول‌های قدیمی نیازمند تأیید صریح مالک است.

## محدودیت‌های فعلی

- همه امکانات فعلاً رایگان هستند؛ پرداخت و اشتراک فعال نیست.
- سهمیه ماهانه اجباری برای کاربران وجود ندارد؛ محدودیت‌های API و rate limit امنیتی همچنان برقرارند.
- اتصال و انتشار اینستاگرام در رابط فعلی پنهان و غیرفعال است؛ هیچ انتشار خودکاری در دسترس کاربر نیست.
- [x] آزمون smoke زمان‌بندی‌شده نخستین اجرای موفق را روی هر دو دامنه در 2026-11-06 ثبت کرده است؛ اکنون health، رد درخواست‌های ناشناس شامل خروجی حساب، سیاست no-store و فایل‌های JavaScript را دوره‌ای بررسی می‌کند.
- آماده‌بودن برای عرضه عمومی فقط پس از انجام آزمون پذیرش و تنظیمات بالا قابل تأیید است.


## Media studio regression checks
- [x] تست خودکار نگاشت نسبت تصویر/اندازه و طبقه‌بندی پیام‌های خطا.
- [ ] ظرفیت حساب سرویس تصویر صفر است؛ پس از فعال‌سازی ظرفیت توسط مالک، تولید واقعی تصویر و کاروسل را آزمایش کن.
- [ ] Resolve the zero-capacity account configuration before attempting authenticated generation.
- [ ] Generate one 4:5 image with an authenticated account and verify the returned private asset.
- [ ] Generate a five-slide carousel and verify all five images are stored under the requesting user.
- [ ] Edit Persian copy on each slide and export 1080×1350 PNG files.
- [ ] Verify a sixth image request in the same hour is rejected and no cross-user asset can be listed or deleted.
- [ ] Verify expired signed URLs refresh after reloading the media library.

## یافته‌های امنیت و عملکرد دیتابیس
- [ ] هشدار `pg_net` در schema عمومی باقی است؛ قبل از انتقال extension وابستگی‌های cron و worker باید بررسی شوند.
- [ ] محافظت رمزهای افشاشده هنوز فعال نیست؛ فقط در صورت پشتیبانی طرح فعلی و بدون ارتقای خودکار بررسی شود.
- [x] index کلید خارجی `generated_media.content_history_id` با migration نسخه‌دار ایجاد و در Production تأیید شد.
- [ ] هفت index در گزارش advisor استفاده‌نشده‌اند؛ حذف آن‌ها تا زمان مشاهده workload واقعی توصیه نمی‌شود.


## Android و Google Play

- [x] Web App Manifest با شناسه پایدار، زبان فارسی، RTL و حالت standalone
- [x] آیکون‌های vector و تولید خودکار PNGهای 192، 512، maskable و آیکون فروشگاه 512 در مرحله build
- [x] Service Worker با مسیر شبکه‌اول و صفحه آفلاین عمومی؛ بدون cache کردن محتوای خصوصی
- [x] پیشنهاد نصب درون‌برنامه‌ای فقط در مرورگرهایی که رویداد نصب را پشتیبانی می‌کنند
- [x] تست‌های واحد PWA و کنترل کیفیت build
- [x] چک‌لیست خودکار Production برای manifest، آیکون‌ها، service worker و صفحه offline
- [x] پیش‌نویس فارسی صفحه فروشگاه: [PLAY_STORE_LISTING_DRAFT_FA.md](PLAY_STORE_LISTING_DRAFT_FA.md)
- [ ] اجرای smoke test واقعی روی هر دو origin پس از انتشار آخرین نسخه PWA
- [x] اعتبارسنجی مستقل PWA روی دامنه Production؛ Bubblewrap PageSpeed validation به‌علت محدودیت 429 API در CI جایگزین شده است
- [x] شناسه دائمی Android package با تأیید مالک ثبت شد: `ir.eltbabak.contentfactory`
- [x] پیکربندی TWA و workflow خودکار Bubblewrap با Java 17 و Android SDK 36 در مخزن ثبت شد
- [x] workflow اندروید: اعتبارسنجی PWA، تولید پروژه TWA و AAB آزمایشی unsigned با موفقیت انجام شد
- [ ] تولید و نگهداری امن upload key تحت کنترل مالک
- [ ] تنظیم Digital Asset Links با fingerprint گواهی Play App Signing
- [x] ساخت APK قابل نصب با امضای Debug برای آزمون دستگاه انجام شد؛ نصب و آزمون روی گوشی واقعی همچنان نیازمند مالک است
- [ ] تکمیل و انتشار سیاست حریم خصوصی و شرایط استفاده؛ پیش‌نویس با Cloudflare Workers AI و Resend به‌روزرسانی شد اما اطلاعات حقوقی، مناطق پردازش و نگهداری داده هنوز باید تأیید شوند
- [ ] تکمیل Data safety، Content rating، Target audience، Ads declaration و App access در Play Console
- [x] تولید خودکار آیکون PNG فروشگاه 512×512 در build
- [ ] تهیه Feature graphic 1024×500 و حداقل دو اسکرین‌شات واقعی
- [ ] بررسی محدودیت‌های حساب Play Console و تکمیل الزامات testing/release در صورت اعمال
- [ ] تأیید نهایی مالک و ارسال نسخه برای بررسی Google Play


## Account deletion and legal-page release update — 2026-11-06

- [x] PR #118 isolates account-deletion reauthentication in a non-persistent Supabase client; the shared signed-in app session is not modified.
- [x] Regression test covers the isolated auth client and guards against signing out the shared client.
- [x] Production smoke script now checks `/privacy` and `/account-deletion` for required disclosure text; CI validates the smoke assertions.
- [x] Render reports deployment `dep-dbn1o0mc6qcc73cajh20` for commit `b756563240f2f1f05faee808dfe13a03c4f9c1cb` as `live`.
- [ ] Direct external HTTP verification of both legal routes remains outstanding: this execution environment could not resolve the custom domain, so deployment status is not treated as proof of public route reachability.

## Android / Play Console audit update — 2026-11-06

### Confirmed by live account configuration
- [x] Latest production deployment for commit `4825ec61748599410125d633b6b327878f816ef6` is reported `live` by Render.
- [x] Supabase project primary region confirmed as AWS `us-east-1` (Northern Virginia); Supabase organization plan is Free.
- [x] Render web service region confirmed as Oregon, USA; plan is Free.
- [x] Resend's current public security/DPA materials describe US storage, 30-day email/log retention on Free/Pro/Scale, and deletion of remaining customer data within 90 days after account termination; account-specific terms still need owner confirmation.
- [x] Public privacy and account-deletion routes are implemented in the production codebase: `/privacy` and `/account-deletion`. Render reports the last privacy-policy deployment as live. External HTTP verification was not possible from the current execution environment.
- [x] Play listing draft now includes `info@eltbabak.ir`, the public privacy URL, and the account deletion URL.
- [x] Internal privacy and Data safety drafts now record verified primary hosting regions and clearly mark unknowns.

### Still blocked — do not mark Play-ready
- [ ] Legal review by a qualified lawyer for the operator's country and intended user markets.
- [x] Owner confirmed Gemini API Free / Unpaid Services on 2026-11-06. Public privacy policy updated to disclose Google's potential product improvement use and human review of prompts/responses.
- [ ] Reconfirm that billing is not enabled on the exact Google Cloud project used by the production API key; Free/Unpaid terms permit Google to use submitted content and generated responses to improve products, and human reviewers may process them. Never promise zero data retention or no training use.
- [ ] Confirm Google Gemini and Cloudflare Workers AI inference geography; no region pinning evidence has been verified.
- [ ] Confirm Supabase Free backup lifecycle and Render log retention from account-specific settings.
- [ ] Owner reviews and accepts current DPA/subprocessor terms for all providers.
- [ ] Public privacy policy must be finalized with accurate data transfer and retention disclosures after the above checks.
- [ ] Play Console Data safety answers, data deletion questions, content rating, target audience, ads declaration, and app access must be completed against the final production build.
- [ ] Generate the upload key locally under owner custody; never upload the keystore or passwords to GitHub or chat.
- [ ] Enroll in Play App Signing, obtain the Play App Signing SHA-256 fingerprint, then publish `/.well-known/assetlinks.json`. No placeholder or debug fingerprint is acceptable.
- [ ] Build and verify the signed release AAB, then upload to the internal testing track.
- [ ] Create the 1024×500 feature graphic and real-device screenshots from the release candidate; approve all store claims.
- [ ] Complete internal/closed testing requirements applicable to the actual Play developer account.

### Important current target SDK check
New Google Play apps and updates submitted from 31 August 2026 must target Android 16 / API 36 or higher. The current Android workflow was configured to verify target SDK 36; re-verify the generated release AAB before upload.
