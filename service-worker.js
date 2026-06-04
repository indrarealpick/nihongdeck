/* service-worker.js — Nihongo Flash PWA */
const CACHE = 'nihongo-flash-v13';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];
// CDN resources yang harus tersedia offline
const CDN_CACHE = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

// Install: cache app shell + CDN kritis
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      // Cache app shell lokal
      await c.addAll(APP_SHELL).catch(() => {});
      // Cache CDN (opsional — tidak blokir install kalau gagal)
      for (const url of CDN_CACHE) {
        try {
          const res = await fetch(url, { mode: 'cors' });
          if (res.ok) await c.put(url, res);
        } catch (e) { /* CDN gagal — skip, tetap install */ }
      }
    })
  );
  self.skipWaiting();
});

// Activate: bersihkan cache lama
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Jangan cache API / Supabase data / auth — selalu network
  if (url.pathname.includes('/api/') ||
      url.hostname.includes('supabase.co') ||
      url.hostname.includes('openai.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    return;
  }

  // Navigasi (HTML) → network-first, fallback cache
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // CDN + aset statis → cache-first, network fallback
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached || new Response('', { status: 503 }));
    })
  );
});
