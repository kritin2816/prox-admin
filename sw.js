/**
 * Pro X Admin - Service Worker (sw.js)
 * Provides background notification handling, lock screen push display,
 * click-through routing to Provider Management & Master User directories,
 * and offline app support for installed PWA.
 */

const CACHE_NAME = 'prox-admin-v1';

self.addEventListener('install', (event) => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all pages under this scope immediately
  event.waitUntil(self.clients.claim());
});

// Handle incoming Web Push
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Pro X Admin Notification', body: event.data.text() };
    }
  }

  const title = data.title || '🔔 Pro X Alert';
  const defaultIcon = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%236a3093'/><text x='50%' y='55%' font-family='sans-serif' font-weight='bold' font-size='42' fill='white' dominant-baseline='middle' text-anchor='middle'>PX</text></svg>";

  const options = {
    body: data.body || 'New activity detected in Pro X.',
    icon: data.icon || defaultIcon,
    badge: data.badge || defaultIcon,
    vibrate: data.vibrate || [250, 100, 250, 100, 250],
    data: {
      url: data.url || 'dashboard.html',
      ...data
    },
    actions: data.actions || [
      { action: 'open', title: 'View in Pro X' }
    ],
    tag: data.tag || 'prox-alert-' + Date.now(),
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click on phone/desktop
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || 'dashboard.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // If no window is open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
