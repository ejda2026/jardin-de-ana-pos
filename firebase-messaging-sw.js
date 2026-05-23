// firebase-messaging-sw.js
// Service Worker para Jardin de Ana POS
// 1) Maneja notificaciones push de Firebase Cloud Messaging en segundo plano
// 2) Passthrough (sin cache) para que la app siempre cargue la version mas reciente

importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC470_8CqDpdqfiIiQu9E42xPNHeLmHXcs",
  authDomain: "el-jardin-de-ana.firebaseapp.com",
  projectId: "el-jardin-de-ana",
  storageBucket: "el-jardin-de-ana.firebasestorage.app",
  messagingSenderId: "346023766519",
  appId: "1:346023766519:web:14c892f65ef95ad29e66f2"
});

var messaging = firebase.messaging();

// Notificaciones cuando la app esta cerrada o en segundo plano
messaging.onBackgroundMessage(function(payload) {
  var n = payload.notification || {};
  var title = n.title || 'Jardin de Ana POS';
  var opts = {
    body: n.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    vibrate: [200, 100, 200],
    data: payload.data || {},
    tag: (payload.data && payload.data.tag) || undefined
  };
  self.registration.showNotification(title, opts);
});

// Cuando el usuario toca la notificacion, abrir o enfocar la app
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) return list[i].focus();
      }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});

// Instalacion: activar inmediatamente sin esperar a que cierren pestanas
self.addEventListener('install', function() {
  self.skipWaiting();
});

// Activacion: limpiar caches viejas y tomar control inmediato
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(names.map(function(name) { return caches.delete(name); }));
    }).then(function() { return self.clients.claim(); })
  );
});

// Fetch: passthrough (siempre red, sin cache)
self.addEventListener('fetch', function(event) {
  event.respondWith(fetch(event.request));
});
