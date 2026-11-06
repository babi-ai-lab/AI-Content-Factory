const origin = new URL("https://app.eltbabak.ir");
const fail = (message) => { throw new Error(`Android PWA validation failed: ${message}`); };

async function get(path) {
  const url = new URL(path, origin);
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: "follow" });
  if (!response.ok) fail(`${path} returned HTTP ${response.status}`);
  if (new URL(response.url).origin !== origin.origin) fail(`${path} redirected outside the trusted origin`);
  return response;
}

const manifestResponse = await get("/manifest.webmanifest");
if (!manifestResponse.headers.get("content-type")?.includes("json")) fail("manifest has an invalid content type");
const manifest = await manifestResponse.json();

if (manifest.id !== "/" || manifest.display !== "standalone" || manifest.lang !== "fa" || manifest.dir !== "rtl") {
  fail("manifest identity, standalone display, or Persian RTL metadata is invalid");
}
if (!manifest.name || !manifest.short_name || !manifest.start_url || !manifest.scope || manifest.prefer_related_applications !== false) {
  fail("manifest is missing required install identity fields");
}
const startUrl = new URL(manifest.start_url, origin);
const scopeUrl = new URL(manifest.scope, origin);
if (startUrl.origin !== origin.origin || !startUrl.pathname.startsWith(scopeUrl.pathname)) {
  fail("start_url must remain inside the trusted app scope");
}

const icons = manifest.icons || [];
const requirements = [
  { size: "192x192", purpose: "any", path: "/icons/app-icon-192.png" },
  { size: "512x512", purpose: "any", path: "/icons/app-icon-512.png" },
  { size: "512x512", purpose: "maskable", path: "/icons/app-icon-maskable-512.png" },
];
for (const required of requirements) {
  const entry = icons.find((icon) =>
    (icon.sizes || "").split(/\\s+/).includes(required.size) &&
    (icon.purpose || "any").split(/\\s+/).includes(required.purpose)
  );
  if (!entry || entry.src !== required.path || entry.type !== "image/png") fail(`missing ${required.purpose} ${required.size} PNG icon`);
  const response = await get(entry.src);
  if (!response.headers.get("content-type")?.includes("image/png")) fail(`${entry.src} is not served as PNG`);
  const png = Buffer.from(await response.arrayBuffer());
  if (png.length < 24 || png.subarray(1, 4).toString() !== "PNG") fail(`${entry.src} is not a valid PNG`);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const [expectedWidth, expectedHeight] = required.size.split("x").map(Number);
  if (width !== expectedWidth || height !== expectedHeight) fail(`${entry.src} dimensions are ${width}x${height}`);
}

const worker = await get("/sw.js");
const workerText = await worker.text();
if (!worker.headers.get("content-type")?.includes("javascript") ||
    !workerText.includes('self.addEventListener("fetch"') ||
    !workerText.includes("Never cache authenticated HTML")) {
  fail("service worker does not meet the safe navigation contract");
}

const offline = await get("/offline");
const offlineText = await offline.text();
if (!offlineText.includes("اتصال اینترنت برقرار نیست")) fail("offline fallback content is missing");

const app = await get("/");
const appHtml = await app.text();
if (!appHtml.includes("manifest.webmanifest")) fail("application shell does not link its web manifest");

console.log("Android PWA contract passed: manifest, scope, PNG dimensions, maskable icon, service worker, offline fallback, and HTTPS origin.");
