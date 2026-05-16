/**
 * Saver — Service Worker
 *
 * Cache-first strategy for static assets (CSS, JS, fonts, icons).
 * Network-first for HTML pages so users always get the latest version.
 * Offline fallback serves cached pages when network is unavailable.
 */

const CACHE_NAME = "saver-v3";

// Static assets to pre-cache on install

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

// Install — pre-cache core assets

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }),
  );

  // Activate immediately without waiting for old SW to finish

  self.skipWaiting();
});

// Activate — clean up old caches

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

  // Take control of all open tabs immediately

  self.clients.claim();
});

// Fetch — network-first for HTML, cache-first for assets

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET requests and external URLs

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip external resources (CDN scripts, Google Fonts, Supabase API)

  if (url.origin !== self.location.origin) return;

  // HTML pages: network-first (try fresh, fall back to cache)

  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Static assets: cache-first (fast loads, fall back to network)

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });
    }),
  );
});

// Notification click — open or focus the dashboard

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If the dashboard is already open, focus it

        for (const client of clientList) {
          if (client.url.includes("/dashboard") && "focus" in client) {
            return client.focus();
          }
        }

        // Otherwise open a new window

        if (clients.openWindow) {
          return clients.openWindow("/pages/dashboard.html");
        }
      }),
  );
});

// Message handler — show notification from main thread (fallback)

self.addEventListener("message", (event) => {
  if (event.data?.type === "SHOW_NOTIFICATION") {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: event.data.icon || "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
    });
  }
});
