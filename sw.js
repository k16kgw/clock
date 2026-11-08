// Service worker: keeps the clock / timekeeper usable offline.
//
// All files are pre-cached as one versioned set and served cache-first, so the
// page opens instantly and reloads even without a network, and never mixes
// files from two different deployments.
//
// IMPORTANT: bump VERSION whenever any file below changes, otherwise browsers
// that already have the site keep showing the old version.

const VERSION = "2026-11-09.1";
const CACHE = `clock-${VERSION}`;
const ASSETS = [
  "./",
  "css/style.css",
  "js/app.js",
  "js/clock.js",
  "js/timer.js",
  "js/bell.js",
  "js/settings.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: "reload" skips the HTTP cache so the set is fresh and consistent.
    await cache.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" })));
    // Safe to take over at once: the page loads every module at startup,
    // so a running page never asks for a file after this point.
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => n.startsWith("clock-") && n !== CACHE).map((n) => caches.delete(n)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  const scopePath = new URL(self.registration.scope).pathname; // "/clock/"
  const isPage = url.pathname === scopePath || url.pathname === `${scopePath}index.html`;
  if (request.mode === "navigate" && !isPage) return; // e.g. docs pages: plain network

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // The page itself, with any query string (e.g. /clock/?v=2#timer), is "./".
    const key = request.mode === "navigate" ? "./" : request;
    const cached = await cache.match(key, { ignoreSearch: true });
    if (cached) return cached;
    return fetch(request);
  })());
});
