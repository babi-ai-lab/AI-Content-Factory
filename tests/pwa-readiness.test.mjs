import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("PWA manifest declares standalone identity and Chromium install icon sizes", async () => {
  const manifest = await readFile(new URL("../app/manifest.ts", import.meta.url), "utf8");
  assert.match(manifest, /start_url:\s*"\/?\?source=android"/);
  assert.match(manifest, /display:\s*"standalone"/);
  assert.match(manifest, /sizes:\s*"192x192"/);
  assert.match(manifest, /sizes:\s*"512x512"/);
  assert.match(manifest, /purpose:\s*"maskable"/);
  assert.match(manifest, /theme_color:\s*"#1c2b5e"/);
});
test("build generates raster launcher and Play Store icons", async () => {
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
  const generator = await readFile(new URL("../scripts/generate-pwa-icons.mjs", import.meta.url), "utf8");
  assert.match(packageJson, /generate-pwa-icons\.mjs/);
  assert.match(packageJson, /"sharp":\s*"0\.35\.5"/);
  assert.match(generator, /app-icon-192\.png/);
  assert.match(generator, /app-icon-512\.png/);
  assert.match(generator, /app-icon-maskable-512\.png/);
  assert.match(generator, /play-store-icon\.png/);
});
test("Android TWA configuration uses the owner-confirmed permanent application ID", async () => {
  const config = JSON.parse(await readFile(new URL("../android/twa-manifest.json", import.meta.url), "utf8"));
  assert.equal(config.packageId, "ir.eltbabak.contentfactory");
  assert.equal(config.host, "app.eltbabak.ir");
  assert.equal(config.startUrl, "/?source=android");
  assert.equal(config.webManifestUrl, "https://app.eltbabak.ir/manifest.webmanifest");
  assert.equal(config.iconUrl, "https://app.eltbabak.ir/icons/app-icon-512.png");
  assert.equal(config.maskableIconUrl, "https://app.eltbabak.ir/icons/app-icon-maskable-512.png");
  assert.equal(config.appVersionCode, 1);
  assert.equal(config.minSdkVersion, 24);
  assert.equal(config.signingKey.path, "./release-keystore.jks");
});
test("Android workflow validates PWA and builds unsigned artifacts without secrets", async () => {
  const workflow = await readFile(new URL("../.github/workflows/android-twa.yml", import.meta.url), "utf8");
  assert.match(workflow, /node scripts\/validate-android-pwa\.mjs/);
  assert.match(workflow, /npm install --global @bubblewrap\/cli@1\.27\.0/);
  assert.match(workflow, /targetSdkVersion 36/);
  assert.match(workflow, /minSdkVersion 24/);
  assert.ok(workflow.includes('applicationId "ir.eltbabak.contentfactory"'));
  assert.match(workflow, /bubblewrap build --skipSigning --skipPwaValidation/);
  assert.match(workflow, /\.\/gradlew --no-daemon assembleDebug/);
  assert.match(workflow, /outputs\/apk\/debug\/\*\.apk/);
  assert.match(workflow, /platforms;android-36/);
  const validator = await readFile(new URL("../scripts/validate-android-pwa.mjs", import.meta.url), "utf8");
  assert.match(validator, /manifest\.webmanifest/);
  assert.match(validator, /app-icon-maskable-512\.png/);
  assert.match(validator, /Never cache authenticated HTML/);
  assert.match(workflow, /build-tools;36\.1\.0/);
  assert.match(workflow, /ln -s "\$CMDLINE_TOOLS_BIN" "\$ANDROID_HOME\/bin"/);
  assert.match(workflow, /\.bubblewrap\/config\.json/);
  assert.match(workflow, /bubblewrap doctor/);
  assert.doesNotMatch(workflow, /bubblewrap updateConfig/);
  assert.match(workflow, /bubblewrap update --skipVersionUpgrade/);
  assert.match(workflow, /bubblewrap build --skipSigning/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.doesNotMatch(workflow, /BUBBLEWRAP_KEYSTORE_PASSWORD|BUBBLEWRAP_KEY_PASSWORD/);
});
test("public account deletion resource verifies the owner and calls the existing deletion function", async () => {
  const page = await readFile(new URL("../app/account-deletion/page.tsx", import.meta.url), "utf8");
  const form = await readFile(new URL("../components/account-deletion-form.tsx", import.meta.url), "utf8");
  const landing = await readFile(new URL("../components/public-landing.tsx", import.meta.url), "utf8");
  assert.match(page, /درخواست حذف حساب کاربری/);
  assert.match(page, /robots: \{ index: true/);
  assert.match(form, /signInWithPassword/);
  assert.match(form, /functions\.invoke\("delete-account"/);
  assert.match(form, /window\.confirm/);
  assert.match(form, /data\?\.deleted !== true/);
  assert.match(landing, /href="\/account-deletion"/);
});
test("service worker never caches private pages, API responses, or media", async () => {
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(worker, /request\.mode !== "navigate"/);
  assert.match(worker, /cache: "no-store"/);
  assert.match(worker, /Never cache authenticated HTML/);
  assert.doesNotMatch(worker, /caches\.put\(request/);
});
test("scheduled production smoke test validates the deployed PWA contract", async () => {
  const smoke = await readFile(new URL("../scripts/production-smoke.mjs", import.meta.url), "utf8");
  assert.match(smoke, /manifest\.webmanifest/);
  assert.match(smoke, /192x192/);
  assert.match(smoke, /512x512/);
  assert.match(smoke, /maskable/);
  assert.match(smoke, /\/sw\.js/);
  assert.match(smoke, /\/offline/);
});
test("supported browsers receive an explicit, dismissible install action", async () => {
  const component = await readFile(new URL("../components/pwa-registration.tsx", import.meta.url), "utf8");
  assert.match(component, /beforeinstallprompt/);
  assert.match(component, /installPrompt\.prompt\(\)/);
  assert.match(component, /appinstalled/);
  assert.match(component, /aria-label="نصب اپلیکیشن"/);
});
test("offline page explains private data is not available offline", async () => {
  const page = await readFile(new URL("../app/offline/page.tsx", import.meta.url), "utf8");
  assert.match(page, /اطلاعات خصوصی/);
});

test("download-page install flow handles prompt acceptance, dismissal, and browser errors", async () => {
  const component = await readFile(new URL("../app/download/add-to-home-screen.tsx", import.meta.url), "utf8");
  assert.match(component, /beforeinstallprompt/);
  assert.match(component, /event\.preventDefault\(\)/);
  assert.match(component, /await installPrompt\.prompt\(\)/);
  assert.match(component, /await installPrompt\.userChoice/);
  assert.match(component, /choice\.outcome === "accepted"/);
  assert.match(component, /setShowHelp\(true\)/);
  assert.match(component, /catch \{/);
  assert.match(component, /finally \{/);
  assert.match(component, /appinstalled/);
  assert.match(component, /removeEventListener\("beforeinstallprompt"/);
  assert.match(component, /removeEventListener\("appinstalled"/);
  assert.match(component, /aria-expanded=\{showHelp\}/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /disabled=\{isInstalling\}/);
});
