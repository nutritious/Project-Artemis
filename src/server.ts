import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { GIPHY_API_KEY, TENOR_API_KEY, ALLOW_PRIVATE, HOST, OWNER_PASSWORD, OWNER_USERNAME, PORT, PROXY_HOSTNAME, PROXY_ORIGIN, PROXY_TOKEN_TTL_MS, SESSION_TTL_MS, TRUST_PROXY, UPSTREAM_PROXY } from "./config.js";
import { allow, checkPassword, clientIp, hashPassword, publicUser, sign, SESSION_COOKIE, userFromRequest } from "./auth.js";
import { audit, db, defaultSettings, isStaff, newEconomy, saveDb, uid, type Settings, type User } from "./store.js";
import { trustInfo, TRUST, accrueProxy } from "./trust.js";
import { can, effectivePerms, hasDashboard, outranks, publicRoles, PERMS, PERM_INFO, rank, roleRank, roleTag, type Perm } from "./perms.js";
import { runCommand } from "./commands.js";
import { wheelMs } from "./game.js";
import { activity, progress, addEventPoints, earnedToday, activeBoosts, newGame, boards, publicEvent, publicGame, rankIndex, submitRun } from "./game.js";
import { casinoPlay, casinoState } from "./casino.js";
import { claim as claimFx, codeView, makeCode, redeem, endLive, giveCoinsTo, giveXpTo, buyUpgrade, togglePass, giftPass, upgradeState, giveItems, giveSelfWholePack, takeItems, joinLive, openPack, spinWheel, pushEventState, quick, startLive, targets } from "./economy.js";
import { storageInfo, migrate } from "./store.js";
import { checkExit, cloudPass, exitInfo, exitKey, exitStatus, localCloudKey, setExit } from "./exit.js";
import { attachCloud } from "./cloud-browser.js";
import { request as undiciRequest } from "undici";
import { literalIpBlocked, safeDispatcher } from "./net.js";
import { checkExitToken } from "./exit-token.js";
import { ACHIEVEMENTS, BASE_THEMES, GAMES, PACKS, WHEEL, WHEEL_MS } from "../public/js/cosmetics.js";
import { answer as answerRound, partyState, setAuto, skipRound, startRound, startRushNow } from "./party.js";
import { BUILD, broadcast, broadcastCustomTags, checkTrust, notifyOwners, broadcastEvent, broadcastAnnouncement, broadcastChannels, broadcastMembers, broadcastRoles, closeUserSockets, closeAllSockets, deleteMessage, handleChatUpgrade, hasAdminSubscribers, pushSelf, pushSelfAll, pushToAdmins } from "./chat.js";
import { encodeTarget, errorPage, handleProxy, handleProxyWsUpgrade, isBlocked, realFromProxyUrl } from "./proxy.js";
import compression from "compression";
import { handleWispUpgrade, isWispPath, mountScramjet } from "./scramjet.js";
import { snapshot, record } from "./monitor.js";
import { extendPhase, gotoPhase, resumeDirector, skipPhase } from "./director.js";
import { ask, card, cards, checkAll, INSTANCES, openStream, status as ytStatus, VIDEO_ID } from "./yt.js";
import { ENGINES, search, suggest, type EngineId } from "./search.js";

const app = express();
if (TRUST_PROXY) app.set("trust proxy", 1);
app.disable("x-powered-by");

/* ---------------- host roles: app / proxy / both ---------------- */
type Role = "app" | "proxy" | "both";
function hostRole(hostname: string): Role {
  if (PROXY_HOSTNAME) return hostname === PROXY_HOSTNAME ? "proxy" : "app";
  if (hostname === "127.0.0.1") return "proxy";
  if (hostname === "localhost") return "app";
  return "both";
}
function proxyOriginFor(req: Request): string {
  if (PROXY_ORIGIN) return PROXY_ORIGIN;
  if (req.hostname === "localhost") return `${req.protocol}://127.0.0.1:${(req.get("host") ?? "").split(":")[1] ?? PORT}`;
  return "";
}

/* Shrink the app and the Scramjet engine files (the engine is several MB). The proxy and API keep their own handling. */
const gzip = compression();
app.use((req, res, next) => (req.path.startsWith("/p/") || req.path.startsWith("/api/") ? next() : gzip(req, res, next)));

app.use((req, res, next) => {
  const role = hostRole(req.hostname);
  const isProxyPath = req.path.startsWith("/p/") || req.path.startsWith("/__artemis/") || req.path.startsWith("/sj/") || req.path.startsWith("/sj1/") || req.path.startsWith("/uv/");
  if (role === "proxy" && !isProxyPath) {
    // Fix up scripts that navigate to site-relative paths by using the Referer.
    const real = realFromProxyUrl(req.get("referer"));
    const tok = req.get("referer")?.match(/\/p\/([^/]+)\//)?.[1];
    if (real && tok && req.path !== "/favicon.ico") {
      try {
        res.redirect(307, `/p/${tok}/${encodeTarget(new URL(req.originalUrl, real).href)}`);
        return;
      } catch { /* fall through */ }
    }
    res.status(404).type("html").send(errorPage("Artemis proxy origin", "Open Project Artemis from its main address.", req.hostname));
    return;
  }
  if (role === "app" && req.path.startsWith("/p/")) {
    res.status(404).type("html").send(errorPage("Wrong origin", "Proxied pages are served from the proxy origin."));
    return;
  }
  next();
});

const IMG_ORIGINS = [PROXY_ORIGIN, "http://127.0.0.1:*"].filter(Boolean).join(" ");
app.use((req, res, next) => {
  if (!req.path.startsWith("/p/") && !req.path.startsWith("/sj/") && !req.path.startsWith("/sj1/") && !req.path.startsWith("/uv/")) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), payment=(), usb=(), interest-cohort=()");
    if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=15552000");
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; img-src 'self' data: blob: ${IMG_ORIGINS}; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'; connect-src 'self' ws: wss:; frame-src *; object-src 'none'; base-uri 'self'`,
    );
  }
  next();
});

/* ---------------- proxy routes ---------------- */
app.get("/__artemis/inject.js", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.resolve("public/inject.js"));
});
app.all("/p/:token/:enc", express.raw({ type: () => true, limit: "25mb" }), (req, res) => {
  handleProxy(req, res).catch((e) => {
    if (!res.headersSent) res.status(500).type("html").send(errorPage("Systems failure", "Something went wrong inside the proxy.", String(e?.message ?? e)));
  });
});

/* Scramjet engine files (the proxy itself runs in the browser; /wisp/ is its tunnel) */
mountScramjet(app);

/* ---------------- API ---------------- */
const api = express.Router();
api.use(express.json({ limit: "100kb" }));

api.use((req, res, next) => {
  if (req.method !== "GET") {
    const origin = req.get("origin");
    let ok = false;
    try { ok = !!origin && new URL(origin).host === req.get("host"); } catch { /* bad origin */ }
    if (!ok) return void res.status(403).json({ error: "Bad origin" });
  }
  next();
});

/** "Remember me" keeps you signed in for 30 days; otherwise the cookie ends with the browser session (and the token lapses after 12 hours). */
const setSession = (req: Request, res: Response, user: User, remember = true) => {
  const ttl = remember ? SESSION_TTL_MS : 12 * 60 * 60 * 1000;
  const token = sign({ k: "s", u: user.id, exp: Date.now() + ttl });
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: req.secure, ...(remember ? { maxAge: ttl } : {}), path: "/" });
};

const auth = (req: Request, res: Response, next: NextFunction) => {
  const user = userFromRequest(req);
  if (!user) return void res.status(401).json({ error: "Not signed in" });
  user.lastSeen = Date.now();
  (req as any).user = user;
  next();
};
const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!isStaff((req as any).user)) return void res.status(403).json({ error: "Commanders only" });
  next();
};
const need = (perm: Perm) => (req: Request, res: Response, next: NextFunction) => {
  if (!can((req as any).user, perm)) return void res.status(403).json({ error: `You need the "${PERM_INFO[perm].title}" power for that` });
  next();
};
const OG_MSG = "Only the owner can give the OG title.";
const ownerOnly = (req: Request, res: Response, next: NextFunction) => {
  if ((req as any).user?.role !== "owner") return void res.status(403).json({ error: "Owner only" });
  next();
};
const panelUp = (req: Request, res: Response, next: NextFunction) => {
  const u = (req as any).user, r = u?.role;
  if (r !== "owner" && r !== "coowner" && !can(u, "use_owner_panel")) return void res.status(403).json({ error: "You need the owner console power" });
  next();
};
const coownerUp = (req: Request, res: Response, next: NextFunction) => {
  const r = (req as any).user?.role;
  if (r !== "owner" && r !== "coowner") return void res.status(403).json({ error: "Owner or co-owner only" });
  next();
};
const me = (req: Request) => (req as any).user as User;
const validUsername = (s: unknown): s is string => typeof s === "string" && /^[a-zA-Z0-9_.-]{3,24}$/.test(s);

function logAdmin(req: Request, action: string, detail = "") {
  const entry = audit(me(req).username, action, detail);
  pushToAdmins({ t: "audit", entry });
}

const hasOwner = () => db.data.users.some((u) => u.role === "owner");
api.get("/config", (_req, res) => res.json({ firstRun: !hasOwner(), ownerName: OWNER_USERNAME, openRegistration: db.data.server.openRegistration, announcement: db.data.announcement }));

