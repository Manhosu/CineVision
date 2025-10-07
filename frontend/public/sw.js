// Cine Vision Service Worker
const CACHE_NAME = 'cine-vision-v2';
const RUNTIME_CACHE = 'cine-vision-runtime-v2';

// Files to cache on install
const PRECACHE_URLS = [
  '/',
  '/favicon.ico'
];

// Install event - precache essential files
self.addEventListener('install', event => {
  console.log('[SW] Install event');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Precaching files');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
      .catch(error => console.error('[SW] Precache failed:', error))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');

  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - implement cache strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Chrome extensions
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Skip Next.js internal requests (RSC, routing, data fetching, etc)
  if (url.pathname.includes('_next') ||
      url.pathname.includes('_rsc') ||
      url.searchParams.has('_rsc')) {
    return;
  }

  // Skip API requests to avoid CSP violations
  // Don't intercept calls to backend API (localhost:3001) or external APIs
  if (url.pathname.startsWith('/api/') ||
      url.port === '3001' ||
      (url.hostname !== self.location.hostname && url.hostname !== 'localhost')) {
    // Let browser handle API requests directly (no Service Worker interception)
    return;
  }

  // Handle images (cache first)
  if (request.destination === 'image') {
    event.respondWith(
      cacheFirst(request)
    );
    return;
  }

  // Handle video/audio (network only)
  if (request.destination === 'video' || request.destination === 'audio') {
    event.respondWith(
      fetch(request)
    );
    return;
  }

  // Handle pages and static assets (stale while revalidate)
  event.respondWith(
    staleWhileRevalidate(request)
  );
});

// Cache Strategies

// Helper function to create offline fallback response
function createOfflineResponse() {
  return new Response(
    `<!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Offline - Cine Vision</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #0a0a0a, #1a1a1a);
          color: white;
          text-align: center;
          padding: 20px;
        }
        .container { max-width: 500px; }
        h1 { color: #dc2626; margin-bottom: 1rem; }
        p { color: #cccccc; line-height: 1.6; }
        button {
          background: #dc2626;
          color: white;
          border: none;
          padding: 0.75rem 2rem;
          border-radius: 0.5rem;
          font-weight: 600;
          cursor: pointer;
          margin-top: 1rem;
        }
        button:hover { background: #b91c1c; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📶 Você está offline</h1>
        <p>Não foi possível carregar esta página. Verifique sua conexão com a internet e tente novamente.</p>
        <button onclick="window.location.reload()">Tentar Novamente</button>
      </div>
    </body>
    </html>`,
    {
      headers: { 'Content-Type': 'text/html' }
    }
  );
}

// Network First - Good for API calls
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) {
        return offlinePage;
      }
      return createOfflineResponse();
    }

    // For non-navigation requests, return empty response instead of throwing
    return new Response('', {
      status: 503,
      statusText: 'Service Unavailable - Offline',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Cache First - Good for images and static assets
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Failed to fetch:', request.url);

    // Return placeholder response for images and assets
    // This prevents "Failed to convert to Response" errors
    if (request.destination === 'image') {
      // Return 1x1 transparent PNG
      return new Response(
        new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE]),
        {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'image/png' }
        }
      );
    }

    // For other assets, return empty response
    return new Response('', {
      status: 404,
      statusText: 'Not Found - Offline',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Stale While Revalidate - Good for pages and frequently updated content
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(error => {
    console.log('[SW] Network failed:', request.url);
    // Return null to indicate network failure, but don't throw
    return null;
  });

  // Return cached version immediately, update cache in background
  if (cachedResponse) {
    fetchPromise; // Don't await, let it run in background
    return cachedResponse;
  }

  // No cached version, wait for network
  const networkResponse = await fetchPromise;

  if (networkResponse) {
    return networkResponse;
  }

  // Network failed and no cache - return appropriate fallback
  console.log('[SW] No cache and network failed for:', request.url);

  // For navigation requests, try to return offline.html from cache
  if (request.mode === 'navigate') {
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) {
      return offlinePage;
    }
    // If offline.html is not cached, create a basic offline response
    return createOfflineResponse();
  }

  // For non-navigation requests (scripts, styles, etc), return empty response
  // This prevents "Failed to convert to Response" errors
  return new Response('', {
    status: 408,
    statusText: 'Request Timeout - Offline',
    headers: { 'Content-Type': 'text/plain' }
  });
}

// Handle background sync for offline actions
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'movie-purchase') {
    event.waitUntil(
      syncMoviePurchases()
    );
  }
});

// Sync movie purchases when online
async function syncMoviePurchases() {
  try {
    // Get pending purchases from IndexedDB
    const pendingPurchases = await getPendingPurchases();

    for (const purchase of pendingPurchases) {
      try {
        const response = await fetch('/api/purchases/initiate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(purchase)
        });

        if (response.ok) {
          // Remove from pending purchases
          await removePendingPurchase(purchase.id);

          // Notify user
          self.registration.showNotification('Compra processada!', {
            body: `Sua compra de "${purchase.movieTitle}" foi processada com sucesso.`,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge.png',
            tag: 'purchase-success',
            data: { purchaseId: purchase.id }
          });
        }
      } catch (error) {
        console.error('[SW] Failed to sync purchase:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Handle push notifications
self.addEventListener('push', event => {
  console.log('[SW] Push notification received');

  if (!event.data) {
    return;
  }

  const data = event.data.json();

  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge.png',
    tag: data.tag || 'notification',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    data: data.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.notification.tag);

  event.notification.close();

  const { data } = event.notification;

  // Handle different notification types
  switch (event.notification.tag) {
    case 'purchase-success':
      event.waitUntil(
        clients.openWindow(`/movies/${data.movieId}`)
      );
      break;

    case 'new-release':
      event.waitUntil(
        clients.openWindow('/releases')
      );
      break;

    default:
      event.waitUntil(
        clients.openWindow('/')
      );
  }
});

// Utility functions for IndexedDB (simplified)
async function getPendingPurchases() {
  // This would normally use IndexedDB
  // For now, return empty array
  return [];
}

async function removePendingPurchase(id) {
  // This would normally remove from IndexedDB
  console.log('[SW] Would remove purchase:', id);
}

// Handle message events from the main thread
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_MOVIE') {
    const { movieId, imageUrl } = event.data;

    // Preload movie images
    event.waitUntil(
      caches.open(RUNTIME_CACHE)
        .then(cache => cache.add(imageUrl))
        .catch(error => console.error('[SW] Failed to cache movie image:', error))
    );
  }
});

console.log('[SW] Service Worker loaded');