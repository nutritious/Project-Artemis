import dns from "node:dns";
import net from "node:net";
import { Agent, ProxyAgent, type Dispatcher } from "undici";
import { ALLOW_PRIVATE, UPSTREAM_PROXY } from "./config.js";

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === "::1" || l === "::") return true;
    if (/^(fc|fd|fe8|fe9|fea|feb)/.test(l)) return true;
    const mapped = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return true;
}

type LookupCb = (err: NodeJS.ErrnoException | null, address: any, family?: number) => void;
/** DNS lookup that refuses non-public addresses (also used for WebSocket upstreams). */
export const safeLookup = (hostname: string, options: any, cb: LookupCb) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addrs) => {
    if (err) return cb(err, undefined);
    const list = (addrs as unknown as dns.LookupAddress[]).filter((a) => ALLOW_PRIVATE || !isPrivateIp(a.address));
    if (!list.length) {
      const e: NodeJS.ErrnoException = new Error("Blocked: address is not publicly routable");
      e.code = "EBLOCKED";
      return cb(e, undefined);
    }
    if (options && options.all) return cb(null, list);
    cb(null, list[0].address, list[0].family);
  });
};

export function literalIpBlocked(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "");
  return !ALLOW_PRIVATE && net.isIP(h) !== 0 && isPrivateIp(h);
}

/** Dispatcher for user-requested pages: SSRF-guarded. */
export const safeDispatcher: Dispatcher = UPSTREAM_PROXY
  ? new ProxyAgent({ uri: UPSTREAM_PROXY, headersTimeout: 30_000, bodyTimeout: 60_000 })
  : new Agent({ connect: { lookup: safeLookup as any }, headersTimeout: 30_000, bodyTimeout: 60_000 });

/** Dispatcher for the server's own fixed requests (search engines, suggestions). */
export const plainDispatcher: Dispatcher = UPSTREAM_PROXY
  ? new ProxyAgent({ uri: UPSTREAM_PROXY, headersTimeout: 15_000, bodyTimeout: 20_000 })
  : new Agent({ headersTimeout: 15_000, bodyTimeout: 20_000 });