api.post("/register", async (req, res) => {
  if (!allow(`reg:${clientIp(req)}`, 8, 60_000)) return void res.status(429).json({ error: "Too many attempts" });
  const { username, password, invite, remember } = req.body ?? {};
  if (!validUsername(username)) return void res.status(400).json({ error: "Username must be 3–24 letters, numbers, . _ -" });
  if (typeof password !== "string" || password.length < 8 || password.length > 200) return void res.status(400).json({ error: "Password must be at least 8 characters" });
  if (db.data.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) return void res.status(409).json({ error: "That callsign is taken" });
  const isOwnerName = !hasOwner() && username.toLowerCase() === OWNER_USERNAME.toLowerCase();
  const first = isOwnerName;
  let inv: (typeof db.data.invites)[number] | undefined;
  if (!first && !db.data.server.openRegistration) {
    inv = db.data.invites.find((i) => i.code === String(invite ?? "").trim() && !i.usedBy);
    if (!inv) return void res.status(403).json({ error: "A valid invite code is required" });
  }
  const { salt, hash } = await hashPassword(password);
  const user: User = {
    id: uid(), username, salt, hash, role: isOwnerName ? "owner" : "member", createdAt: Date.now(), lastSeen: Date.now(), banned: false,
    stats: { requests: 0, bytes: 0 }, bookmarks: [], history: [], settings: defaultSettings(db.data.server.defaultEngine), profile: { status: "", presence: "online", avatar: "" }, game: newGame(), ...newEconomy(),
  };
  if (!first && db.data.server.launchAt && Date.now() < db.data.server.launchAt + 864e5) { user.inv.tags.push("og"); user.equip.tag = "og"; }
  db.data.users.push(user);
  if (inv) inv.usedBy = user.username;
  saveDb();
  setSession(req, res, user, remember !== false);
  broadcastMembers();
  res.json({ user: publicUser(user) });
});

api.post("/login", async (req, res) => {
  if (!allow(`login:${clientIp(req)}`, 10, 60_000)) return void res.status(429).json({ error: "Too many attempts, try again shortly" });
  const { username, password, remember } = req.body ?? {};
  const user = db.data.users.find((u) => u.username.toLowerCase() === String(username ?? "").toLowerCase());
  if (!user || typeof password !== "string" || !(await checkPassword(user, password))) return void res.status(401).json({ error: "Wrong callsign or passcode" });
  if (user.banned) return void res.status(403).json({ error: "This account has been suspended" });
  user.lastSeen = Date.now();
  setSession(req, res, user, remember !== false);
  res.json({ user: publicUser(user) });
});

api.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

const proxyToken = (user: User) => sign({ k: "p", u: user.id, exp: Date.now() + PROXY_TOKEN_TTL_MS });
const engineList = () => Object.entries(ENGINES).map(([id, e]) => ({ id, name: e.name, home: e.home }));

