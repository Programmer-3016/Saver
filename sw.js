/**
 * Saver - Service Worker
 *
 * Network-first strategy for HTML, app code, and styles so production fixes are
 * not held by old browser caches. Stable assets stay cache-first for speed.
 */

const CACHE_NAME = "saver-v4";

const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/pages/dashboard.html",
  "/pages/onboarding.html",
  "/pages/login.html",
  "/pages/register.html",
  "/pages/reset-password.html",
  "/pages/privacy.html",
  "/pages/terms.html",
  "/styles/design-system.css",
  "/styles/shared.css",
  "/styles/dashboard.css",
  "/styles/onboarding.css",
  "/scripts/shared.js",
  "/scripts/dashboard.js",
  "/scripts/onboarding.js",
  "/scripts/auth.js",
  "/scripts/reveal.js",
  "/scripts/tailwind-theme.js",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/manifest.json",
];

function cacheFreshResponse(request) {
  return fetch(request).then((response) => {
    const clone = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
    return response;
  });
}

function shouldFetchFresh(url) {
  return (
    url.pathname.startsWith("/scripts/") ||
    url.pathname.startsWith("/styles/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/sw.js"
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }),
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
    }),
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(cacheFreshResponse(request).catch(() => caches.match(request)));
    return;
  }

  if (shouldFetchFresh(url)) {
    event.respondWith(cacheFreshResponse(request).catch(() => caches.match(request)));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return cacheFreshResponse(request);
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("/dashboard") && "focus" in client) {
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow("/dashboard");
        }
      }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SHOW_NOTIFICATION") {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: event.data.icon || "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
    });
  }
});
