/* FirstFinder service worker -- the app shell, offline.
 *
 * Issue #60. A collector standing in a shop basement should get the app and
 * their last synced collection, not the browser's offline page. This file is
 * the shell half of that; the collection itself is a snapshot in localStorage
 * (src/utils/offlineCollection.js), read by the app once this has served it.
 *
 * Hand-written rather than generated. The whole thing is three fetch rules,
 * and a build-time plugin would hide those three rules behind a dependency
 * that also wants to own the build.
 *
 * The rules, and why each one is the way it is:
 *
 *   Navigations -- network first, cache second. A collector on a working
 *     connection must always get the current app, or a deploy would take days
 *     to reach installed clients. When the network fails, the cached shell is
 *     the difference between a usable catalog and a dinosaur.
 *
 *   Next's hashed build assets and our own images -- cache first. The hash in
 *     the URL is the version, so a hit is never stale, and this is what makes
 *     the offline launch fast rather than merely possible.
 *
 *   Everything else -- straight to the network, cached never. That is
 *     deliberately where Supabase, /api, and the photo signing live: a cached
 *     API response is a wrong answer with a long shelf life, and a cached
 *     signed URL is a permission that outlives its expiry.
 */

// Bump to retire every cache this worker wrote. The old ones are deleted on
// activate, so a stale shell cannot outlive a release.
const CACHE_VERSION = "v1";
const SHELL_CACHE = `firstfinder-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `firstfinder-assets-${CACHE_VERSION}`;

// The one document worth having before it is asked for. Everything else the
// app needs is a hashed asset, and those arrive through the runtime cache on
// first visit.
const SHELL_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // reload, so an install triggered by a new deploy cannot pick the old
      // document out of the HTTP cache.
      .then((cache) => cache.add(new Request(SHELL_URL, { cache: "reload" })))
      // A failed precache must not fail the install: the worker is still
      // useful, it simply has nothing cached until the first navigation.
      .catch(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("firstfinder-") && key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Deliberately no skipWaiting on install. A new worker taking over a page
// mid-session would start serving a different build's assets to a React tree
// that has already loaded, which fails in ways that look like nothing else.
// The new worker takes over on the next launch instead; the message below
// lets the page ask for it sooner, on a reload it controls.
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

function isAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/firstfinder-mark-exact.png"
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Another origin means Supabase, Google Fonts, or analytics. None of them
  // are ours to cache, and the storage one is a signed URL.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(SHELL_URL, copy)).catch(() => undefined);
          return response;
        })
        .catch(async () => {
          // Any page of the app falls back to the shell: the app is one client
          // route, so the shell can render whichever view was asked for.
          const cached = await caches.match(SHELL_URL);
          return cached || Response.error();
        })
    );
    return;
  }

  if (!isAsset(url)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Opaque and error responses are not worth keeping; a cached 404 for a
        // hashed asset would survive the fix.
        if (response.ok) {
          const copy = response.clone();
          caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      });
    })
  );
});