api.get("/me", auth, (req, res) => {
  const user = me(req);
  res.json({
    user: publicUser(user),
    perms: effectivePerms(user),
    roles: publicRoles(),
    permInfo: PERM_INFO,
    proxyOrigin: proxyOriginFor(req),
    sjOrigin: PROXY_ORIGIN,
    ...exitInfo(user),
    storageWarn: user.role === "owner" && storageInfo().permanent === false,
    proxyToken: proxyToken(user),
    bookmarks: user.bookmarks,
    channels: db.data.channels.map((c) => ({ id: c.id, name: c.name, topic: c.topic })),
    announcement: db.data.announcement,
    maintenance: db.data.server.maintenance,
    engines: engineList(),
  });
});
/* Image proxy: chat images are fetched by the server, so a poster's website never sees the viewer's IP address or device. */
const IMG_OK = /^image\/(png|jpe?g|gif|webp|avif|x-icon|vnd\.microsoft\.icon)$/i;
api.get("/img", auth, async (req, res) => {
  const u = me(req);
  if (!allow(`img:${u.id}`, 120, 60_000)) return void res.status(429).end();
  let target: URL;
  try { target = new URL(String(req.query.u ?? "")); } catch { return void res.status(400).end(); }
  if (!/^https?:$/.test(target.protocol) || target.username || target.password || (!ALLOW_PRIVATE && target.port && !["80", "443"].includes(target.port))) return void res.status(400).end();
  try {
    let url = target, r: Awaited<ReturnType<typeof undiciRequest>> | null = null;
    for (let hop = 0; hop < 4; hop++) {
      if (literalIpBlocked(url.hostname) || db.data.blocklist.some((b) => url.hostname === b || url.hostname.endsWith("." + b))) return void res.status(403).end();
      r = await undiciRequest(url.href, { method: "GET", dispatcher: safeDispatcher, headers: { "user-agent": "Mozilla/5.0 ArtemisImage", accept: "image/*" }, signal: AbortSignal.timeout(8000) });
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { await r.body.dump(); url = new URL(String(r.headers.location), url); if (!/^https?:$/.test(url.protocol)) return void res.status(400).end(); r = null; continue; }
      break;
    }
    if (!r || r.statusCode !== 200) return void res.status(404).end();
    const type = String(r.headers["content-type"] ?? "").split(";")[0].trim();
    if (!IMG_OK.test(type)) { await r.body.dump(); return void res.status(415).end(); }
    const chunks: Buffer[] = []; let size = 0;
    for await (const c of r.body) { size += (c as Buffer).length; if (size > 5_000_000) { r.body.destroy(); return void res.status(413).end(); } chunks.push(c as Buffer); }
    res.setHeader("Content-Type", type); res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Cache-Control", "private, max-age=3600"); res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.end(Buffer.concat(chunks));
  } catch { res.status(502).end(); }
});
/* Artemis Tube: video lists come from public Invidious servers */
const ytBackend = (req: Request) => { const n = parseInt(String(req.query.b ?? ""), 10); return Number.isInteger(n) ? n : -1; };
const ytFail = (res: Response, e: any) => res.status(502).json({ error: String(e?.message ?? "Video servers are not answering") });
api.get("/yt/backends", auth, (_req, res) => res.json({ backends: ytStatus() }));
api.post("/yt/backends/check", auth, async (req, res) => { if (!allow(`ytchk:${me(req).id}`, 6, 60_000)) return void res.status(429).json({ error: "Slow down" }); res.json({ backends: await checkAll() }); });
api.get("/yt/list", auth, async (req, res) => {
  if (!allow(`yt:${me(req).id}`, 60, 60_000)) return void res.status(429).json({ error: "Slow down" });
  const tab = req.query.tab === "trending" ? "trending" : "popular";
  try { const r = await ask(tab === "popular" ? "/api/v1/popular" : "/api/v1/trending", ytBackend(req)); res.json({ videos: cards(r.data), from: r.from, backends: ytStatus() }); } catch (e) { ytFail(res, e); }
});
api.get("/yt/search", auth, async (req, res) => {
  if (!allow(`yt:${me(req).id}`, 60, 60_000)) return void res.status(429).json({ error: "Slow down" });
  const q = String(req.query.q ?? "").trim().slice(0, 120); if (!q) return void res.json({ videos: [] });
  try { const r = await ask("/api/v1/search?type=video&q=" + encodeURIComponent(q), ytBackend(req)); res.json({ videos: cards(r.data), from: r.from, backends: ytStatus() }); } catch (e) { ytFail(res, e); }
});
api.get("/yt/video/:id", auth, async (req, res) => {
  if (!allow(`yt:${me(req).id}`, 60, 60_000)) return void res.status(429).json({ error: "Slow down" });
  const id = String(req.params.id); if (!VIDEO_ID.test(id)) return void res.status(400).json({ error: "Bad video id" });
  try {
    const r = await ask("/api/v1/videos/" + id + "?fields=videoId,title,author,authorId,viewCount,likeCount,publishedText,lengthSeconds,description,recommendedVideos", ytBackend(req));
    const d = r.data ?? {};
    res.json({ video: { ...card({ ...d, videoId: id }), description: String(d.description ?? "").slice(0, 1500), likes: Number(d.likeCount) || 0 }, related: cards((d.recommendedVideos ?? []).map((x: any) => ({ ...x, viewCount: x.viewCount ?? x.viewCountText }))), base: INSTANCES[r.from], backends: ytStatus() });
  } catch (e) { ytFail(res, e); }
});
api.get("/yt/stream/:id", auth, async (req, res) => {
  if (!allow(`ytst:${me(req).id}`, 120, 60_000)) return void res.status(429).json({ error: "Slow down" });
  const id = String(req.params.id); if (!VIDEO_ID.test(id)) return void res.status(400).json({ error: "Bad video id" });
  const itag = ["18", "22", "17"].includes(String(req.query.itag)) ? String(req.query.itag) : "18";
  const s = await openStream(id, req.headers.range, ytBackend(req), itag).catch(() => null);
  if (!s) return void res.status(502).json({ error: "No video server could send this video" });
  res.status(s.status);
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) { const v = s.headers[h]; if (v) res.setHeader(h, String(v)); }
  res.setHeader("cache-control", "private, max-age=600");
  res.on("close", () => { try { s.body.destroy(); } catch { /* done */ } });
  s.body.on("error", () => res.end()); s.body.pipe(res);
});
/* GIF library: the server library (owner and co-owners curate it), each person's saved GIFs, and optional search */
const gifUrl = (raw: unknown) => {
  let u: URL; try { u = new URL(String(raw ?? "").trim()); } catch { throw new Error("That is not a link"); }
  if (u.protocol !== "https:" || u.username || u.password || String(raw).length > 500) throw new Error("Use a normal https link");
  if (db.data.blocklist.some((b) => u.hostname === b || u.hostname.endsWith("." + b))) throw new Error("That site is blocked here");
  if (!/\.(gif|webp|png|jpe?g|avif)$/i.test(u.pathname) && !/(^|\.)(giphy\.com|tenor\.com|tenor\.googleapis\.com|imgur\.com)$/.test(u.hostname)) throw new Error("That link must go straight to a GIF or image (it should end in .gif)");
  return u.href;
};
const gifView = () => ({ library: db.data.gifs.map((g) => ({ id: g.id, url: g.url, title: g.title })), search: !!(TENOR_API_KEY || GIPHY_API_KEY) });
api.get("/gifs", auth, (req, res) => res.json({ ...gifView(), mine: me(req).gifs ?? [] }));
api.post("/gifs/mine", auth, (req, res) => {
  try { const u = me(req), url = gifUrl(req.body?.url); u.gifs ??= []; if (u.gifs.some((g) => g.url === url)) return void res.json({ mine: u.gifs }); if (u.gifs.length >= 100) throw new Error("You can save up to 100 GIFs"); u.gifs.unshift({ id: uid(), url }); saveDb(); res.json({ mine: u.gifs }); } catch (e: any) { res.status(400).json({ error: e.message }); }
});
api.delete("/gifs/mine/:id", auth, (req, res) => { const u = me(req); u.gifs = (u.gifs ?? []).filter((g) => g.id !== req.params.id); saveDb(); res.json({ mine: u.gifs }); });
api.post("/gifs/library", auth, coownerUp, (req, res) => {
  try { const url = gifUrl(req.body?.url), title = String(req.body?.title ?? "").trim().slice(0, 40); if (db.data.gifs.length >= 400) throw new Error("The library is full (400 GIFs)"); if (db.data.gifs.some((g) => g.url === url)) throw new Error("That GIF is already in the library"); db.data.gifs.unshift({ id: uid(), url, title, by: me(req).username, ts: Date.now() }); saveDb(); logAdmin(req, "gif.add", url.slice(0, 120)); res.json(gifView()); } catch (e: any) { res.status(400).json({ error: e.message }); }
});
api.delete("/gifs/library/:id", auth, coownerUp, (req, res) => { db.data.gifs = db.data.gifs.filter((g) => g.id !== req.params.id); saveDb(); logAdmin(req, "gif.remove", String(req.params.id)); res.json(gifView()); });
api.get("/gifs/search", auth, async (req, res) => {
  if (!allow(`gifs:${me(req).id}`, 40, 60_000)) return void res.status(429).json({ error: "Slow down a little" });
  if (!TENOR_API_KEY && !GIPHY_API_KEY) return void res.status(501).json({ error: "GIF search is off. The owner can turn it on with a Tenor or Giphy key (TENOR_API_KEY or GIPHY_API_KEY)." });
  const q = String(req.query.q ?? "").trim().slice(0, 60);
  try {
    const url = TENOR_API_KEY
      ? `https://tenor.googleapis.com/v2/${q ? "search" : "featured"}?key=${encodeURIComponent(TENOR_API_KEY)}&client_key=artemis&limit=24&contentfilter=high&media_filter=gif,tinygif${q ? "&q=" + encodeURIComponent(q) : ""}`
      : `https://api.giphy.com/v1/gifs/${q ? "search" : "trending"}?api_key=${encodeURIComponent(GIPHY_API_KEY)}&limit=24&rating=pg${q ? "&q=" + encodeURIComponent(q) : ""}`;
    const r = await undiciRequest(url, { method: "GET", dispatcher: safeDispatcher, headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (r.statusCode !== 200) { await r.body.dump(); throw new Error("status " + r.statusCode); }
    const j: any = await r.body.json();
    const gifs = TENOR_API_KEY
      ? (j.results ?? []).map((x: any) => ({ url: x.media_formats?.gif?.url, preview: x.media_formats?.tinygif?.url ?? x.media_formats?.gif?.url, title: String(x.content_description ?? "").slice(0, 60) }))
      : (j.data ?? []).map((x: any) => ({ url: x.images?.original?.url?.split("?")[0], preview: x.images?.fixed_width?.url?.split("?")[0], title: String(x.title ?? "").slice(0, 60) }));
    res.json({ gifs: gifs.filter((g: any) => typeof g.url === "string" && /^https:\/\//.test(g.url)).slice(0, 24) });
  } catch { res.status(502).json({ error: "The GIF service did not answer. Try again in a moment." }); }
});
api.get("/proxy-token", auth, (req, res) => res.json({ proxyToken: proxyToken(me(req)), proxyOrigin: proxyOriginFor(req), sjOrigin: PROXY_ORIGIN, ...exitInfo(me(req)) }));
api.get("/cloud-pass", auth, (req, res) => res.json(cloudPass(me(req))));
/* the home exit node asks for bans and the blocklist with its secret key */
api.get("/exit/policy", (req, res) => {
  const k = exitKey(), got = String(req.headers["x-exit-key"] ?? "");
  if (!k || got.length !== k.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(k))) return void res.status(403).json({ error: "No" });
  res.json({ banned: db.data.users.filter((u) => u.banned).map((u) => u.id), blocklist: db.data.blocklist, maintenance: db.data.server.maintenance });
});
api.get("/owner/network", auth, ownerOnly, async (_req, res) => {
  const get = async (url: string, ms = 8000) => { const r = await undiciRequest(url, { dispatcher: safeDispatcher, headersTimeout: ms, bodyTimeout: ms, headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36", "accept-language": "en-US,en;q=0.9" } }); return { status: r.statusCode, text: (await r.body.text()).slice(0, 600_000) }; };
  const out: any = { viaUpstream: !!UPSTREAM_PROXY, ip: "", org: "", hosting: null, city: "", youtube: { state: "unknown", note: "" } };
  try {
    const j = JSON.parse((await get("https://ipinfo.io/json")).text);
    out.ip = String(j.ip ?? ""); out.org = String(j.org ?? ""); out.city = [j.city, j.region, j.country].filter(Boolean).join(", ");
    out.hosting = /amazon|aws|google|gcp|microsoft|azure|digitalocean|hetzner|ovh|linode|akamai|vultr|oracle|cloudflare|render|fly\.io|leaseweb|contabo|hosting|cloud|data ?center|server/i.test(out.org);
  } catch { out.error = "Could not look up the server's address (the lookup site may be blocked)."; }
  try {
    const r = await get("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    const t = r.text;
    if (/confirm you.{0,8}re not a bot|LOGIN_REQUIRED|unusual traffic/i.test(t)) out.youtube = { state: "blocked", note: "YouTube asked this server to prove it is not a bot." };
    else if (r.status === 200 && /"playabilityStatus":\{"status":"OK"/.test(t)) out.youtube = { state: "ok", note: "YouTube served a playable video to this server." };
    else out.youtube = { state: "unclear", note: "YouTube answered with status " + r.status + " and no clear verdict." };
  } catch { out.youtube = { state: "unclear", note: "Could not reach YouTube from the server." }; }
  res.json(out);
});
api.get("/owner/exit", auth, ownerOnly, (_req, res) => res.json(exitStatus()));
api.put("/owner/exit", auth, ownerOnly, async (req, res) => {
  try { setExit(req.body?.url, req.body?.key); audit(me(req).username, "exit.set", db.data.server.exitUrl || "(off)"); await checkExit(); res.json(exitStatus()); } catch (e: any) { res.status(400).json({ error: e.message }); }
});
api.post("/owner/exit/test", auth, ownerOnly, async (_req, res) => { await checkExit(); res.json(exitStatus()); });
api.get("/ping", (_req, res) => res.json({ t: Date.now() }));

/* ----- crew hub: ranks, coins, missions, arcade ----- */
const gamePayload = (u: User) => ({ game: publicGame(u), ...boards(), event: publicEvent(u) });
api.get("/game", auth, (req, res) => res.json(gamePayload(me(req))));
api.post("/game/run", auth, (req, res) => {
  const user = me(req);
  if (!allow(`run:${user.id}`, 12, 60_000)) return void res.status(429).json({ error: "Slow down, pilot" });
  if (!submitRun(user, String(req.body?.game ?? "run"), Number(req.body?.score), Number(req.body?.secs))) return void res.status(400).json({ error: "That run was not recorded" });
  if (db.data.event) pushEventState();
  res.json(gamePayload(user));
});
api.post("/event/answer", auth, (req, res) => {
  const u = me(req);
  if (!allow(`ans:${u.id}`, 60, 30_000)) return void res.status(429).json({ error: "Easy there" });
  try { res.json(answerRound(u, String(req.body?.id ?? ""), req.body?.answer)); } catch (e: any) { res.status(400).json({ error: e.message }); }
});
api.post("/owner/round", auth, ownerOnly, (req, res) => {
  const b = req.body ?? {}, by = me(req).username;
  try {
    if (b.action === "skip") skipRound(by);
    else if (b.action === "auto") setAuto(by, !!b.on);
    else if (b.kind === "rush") startRushNow(by, GAMES.some((g) => g.id === b.game) ? String(b.game) : "run");
    else startRound(by, String(b.kind ?? ""));
    res.json({ ok: true, ...partyState() });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
api.put("/owner/countdown", auth, coownerUp, (req, res) => {
  const title = String(req.body?.title ?? "").trim().slice(0, 60), about = String(req.body?.about ?? "").trim().slice(0, 160), at = Number(req.body?.at);
  if (!title || !Number.isFinite(at) || at < Date.now() - 6e4) return void res.status(400).json({ error: "Add a title and a time in the future" });
  db.data.server.countdown = { title, about, at, by: me(req).username }; saveDb(); logAdmin(req, "countdown.set", title); broadcast({ t: "countdown", countdown: db.data.server.countdown }); res.json({ ok: true });
});
api.delete("/owner/countdown", auth, coownerUp, (req, res) => { db.data.server.countdown = null; saveDb(); logAdmin(req, "countdown.clear", ""); broadcast({ t: "countdown", countdown: null }); res.json({ ok: true }); });
api.post("/owner/secret-announce", auth, ownerOnly, (req, res) => { logAdmin(req, "secret.test", ""); broadcast({ t: "secret", user: me(req).username, tier: ["forbidden", "omega"].includes(String(req.body?.tier)) ? String(req.body.tier) : "secret" }); res.json({ ok: true }); });
api.post("/owner/updatelive", auth, ownerOnly, (req, res) => { logAdmin(req, "update.live", ""); broadcast({ t: "updatelive" }); res.json({ ok: true }); });
api.post("/event/join", auth, (req, res) => { try { joinLive(me(req)); res.json(gamePayload(me(req))); } catch (e: any) { res.status(400).json({ error: e.message }); } });
api.post("/fx/claim", auth, (req, res) => { if (!allow(`claim:${me(req).id}`, 40, 60_000)) return void res.status(429).json({ error: "Easy there" }); try { res.json({ coins: claimFx(me(req), String(req.body?.id ?? "")) }); } catch (e: any) { res.status(400).json({ error: e.message }); } });

/* ----- shop: packs, equipping ----- */
const shopPayload = (u: User) => ({ up: upgradeState(u), nextSpin: u.game.lastSpin + wheelMs(u), coins: u.coins, freePacks: u.freePacks, inv: u.inv, equip: u.equip, packs: PACKS, customTags: db.data.customTags });
api.get("/shop", auth, (req, res) => res.json(shopPayload(me(req))));
api.post("/shop/open", auth, (req, res) => {
  const user = me(req);
  if (!allow(`pack:${user.id}`, 20, 60_000)) return void res.status(429).json({ error: "Slow down" });
  try { res.json(openPack(user, String(req.body?.pack ?? ""), !!req.body?.free, Number(req.body?.count ?? 1))); } catch (e: any) { res.status(400).json({ error: e.message }); }
});
api.post("/shop/upgrade", auth, (req, res) => {
  const u = me(req); if (!allow(`upg:${u.id}`, 60, 60_000)) return void res.status(429).json({ error: "Slow down" });
  try { buyUpgrade(u, String(req.body?.id ?? "")); res.json(shopPayload(u)); } catch (e: any) { res.status(400).json({ error: e.message }); }
});
api.post("/shop/pass", auth, (req, res) => {
  const u = me(req); if (!allow(`uppass:${u.id}`, 60, 60_000)) return void res.status(429).json({ error: "Slow down" });
  try { togglePass(u, String(req.body?.id ?? ""), !!req.body?.on); res.json(shopPayload(u)); } catch (e: any) { res.status(400).json({ error: e.message }); }
});
api.post("/shop/gift", auth, (req, res) => {
  const u = me(req); if (!allow(`upgift:${u.id}`, 10, 60_000)) return void res.status(429).json({ error: "Slow down" });
  try { const to = giftPass(u, String(req.body?.id ?? ""), String(req.body?.to ?? "")); res.json({ ...shopPayload(u), to }); } catch (e: any) { res.status(400).json({ error: e.message }); }
});
api.put("/equip", auth, (req, res) => {
  const u = me(req), b = req.body ?? {};
  if ("effect" in b) { const v = String(b.effect ?? ""); if (v && !u.inv.effects.includes(v)) return void res.status(400).json({ error: "You don't own that effect" }); u.equip.effect = v; }
  if ("tag" in b) { const v = String(b.tag ?? ""); if (v && !u.inv.tags.includes(v)) return void res.status(400).json({ error: "You don't own that title" }); u.equip.tag = v; }
  if ("bg" in b) { const v = String(b.bg ?? ""); if (v && !u.inv.bgs.includes(v)) return void res.status(400).json({ error: "You don't own that background" }); u.equip.bg = v; }
  saveDb(); broadcastMembers(); res.json(shopPayload(u));
});
api.post("/redeem", auth, (req, res) => { const u = me(req); if (!allow("redeem:" + u.id, 8, 60_000)) return void res.status(429).json({ error: "Slow down. Try again in a minute." }); try { res.json(redeem(u, req.body?.code)); } catch (e: any) { res.status(400).json({ error: e.message }); } });
api.get("/owner/codes", auth, coownerUp, (_req, res) => res.json({ codes: db.data.codes.map(codeView) }));
api.post("/owner/codes", auth, coownerUp, (req, res) => { try {
  if (me(req).role !== "owner" && (Array.isArray(req.body?.items) ? req.body.items : []).some((i: any) => i?.type === "tag" && i?.id === "og")) return void res.status(403).json({ error: OG_MSG });
   const c = makeCode(me(req).username, req.body ?? {}); res.json({ ok: true, code: c.code }); } catch (e: any) { res.status(400).json({ error: e.message }); } });
api.put("/owner/codes/:code", auth, coownerUp, (req, res) => { const c = db.data.codes.find((x) => x.code === req.params.code); if (!c) return void res.status(404).json({ error: "No such code" }); c.disabled = !c.disabled; saveDb(); logAdmin(req, "code.toggle", c.code); res.json({ ok: true }); });
api.delete("/owner/codes/:code", auth, coownerUp, (req, res) => { const n = db.data.codes.length; db.data.codes = db.data.codes.filter((x) => x.code !== req.params.code); if (db.data.codes.length === n) return void res.status(404).json({ error: "No such code" }); saveDb(); logAdmin(req, "code.delete", String(req.params.code)); res.json({ ok: true }); });
api.post("/wheel/spin", auth, (req, res) => { try { res.json(spinWheel(me(req))); } catch (e: any) { res.status(400).json({ error: e.message }); } });
api.get("/casino", auth, (req, res) => res.json(casinoState(me(req))));
api.post("/casino/:game", auth, (req, res) => { try { res.json(casinoPlay(me(req), String(req.params.game), req.body ?? {})); } catch (e: any) { res.status(400).json({ error: e.message }); } });
api.get("/wheel", auth, (req, res) => res.json({ wheel: WHEEL, next: me(req).game.lastSpin + wheelMs(me(req)), ms: wheelMs(me(req)) }));
api.get("/achievements", auth, (req, res) => { const u = me(req); res.json({ list: ACHIEVEMENTS.map((a) => ({ ...a, done: u.game.ach[a.id] ?? 0 })), stats: { ...u.game.stats, plays: u.game.plays, rank: rankIndex(u.game.xp), items: u.inv.effects.length + u.inv.tags.length + u.inv.themes.length + u.inv.bgs.length }, earnedToday: earnedToday(u) }); });
api.get("/profile/:name", auth, (req, res) => {
  const viewer = me(req), u = db.data.users.find((x) => x.username.toLowerCase() === String(req.params.name).toLowerCase() && !x.banned);
  if (!u) return void res.status(404).json({ error: "No one with that callsign" });
  const staff = viewer.role === "owner" || viewer.role === "coowner";
  res.json({ id: u.id, username: u.username, role: u.role, roleId: u.roleId ?? null, profile: u.profile, createdAt: u.createdAt, lastSeen: u.lastSeen, xp: u.game.xp, rank: rankIndex(u.game.xp), streak: u.game.streak, plays: u.game.plays, bests: u.game.bests, equip: u.equip, inv: u.inv, ach: Object.keys(u.game.ach).length, msgs: (u.game.stats as any)?.msgs ?? 0, ...(staff ? { coins: u.coins } : {}) });
});

/* ----- owner economy and events ----- */
const parseTarget = (t: any) => ({ type: ["user", "all", "online", "role"].includes(t?.type) ? t.type : "online", value: t?.value ? String(t.value) : undefined });
api.get("/owner/economy", auth, panelUp, (_req, res) => res.json({
  users: db.data.users.filter((u) => !u.banned).map((u) => ({ id: u.id, username: u.username, role: u.role, roleId: u.roleId ?? null, coins: u.coins, xp: u.game.xp, rank: rankIndex(u.game.xp), freePacks: u.freePacks, equip: u.equip, effects: u.inv.effects.length, tags: u.inv.tags.length, themes: u.inv.themes.length })),
  customTags: db.data.customTags, event: publicEvent(), party: partyState(), boosts: activeBoosts(), totalCoins: db.data.users.reduce((n, u) => n + u.coins, 0),
}));
api.post("/owner/coins", auth, panelUp, (req, res) => {
  const amount = Math.round(Number(req.body?.amount));
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1e12) return void res.status(400).json({ error: "Enter an amount, positive or negative (up to a trillion)" });
  const n = giveCoinsTo(me(req).username, amount, parseTarget(req.body?.target), String(req.body?.reason ?? "").slice(0, 60));
  broadcastMembers(); res.json({ ok: true, reached: n });
});
api.post("/admin/coins", auth, (req, res) => {
  const r = me(req).role; if (r !== "owner" && r !== "coowner" && r !== "admin") return void res.status(403).json({ error: "Owner, co-owner or commander only" });
  const amount = Math.round(Number(req.body?.amount));
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1e12) return void res.status(400).json({ error: "Enter an amount, positive or negative (up to a trillion)" });
  const name = String(req.body?.username ?? "").trim().toLowerCase(), t = db.data.users.find((u) => u.username.toLowerCase() === name && !u.banned);
  if (!t) return void res.status(404).json({ error: "No active player with that callsign" });
  giveCoinsTo(me(req).username, amount, { type: "user", value: t.id }, String(req.body?.reason ?? "").slice(0, 60));
  broadcastMembers(); res.json({ ok: true, username: t.username, coins: t.coins });
});
api.post("/owner/xp", auth, coownerUp, (req, res) => {
  const amount = Math.round(Number(req.body?.amount));
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1_000_000_000) return void res.status(400).json({ error: "Enter an XP amount (any number except 0, negative takes XP back)" });
  const n = giveXpTo(me(req).username, amount, parseTarget(req.body?.target), String(req.body?.reason ?? "").slice(0, 60));
  broadcastMembers(); res.json({ ok: true, reached: n });
});
api.post("/owner/give", auth, panelUp, (req, res) => {
  const type = String(req.body?.type ?? "");
  if (type === "tag" && String(req.body?.id ?? "") === "og" && me(req).role !== "owner") return void res.status(403).json({ error: OG_MSG });
  if (type === "pack") { const t = targets(parseTarget(req.body?.target)); for (const u of t) u.freePacks += Math.max(1, Math.min(20, Number(req.body?.count) || 1)); saveDb(); audit(me(req).username, "give.pack", `${t.length} players`); return void res.json({ ok: true, reached: t.length }); }
  try { const n = giveItems(me(req).username, type, String(req.body?.id ?? ""), parseTarget(req.body?.target)); broadcastMembers(); res.json({ ok: true, reached: n }); } catch (e: any) { res.status(400).json({ error: e.message }); }
});
api.post("/owner/selfpack", auth, (req, res) => {
  const u = me(req);
  if (u.role !== "owner" && u.role !== "coowner") return void res.status(403).json({ error: "Owner and co-owners only" });
  try { const r = giveSelfWholePack(u, String(req.body?.pack ?? "")); broadcastMembers(); pushSelf(u.id); res.json({ ok: true, ...r }); } catch (e: any) { res.status(400).json({ error: e.message }); }
});
api.post("/owner/take", auth, ownerOnly, (req, res) => {
  try { const n = takeItems(me(req).username, String(req.body?.type ?? ""), String(req.body?.id ?? ""), parseTarget(req.body?.target)); broadcastMembers(); pushSelfAll(); res.json({ ok: true, reached: n }); } catch (e: any) { res.status(400).json({ error: e.message }); }
});
api.post("/owner/tags", auth, panelUp, (req, res) => {
  const name = String(req.body?.name ?? "").trim().slice(0, 24), color = /^#[0-9a-fA-F]{6}$/.test(String(req.body?.color)) ? String(req.body.color) : "#8b7bff";
  if (name.length < 2) return void res.status(400).json({ error: "Give the tag a name" });
  const tag = { id: "c-" + uid().slice(0, 8), name, color }; db.data.customTags.push(tag); saveDb(); audit(me(req).username, "tag.create", name); broadcastCustomTags(); res.json({ tag });
});
api.delete("/owner/tags/:id", auth, panelUp, (req, res) => {
  db.data.customTags = db.data.customTags.filter((t) => t.id !== req.params.id);
  for (const u of db.data.users) { u.inv.tags = u.inv.tags.filter((t) => t !== req.params.id); if (u.equip.tag === req.params.id) u.equip.tag = ""; }
  saveDb(); broadcastCustomTags(); broadcastMembers(); res.json({ ok: true });
});
api.post("/owner/event", auth, panelUp, (req, res) => {
  const user = me(req), b = req.body ?? {};
  if (!allow(`ownev:${user.id}`, 6, 30_000)) return void res.status(429).json({ error: "One at a time, commander" });
  const kind = String(b.kind ?? "");
  if (!/^(launch|eclipse|party|update|opening|halloween|levelup:([1-9]|1[0-4]))$/.test(kind)) return void res.status(400).json({ error: "Unknown cutscene" });
  const title = String(b.title ?? "").trim().slice(0, 60) || "LIFTOFF", sub = String(b.sub ?? "").trim().slice(0, 400);
  const reached = broadcastEvent({ kind, title, sub, by: user.username });
  audit(user.username, "event.cutscene", kind); res.json({ ok: true, reached });
});
api.post("/owner/live", auth, ownerOnly, (req, res) => {
  try {
    if (req.body?.action === "end") { const n = endLive(me(req).username); broadcastMembers(); return void res.json({ ok: true, rewarded: n }); }
    const b = req.body ?? {}; startLive(me(req).username, String(b.kind ?? ""), { schedule: b.schedule, loop: !!b.loop, cfg: b.cfg }); res.json({ ok: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
api.post("/owner/phase", auth, ownerOnly, (req, res) => {
  try { const a = String(req.body?.action), by = me(req).username; if (a === "skip") skipPhase(by); else if (a === "extend") extendPhase(by, Number(req.body?.mins) || 1); else if (a === "goto") gotoPhase(by, Number(req.body?.idx)); else throw new Error("Unknown action"); res.json({ ok: true }); } catch (e: any) { res.status(400).json({ error: e.message }); }
});
api.post("/owner/quick", auth, panelUp, (req, res) => {
  if (!allow(`quick:${me(req).id}`, 20, 30_000)) return void res.status(429).json({ error: "One at a time, commander" });
  try { res.json({ ok: true, note: quick(me(req).username, String(req.body?.kind ?? ""), req.body?.target) }); } catch (e: any) { res.status(400).json({ error: e.message }); }
});

/* ----- issue reports: anyone can send one, owner and co-owners read them ----- */
api.post("/reports", auth, (req, res) => {
  const user = me(req);
  if (!allow(`report:${user.id}`, 5, 10 * 60_000)) return void res.status(429).json({ error: "You've sent a few reports already, try again in a bit" });
  const text = String(req.body?.text ?? "").trim().slice(0, 1500);
  if (text.length < 5) return void res.status(400).json({ error: "Tell us a little more about the problem" });
  const kind = ["bug", "proxy", "chat", "idea", "other"].includes(String(req.body?.kind)) ? String(req.body.kind) : "other";
  const r = { id: uid(), userId: user.id, username: user.username, kind, text, page: String(req.body?.page ?? "").slice(0, 200), ts: Date.now(), status: "open" as const };
  db.data.reports.push(r);
  if (db.data.reports.length > 500) db.data.reports.splice(0, db.data.reports.length - 500);
  saveDb();
  notifyOwners({ t: "report", username: user.username, kind });
  res.json({ ok: true });
});
api.put("/owner/reports/:id", auth, coownerUp, (req, res) => {
  const r = db.data.reports.find((x) => x.id === req.params.id);
  if (!r) return void res.status(404).json({ error: "Report not found" });
  r.status = req.body?.status === "open" ? "open" : "done";
  saveDb();
  res.json({ ok: true });
});
api.delete("/owner/reports/:id", auth, coownerUp, (req, res) => {
  db.data.reports = db.data.reports.filter((x) => x.id !== req.params.id);
  saveDb();
  res.json({ ok: true });
});

/* ----- search ----- */
const isEngine = (v: unknown): v is EngineId => v === "ddg" || v === "brave" || v === "mojeek" || v === "google";
api.get("/search", auth, async (req, res) => {
  const user = me(req);
  if (!allow(`search:${user.id}`, 40, 60_000)) return void res.status(429).json({ error: "Searching too fast" });
  if (db.data.server.maintenance && user.role === "member") return void res.status(503).json({ error: db.data.server.maintenanceMessage || "The proxy is docked for maintenance." });
  const q = String(req.query.q ?? "").trim();
  if (!q) return void res.status(400).json({ error: "Type something to search for" });
  const engine = isEngine(req.query.engine) ? req.query.engine : user.settings.engine;
  const next = req.query.next ? String(req.query.next) : undefined;
  const nextEngine = isEngine(req.query.nextEngine) ? req.query.nextEngine : undefined;
  user.stats.requests++; activity(user, "search");
  res.json(await search(q, engine, next, nextEngine));
});
api.get("/suggest", auth, async (req, res) => {
  if (!allow(`sug:${me(req).id}`, 120, 60_000)) return void res.json({ suggestions: [] });
  res.json({ suggestions: await suggest(String(req.query.q ?? "")) });
});

api.post("/password", auth, async (req, res) => {
  const user = me(req);
  const { current, next } = req.body ?? {};
  if (typeof next !== "string" || next.length < 8) return void res.status(400).json({ error: "New password must be at least 8 characters" });
  if (!(await checkPassword(user, String(current ?? "")))) return void res.status(403).json({ error: "Current password is wrong" });
  Object.assign(user, await hashPassword(next));
  saveDb();
  res.json({ ok: true });
});

api.put("/account/username", auth, async (req, res) => {
  const user = me(req);
  const { username, password } = req.body ?? {};
  if (!validUsername(username)) return void res.status(400).json({ error: "Username must be 3–24 letters, numbers, . _ -" });
  if (!(await checkPassword(user, String(password ?? "")))) return void res.status(403).json({ error: "Password is wrong" });
  if (db.data.users.some((u) => u.id !== user.id && u.username.toLowerCase() === username.toLowerCase())) return void res.status(409).json({ error: "That callsign is taken" });
  const old = user.username;
  if (old === username) return void res.json({ user: publicUser(user) });
  user.username = username;
  for (const m of db.data.messages) { if (m.userId === user.id) m.username = username; if (m.replyTo?.username === old) m.replyTo.username = username; }
  audit(username, "account.rename", `${old} → ${username}`);
  saveDb();
  broadcastMembers();
  pushSelf(user.id);
  res.json({ user: publicUser(user) });
});

api.delete("/account", auth, async (req, res) => {
  const user = me(req);
  if (user.role === "owner") return void res.status(403).json({ error: "The owner can't delete their account. Transfer ownership first." });
  if (!(await checkPassword(user, String(req.body?.password ?? "")))) return void res.status(403).json({ error: "Password is wrong" });
  audit(user.username, "account.delete", "self-service");
  db.data.users = db.data.users.filter((u) => u.id !== user.id);
  saveDb();
  closeUserSockets(user.id, "Account deleted");
  broadcastMembers();
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

api.put("/settings", auth, (req, res) => {
  const s = me(req).settings;
  const b = req.body ?? {};
  const str = (v: unknown, max: number) => String(v ?? "").slice(0, max);
  if ("theme" in b && (BASE_THEMES.includes(b.theme) || me(req).inv.themes.includes(b.theme))) s.theme = b.theme;
  if ("engine" in b && isEngine(b.engine)) s.engine = b.engine;
  if ("bookmarksBar" in b) s.bookmarksBar = !!b.bookmarksBar;
  if ("chatSound" in b) s.chatSound = !!b.chatSound;
  if ("cloakTitle" in b) s.cloakTitle = str(b.cloakTitle, 80);
  if ("cloakIcon" in b) s.cloakIcon = str(b.cloakIcon, 20);
  if ("antiClose" in b) s.antiClose = !!b.antiClose;
  if ("skipCutscenes" in b) s.skipCutscenes = !!b.skipCutscenes;
  if ("panicKey" in b) s.panicKey = str(b.panicKey, 10);
  if ("panicUrl" in b) s.panicUrl = str(b.panicUrl, 500);
  saveDb();
  res.json({ settings: s satisfies Settings });
});

api.post("/bookmarks", auth, (req, res) => {
  const user = me(req);
  const url = String(req.body?.url ?? "").slice(0, 2000);
  if (!/^https?:\/\//i.test(url)) return void res.status(400).json({ error: "Invalid URL" });
  if (user.bookmarks.length >= 200) return void res.status(400).json({ error: "Bookmark limit reached" });
  if (user.bookmarks.some((b) => b.url === url)) return void res.json({ bookmark: user.bookmarks.find((b) => b.url === url) });
  const b = { id: uid(), title: String(req.body?.title || url).slice(0, 120), url };
  user.bookmarks.push(b);
  saveDb();
  res.json({ bookmark: b });
});
api.delete("/bookmarks/:id", auth, (req, res) => {
  const user = me(req);
  user.bookmarks = user.bookmarks.filter((b) => b.id !== req.params.id);
  saveDb();
  res.json({ ok: true });
});

api.get("/history", auth, (req, res) => res.json({ history: me(req).history }));
api.post("/history", auth, (req, res) => {
  const user = me(req);
  const url = String(req.body?.url ?? "").slice(0, 2000);
  if (!/^https?:\/\//i.test(url)) return void res.json({ ok: true });
  if (req.body?.via === "sj") {
    // Scramjet browses in the browser, so count the page view here (same rewards as the classic proxy).
    let host = "";
    try { host = new URL(url).hostname; } catch { /* checked above */ }
    if (host && !isBlocked(host)) {
      user.stats.requests++; accrueProxy(user); checkTrust(user); progress(user, "browse"); activity(user, "browse");
      record({ ts: Date.now(), user: user.username, method: "GET", host, path: "/", status: 200, bytes: 0, ms: 0 });
    }
  }
  const last = user.history[0];
  if (last && last.url === url) {
    last.title = String(req.body?.title ?? last.title).slice(0, 120);
  } else {
    user.history.unshift({ url, title: String(req.body?.title || url).slice(0, 120), ts: Date.now() });
    user.history = user.history.slice(0, 300);
  }
  saveDb();
  res.json({ ok: true });
});
api.delete("/history", auth, (req, res) => {
  me(req).history = [];
  saveDb();
  res.json({ ok: true });
});

/* ----- chat admin ----- */
api.post("/channels", auth, need("manage_channels"), (req, res) => {
  const name = String(req.body?.name ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
  if (!name) return void res.status(400).json({ error: "Invalid channel name" });
  if (db.data.channels.some((c) => c.id === name)) return void res.status(409).json({ error: "Channel exists" });
  db.data.channels.push({ id: name, name, topic: String(req.body?.topic ?? "").slice(0, 120), createdAt: Date.now(), ...(req.body?.voice ? { voice: true } : {}) });
  saveDb();
  logAdmin(req, "channel.create", `${req.body?.voice ? "voice " : "#"}${name}`);
  broadcastChannels();
  res.json({ ok: true });
});
api.put("/channels/:id/topic", auth, need("manage_channels"), (req, res) => {
  const c = db.data.channels.find((x) => x.id === req.params.id);
  if (!c) return void res.status(404).json({ error: "No such channel" });
  c.topic = String(req.body?.topic ?? "").slice(0, 120);
  saveDb();
  broadcastChannels();
  res.json({ ok: true });
});
api.delete("/channels/:id", auth, need("manage_channels"), (req, res) => {
  if (req.params.id === "general") return void res.status(400).json({ error: "Can't delete #general" });
  db.data.channels = db.data.channels.filter((c) => c.id !== req.params.id);
  db.data.messages = db.data.messages.filter((m) => m.channel !== req.params.id);
  saveDb();
  logAdmin(req, "channel.delete", `#${req.params.id}`);
  broadcastChannels();
  res.json({ ok: true });
});
api.delete("/messages/:id", auth, need("delete_messages"), (req, res) => res.json({ ok: deleteMessage(req.params.id) }));

/* ----- admin ----- */
const adminUsers = () =>
  db.data.users.map((u) => ({ id: u.id, username: u.username, role: u.role, roleId: u.roleId ?? null, rank: rank(u), createdAt: u.createdAt, lastSeen: u.lastSeen, banned: u.banned, requests: u.stats.requests, bytes: u.stats.bytes }));

api.get("/admin/overview", auth, (req, res) => {
  const u = me(req);
  if (!hasDashboard(u)) return void res.status(403).json({ error: "No dashboard access" });
  const dash = can(u, "view_dashboard"), crew = can(u, "manage_users") || can(u, "manage_roles");
  res.json({
    stats: dash ? snapshot(true) : null,
    users: dash || crew ? adminUsers() : [],
    invites: can(u, "manage_users") ? db.data.invites : [],
    blocklist: can(u, "manage_blocklist") || dash ? db.data.blocklist : [],
    server: db.data.server,
    announcement: db.data.announcement,
    audit: dash ? db.data.audit.slice(-120).reverse() : [],
    privateAllowed: ALLOW_PRIVATE,
    upstreamProxy: !!UPSTREAM_PROXY,
    proxyIsolated: !!proxyOriginFor(req),
    perms: effectivePerms(u), staff: isStaff(u), roles: publicRoles(),
  });
});

api.put("/admin/settings", auth, adminOnly, (req, res) => {
  const b = req.body ?? {};
  const s = db.data.server;
  const changes: string[] = [];
  if ("openRegistration" in b && !!b.openRegistration !== s.openRegistration) { s.openRegistration = !!b.openRegistration; changes.push(`openRegistration=${s.openRegistration}`); }
  if ("rateLimit" in b) {
    const n = Math.round(Number(b.rateLimit));
    if (!Number.isFinite(n) || n < 30 || n > 20000) return void res.status(400).json({ error: "Rate limit must be between 30 and 20,000 requests per minute" });
    if (n !== s.rateLimit) { s.rateLimit = n; changes.push(`rateLimit=${n}`); }
  }
  if ("defaultEngine" in b && isEngine(b.defaultEngine) && b.defaultEngine !== s.defaultEngine) { s.defaultEngine = b.defaultEngine; changes.push(`defaultEngine=${b.defaultEngine}`); }
  saveDb();
  if (changes.length) logAdmin(req, "settings.update", changes.join(", "));
  res.json({ server: s });
});

api.post("/admin/announcement", auth, need("announce"), (req, res) => {
  const text = String(req.body?.text ?? "").trim().slice(0, 300);
  if (!text) return void res.status(400).json({ error: "Write the announcement first" });
  db.data.announcement = { id: uid(), text, by: me(req).username, byTag: roleTag(me(req)), ts: Date.now() };
  saveDb();
  logAdmin(req, "announcement.post", text.slice(0, 80));
  broadcastAnnouncement();
  res.json({ announcement: db.data.announcement });
});
api.delete("/admin/announcement", auth, need("announce"), (req, res) => {
  db.data.announcement = null;
  saveDb();
  logAdmin(req, "announcement.clear");
  broadcastAnnouncement();
  res.json({ ok: true });
});

api.post("/admin/blocklist", auth, need("manage_blocklist"), (req, res) => {
  const host = String(req.body?.host ?? "").toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9.-]+$/.test(host) || !host.includes(".")) return void res.status(400).json({ error: "Enter a domain like example.com" });
  if (!db.data.blocklist.includes(host)) { db.data.blocklist.push(host); logAdmin(req, "block.add", host); }
  saveDb();
  res.json({ blocklist: db.data.blocklist });
});
api.delete("/admin/blocklist/:host", auth, need("manage_blocklist"), (req, res) => {
  db.data.blocklist = db.data.blocklist.filter((h) => h !== req.params.host);
  saveDb();
  logAdmin(req, "block.remove", req.params.host);
  res.json({ blocklist: db.data.blocklist });
});
api.post("/admin/invites", auth, need("manage_users"), (req, res) => {
  const code = "ARTEMIS-" + crypto.randomBytes(4).toString("hex").toUpperCase();
  db.data.invites.push({ code, createdBy: me(req).username, createdAt: Date.now() });
  saveDb();
  logAdmin(req, "invite.create", code);
  res.json({ code });
});
api.delete("/admin/invites/:code", auth, need("manage_users"), (req, res) => {
  db.data.invites = db.data.invites.filter((i) => i.code !== req.params.code);
  saveDb();
  logAdmin(req, "invite.revoke", req.params.code);
  res.json({ ok: true });
});

const targetUser = (req: Request, res: Response) => {
  const t = db.data.users.find((u) => u.id === req.params.id);
  if (!t) { res.status(404).json({ error: "No such user" }); return null; }
  if (t.id === me(req).id) { res.status(400).json({ error: "You can't do that to yourself" }); return null; }
  if (t.role === "owner") { res.status(403).json({ error: "The owner can't be changed" }); return null; }
  if (!outranks(me(req), t)) { res.status(403).json({ error: "You can only do that to people ranked below you" }); return null; }
  return t;
};
api.put("/admin/users/:id/role", auth, coownerUp, (req, res) => {
  const t = targetUser(req, res); if (!t) return;
  const to = req.body?.role === "coowner" ? "coowner" : req.body?.role === "admin" ? "admin" : "member";
  if (to === "coowner" && me(req).role !== "owner") return void res.status(403).json({ error: "Only the owner can name a co-owner" });
  t.role = to;
  if (t.role !== "member") delete t.roleId;
  saveDb();
  pushSelf(t.id);
  logAdmin(req, "user.role", `${t.username} → ${t.role}`);
  broadcastMembers();
  res.json({ ok: true });
});
api.post("/admin/users/:id/ban", auth, need("manage_users"), (req, res) => {
  const t = targetUser(req, res); if (!t) return;
  t.banned = !!req.body?.banned; if (t.banned) t.lastBanAt = Date.now();
  saveDb();
  if (t.banned) closeUserSockets(t.id, "Suspended");
  logAdmin(req, t.banned ? "user.ban" : "user.unban", t.username);
  broadcastMembers();
  res.json({ ok: true });
});
api.post("/admin/users/:id/reset-password", auth, need("manage_users"), async (req, res) => {
  const t = targetUser(req, res); if (!t) return;
  const temp = crypto.randomBytes(6).toString("base64url");
  Object.assign(t, await hashPassword(temp));
  saveDb();
  logAdmin(req, "user.reset-password", t.username);
  res.json({ password: temp });
});
api.delete("/admin/users/:id", auth, need("manage_users"), (req, res) => {
  const t = targetUser(req, res); if (!t) return;
  db.data.users = db.data.users.filter((u) => u.id !== t.id);
  saveDb();
  closeUserSockets(t.id);
  logAdmin(req, "user.remove", t.username);
  broadcastMembers();
  res.json({ ok: true });
});

/* ----- owner console ----- */
const ownerPassword = async (req: Request, res: Response) => {
  if (!(await checkPassword(me(req), String(req.body?.password ?? "")))) { res.status(403).json({ error: "Your password is wrong" }); return false; }
  return true;
};
/* ----- trust, launch window and the chatbot ----- */
api.get("/trust", auth, (req, res) => res.json(trustInfo(me(req))));
api.get("/owner/safety", auth, panelUp, (req, res) => {
  const bot = db.data.server.bot!;
  res.json({ storage: storageInfo(), exit: me(req).role === "owner" ? exitStatus() : null, launchAt: db.data.server.launchAt ?? 0, rules: TRUST, bot: { enabled: bot.enabled, action: bot.action, strikes: bot.strikes, words: bot.words, log: bot.log },
    users: db.data.users.filter((u) => !u.banned).map((u) => ({ id: u.id, username: u.username, role: u.role, roleId: u.roleId ?? null, ...trustInfo(u) })) });
});
api.get("/owner/backup", auth, ownerOnly, (req, res) => {
  if (!allow(`backup:${me(req).id}`, 10, 60 * 60_000)) return void res.status(429).json({ error: "Too many downloads. Try again later." });
  db.flush();
  logAdmin(req, "backup.download", "full data download");
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  res.setHeader("Content-Disposition", `attachment; filename="artemis-backup-${stamp}.json"`);
  res.setHeader("Cache-Control", "no-store");
  res.type("application/json").send(JSON.stringify(db.data));
});
api.post("/owner/launch", auth, panelUp, (req, res) => {
  const s = db.data.server; s.launchAt = req.body?.action === "stop" ? 0 : Date.now(); saveDb();
  logAdmin(req, "launch." + (s.launchAt ? "start" : "stop"), "OG title window"); res.json({ ok: true, launchAt: s.launchAt });
});
api.put("/owner/bot", auth, panelUp, (req, res) => {
  const b = req.body ?? {}, bot = db.data.server.bot!;
  if ("enabled" in b) bot.enabled = !!b.enabled;
  if (b.action === "ban" || b.action === "warn") bot.action = b.action;
  if ("strikes" in b) bot.strikes = Math.max(1, Math.min(10, Math.round(Number(b.strikes)) || 3));
  if (Array.isArray(b.words)) bot.words = [...new Set(b.words.map((w: unknown) => String(w).trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 100) as string[];
  saveDb(); logAdmin(req, "bot.config", `${bot.enabled ? "on" : "off"} · ${bot.action} · ${bot.strikes} strikes`);
  res.json({ ok: true, bot });
});
api.post("/owner/trust", auth, panelUp, (req, res) => {
  const t = db.data.users.find((u) => u.id === String(req.body?.id)); if (!t) return void res.status(404).json({ error: "No such player" });
  const mode = String(req.body?.mode); if (mode === "grant") t.trust = "grant"; else if (mode === "revoke") t.trust = "revoke"; else delete t.trust;
  saveDb(); logAdmin(req, "trust." + mode, t.username); checkTrust(t); pushSelf(t.id); res.json({ ok: true });
});
api.get("/owner/overview", auth, panelUp, (_req, res) => {
  const users = db.data.users;
  let dataBytes = 0;
  try { dataBytes = fs.statSync(path.join(process.env.ARTEMIS_DATA ?? path.resolve("data"), "artemis.json")).size; } catch { /* not yet flushed */ }
  res.json({
    counts: { owner: users.filter((u) => u.role === "owner").length, coowner: users.filter((u) => u.role === "coowner").length, admin: users.filter((u) => u.role === "admin").length, member: users.filter((u) => u.role === "member").length, banned: users.filter((u) => u.banned).length },
    messages: db.data.messages.length, channels: db.data.channels.length, invites: db.data.invites.length, auditEntries: db.data.audit.length,
    history: users.reduce((n, u) => n + u.history.length, 0), bookmarks: users.reduce((n, u) => n + u.bookmarks.length, 0),
    dataBytes, node: process.version, memoryMb: Math.round(process.memoryUsage().rss / 1048576), uptimeSec: Math.round(process.uptime()),
    reports: [...db.data.reports].reverse(),
    maintenance: db.data.server.maintenance, maintenanceMessage: db.data.server.maintenanceMessage,
    viewerRole: me(_req).role,
    coowners: users.filter((u) => u.role === "coowner").map((u) => ({ id: u.id, username: u.username, lastSeen: u.lastSeen })),
    commanders: users.filter((u) => u.role === "admin").map((u) => ({ id: u.id, username: u.username, lastSeen: u.lastSeen })),
    members: users.filter((u) => u.role === "member").map((u) => ({ id: u.id, username: u.username })),
  });
});
api.put("/owner/maintenance", auth, coownerUp, (req, res) => {
  const on = !!req.body?.on;
  db.data.server.maintenance = on;
  db.data.server.maintenanceMessage = String(req.body?.message ?? "").slice(0, 200);
  saveDb();
  logAdmin(req, on ? "maintenance.on" : "maintenance.off", db.data.server.maintenanceMessage);
  res.json({ maintenance: on });
});
api.post("/owner/signout-all", auth, ownerOnly, async (req, res) => {
  if (!(await ownerPassword(req, res))) return;
  db.data.secret = crypto.randomBytes(32).toString("hex");
  saveDb();
  logAdmin(req, "security.signout-all", "signing secret rotated");
  setSession(req, res, me(req));
  for (const u of db.data.users) if (u.id !== me(req).id) closeUserSockets(u.id, "Signed out");
  res.json({ ok: true });
});
api.post("/owner/wipe", auth, ownerOnly, async (req, res) => {
  if (!(await ownerPassword(req, res))) return;
  const what = String(req.body?.what ?? "");
  if (what === "chat") { db.data.messages = []; }
  else if (what === "history") { for (const u of db.data.users) u.history = []; }
  else if (what === "stats") { for (const u of db.data.users) u.stats = { requests: 0, bytes: 0 }; }
  else if (what === "audit") { db.data.audit = []; }
  else return void res.status(400).json({ error: "Unknown target" });
  saveDb();
  logAdmin(req, "owner.wipe", what);
  if (what === "chat") broadcastChannels();
  res.json({ ok: true });
});
api.get("/owner/export", auth, ownerOnly, (req, res) => {
  const { secret: _s, ...rest } = db.data;
  logAdmin(req, "owner.export", "full backup downloaded");
  res.setHeader("Content-Disposition", `attachment; filename="artemis-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.type("application/json").send(JSON.stringify(rest, null, 2));
});
api.post("/owner/transfer", auth, ownerOnly, async (req, res) => {
  if (!(await ownerPassword(req, res))) return;
  const t = db.data.users.find((u) => u.id === String(req.body?.userId));
  if (!t || t.banned || t.id === me(req).id) return void res.status(400).json({ error: "Pick another active crew member" });
  t.role = "owner"; me(req).role = "admin";
  saveDb();
  logAdmin(req, "owner.transfer", `${me(req).username} → ${t.username}`);
  broadcastMembers();
  res.json({ ok: true });
});

/* ----- update log: everyone reads, only the owner writes ----- */
const cleanUpdate = (b: any) => ({ title: String(b?.title ?? "").trim().slice(0, 120), body: String(b?.body ?? "").trim().slice(0, 4000) });
api.get("/updates", auth, (_req, res) => res.json({ updates: [...db.data.updates].sort((a, b) => b.ts - a.ts) }));
api.post("/updates", auth, ownerOnly, (req, res) => {
  const u = cleanUpdate(req.body);
  if (!u.title) return void res.status(400).json({ error: "Give the update a title" });
  const entry = { id: uid(), ts: Date.now(), by: me(req).username, ...u };
  db.data.updates.push(entry); saveDb(); res.json({ update: entry });
});
api.put("/updates/:id", auth, ownerOnly, (req, res) => {
  const e = db.data.updates.find((x) => x.id === req.params.id); if (!e) return void res.status(404).json({ error: "No such update" });
  const u = cleanUpdate(req.body); if (!u.title) return void res.status(400).json({ error: "Give the update a title" });
  Object.assign(e, u); saveDb(); res.json({ update: e });
});
api.delete("/updates/:id", auth, ownerOnly, (req, res) => {
  db.data.updates = db.data.updates.filter((x) => x.id !== req.params.id); saveDb(); res.json({ ok: true });
});

/* ----- profile ----- */
api.put("/profile", auth, (req, res) => {
  const u = me(req), b = req.body ?? {};
  if ("status" in b) u.profile.status = String(b.status ?? "").slice(0, 60);
  const txt = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
  if ("bio" in b) u.profile.bio = txt(b.bio, 200);
  if ("pronouns" in b) u.profile.pronouns = txt(b.pronouns, 20);
  if ("links" in b) u.profile.links = txt(b.links, 80);
  if ("accent" in b) u.profile.accent = /^#[0-9a-fA-F]{6}$/.test(String(b.accent)) ? String(b.accent) : "";
  if ("presence" in b && ["online", "idle", "dnd"].includes(b.presence)) u.profile.presence = b.presence;
  if ("avatar" in b) {
    const a = String(b.avatar ?? "");
    if (a && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(a) || a.length > 70_000)) return void res.status(400).json({ error: "That image is too large. Try a smaller one." });
    u.profile.avatar = a;
  }
  saveDb();
  broadcastMembers();
  res.json({ profile: u.profile });
});

/* ----- custom roles (owner defines, others may assign within rank) ----- */
const cleanPerms = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map(String))].filter((p): p is Perm => (PERMS as readonly string[]).includes(p)) : []);
const cleanColor = (v: unknown) => (/^#[0-9a-fA-F]{6}$/.test(String(v)) ? String(v) : "#8b7bff");
const afterRoleChange = () => { saveDb(); broadcastRoles(); broadcastMembers(); pushSelfAll(); };
api.post("/owner/roles", auth, coownerUp, (req, res) => {
  const name = String(req.body?.name ?? "").trim().slice(0, 24);
  if (!name) return void res.status(400).json({ error: "Give the role a name" });
  if (db.data.roles.length >= 20) return void res.status(400).json({ error: "Role limit reached" });
  if (db.data.roles.some((r) => r.name.toLowerCase() === name.toLowerCase())) return void res.status(409).json({ error: "A role with that name exists" });
  const role = { id: uid(), name, color: cleanColor(req.body?.color), position: 2 + db.data.roles.length, perms: cleanPerms(req.body?.perms) };
  db.data.roles.push(role);
  logAdmin(req, "role.create", name);
  afterRoleChange();
  res.json({ role });
});
api.put("/owner/roles/:id", auth, coownerUp, (req, res) => {
  const r = db.data.roles.find((x) => x.id === req.params.id);
  if (!r) return void res.status(404).json({ error: "No such role" });
  if ("name" in (req.body ?? {})) { const n = String(req.body.name).trim().slice(0, 24); if (n) r.name = n; }
  if ("color" in (req.body ?? {})) r.color = cleanColor(req.body.color);
  if ("perms" in (req.body ?? {})) r.perms = cleanPerms(req.body.perms);
  logAdmin(req, "role.update", r.name);
  afterRoleChange();
  res.json({ role: r });
});
api.post("/owner/roles/:id/move", auth, coownerUp, (req, res) => {
  const list = [...db.data.roles].sort((a, b) => a.position - b.position);
  const i = list.findIndex((x) => x.id === req.params.id);
  const j = i + (req.body?.dir === "up" ? -1 : 1);
  if (i < 0 || j < 0 || j >= list.length) return void res.json({ ok: true });
  [list[i], list[j]] = [list[j], list[i]];
  list.forEach((r, k) => (r.position = 2 + k));
  logAdmin(req, "role.reorder", list[j].name);
  afterRoleChange();
  res.json({ ok: true });
});
api.delete("/owner/roles/:id", auth, coownerUp, (req, res) => {
  const r = db.data.roles.find((x) => x.id === req.params.id);
  if (!r) return void res.status(404).json({ error: "No such role" });
  db.data.roles = db.data.roles.filter((x) => x.id !== r.id);
  [...db.data.roles].sort((a, b) => a.position - b.position).forEach((x, k) => (x.position = 2 + k));
  for (const u of db.data.users) if (u.roleId === r.id) delete u.roleId;
  logAdmin(req, "role.delete", r.name);
  afterRoleChange();
  res.json({ ok: true });
});
api.put("/admin/users/:id/custom-role", auth, need("manage_roles"), (req, res) => {
  const t = targetUser(req, res); if (!t) return;
  const roleId = req.body?.roleId ? String(req.body.roleId) : null;
  const role = roleId ? db.data.roles.find((r) => r.id === roleId) : null;
  if (roleId && !role) return void res.status(404).json({ error: "No such role" });
  if (role && me(req).role !== "owner" && roleRank(role) <= rank(me(req))) return void res.status(403).json({ error: "You can only hand out roles ranked below your own" });
  if (t.role === "admin" || t.role === "coowner") return void res.status(400).json({ error: "Commanders and co-owners don't use custom roles" });
  if (role) t.roleId = role.id; else delete t.roleId;
  saveDb();
  logAdmin(req, "user.role", `${t.username} → ${role?.name ?? "no role"}`);
  broadcastMembers(); pushSelf(t.id);
  res.json({ ok: true });
});

/* ----- admin terminal ----- */
api.post("/admin/command", auth, need("use_terminal"), async (req, res) => {
  const line = String(req.body?.line ?? "").slice(0, 600);
  const out = await runCommand(me(req), line);
  if (out.audit) logAdmin(req, "terminal", out.audit);
  res.json({ output: out.lines, ok: out.ok });
});

api.use((_req, res) => res.status(404).json({ error: "Not found" }));

/* Restore a backup. It lives outside the API router because backups are far bigger than the normal 100 KB limit.
   Only the owner can do this. The file is checked, the current data is copied aside, and the restored data is loaded live, with no restart. */
app.post("/api/owner/restore", express.json({ limit: "80mb" }), (req, res) => {
  const origin = req.get("origin");
  let okOrigin = false;
  try { okOrigin = !!origin && new URL(origin).host === req.get("host"); } catch { /* bad origin */ }
  if (!okOrigin) return void res.status(403).json({ error: "Bad origin" });
  const user = userFromRequest(req);
  if (!user || user.role !== "owner") return void res.status(403).json({ error: "Owner only" });
  if (!allow(`restore:${user.id}`, 4, 60 * 60_000)) return void res.status(429).json({ error: "Too many restores. Try again later." });
  const b = req.body as any;
  const good = b && typeof b === "object" && Array.isArray(b.users) && b.users.length > 0 && b.users.every((u: any) => u && typeof u.id === "string" && typeof u.username === "string" && typeof u.hash === "string") &&
    Array.isArray(b.channels) && Array.isArray(b.messages) && typeof b.secret === "string" && b.secret.length >= 16 && b.users.some((u: any) => u.role === "owner");
  if (!good) return void res.status(400).json({ error: "That does not look like an Artemis backup file." });
  try {
    db.flush();
    const bdir = path.join(path.dirname(db.path), "backups");
    fs.mkdirSync(bdir, { recursive: true });
    if (fs.existsSync(db.path)) fs.copyFileSync(db.path, path.join(bdir, `before-restore-${Date.now()}.json`));
    db.replace(b);
    migrate();
    db.flush();
  } catch (e: any) {
    return void res.status(500).json({ error: "Could not apply the backup: " + (e?.message ?? e) });
  }
  console.log(`[artemis] data restored from a backup by ${user.username}; loaded live`);
  const me2 = db.data.users.find((x) => x.id === user.id) ?? db.data.users.find((x) => x.role === "owner");
  if (me2) setSession(req, res, me2);
  closeAllSockets("Data restored");
  res.json({ ok: true, users: b.users.length, messages: b.messages.length });
});

app.use("/api", api);

/* ---------------- static UI ---------------- */
app.use(express.static(path.resolve("public"), { index: "index.html", maxAge: 0 }));

/* ---------------- boot ---------------- */
const server = http.createServer(app);
const localCloud = attachCloud({ check: (t) => checkExitToken(localCloudKey(), t), banned: () => new Set(db.data.users.filter((u) => u.banned).map((u) => u.id)), maintenance: () => db.data.server.maintenance, blocked: () => db.data.blocklist });
server.on("upgrade", (req, socket, head) => {
  if ((req.url ?? "").startsWith("/cb/")) return localCloud(req, socket, head);
  if ((req.url ?? "").startsWith("/pws/")) return handleProxyWsUpgrade(req, socket, head);
  if (isWispPath(req.url)) return handleWispUpgrade(req, socket, head);
  handleChatUpgrade(req, socket, head, (host) => hostRole(host) !== "proxy");
});
setInterval(() => {
  if (hasAdminSubscribers()) pushToAdmins({ t: "stats", stats: snapshot(true), users: adminUsers() });
}, 2000).unref();

/* Seed the owner from the environment (OWNER_PASSWORD) so the password stays out of the code. */
if (OWNER_PASSWORD.length >= 8 && !db.data.users.some((u) => u.role === "owner" || u.username.toLowerCase() === OWNER_USERNAME.toLowerCase())) {
  const { salt, hash } = await hashPassword(OWNER_PASSWORD);
  db.data.users.push({ id: uid(), username: OWNER_USERNAME, salt, hash, role: "owner", createdAt: Date.now(), lastSeen: Date.now(), banned: false, stats: { requests: 0, bytes: 0 }, bookmarks: [], history: [], settings: defaultSettings(db.data.server.defaultEngine), profile: { status: "", presence: "online", avatar: "" }, game: newGame(), ...newEconomy() });
  saveDb();
  console.log(`Owner account "${OWNER_USERNAME}" created from OWNER_PASSWORD.`);
}
resumeDirector();
server.listen(PORT, HOST, () => {
  console.log(`\n  ☾  Project Artemis is on the pad  →  http://localhost:${PORT}`);
  if (PROXY_ORIGIN) console.log(`  proxied sites are isolated on ${PROXY_ORIGIN}`);
  else console.log(`  tip: set PROXY_ORIGIN to a separate origin in production so proxied sites can't touch your session`);
  if (ALLOW_PRIVATE) console.log("  ⚠ ARTEMIS_ALLOW_PRIVATE=1: proxy may reach private networks");
  if (UPSTREAM_PROXY) console.log("  outbound traffic goes through ARTEMIS_UPSTREAM_PROXY");
  console.log("");
});
