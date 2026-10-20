/* Ultraviolet service worker: intercepts /uv/service/* and rewrites it in the browser. */
importScripts("/uv/lib/uv.bundle.js");
importScripts("/uv/uv.config.js");
importScripts(self.__uv$config.sw);
const uv = new UVServiceWorker();
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith((async () => (uv.route(event) ? uv.fetch(event) : fetch(event.request)))());
});
