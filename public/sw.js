// Self-contained offline fallback: the previous version served the cached
// /offline route, but that page still needed its hashed JS chunk from the
// network — unreachable exactly when the fallback fires, so users got a white
// "Application error" screen instead. This HTML has zero external references.
const OFFLINE_HTML = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Нет соединения | Almanax</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0c0d10;color:#e9ebee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:center;padding:24px}
  .box{max-width:340px}
  .ico{font-size:34px;margin-bottom:12px}
  h1{font-size:19px;margin:0 0 8px;font-weight:600}
  p{font-size:14px;color:#9aa0aa;line-height:1.55;margin:0 0 20px}
  button{background:#7c82f2;color:#fff;border:none;border-radius:9px;padding:11px 22px;font-size:14px;font-weight:500;cursor:pointer;font-family:inherit}
  button:active{transform:scale(0.98)}
</style></head>
<body><div class="box">
  <div class="ico">&#128225;</div>
  <h1>Нет соединения</h1>
  <p>Сервер не отвечает или пропал интернет. Записи никуда не делись и вернутся вместе с сетью.</p>
  <button onclick="location.reload()">Попробовать снова</button>
</div></body></html>`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Drop every cache from older SW versions — nothing is precached anymore.
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Intercept ONLY page navigations: network first, inline offline page as
// fallback. Static assets, Next.js chunks and API calls go straight to the
// network — intercepting them broke chunk loading after deploys.
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request).catch(() =>
      new Response(OFFLINE_HTML, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    )
  );
});
