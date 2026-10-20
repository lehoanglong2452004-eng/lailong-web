// Lai Long Desk: service worker để cài như ứng dụng.
// Luôn lấy bản mới từ mạng trước; chỉ khi mất mạng mới dùng bản đã lưu (giao diện, không phải dữ liệu thị trường).
const CACHE = "lailong-ui";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return; // dữ liệu sàn đi thẳng, không lưu
  const key = url.origin + url.pathname; // bỏ ?v=... để bản lưu không phình ra theo phiên bản
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
    return res;
  }).catch(() => caches.match(key).then(r => r || caches.match(url.origin + url.pathname.replace(/[^/]*$/, "")))));
});
