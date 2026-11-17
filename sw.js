/* sw.js: keeps a copy of the app on the device so it opens with no signal.

   - The page itself (index.html) and files with no version tag: the network first, the kept copy
     only when there is no signal. A new version always wins.
   - Files with a version tag (app.css?v=18): the kept copy first. A changed file gets a new tag in
     index.html, so an old copy can never stand in for a new one.
   Nothing here saves any order or customer; the preview still keeps nothing between visits. */
const KEEP = 'bennett-app-8';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(KEEP);
    const page = await fetch('./index.html', { cache: 'no-store' });
    await cache.put('./index.html', page.clone());
    const html = await page.text();
    const files = [...new Set([...html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map((m) => m[1]))];
    await Promise.all(files.map((f) => cache.add(f).catch(() => {})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== KEEP) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fonts = /^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== self.location.origin && !fonts) return;
  event.respondWith((async () => {
    const cache = await caches.open(KEEP);
    const page = req.mode === 'navigate';
    const key = page ? './index.html' : req;
    const kept = async () => (await cache.match(key)) || (page ? undefined : await cache.match(req, { ignoreSearch: true }));
    if (!page && (url.searchParams.has('v') || fonts)) {
      const hit = await cache.match(req);
      if (hit) return hit;
    }
    try {
      const fresh = await fetch(req);
      if (fresh && (fresh.ok || fresh.type === 'opaque')) cache.put(key, fresh.clone()).catch(() => {});
      return fresh;
    } catch (e) {
      const hit = await kept();
      if (hit) return hit;
      throw e;
    }
  })());
});
