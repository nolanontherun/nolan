// Minimal offline shell. Data pages are always fetched from the network first so numbers are never stale.
const CACHE = "nolan-os-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/icon.svg", "/manifest.webmanifest"]))); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).pathname.startsWith("/api/")) return;
  e.respondWith(fetch(req).then((res) => { if (res.ok && (req.destination === "style" || req.destination === "script" || req.destination === "font" || req.destination === "image")) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; }).catch(() => caches.match(req).then((m) => m || new Response("Offline. Nolan OS needs its local server to show live data.", { status: 503, headers: { "content-type": "text/plain" } }))));
});
