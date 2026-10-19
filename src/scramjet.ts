/* Scramjet engine: serves the browser-side proxy files and the Wisp tunnel that carries its traffic.
 *
 * Scramjet rewrites pages inside the browser (service worker), so the server only has to
 * (1) hand out the static files and (2) run a Wisp websocket that opens the real TCP connections.
 * The Wisp socket is where Artemis keeps its rules: signed token, bans, maintenance, the blocklist,
 * private-network protection and the per-user rate limit. */
import path from "node:path";
import type http from "node:http";
import type { Duplex } from "node:stream";
import type { Express } from "express";
import express from "express";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import { ALLOW_PRIVATE } from "./config.js";
import { allow, verify } from "./auth.js";
import { db } from "./store.js";
import { record } from "./monitor.js";

const mod = (p: string) => path.resolve("node_modules", p);

/** Static assets the browser needs. */
export function mountScramjet(app: Express) {
  const opts = { maxAge: "7d", fallthrough: false, index: false } as const;
  app.use("/sj/lib", express.static(mod("@mercuryworkshop/scramjet/dist"), opts));
  app.use("/sj/ctl", express.static(mod("@mercuryworkshop/scramjet-controller/dist"), opts));
  app.use("/sj/curl", express.static(mod("@mercuryworkshop/libcurl-transport/dist"), opts));
}

logging.set_level(logging.ERROR);
wisp.options.allow_private_ips = ALLOW_PRIVATE;
wisp.options.allow_loopback_ips = ALLOW_PRIVATE;
wisp.options.allow_udp_streams = false;
wisp.options.parse_real_ip = false;
wisp.options.dns_ttl = 600;
wisp.options.stream_limit_total = 120;
wisp.options.port_blacklist = [22, 23, 25, 110, 143, 445, 465, 587, 993, 995, 3306, 5432, 6379, 27017];

/* A misbehaving tunnel must never take chat and everyone else down with it. */
process.on("unhandledRejection", (e) => console.error("[artemis] unhandled rejection:", (e as any)?.stack ?? e));

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The owner's blocklist, kept in sync with the live Wisp filter on every new connection. */
function syncBlocklist() {
  wisp.options.hostname_blacklist = db.data.blocklist.map((b) => new RegExp(`(^|\\.)${escRe(b.toLowerCase())}$`, "i"));
}

export function isWispPath(url: string | undefined) {
  return (url ?? "").startsWith("/wisp/");
}

export function handleWispUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer) {
  const fail = (code: number, msg: string) => {
    console.log(`[scramjet] tunnel refused: ${code} ${msg}`);
    socket.write(`HTTP/1.1 ${code} ${msg}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
  };
  // The token rides in the path (/wisp/<token>/) because the transport wants an address that ends in a slash.
  const tok = /^\/wisp\/([^/?#]+)\//.exec(req.url ?? "")?.[1] ?? "";
  if (!tok) return fail(400, "Bad Request");
  const p = verify(tok, "p");
  const user = p && db.data.users.find((u) => u.id === p.u);
  if (!user) return fail(401, "Unauthorized");
  if (user.banned) return fail(403, "Forbidden");
  if (db.data.server.maintenance && user.role === "member") return fail(503, "Service Unavailable");
  if (!allow(`wisp:${user.id}`, 60, 60_000)) return fail(429, "Too Many Requests");
  syncBlocklist();
  user.lastSeen = Date.now();
  console.log(`[scramjet] tunnel open for ${user.username}`);
  record({ ts: Date.now(), user: user.username, method: "TUNNEL", host: "(scramjet)", path: "/wisp", status: 101, bytes: 0, ms: 0 });
  wisp.routeRequest(req, socket as any, head);
}
