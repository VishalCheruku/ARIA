/* ============================================================================
   ARIA AI — Service Worker (offline shell + conservative runtime caching)
   Registered from app.js on https/localhost only.

   Strategy map
   • navigations (HTML)   → network-first, offline fallback to the cached shell
   • /api/* GET           → network-first with cache fallback (reports, demo patients)
   • same-origin statics  → cache-first (css/js/json/media/images)
   • Google Fonts         → stale-while-revalidate, separate cache
   • never touched        → POST/PUT/DELETE, /copilot (SSE streaming), range requests
   ============================================================================ */
/* Bump on every static-asset change: activate deletes every cache that does
   not start with this version, so users get the new css/js immediately. */
const VERSION = "aria-v10";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const API_CACHE = `${VERSION}-api`;
const FONT_CACHE = `${VERSION}-fonts`;

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/home-station.css",
  "/mobile-responsive.css",
  "/ask-aria.css",
  "/app.js",
  "/js/mobile.js",
  "/ask-aria.js",
  "/manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => !key.startsWith(VERSION)).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* allow the page to force-skip waiting: postMessage({ type: "SKIP_WAITING" }) */
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (_error) {
    const cached = await cache.match(request, { ignoreSearch: fallbackUrl ? true : false });
    if (cached) return cached;
    if (fallbackUrl) {
      const shell = await cache.match(fallbackUrl) || await caches.match(fallbackUrl);
      if (shell) return shell;
    }
    throw _error;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && (fresh.ok || fresh.type === "opaque")) cache.put(request, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then(response => {
    if (response && (response.ok || response.type === "opaque")) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  /* only GETs are cached; everything else (analyze POST, dispatch, auth, SSE) passes */
  if (request.method !== "GET") return;
  /* the copilot proxy streams SSE — buffering it here would break the chat */
  if (url.pathname.startsWith("/copilot")) return;
  /* media elements issue range requests; SW must not intercept those */
  if (request.headers.has("range")) return;

  /* page navigations: fresh HTML when online, cached shell when offline */
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE, "/index.html"));
    return;
  }

  /* API reads: always try the network, fall back to the last good response */
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  /* Google Fonts + cdnjs (three.js): stale-while-revalidate across origins */
  if (url.origin !== self.location.origin &&
      /fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  /* same-origin statics: cache-first */
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
  }
});
