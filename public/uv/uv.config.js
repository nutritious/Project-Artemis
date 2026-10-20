/* Ultraviolet settings. The bundle defines the Ultraviolet global before this runs. */
self.__uv$config = {
  prefix: "/uv/service/",
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: "/uv/lib/uv.handler.js",
  client: "/uv/lib/uv.client.js",
  bundle: "/uv/lib/uv.bundle.js",
  config: "/uv/uv.config.js",
  sw: "/uv/lib/uv.sw.js",
};
