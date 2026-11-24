/* Local offline cache only. No analytics, no third-party requests. */
const CACHE = "team-united-invite-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./game.js",
  "./config.json",
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/favicon.png",
  "./assets/gcvc-united-logo.jpg",
  "./assets/gcvc-united-title.jpg",
  "./assets/sprites/winter-bg.jpg",
  "./assets/sprites/girl-idle.png",
  "./assets/sprites/girl-toss.png",
  "./assets/sprites/girl-spike.png",
  "./assets/sprites/girl-hug.png",
  "./assets/sprites/girl-win.png",
  "./assets/sprites/volleyball.png",
  "./assets/sprites/snow-poof.png",
  "./assets/sprites/snowman-santa.png",
  "./assets/sprites/snowman-green.png",
  "./assets/sprites/snowman-tophat.png",
  "./assets/sprites/snowman-hug.png",
  "./assets/sprites/snowman-baby.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
