/* Steadywag service worker.
 * - Pages: network first, so he is never shown stale records; the last good copy is the offline fallback.
 * - Static files (scripts, styles, fonts, images): stale-while-revalidate.
 * - Never touched: /api (the chat), other origins, and anything that is not a plain GET.
 * Personal logs (check-ins, appointments) live in the browser's own storage, so they work offline too.
 */
const VERSION = "v1";
const STATIC = `steadywag-static-${VERSION}`;
const PAGES = `steadywag-pages-${VERSION}`;
const OFFLINE = "/offline";
const MAX_PAGES = 60;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGES).then((c) => c.addAll([OFFLINE])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Page loads, and the data fetches Next makes when you move between pages.
  const isPage = req.mode === "navigate" || url.searchParams.has("_rsc");
  if (isPage) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.status === 200) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy)).then(() => trim(PAGES, MAX_PAGES));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (req.mode === "navigate" ? caches.match(OFFLINE) : Response.error())),
    );
    return;
  }

  // Static assets.
  if (url.pathname.startsWith("/_next/static/") || /\.(?:png|jpe?g|webp|svg|ico|woff2?|css|js)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
