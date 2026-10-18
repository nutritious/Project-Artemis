import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type http from "node:http";
import type { Duplex } from "node:stream";
import type { Request, Response } from "express";
import * as cheerio from "cheerio";
import { fetch } from "undici";
import { WebSocket, WebSocketServer } from "ws";
import { USER_AGENT } from "./config.js";
import { allow, verify } from "./auth.js";
import { db, saveDb } from "./store.js";
import { record } from "./monitor.js";
import { activity, progress } from "./game.js";
import { accrueProxy, checkTrust } from "./trust.js";
import { literalIpBlocked, safeDispatcher, safeLookup } from "./net.js";

/* ------------------------------------------------------------------ */
/* URL encoding                                                        */
/* ------------------------------------------------------------------ */

export const encodeTarget = (u: string) => Buffer.from(u, "utf8").toString("base64url");
export const decodeTarget = (s: string) => Buffer.from(s, "base64url").toString("utf8");
export const proxyPath = (u: string, token: string) => `/p/${token}/${encodeTarget(u)}`;

/** Resolve `raw` against `base` and return a proxied path, or null when it should be left alone. */
export function proxify(raw: string, base: URL, token: string): string | null {
  const v = raw.trim();
  if (!v || v.startsWith("#")) return null;
  if (/^(data|javascript|mailto|tel|blob|about|sms):/i.test(v)) return null;
  if (v.startsWith(`/p/${token}/`)) return null;
  try {
    const abs = new URL(v, base);
    if (abs.protocol !== "http:" && abs.protocol !== "https:") return null;
    return proxyPath(abs.href, token);
  } catch {
    return null;
  }
}

