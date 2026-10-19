/* Cloud browser: a real Chrome, Firefox or Edge-style browser that runs on the exit-node computer and is streamed to a canvas on the site.
 * Needs Playwright on that computer:  npm i playwright && npx playwright install chromium firefox
 * Everyone gets one private session (30 minutes). Admins and above are unlimited. */
import dns from "node:dns/promises";
import net from "node:net";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";

interface Opts { check: (token: string) => { u: string; ul?: number } | null; banned: () => Set<string>; maintenance: () => boolean; blocked: () => string[] }
interface Sess { user: string; ws: WebSocket; close: (why?: string) => void }
const sessions = new Map<string, Sess>();
const MAX_TOTAL = Number(process.env.CLOUD_MAX ?? 4), LIMIT_MS = 30 * 60_000, IDLE_MS = 5 * 60_000;

const privateIp = (ip: string): boolean => {
  if (net.isIPv6(ip)) { const l = ip.toLowerCase(); return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:") && privateIp(l.slice(7)); }
  const p = ip.split(".").map(Number); if (p.length !== 4) return true;
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 169 && p[1] === 254) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] >= 224;
};
const dnsCache = new Map<string, { ok: boolean; at: number }>();
async function hostAllowed(host: string, blocked: string[]) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return false;
  if (blocked.some((b) => h === b || h.endsWith("." + b))) return false;
  if (net.isIP(h)) return !privateIp(h);
  const c = dnsCache.get(h); if (c && Date.now() - c.at < 60_000) return c.ok;
  let ok = false; try { const r = await dns.lookup(h, { all: true }); ok = r.length > 0 && r.every((x) => !privateIp(x.address)); } catch { ok = false; }
  dnsCache.set(h, { ok, at: Date.now() }); if (dnsCache.size > 2000) dnsCache.clear(); return ok;
}
const KEYS: Record<string, string> = { " ": "Space", Esc: "Escape", Del: "Delete", Left: "ArrowLeft", Right: "ArrowRight", Up: "ArrowUp", Down: "ArrowDown", Meta: "Meta", Control: "Control", Alt: "Alt", Shift: "Shift" };
const NOKEY = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "Dead", "Unidentified", "Process"]);

