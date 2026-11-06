# ساخت امن کلید امضای اندروید در Windows

این راهنما فقط کلید **Upload key** را روی رایانه مالک ایجاد می‌کند. کلید خصوصی، رمزها و فایل keystore نباید وارد GitHub، چت، ایمیل یا فضای اشتراکی شوند.

## پیش‌نیازها
- Windows PowerShell
- JDK 17 نصب‌شده و دستور `keytool` در PATH
- دریافت آخرین نسخه مخزن و اجرای دستورات از ریشه مخزن

## روش پیشنهادی

در PowerShell از ریشه مخزن اجرا کن:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\create-android-upload-key.ps1
```

اسکریپت فایل زیر را به‌صورت محلی ایجاد می‌کند و اگر فایل از قبل وجود داشته باشد، از بازنویسی آن خودداری می‌کند:

```text
android\release-keystore.jks
```

هنگام اجرای `keytool`:
1. یک رمز قوی و منحصربه‌فرد برای keystore وارد کن.
2. رمز کلید را نیز تعیین کن؛ بهتر است با رمز keystore متفاوت باشد.
3. اطلاعات را در password manager نگه‌دار و یک نسخه پشتیبان رمزگذاری‌شده از keystore تهیه کن.

## تفاوت دو گواهی مهم

- **Upload key certificate:** گواهی همین کلید محلی است؛ برای بارگذاری AAB استفاده می‌شود.
- **Play App Signing key certificate:** گواهی‌ای است که Google Play برای امضای APKهای توزیع‌شده استفاده می‌کند.

برای فایل `/.well-known/assetlinks.json` فقط SHA-256 گواهی **Play App Signing** را از مسیر Play Console → App integrity → App signing key certificate استفاده کن. اثرانگشت Upload key یا Debug key را جایگزین آن نکن.

## بررسی فایل و اثرانگشت Upload key

اسکریپت پس از ساخت، مشخصات گواهی را با `keytool -list -v` نمایش می‌دهد. این اثرانگشت را صرفاً برای ثبت امن اطلاعات Upload key نگه‌دار؛ هنوز برای Digital Asset Links مناسب نیست.

## الزامات امنیتی
- فایل keystore و رمزهایش را در GitHub یا چت بارگذاری نکن.
- فایل را در حداقل دو محل امن و رمزگذاری‌شده پشتیبان‌گیری کن.
- رمزها را در فایل متنی کنار keystore ذخیره نکن.
- اگر keystore یا رمز آن گم شود، روند بازیابی/تعویض Upload key باید از Google Play Console انجام شود؛ کلید جدید را خودسرانه جایگزین نکن.
- این مرحله به‌تنهایی برنامه را برای انتشار آماده نمی‌کند. پس از ثبت برنامه در Play Console، App Signing را فعال کن، SHA-256 گواهی Play App Signing را دریافت کن، سپس Digital Asset Links را منتشر و TWA را با نسخه امضاشده آزمایش کن.
