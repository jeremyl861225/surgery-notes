/* Service worker — 讓這個站在刀房沒訊號時照樣打得開。
 *
 * 注意：github.io 是同一個 origin 下多個 PWA 共存，
 * 這支只能刪自己前綴的快取，絕不可以 keys() 全清（會把別的 App 弄壞）。
 */
const PREFIX = 'surgery-notes-';
const CACHE = PREFIX + 'v4';
const SHELL = [
  './', './index.html',
  './css/app.css',
  './js/data.js', './js/config.js', './js/cloud.js', './js/app.js',
  './manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-192.png', './icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);                       // 外殼一定要成功
    try {                                        // 手繪圖盡力而為，個別失敗不擋安裝
      const list = await (await fetch('./img/list.json', { cache: 'reload' })).json();
      await Promise.all(list.map(f =>
        c.add('./img/' + encodeURIComponent(f)).catch(() => {})));
      await c.add('./img/list.json').catch(() => {});
    } catch (err) { /* 沒有清單也照樣裝得起來 */ }
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
  if (url.origin !== location.origin) return;            // Supabase 一律走網路，不快取

  if (url.pathname.includes('/img/')) {                  // 圖片：快取優先
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    })));
    return;
  }
  // 其餘：先給快取、背景更新（stale-while-revalidate）
  e.respondWith(caches.match(req).then(cached => {
    const net = fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => cached);
    return cached || net;
  }));
});
