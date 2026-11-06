const CACHE_VERSION = "acf-shell-v1";
const OFFLINE_URL = "/offline";
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});
// Never cache authenticated HTML, API responses, user data, or generated media.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode !== "navigate") return;
  event.respondWith((async () => {
    try {
      return await fetch(request, { cache: "no-store" });
    } catch {
      const cached = await caches.match(OFFLINE_URL);
      return cached || Response.error();
    }
  })());
});
