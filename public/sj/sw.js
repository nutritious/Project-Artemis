/* Scramjet 2 service worker: hands every request under /sj/service/ to the controller page, which rewrites it. */
importScripts("/sj/ctl/controller.sw.js");

self.addEventListener("fetch", (event) => {
  if ($scramjetController.shouldRoute(event)) event.respondWith($scramjetController.route(event));
});