/** If `u` is a proxied URL (absolute or path), return the real URL it points to. */
export function realFromProxyUrl(u: string | undefined): URL | null {
  if (!u) return null;
  try {
    const parsed = new URL(u, "http://x");
    const m = parsed.pathname.match(/^\/p\/([^/]+)\/([^/?#]+)/);
    if (!m) return null;
    return new URL(decodeTarget(m[2]));
  } catch {
    return null;
  }
}

export function isBlocked(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return db.data.blocklist.some((b) => h === b || h.endsWith("." + b));
}

/* ------------------------------------------------------------------ */
/* Cookie jar (per user)                                               */
/* ------------------------------------------------------------------ */

interface JarCookie { name: string; value: string; domain: string; hostOnly: boolean; path: string; expires: number; secure: boolean }
const jars = new Map<string, JarCookie[]>();

function storeCookies(userId: string, url: URL, setCookies: string[]) {
  if (!setCookies.length) return;
  const jar = jars.get(userId) ?? [];
  for (const line of setCookies) {
    const parts = line.split(";").map((s) => s.trim());
    const eq = parts[0].indexOf("=");
    if (eq <= 0) continue;
    const c: JarCookie = {
      name: parts[0].slice(0, eq),
      value: parts[0].slice(eq + 1),
      domain: url.hostname,
      hostOnly: true,
      path: "/",
      expires: Infinity,
      secure: false,
    };
    for (const attr of parts.slice(1)) {
      const [k, ...rest] = attr.split("=");
      const v = rest.join("=");
      switch (k.toLowerCase()) {
        case "domain": {
          const d = v.replace(/^\./, "").toLowerCase();
          if (url.hostname === d || url.hostname.endsWith("." + d)) {
            c.domain = d;
            c.hostOnly = false;
          }
          break;
        }
        case "path": if (v.startsWith("/")) c.path = v; break;
        case "max-age": { const n = Number(v); if (!Number.isNaN(n)) c.expires = Date.now() + n * 1000; break; }
        case "expires": { const t = Date.parse(v); if (!Number.isNaN(t) && c.expires === Infinity) c.expires = t; break; }
        case "secure": c.secure = true; break;
      }
    }
    const idx = jar.findIndex((j) => j.name === c.name && j.domain === c.domain && j.path === c.path);
    if (idx >= 0) jar.splice(idx, 1);
    if (c.expires > Date.now()) jar.push(c);
  }
  jars.set(userId, jar.slice(-500));
}

function cookieHeader(userId: string, url: URL): string {
  const jar = jars.get(userId);
  if (!jar) return "";
  const t = Date.now();
  return jar
    .filter((c) =>
      c.expires > t &&
      (c.hostOnly ? url.hostname === c.domain : url.hostname === c.domain || url.hostname.endsWith("." + c.domain)) &&
      url.pathname.startsWith(c.path) &&
      (!c.secure || url.protocol === "https:"))
    .sort((a, b) => b.path.length - a.path.length)
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

/* ------------------------------------------------------------------ */
/* Rewriting                                                           */
/* ------------------------------------------------------------------ */

export function rewriteCss(css: string, base: URL, token: string): string {
  return css
    .replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (m, q: string, u: string) => {
      const r = proxify(u, base, token);
      return r ? `url(${q}${r}${q})` : m;
    })
    .replace(/@import\s+(['"])(.*?)\1/gi, (m, q: string, u: string) => {
      const r = proxify(u, base, token);
      return r ? `@import ${q}${r}${q}` : m;
    });
}

const URL_ATTRS = ["href", "src", "action", "poster", "formaction", "background", "data-src", "data-href", "data-poster", "data-original", "data-lazy-src", "data-url"];

export function rewriteHtml(html: string, pageUrl: URL, token: string): string {
  const $ = cheerio.load(html);
  let base = pageUrl;
  const baseHref = $("base[href]").first().attr("href");
  if (baseHref) {
    try { base = new URL(baseHref, pageUrl); } catch { /* ignore */ }
  }
  $("base").remove();
  $('meta[http-equiv="content-security-policy" i], meta[charset], meta[http-equiv="content-type" i]').remove();
  $('link[rel="preconnect"], link[rel="dns-prefetch"], link[rel="prefetch"], link[rel="prerender"]').remove();
  $("[integrity]").removeAttr("integrity");
  $("[nonce]").removeAttr("nonce");

  $("form").each((_, el) => {
    const form = $(el);
    try {
      form.attr("data-artemis-action", new URL(form.attr("action") || pageUrl.href, base).href);
    } catch { /* ignore */ }
  });

  const selector = URL_ATTRS.map((a) => `[${a}]`).join(",");
  $(selector).each((_, el) => {
    const node = $(el);
    for (const attr of URL_ATTRS) {
      const v = node.attr(attr);
      if (v === undefined) continue;
      const r = proxify(v, base, token);
      if (r) node.attr(attr, r);
    }
  });

  $("[srcset],[data-srcset]").each((_, el) => {
    const node = $(el);
    for (const attr of ["srcset", "data-srcset"]) {
      const v = node.attr(attr);
      if (!v) continue;
      const out = v.split(/\s*,\s+/).map((item) => {
        const [u, ...desc] = item.trim().split(/\s+/);
        const r = proxify(u, base, token);
        return [r ?? u, ...desc].join(" ");
      });
      node.attr(attr, out.join(", "));
    }
  });

  $("[style]").each((_, el) => {
    const node = $(el);
    node.attr("style", rewriteCss(node.attr("style") ?? "", base, token));
  });
  $("style").each((_, el) => {
    const node = $(el);
    node.text(rewriteCss(node.text(), base, token));
  });

  $('meta[http-equiv="refresh" i]').each((_, el) => {
    const node = $(el);
    const m = (node.attr("content") ?? "").match(/^(\s*\d+\s*;\s*url=)(.+)$/i);
    if (m) {
      const r = proxify(m[2].replace(/^['"]|['"]$/g, ""), base, token);
      if (r) node.attr("content", m[1] + r);
    }
  });

  $("head").prepend('<meta charset="utf-8"><script src="/__artemis/inject.js"></script>');
  return $.html();
}

function decodeBody(buf: Buffer, contentType: string): string {
  const m = contentType.match(/charset=["']?([\w-]+)/i);
  let label = m ? m[1] : "utf-8";
  if (!m) {
    const sniff = buf.subarray(0, 2048).toString("latin1").match(/<meta[^>]+charset=["']?([\w-]+)/i);
    if (sniff) label = sniff[1];
  }
  try {
    return new TextDecoder(label).decode(buf);
  } catch {
    return buf.toString("utf8");
  }
}

/* ------------------------------------------------------------------ */
/* Error page                                                          */
/* ------------------------------------------------------------------ */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function errorPage(title: string, message: string, detail = "", needAuth = false): string {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
html,body{height:100%;margin:0}
body{display:grid;place-items:center;background:radial-gradient(1200px 600px at 50% -10%,#1b2140,#05060d);color:#e8ecff;font:16px/1.5 ui-sans-serif,system-ui,sans-serif}
.card{max-width:520px;margin:20px;padding:36px;border:1px solid rgba(255,255,255,.1);border-radius:20px;background:rgba(14,17,32,.7);text-align:center}
.moon{width:56px;height:56px;margin:0 auto 14px;border-radius:50%;box-shadow:inset -14px 0 0 0 #e8ecff;opacity:.9}
h1{margin:0 0 8px;font-size:22px}p{margin:0;color:#9aa3c7}code{display:block;margin-top:16px;color:#ff9a5c;font:12px ui-monospace,monospace;word-break:break-all}
</style>
<div class="card"><div class="moon"></div><h1>${esc(title)}</h1><p>${esc(message)}</p>${detail ? `<code>${esc(detail)}</code>` : ""}</div>
${needAuth ? "<script>try{parent.postMessage({artemis:'need-auth'},'*')}catch(e){}</script>" : ""}`;
}

/* ------------------------------------------------------------------ */
/* HTTP handler                                                        */
/* ------------------------------------------------------------------ */

const STRIP_RESPONSE = new Set([
  "content-security-policy", "content-security-policy-report-only", "x-frame-options", "set-cookie",
  "content-encoding", "content-length", "transfer-encoding", "strict-transport-security", "connection",
  "cross-origin-opener-policy", "cross-origin-embedder-policy", "cross-origin-resource-policy",
  "permissions-policy", "report-to", "nel", "alt-svc", "public-key-pins", "keep-alive", "link",
  "x-content-type-options", "origin-agent-cluster", "document-policy",
]);
const MAX_REWRITE_BYTES = 15 * 1024 * 1024;

export async function handleProxy(req: Request, res: Response) {
  const started = Date.now();
  const token = req.params.token;
  const payload = verify(token, "p");
  const user = payload ? db.data.users.find((u) => u.id === payload.u && !u.banned) : undefined;
  if (!payload || !user) {
    res.status(401).type("html").send(errorPage("Session expired", "Re-open this page from Project Artemis.", "", true));
    return;
  }

  if (db.data.server.maintenance && user.role === "member") {
    res.status(503).type("html").send(errorPage("Docked for maintenance", db.data.server.maintenanceMessage || "Mission control has paused the proxy. Chat is still open. Try again soon."));
    return;
  }
  let target: URL;
  try {
    target = new URL(decodeTarget(req.params.enc));
    if (target.protocol !== "http:" && target.protocol !== "https:") throw new Error("bad scheme");
  } catch {
    res.status(400).type("html").send(errorPage("Bad address", "That doesn't look like a valid web address."));
    return;
  }

  const log = (status: number, bytes: number) => {
    user.stats.requests++; accrueProxy(user); checkTrust(user);
    user.stats.bytes += bytes;
    user.lastSeen = Date.now();
    if (req.method === "GET" && status < 400 && /^(iframe|document)$/.test(req.get("sec-fetch-dest") ?? "")) { progress(user, "browse"); activity(user, "browse"); }
    saveDb();
    record({ ts: Date.now(), user: user.username, method: req.method, host: target.hostname, path: target.pathname + target.search, status, bytes, ms: Date.now() - started });
  };

  if (isBlocked(target.hostname)) {
    log(403, 0);
    res.status(403).type("html").send(errorPage("Signal lost", "This destination is blocked by mission control.", target.hostname));
    return;
  }
  if (literalIpBlocked(target.hostname)) {
    log(403, 0);
    res.status(403).type("html").send(errorPage("Restricted orbit", "Private network addresses can't be reached through Artemis.", target.hostname));
    return;
  }
  if (!allow(`px:${user.id}`, db.data.server.rateLimit, 60_000)) {
    log(429, 0);
    res.status(429).type("html").send(errorPage("Slow down, Commander", "You're sending requests too fast. Try again in a moment."));
    return;
  }

  const headers: Record<string, string> = {
    "user-agent": USER_AGENT,
    accept: req.get("accept") ?? "*/*",
    "accept-language": req.get("accept-language") ?? "en-US,en;q=0.9",
  };
  const range = req.get("range");
  if (range) headers.range = range;
  const ref = realFromProxyUrl(req.get("referer"));
  headers.referer = ref ? ref.href : target.origin + "/";
  const cookie = cookieHeader(user.id, target);
  if (cookie) headers.cookie = cookie;

  let body: Buffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD" && Buffer.isBuffer(req.body) && req.body.length) {
    body = req.body;
    const ct = req.get("content-type");
    if (ct) headers["content-type"] = ct;
  }
  if (req.method !== "GET" && req.method !== "HEAD") headers.origin = target.origin;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
      dispatcher: safeDispatcher,
      signal: AbortSignal.timeout(45_000),
    });

    storeCookies(user.id, target, upstream.headers.getSetCookie());

    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const loc = upstream.headers.get("location");
      const dest = loc ? proxify(loc, target, token) : null;
      log(upstream.status, 0);
      if (dest) {
        res.status(upstream.status).setHeader("location", dest).end();
      } else {
        res.status(502).type("html").send(errorPage("Bad redirect", "The site sent us somewhere we can't follow.", loc ?? ""));
      }
      return;
    }

    let contentType = upstream.headers.get("content-type") ?? "";
    const isImageLike = /^(image|video|audio|font)\//i.test(contentType) || /octet-stream|pdf|zip/i.test(contentType);
    let isHtml = /text\/html|application\/xhtml/i.test(contentType);
    const isCss = /text\/css/i.test(contentType);

    for (const [k, v] of upstream.headers) {
      if (!STRIP_RESPONSE.has(k.toLowerCase())) res.setHeader(k, v);
    }
    res.setHeader("x-robots-tag", "noindex");
    res.setHeader("referrer-policy", "unsafe-url");

    // Some sites omit the content type; sniff small bodies instead of serving raw markup.
    if (!contentType && !isImageLike && req.method !== "HEAD") {
      const buf = Buffer.from(await upstream.arrayBuffer());
      const head = buf.subarray(0, 512).toString("latin1").trimStart().toLowerCase();
      isHtml = head.startsWith("<!doctype html") || head.startsWith("<html");
      contentType = isHtml ? "text/html" : "application/octet-stream";
      const out = isHtml ? rewriteHtml(decodeBody(buf, contentType), target, token) : buf;
      res.status(upstream.status);
      res.setHeader("content-type", isHtml ? "text/html; charset=utf-8" : contentType);
      res.send(out);
      log(upstream.status, buf.length);
      return;
    }

    if (isHtml || isCss) {
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.length > MAX_REWRITE_BYTES) {
        res.status(upstream.status).send(buf);
        log(upstream.status, buf.length);
        return;
      }
      const text = decodeBody(buf, contentType);
      const out = isHtml ? rewriteHtml(text, target, token) : rewriteCss(text, target, token);
      res.status(upstream.status);
      res.setHeader("content-type", isHtml ? "text/html; charset=utf-8" : "text/css; charset=utf-8");
      if (isHtml) res.setHeader("cache-control", "no-store");
      res.send(out);
      log(upstream.status, Buffer.byteLength(out));
      return;
    }

    res.status(upstream.status);
    if (!upstream.headers.get("content-encoding")) {
      const len = upstream.headers.get("content-length");
      if (len) res.setHeader("content-length", len);
    }
    let bytes = 0;
    if (upstream.body && req.method !== "HEAD") {
      const stream = Readable.fromWeb(upstream.body as any);
      stream.on("data", (c: Buffer) => { bytes += c.length; });
      await pipeline(stream, res);
    } else {
      res.end();
    }
    log(upstream.status, bytes);
  } catch (err: any) {
    const code = err?.cause?.code ?? err?.code ?? "";
    log(502, 0);
    if (res.headersSent) {
      res.destroy();
      return;
    }
    const blocked = code === "EBLOCKED" || /not publicly routable/.test(String(err?.cause?.message ?? err?.message));
    const timeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    res.status(blocked ? 403 : 502).type("html").send(
      errorPage(
        blocked ? "Restricted orbit" : timeout ? "Transmission timed out" : "Couldn't reach that site",
        blocked ? "Private network addresses can't be reached through Artemis." : timeout ? "The site took too long to respond." : "We couldn't establish a connection to the destination.",
        `${target.hostname}${code ? " · " + code : ""}`,
      ),
    );
  }
}

/* ------------------------------------------------------------------ */
/* WebSocket proxy: /pws/<token>/<base64url(ws-url)>                   */
/* ------------------------------------------------------------------ */

const wsServer = new WebSocketServer({ noServer: true, handleProtocols: (set) => set.values().next().value ?? false });

export function handleProxyWsUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer) {
  const fail = (code = 403) => {
    socket.write(`HTTP/1.1 ${code} Forbidden\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  };
  const m = (req.url ?? "").match(/^\/pws\/([^/]+)\/([^/?#]+)/);
  if (!m) return fail(400);
  const payload = verify(m[1], "p");
  const user = payload ? db.data.users.find((u) => u.id === payload.u && !u.banned) : undefined;
  if (!user) return fail(401);
  let target: URL;
  try {
    target = new URL(decodeTarget(m[2]));
    if (target.protocol === "http:") target.protocol = "ws:";
    else if (target.protocol === "https:") target.protocol = "wss:";
    if (target.protocol !== "ws:" && target.protocol !== "wss:") throw new Error("scheme");
  } catch {
    return fail(400);
  }
  if (isBlocked(target.hostname) || literalIpBlocked(target.hostname)) return fail(403);

  const protoHeader = String(req.headers["sec-websocket-protocol"] ?? "");
  const protocols = protoHeader ? protoHeader.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  wsServer.handleUpgrade(req, socket, head, (client) => {
    const httpish = new URL(target.href.replace(/^ws/, "http"));
    const upstream = new WebSocket(target.href, protocols, {
      lookup: safeLookup as any,
      handshakeTimeout: 15_000,
      headers: {
        "user-agent": USER_AGENT,
        origin: httpish.origin,
        ...(cookieHeader(user.id, httpish) ? { cookie: cookieHeader(user.id, httpish) } : {}),
      },
    });
    const pending: { data: any; binary: boolean }[] = [];
    client.on("message", (data, binary) => {
      if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary });
      else if (pending.length < 200) pending.push({ data, binary });
    });
    upstream.on("open", () => { for (const p of pending.splice(0)) upstream.send(p.data, { binary: p.binary }); });
    upstream.on("message", (data, binary) => { if (client.readyState === WebSocket.OPEN) client.send(data, { binary }); });
    const closeBoth = (code?: number) => {
      const safe = code && code >= 1000 && code < 5000 && ![1005, 1006, 1015].includes(code) ? code : 1000;
      try { client.close(safe); } catch { /* closed */ }
      try { upstream.close(); } catch { /* closed */ }
    };
    upstream.on("close", closeBoth);
    upstream.on("error", () => closeBoth(1011));
    client.on("close", closeBoth);
    client.on("error", () => closeBoth(1011));
    record({ ts: Date.now(), user: user.username, method: "WS", host: target.hostname, path: target.pathname + target.search, status: 101, bytes: 0, ms: 0 });
    user.stats.requests++;
  });
}
