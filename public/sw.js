/* eslint-disable no-restricted-globals */
/* eslint-env serviceworker */
/* global clients */

const CACHE_NAME = "immunicare-v2";
const STATIC_CACHE = "immunicare-static-v2";
const API_CACHE = "immunicare-api-v2";
const urlsToCache = [
  "/",
  "/index.html",
  "/static/js/bundle.js",
  "/static/css/main.css",
  "/manifest.json",
  "/logo192.png",
  "/logo512.png",
  "/favicon.ico",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.warn("Service Worker: Failed to cache some assets", err);
      }),
  );
  // Activate immediately
  self.skipWaiting();
});

// Fetch event with network-first strategy for API, cache-first for static
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // API requests - Network first, then cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached response if network fails
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return offline fallback for API
            return new Response(
              JSON.stringify({
                error: "You are offline",
                offline: true,
                cached: false,
              }),
              {
                status: 503,
                headers: { "Content-Type": "application/json" },
              },
            );
          });
        }),
    );
    return;
  }

  // Static assets - Cache first, then network
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Update cache in background
        fetch(request)
          .then((response) => {
            if (response.status === 200) {
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(request, response);
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return offline page for HTML requests
          if (request.headers.get("accept")?.includes("text/html")) {
            return caches.match("/index.html");
          }
          throw new Error("Network error");
        });
    }),
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (![STATIC_CACHE, API_CACHE].includes(cacheName)) {
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => {
        // Take control of all clients immediately
        return self.clients.claim();
      }),
  );
});

// Background sync for offline form submissions
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-forms") {
    event.waitUntil(syncFormSubmissions());
  }
});

// Handle push notifications
self.addEventListener("push", (event) => {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || "Immunicare", {
        body: data.body || "New notification",
        icon: "/logo192.png",
        badge: "/logo192.png",
        data: data.data || {},
        actions: data.actions || [],
      }),
    );
  }
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});

// Helper function for background sync (placeholder)
async function syncFormSubmissions() {
  // This would sync any queued form submissions when back online
  console.log("Service Worker: Syncing form submissions...");
}
