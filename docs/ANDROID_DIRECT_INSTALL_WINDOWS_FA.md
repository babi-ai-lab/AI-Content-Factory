# ساخت APK نهایی و نصب مستقیم در Windows

این مسیر برای توزیع مستقیم برنامه از وب‌سایت است و به حساب یا پرداخت Google Play Console نیاز ندارد. خروجی نهایی باید با همان کلید خصوصی مالک امضا شود که اثرانگشت آن در فایل زیر ثبت شده است:

`public/.well-known/assetlinks.json`

**هرگز فایل keystore یا رمزهای آن را در GitHub، چت یا ایمیل بارگذاری نکن.**

## پیش‌نیازها

- آخرین نسخه مخزن در رایانه
- JDK 17
- فایل محلی `android/release-keystore.jks` و alias برابر `contentfactory`
- فایل امضاشده `android/app-release-signed.aab`
- ابزار bundletool در `android/tools/bundletool-all-1.18.3.jar`

## ۱. بررسی انتشار Digital Asset Links

پس از پایان Deploy در Render، در PowerShell اجرا کن:

```powershell
$url = "https://app.eltbabak.ir/.well-known/assetlinks.json"
$r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30
$r.StatusCode
$r.Content
```

باید پاسخ HTTP برابر 200 و JSON شامل package برابر `ir.eltbabak.contentfactory` و SHA-256 گواهی کلید انتشار محلی باشد. اگر 404 یا خطای دیگری دیدی، APK را هنوز به کاربران توزیع نکن.

## ۲. ساخت APK یونیورسال امضاشده

از ریشه مخزن در PowerShell اجرا کن:

```powershell
$jdk = "C:\Program Files\Eclipse Adoptium\jdk-17.0.21.9-hotspot"
$env:JAVA_HOME = $jdk
$env:Path = "$jdk\bin;$env:Path"

$bundletool = ".\android\tools\bundletool-all-1.18.3.jar"
$bundle = ".\android\app-release-signed.aab"
$keystore = ".\android\release-keystore.jks"
$apks = ".\android\app-release-universal.apks"

if (!(Test-Path $bundle)) { throw "Signed AAB not found: $bundle" }
if (!(Test-Path $keystore)) { throw "Signing keystore not found: $keystore" }
if (!(Test-Path $bundletool)) { throw "bundletool not found: $bundletool" }

java -jar $bundletool build-apks `
  --bundle="$bundle" `
  --output="$apks" `
  --mode=universal `
  --ks="$keystore" `
  --ks-key-alias=contentfactory

if ($LASTEXITCODE -ne 0) { throw "APK generation failed." }

$extract = ".\android\universal-apk-extracted"
if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
Expand-Archive -LiteralPath $apks -DestinationPath $extract -Force

$apk = Join-Path $extract "universal.apk"
if (!(Test-Path $apk)) { throw "Universal APK was not produced." }

$final = ".\android\AI-Content-Factory-1.0.0.apk"
Copy-Item $apk $final -Force

& "$env:JAVA_HOME\bin\jarsigner.exe" -verify $final
if ($LASTEXITCODE -ne 0) { throw "APK signature verification failed." }

& "$env:JAVA_HOME\bin\keytool.exe" -printcert -jarfile $final
Get-FileHash $final -Algorithm SHA256
Get-Item $final | Select-Object FullName,Length
```

bundletool will prompt for the keystore password and key password locally. Enter them only in the terminal; do not put them in command arguments or share them.

## ۳. نصب و آزمون روی گوشی

برای نصب با USB، Android Platform Tools (ADB) باید نصب باشد و USB debugging روی گوشی فعال شده باشد:

```powershell
adb devices
adb install -r .\android\AI-Content-Factory-1.0.0.apk
```

همچنین می‌توان APK را به گوشی منتقل و از فایل‌منیجر نصب کرد؛ ممکن است Android اجازه نصب از آن منبع را بخواهد. فقط APKای را نصب کن که خودت ساخته‌ای و امضایش را بررسی کرده‌ای.

پس از نصب، برنامه را باز کن و این موارد را بررسی کن:
- برنامه با نام و آیکون درست اجرا شود.
- صفحه اصلی در حالت تمام‌صفحه TWA و بدون نوار آدرس مرورگر باز شود.
- ورود، خروج، ساخت محتوا، بارگذاری رسانه و صفحات حریم خصوصی/حذف حساب کار کنند.
- لینک‌های خارج از دامنه امن به شکل کنترل‌شده باز شوند.
- پس از بستن و بازکردن برنامه، نشست کاربر و مسیرهای اصلی درست کار کنند.

## ۴. انتشار فایل

فایل قابل توزیع این است:

`android/AI-Content-Factory-1.0.0.apk`

پیش از انتشار عمومی، ابتدا روی حداقل یک گوشی واقعی نصب و آزمون شود. فایل APK را می‌توان از طریق صفحه دانلود وب‌سایت یا یک لینک دانلود امن ارائه کرد. این روش انتشار مستقیم است و به معنی انتشار در Google Play نیست.

## نکات مهم

- حداقل نسخه Android طبق پیکربندی فعلی API 24 است.
- شناسه بسته: `ir.eltbabak.contentfactory`
- نسخه فعلی: `1.0.0 (versionCode 1)`
- برای به‌روزرسانی‌های بعدی، همان keystore و alias باید حفظ شوند؛ versionCode نیز باید افزایش یابد.
- اگر کلید امضا عوض شود، اثرانگشت جدید باید به Digital Asset Links اضافه شود و نسخه قبلی نصب‌شده ممکن است با امضای متفاوت به‌روزرسانی نشود.
- اگر در آینده نسخه‌ای از طریق Google Play و Play App Signing منتشر شود، اثرانگشت گواهی Play App Signing نیز باید به Digital Asset Links اضافه شود.
