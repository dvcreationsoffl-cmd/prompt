/* ==========================================================================
   CampusConnect Progressive Web App (PWA) Service Worker
   Version: 1.0.0
   Strategies:
     - App Shell: Precaching + Stale-While-Revalidate
     - Navigations: Network-First with Offline Cache Fallback
     - Static Assets: Cache-First / Stale-While-Revalidate
     - Read-only API Data: Network-First with Cache Fallback
   ========================================================================== */

const CACHE_VERSION = 'campusconnect-v1.0.0';
const STATIC_CACHE = `campusconnect-static-${CACHE_VERSION}`;
const DATA_CACHE = `campusconnect-data-${CACHE_VERSION}`;

// Pre-cached App Shell Assets
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png'
];

/* -------------------------------------------------------------
 * 1. INSTALLATION EVENT: Pre-cache core application shell
 * ----------------------------------------------------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[ServiceWorker] Pre-caching App Shell assets');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Some assets failed to pre-cache during install:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

/* -------------------------------------------------------------
 * 2. ACTIVATION EVENT: Clean up stale caches & claim clients
 * ----------------------------------------------------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== STATIC_CACHE && name !== DATA_CACHE) {
            console.log('[ServiceWorker] Removing stale cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      console.log('[ServiceWorker] Claiming all clients');
      return self.clients.claim();
    })
  );
});

/* -------------------------------------------------------------
 * 3. FETCH EVENT: Request routing and caching strategies
 * ----------------------------------------------------------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-HTTP(S) schemes (e.g. chrome-extension:)
  if (!url.protocol.startsWith('http')) return;

  // A. Navigation Requests (HTML / Page Loads) -> Network-First with Offline Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If valid response, update cache in background
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          // Offline fallback: serve cached index.html
          const cached = await caches.match('/index.html') || await caches.match('/');
          if (cached) return cached;
          return new Response(
            `<!DOCTYPE html>
            <html lang="en">
            <head><meta charset="utf-8"><title>CampusConnect - Offline</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="font-family:system-ui,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center;">
              <div>
                <h2>CampusConnect Offline</h2>
                <p style="color:#94a3b8;">You are currently offline. Please reconnect to access real-time event updates.</p>
                <button onclick="location.reload()" style="background:#059669;color:#fff;border:none;padding:10px 18px;border-radius:8px;font-weight:600;cursor:pointer;">Retry Connection</button>
              </div>
            </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // B. Google Fonts (Web Fonts & Stylesheets) -> Cache-First
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // C. API Data Requests (/api/*) -> Network-First with Cache Fallback for GET requests
  if (url.pathname.startsWith('/api/')) {
    if (request.method === 'GET') {
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(DATA_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(async () => {
            const cached = await caches.match(request);
            if (cached) return cached;
            return new Response(
              JSON.stringify({
                offline: true,
                message: 'You are currently offline. Displaying cached campus data.'
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              }
            );
          })
      );
      return;
    }
    // Non-GET API calls (POST/PUT/DELETE): standard network request
    return;
  }

  // D. Static Assets (CSS, JS, Images, Icons) -> Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

/* -------------------------------------------------------------
 * 4. MESSAGE EVENT: Allow clients to prompt immediate update
 * ----------------------------------------------------------- */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
