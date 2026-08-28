/* Service worker — 讓這個站在刀房沒訊號時照樣打得開。
 *
 * 注意：github.io 是同一個 origin 下多個 PWA 共存，
 * 這支只能刪自己前綴的快取，絕不可以 keys() 全清（會把別的 App 弄壞）。
 */
const PREFIX = 'surgery-notes-';
const CACHE = PREFIX + 'v16';
const SHELL = [
  './', './index.html',
  './css/app.css',
  './js/store.js', './js/ui.js', './js/edit.js', './js/app.js',
  './fonts/newsreader-latin.woff2', './fonts/newsreader-latin-italic.woff2',
  './data/seed.json', './data/version.json',
  './manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-192.png', './icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k.startsWith(PREFIX) && k !== CACHE)   // 只刪自己的舊版
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // 資料檔走 network-first：它是內容不是外殼，拿到舊的等於整個 App 停在舊版。
  // stale-while-revalidate 在這裡會讓「重設回預設內容」也吃到舊的那一份。
  if (url.pathname.includes('/data/')) {
    e.respondWith(fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req)));
    return;
  }

  // 其餘（外殼）先給快取、背景更新：離線一定開得起來，有網路時第二次開就是新版。
  e.respondWith(caches.match(req).then(cached => {
    const net = fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => cached);
    return cached || net;
  }));
});
