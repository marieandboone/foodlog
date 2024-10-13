self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("app-cache").then((cache) => {
      return cache.addAll([
        "/foodlog/",
        "/foodlog//index.html",
        "/foodlog//styles.css",
        "/foodlog//script.js",
        "/foodlog//icon.png",
        "/foodlog/manifest.json",
      ]);
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
