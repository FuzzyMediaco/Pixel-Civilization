const CACHE_NAME = "pixel-civ-shell-dev";
const PAGES = new Map([
  ["/", "/"], ["/index.html", "/"],
  ["/field-guide", "/field-guide.html"], ["/field-guide.html", "/field-guide.html"],
  ["/handbook", "/handbook.html"], ["/handbook.html", "/handbook.html"],
  ["/gallery", "/gallery.html"], ["/gallery.html", "/gallery.html"],
  ["/downloads", "/downloads.html"], ["/downloads.html", "/downloads.html"],
]);
const SHELL = [
  ...new Set(PAGES.values()), "/site.webmanifest", "/favicon.ico",
  "/pwa-192x192.png", "/pwa-512x512.png", "/apple-touch-icon.png",
  /* compiled files */
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL.map(path => new Request(path, {cache: "reload"})));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key =>
      key !== CACHE_NAME && (key.startsWith("pixel-civ-shell-") || key === "pixel-civ-v1")
    ).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate" && PAGES.has(url.pathname)) {
    event.respondWith((async () => {
      try { return await fetch(request); }
      catch {
        const cache = await caches.open(CACHE_NAME);
        const page = await cache.match(PAGES.get(url.pathname));
        // Navigation responds with the body directly, even when the hosted .html URL redirected.
        return page ? new Response(page.body, { headers: page.headers }) : Response.error();
      }
    })());
    return;
  }
  if (!url.pathname.startsWith("/handbook/") && !url.pathname.startsWith("/assets/")) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(request);
    if (hit) return hit;
    const response = await fetch(request);
    if (response.ok) {
      try { await cache.put(request, response.clone()); } catch { /* Device storage can be full. */ }
    }
    return response;
  })());
});
