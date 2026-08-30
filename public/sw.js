/* SokoOS service worker.
 *
 * The seller is often on a matatu with one bar of signal, so the app shell is
 * precached and served cache-first; business data lives in localStorage and
 * never needs the network at all.
 */

const VERSION = "sokoos-v7";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

/* Every route in the app, so a cold install works offline immediately. */
const SHELL_ROUTES = [
  "/",
  "/welcome/",
  "/landing/",
  "/login/",
  "/signup/",
  "/store/",
  "/storefront/",
  "/orders/",
  "/inbox/",
  "/customers/",
  "/products/",
  "/payments/",
  "/deliveries/",
  "/bookings/",
  "/ledger/",
  "/capture/",
  "/import/",
  "/cfo/",
  "/stock/",
  "/analytics/",
  "/settings/",
  "/more/",
  "/offline/",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      // addAll fails the whole install if one URL 404s, so add them
      // individually and tolerate misses.
      await Promise.all(
        SHELL_ROUTES.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => undefined),
        ),
      );
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

function isAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|ico|webmanifest|json|txt)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The operator console is staff software. It is never precached and never
  // served from the seller's offline cache.
  if (url.pathname.startsWith("/admin")) return;

  // Navigations: serve the cached page instantly, refresh it in the
  // background, and fall back to the offline screen on a cold miss.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(request, { ignoreSearch: true });
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(network);
          return cached;
        }
        return (
          (await network) ||
          (await cache.match("/offline/")) ||
          (await cache.match("/")) ||
          new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
        );
      })(),
    );
    return;
  }

  // Build output is content-hashed, so cache-first is safe and fast.
  if (isAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        // The manifest and icons live in the shell cache from install time.
        const cached = (await cache.match(request)) || (await caches.match(request));
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          return cached || Response.error();
        }
      })(),
    );
  }
});
