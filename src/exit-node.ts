/* Artemis home exit node. Run this on a computer with a home internet connection. Browsing then leaves from your home address,
 * which sites like YouTube trust, while the main Artemis site can stay on Render.
 *
 *   EXIT_KEY="a-long-secret" MAIN_URL="https://your-site.onrender.com" npx tsx src/exit-node.ts
 *   cloudflared tunnel --url http://localhost:8090      (then paste the https address in Owner console > Safety)
 */
import http from "node:http";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import { checkExitToken } from "./exit-token.js";
import { attachCloud } from "./cloud-browser.js";

const KEY = process.env.EXIT_KEY ?? "";
const PORT = Number(process.env.EXIT_PORT ?? 8090);
const MAIN = (process.env.MAIN_URL ?? "").replace(/\/$/, "");
if (KEY.length < 12) { console.error("Set EXIT_KEY to a long secret (at least 12 characters). The same key goes into the owner console of your site."); process.exit(1); }

logging.set_level(logging.ERROR);
const PRIV = process.env.EXIT_ALLOW_PRIVATE === "1"; /* testing only */
wisp.options.allow_private_ips = PRIV;
wisp.options.allow_loopback_ips = PRIV;
wisp.options.allow_udp_streams = false;
wisp.options.parse_real_ip = false;
wisp.options.dns_ttl = 600;
wisp.options.stream_limit_total = 120;
wisp.options.port_blacklist = [22, 23, 25, 110, 143, 445, 465, 587, 993, 995, 3306, 5432, 6379, 27017];
process.on("unhandledRejection", (e) => console.error("[exit] unhandled rejection:", (e as any)?.stack ?? e));

/* The main site tells us who is banned and which hosts are blocked, so its rules follow people to the exit node. */
let banned = new Set<string>();
let maintenance = false;
let blocklist: string[] = [];
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
async function pullPolicy() {
  if (!MAIN) return;
  try {
    const r = await fetch(MAIN + "/api/exit/policy", { headers: { "x-exit-key": KEY }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return console.error("[exit] policy refused:", r.status);
    const p = (await r.json()) as { banned: string[]; blocklist: string[]; maintenance: boolean };
    banned = new Set(p.banned); maintenance = !!p.maintenance; blocklist = p.blocklist.map((b) => b.toLowerCase());
    wisp.options.hostname_blacklist = p.blocklist.map((b) => new RegExp(`(^|\\.)${escRe(b.toLowerCase())}$`, "i"));
  } catch (e: any) { console.error("[exit] could not reach the main site:", e?.message ?? e); }
}
void pullPolicy(); setInterval(pullPolicy, 45_000).unref();

const srv = http.createServer((req, res) => {
  if (req.url === "/health") { res.writeHead(200, { "content-type": "text/plain", "access-control-allow-origin": "*" }); return void res.end("artemis-exit ok"); }
  res.writeHead(200, { "content-type": "text/plain" }); res.end("Artemis exit node. Nothing to see here.\n");
});
const cloud = attachCloud({ check: (t) => checkExitToken(KEY, t), banned: () => banned, maintenance: () => maintenance, blocked: () => blocklist });
srv.on("upgrade", (req, socket, head) => {
  if ((req.url ?? "").startsWith("/cb/")) return cloud(req, socket, head);
  const fail = (code: number, msg: string) => { socket.write(`HTTP/1.1 ${code} ${msg}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); socket.destroy(); };
  const tok = /^\/wisp\/([^/?#]+)\//.exec(req.url ?? "")?.[1] ?? "";
  const p = checkExitToken(KEY, decodeURIComponent(tok));
  if (!p) return fail(401, "Unauthorized");
  if (banned.has(p.u)) return fail(403, "Forbidden");
  if (maintenance) return fail(503, "Service Unavailable");
  console.log(`[exit] tunnel open for ${p.u.slice(0, 6)}…`);
  wisp.routeRequest(req, socket as any, head);
});
srv.listen(PORT, () => console.log(`\n  ☾  Artemis exit node ready on port ${PORT}${MAIN ? `, following the rules of ${MAIN}` : " (no MAIN_URL set: bans and the blocklist are not synced)"}\n`));