export function attachCloud(o: Opts) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
  const handle = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const fail = (code: number, msg: string) => { socket.write(`HTTP/1.1 ${code} ${msg}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); socket.destroy(); };
    const tok = /^\/cb\/([^/?#]+)/.exec(req.url ?? "")?.[1] ?? "";
    const p = o.check(decodeURIComponent(tok)); if (!p) return fail(401, "Unauthorized");
    if (o.banned().has(p.u)) return fail(403, "Forbidden"); if (o.maintenance()) return fail(503, "Service Unavailable");
    wss.handleUpgrade(req, socket, head, (ws) => run(ws, p.u, !!p.ul));
  };

  async function run(ws: WebSocket, user: string, unlimited: boolean) {
    const send = (d: unknown) => { if (ws.readyState === 1) ws.send(JSON.stringify(d)); };
    sessions.get(user)?.close("You opened another cloud browser");
    if (sessions.size >= MAX_TOTAL) { send({ t: "error", message: "All cloud browsers are busy right now. Try again in a few minutes." }); return ws.close(); }
    let pw: any = null;
    let pendingMove: { x: number; y: number } | null = null, moving = false;
    let browser: any = null, ctx: any = null, page: any = null, cdp: any = null, closed = false, shot: NodeJS.Timeout | null = null, last = Date.now(), kind = "chrome", w = 1100, h = 650, fireLast: Buffer | null = null, startedAt = Date.now(), lastFrame = 0, still = false;
    const sess: Sess = { user, ws, close: (why) => { void end(why); } };
    async function end(why?: string) {
      if (closed) return; closed = true; sessions.delete(user); if (shot) clearInterval(shot); clearInterval(tick); clearInterval(keep);
      send({ t: "ended", reason: why ?? "Session ended" }); try { await browser?.close(); } catch { /* gone */ } try { ws.close(); } catch { /* gone */ }
    }
    sessions.set(user, sess);
    const tick = setInterval(() => { if (!unlimited && Date.now() - startedAt > LIMIT_MS) void end("Your 30 minute session is over"); else if (Date.now() - last > IDLE_MS) void end("Closed after 5 idle minutes"); }, 5000);
    /* a page that is not changing sends no frames, so grab a still every so often (this also gives the first picture) */
    const keep = setInterval(async () => { if (!page || closed || still || Date.now() - lastFrame < 1500 || ws.bufferedAmount > 1_500_000) return; still = true; try { const b: Buffer = await page.screenshot({ type: "jpeg", quality: 60 }); ws.send(b); lastFrame = Date.now(); } catch { /* navigating */ } still = false; }, 1000);
    const meta = async () => { try { send({ t: "meta", url: page.url(), title: await page.title().catch(() => "") }); } catch { /* closed */ } };
    async function stream() {
      if (!page) return;
      try { await cdp?.send("Page.stopScreencast").catch(() => 0); await cdp?.detach().catch(() => 0); } catch { /* none */ } cdp = null; if (shot) { clearInterval(shot); shot = null; }
      if (kind !== "firefox") {
        cdp = await ctx.newCDPSession(page);
        cdp.on("Page.screencastFrame", (f: any) => { if (ws.readyState === 1 && ws.bufferedAmount < 400_000) { ws.send(Buffer.from(f.data, "base64")); lastFrame = Date.now(); } void cdp?.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => 0); });
        await cdp.send("Page.startScreencast", { format: "jpeg", quality: 50, maxWidth: w, maxHeight: h, everyNthFrame: 2 });
      } else {
        let busy = false;
        shot = setInterval(async () => { if (busy || ws.bufferedAmount > 1_500_000) return; busy = true; try { const b: Buffer = await page.screenshot({ type: "jpeg", quality: 60 }); if (!fireLast || !b.equals(fireLast)) { fireLast = b; ws.send(b); } } catch { /* navigating */ } busy = false; }, 140);
      }
    }
    function adopt(p: any) { page = p; p.on("framenavigated", (f: any) => { if (f === p.mainFrame()) void meta(); }); p.on("load", () => void meta()); p.on("close", () => { if (page === p) { const l = ctx.pages().filter((x: any) => x !== p); if (l.length) { adopt(l[l.length - 1]); void stream(); } else void end("The browser closed"); } }); void stream().then(meta); }
    async function launch(url: string, which: string) {
      if (!pw) { try { pw = await import("playwright" as string); } catch { send({ t: "error", message: "The cloud browser isn't set up on the host computer yet. On that computer run: npm i playwright && npx playwright install chromium firefox" }); return void end("Not set up"); } }
      kind = ["firefox", "edge", "chrome"].includes(which) ? which : "chrome";
      const { chromium, firefox } = pw;
      browser = await (kind === "firefox" ? firefox : chromium).launch({ headless: true, args: kind === "firefox" ? [] : ["--disable-dev-shm-usage", "--no-first-run", ...(process.env.CLOUD_NOSANDBOX === "1" ? ["--no-sandbox", "--disable-gpu"] : []), "--disable-features=Translate,BackForwardCache,MediaRouter,OptimizationHints", "--mute-audio", "--disable-extensions", "--disable-sync", "--disable-background-networking", "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--js-flags=--max-old-space-size=384"] });
      const ver = browser.version().split(".")[0];
      const ua = kind === "firefox" ? undefined : `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36${kind === "edge" ? ` Edg/${browser.version()}` : ""}`;
      void ver;
      ctx = await browser.newContext({ viewport: { width: w, height: h }, userAgent: ua, acceptDownloads: false, permissions: [], serviceWorkers: "block", locale: "en-US" });
      await ctx.route("**/*", async (route: any) => {
        try {
          const u = new URL(route.request().url());
          if (u.protocol === "data:" || u.protocol === "blob:" || u.protocol === "about:") return route.continue();
          if ((u.protocol === "http:" || u.protocol === "https:") && (await hostAllowed(u.hostname, o.blocked()))) return route.continue();
          return route.abort("blockedbyclient");
        } catch { return route.abort(); }
      });
      ctx.on("page", (p: any) => { adopt(p); void p.bringToFront().catch(() => 0); });
      const p = await ctx.newPage(); adopt(p); send({ t: "ready", browser: kind });
      if (url) await page.goto(url, { timeout: 30000 }).catch((e: any) => send({ t: "note", message: String(e.message ?? e).split("\n")[0].slice(0, 160) }));
    }
    ws.on("close", () => void end("Disconnected"));
    ws.on("message", async (raw, isBin) => {
      if (isBin || closed) return; last = Date.now(); let m: any; try { m = JSON.parse(String(raw)); } catch { return; }
      try {
        if (m.t === "start" && !browser) { w = Math.max(320, Math.min(1920, Math.floor(+m.w || 1100))); h = Math.max(240, Math.min(1200, Math.floor(+m.h || 650))); await launch(String(m.url ?? ""), String(m.browser ?? "chrome")); return; }
        if (!page) return;
        switch (m.t) {
          case "nav": { let u = String(m.url ?? "").trim(); if (!/^https?:\/\//i.test(u)) u = /^[\w-]+(\.[\w-]+)+(\/|$)/.test(u) ? "https://" + u : "https://duckduckgo.com/?q=" + encodeURIComponent(u); await page.goto(u, { timeout: 30000 }).catch((e: any) => send({ t: "note", message: String(e.message ?? e).split("\n")[0].slice(0, 160) })); break; }
          case "back": await page.goBack().catch(() => 0); break;
          case "forward": await page.goForward().catch(() => 0); break;
          case "reload": await page.reload().catch(() => 0); break;
          case "mouse": { const x = +m.x, y = +m.y; if (!Number.isFinite(x) || !Number.isFinite(y)) break; if (m.type === "move") { pendingMove = { x, y }; if (!moving) { moving = true; try { while (pendingMove) { const mv = pendingMove; pendingMove = null; await page.mouse.move(mv.x, mv.y); } } finally { moving = false; } } } else if (m.type === "down") { await page.mouse.move(x, y); await page.mouse.down({ button: ["left", "middle", "right"][m.button | 0] ?? "left" }); } else if (m.type === "up") await page.mouse.up({ button: ["left", "middle", "right"][m.button | 0] ?? "left" }); break; }
          case "wheel": await page.mouse.wheel(Math.max(-2000, Math.min(2000, +m.dx || 0)), Math.max(-2000, Math.min(2000, +m.dy || 0))); break;
          case "key": { const k = String(m.key ?? ""); if (!k || NOKEY.has(k)) break; const key = KEYS[k] ?? k; await page.keyboard.press(m.ctrl ? `Control+${key}` : key); break; }
          case "text": await page.keyboard.insertText(String(m.text ?? "").slice(0, 5000)); break;
          case "resize": { w = Math.max(320, Math.min(1920, Math.floor(+m.w || w))); h = Math.max(240, Math.min(1200, Math.floor(+m.h || h))); await page.setViewportSize({ width: w, height: h }); await stream(); break; }
          case "close": await end("You closed the browser"); break;
        }
      } catch (e: any) { if (!page) { console.error("[cloud] could not start a browser:", e?.message ?? e); send({ t: "error", message: "The cloud browser could not start on the server. " + String(e?.message ?? e).split("\n")[0].slice(0, 140) }); void end("Could not start"); } /* otherwise: page navigating or closed */ }
    });
  }
  return handle;
}
