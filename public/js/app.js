/* Project Artemis — bootstrap, auth, shell, command palette. */
import { playIntro } from "./intro.js";
import { $, $$, api, byLine, esc, hasDash, hasOwnerPanel, icon, isCoOwnerUp, on, emit, overlay, state, toast } from "./util.js";
import { buildBrowser, newTab, openOmni, openUrl, startTokenRefresh, interpret } from "./browser.js";
import { buildSocial } from "./social.js";
import { buildChat, connectChat, initAnnouncementUi, onChatShown, openChannel } from "./chat.js";
import { buildAdmin, onAdminShown } from "./admin.js";
import { buildOwner, onOwnerShown } from "./owner.js";
import { buildHub, onHubShown } from "./hub.js";
import { buildTube, onTubeShown } from "./youtube.js";
import { buildArcade, onArcadeLeft, onArcadeShown } from "./arcade.js";
import { playEvent } from "./event.js";
import { initFx } from "./fx.js";
import { initSpooky } from "./spooky.js";
import { maybeTour, rulesHtml } from "./tour.js";
import { initBanners } from "./banners.js";
import { initArena } from "./arena.js";
import { initParty } from "./party.js";
import { buildShop, onShopShown } from "./shop.js";
import { openReport } from "./report.js";
import { buildUpdates, checkUpdatesDot, onUpdatesShown } from "./updates.js";
import { applySettings, buildSettings, panicCheck, saveSettings, THEMES } from "./settings.js";

/* broken images hide themselves (inline handlers are blocked by CSP) */
document.addEventListener("error", (e) => {
  const t = e.target; if (t?.tagName !== "IMG" || !t.hasAttribute("data-hide")) return;
  /* chat pictures get two quiet retries (the server may be busy) before they give up; if one fails for good, a hidden link shows again */
  const n = +(t.dataset.try || 0);
  if (t.closest(".embed") && n < 2) { t.dataset.try = String(n + 1); const base = t.getAttribute("src").replace(/&r=\d+$/, ""); setTimeout(() => { if (t.isConnected) t.src = base + "&r=" + (n + 1); }, 700 * (n + 1) + Math.random() * 500); return; }
  t.closest(".body")?.querySelector(".linkhid")?.classList.remove("linkhid");
  t.remove();
}, true);

/* ------------------------------ ambient starfield: 3 parallax layers, twinkle, shooting stars ------------------------------ */
(function ambient() {
  const c = $("#stars"), ctx = c.getContext("2d");
  let w, h, layers, dpr;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tints = ["#ffffff", "#cfe0ff", "#ffe9c9", "#d8c9ff"];
  const init = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = c.width = innerWidth * dpr; h = c.height = innerHeight * dpr;
    const area = innerWidth * innerHeight;
    layers = [[area / 4200, 0.35, 0.02], [area / 9000, 0.8, 0.05], [area / 26000, 1.5, 0.11]].map(([n, size, speed]) => ({
      speed, stars: Array.from({ length: Math.round(n) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: size * (0.6 + Math.random() * 0.9) * dpr, p: Math.random() * 6.28, tw: 0.5 + Math.random() * 1.8, c: tints[(Math.random() * tints.length) | 0] })),
    }));
  };
  init(); addEventListener("resize", init);
  const shooters = [];
  let nextShot = 2500, last = 0;
  (function loop(t) {
    if (t - last > 33) {
      const dt = Math.min(64, t - last) / 16; last = t;
      ctx.clearRect(0, 0, w, h);
      for (const L of layers) for (const s of L.stars) {
        if (!reduce) { s.y += L.speed * dt * dpr; s.x -= L.speed * 0.4 * dt * dpr; if (s.y > h) { s.y = 0; s.x = Math.random() * w; } if (s.x < 0) s.x = w; }
        const a = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t / 700 * s.tw + s.p));
        ctx.globalAlpha = a; ctx.fillStyle = s.c;
        if (s.r > 1.6 * dpr) { ctx.fillRect(s.x - s.r * 1.8, s.y - 0.3 * dpr, s.r * 3.6, 0.6 * dpr); ctx.fillRect(s.x - 0.3 * dpr, s.y - s.r * 1.8, 0.6 * dpr, s.r * 3.6); }
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
      }
      if (!reduce && t > nextShot) {
        nextShot = t + 4000 + Math.random() * 7000;
        const ang = Math.PI * (0.62 + Math.random() * 0.14);
        shooters.push({ x: Math.random() * w * 0.9 + w * 0.1, y: Math.random() * h * 0.4, vx: Math.cos(ang) * 14 * dpr, vy: Math.sin(ang) * 14 * dpr, life: 1 });
      }
      for (let i = shooters.length - 1; i >= 0; i--) {
        const s = shooters[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= 0.018 * dt;
        if (s.life <= 0) { shooters.splice(i, 1); continue; }
        const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 9, s.y - s.vy * 9);
        g.addColorStop(0, `rgba(255,255,255,${s.life})`); g.addColorStop(1, "rgba(160,190,255,0)");
        ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = 1.6 * dpr; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 9, s.y - s.vy * 9); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    requestAnimationFrame(loop);
  })(0);
})();

/* ------------------------------ intro + boot ------------------------------ */
function runIntro(sound, quick) {
  return new Promise((resolve) => {
    const el = $("#intro"), title = $("#introTitle");
    el.classList.remove("hidden", "fade"); title.classList.remove("on", "sub"); $("#hud").classList.remove("dim");
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(guard); el.classList.add("fade"); setTimeout(() => { el.classList.add("hidden"); resolve(); }, 900); };
    const guard = setTimeout(finish, 22000); /* never leave anyone stuck on a black screen */
    try { const old = $("#introCanvas"), fresh = old.cloneNode(false); old.replaceWith(fresh); /* a fresh canvas each time, so a used WebGL context never blocks the 2D fallback */
    const skip = playIntro({ canvas: fresh, hud: $("#hud"), title, sound, startAt: quick ? 6.5 : 0, onDone: finish }); const sb = $("#intro .skip"); sb.onclick = (e) => { e.stopPropagation(); (typeof skip === "function" ? skip : finish)(); finish(); }; } catch (e) { console.warn("[intro] failed, skipping", e); finish(); }
  });
}
let introSound = true;
function gate() {
  return new Promise((resolve) => {
    const g = $("#gate"); g.classList.remove("hidden");
    $("#launchBtn").onclick = async () => { const snd = introSound = $("#gateSound").checked; g.classList.add("hidden"); await runIntro(snd); resolve(); };
    $("#gateSkip").onclick = () => { g.classList.add("hidden"); resolve(); };
    $("#launchBtn").focus();
  });
}
const seen = () => { try { return sessionStorage.getItem("artemis-intro") === "1"; } catch { return false; } };
const markSeen = () => { try { sessionStorage.setItem("artemis-intro", "1"); } catch { /* ignore */ } };

async function boot() {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.addEventListener("error", (e) => { if (!document.querySelector("#app:not(.hidden), #auth:not(.hidden), #gate:not(.hidden), #intro:not(.hidden)")) { $("#auth").classList.remove("hidden"); $("#authError").textContent = "Something went wrong loading the app: " + (e.message || "unknown error"); } });
  const meP = api("/me").catch(() => null);
  const cfgP = api("/config").catch(() => ({ firstRun: false }));
  if (!reduce && !seen()) { markSeen(); await gate(); }
  const me = await meP;
  if (me) enterApp(me); else showAuth(await cfgP);
}

/* ------------------------------ auth ------------------------------ */
let authMode = "login", authCfg = {};
function showAuth(cfg) {
  authCfg = cfg;
  $("#app").classList.add("hidden"); $("#auth").classList.remove("hidden");
  $("#firstRun").classList.toggle("hidden", !cfg.firstRun);
  const ann = $("#authAnn"); ann.classList.toggle("hidden", !cfg.announcement); if (cfg.announcement) ann.innerHTML = `<b>Announcement</b><span></span>`, ann.querySelector("span").innerHTML = `${esc(cfg.announcement.text)} <span class="a-by">— ${byLine(cfg.announcement)}</span>`;
  if (cfg.ownerName) $("#ownerName").textContent = cfg.ownerName;
  if (cfg.firstRun) { setAuthMode("register"); $("#authForm [name=username]").value = cfg.ownerName ?? ""; } else setAuthMode("login");
  $("#authForm [name=username]").focus();
}
function setAuthMode(mode) {
  authMode = mode;
  $$(".seg button").forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
  const first = !$("#firstRun").classList.contains("hidden");
  $("#inviteField").classList.toggle("hidden", mode !== "register" || first || !!authCfg.openRegistration);
  $("#openNote").classList.toggle("hidden", mode !== "register" || first || !authCfg.openRegistration);
  { const has = mode === "register" && !!(authCfg.rules ?? "").trim(); $("#rulesField").classList.toggle("hidden", !has); if (has) $("#rulesBox").innerHTML = rulesHtml(authCfg.rules); }
  $("#authForm [name=password]").minLength = mode === "register" ? 8 : 1;
  $("#authForm [name=password]").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("#authForm button[type=submit]").textContent = mode === "login" ? "Begin mission" : "Join the crew";
  $("#authError").textContent = "";
}
$$(".seg button").forEach((b) => b.addEventListener("click", () => setAuthMode(b.dataset.mode)));
$("#authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target), btn = e.target.querySelector("[type=submit]");
  btn.disabled = true;
  try {
    if (authMode === "register" && (authCfg.rules ?? "").trim() && f.get("agree") !== "on") throw new Error("Please read the rules and tick the box to agree");
    await api(authMode === "login" ? "/login" : "/register", "POST", { username: f.get("username"), password: f.get("password"), invite: f.get("invite"), remember: f.get("remember") === "on", agreeRules: f.get("agree") === "on" });
    const meData = await api("/me");
    /* no cutscene after signing in: straight into the app */
    $("#auth").classList.add("hidden");
    enterApp(meData);
  } catch (err) { $("#authError").textContent = err.message; } finally { btn.disabled = false; }
});
$("#replayIntro").addEventListener("click", async () => { $("#auth").classList.add("hidden"); await runIntro(true); $("#auth").classList.remove("hidden"); });

/* ------------------------------ shell ------------------------------ */
let started = false;
function enterApp(me) {
  Object.assign(state, { perms: me.perms ?? [], roles: me.roles ?? [], permInfo: me.permInfo ?? {}, me: me.user, proxyOrigin: me.proxyOrigin, sjOrigin: me.sjOrigin ?? "", exitUrl: me.exitUrl ?? "", exitToken: me.exitToken ?? "", storageWarn: !!me.storageWarn, proxyToken: me.proxyToken, bookmarks: me.bookmarks, channels: me.channels, engines: me.engines, announcement: me.announcement });
  if (state.storageWarn) setTimeout(() => toast("This server has no permanent disk, so updates erase your data. Download a backup in Owner console, Safety.", true), 3500);
  $("#auth").classList.add("hidden"); $("#app").classList.remove("hidden");
  syncRail();
  applySettings();
  if (started) return;
  started = true;
  const LABELS = { browse: "Browse", chat: "Chat", hub: "Hub", tube: "Tube", arcade: "Arcade", packs: "Packs", updates: "Update log", admin: "Mission control", owner: "Owner console", settings: "Settings" };
  $$("#rail button[data-view]").forEach((b) => { b.insertAdjacentHTML("afterbegin", icon(b.dataset.view)); b.insertAdjacentHTML("beforeend", `<span class="lbl">${LABELS[b.dataset.view]}</span>`); b.addEventListener("click", () => showView(b.dataset.view)); });
  { const rb = $("#reportBtn"); rb.insertAdjacentHTML("afterbegin", icon("flag")); rb.insertAdjacentHTML("beforeend", `<span class="lbl">Report issue</span>`); rb.addEventListener("click", openReport); }
  initSidebar();
  buildBrowser(); buildChat(); buildSocial(); buildHub(); buildTube(); buildArcade(); buildShop(); buildSettings(); buildUpdates(); buildAdmin();
  buildOwner();
  initAnnouncementUi(); connectChat(); startTokenRefresh(); checkUpdatesDot();
  on("view", showView);
  maybeTour();
  on("event", playEvent);
  initFx(); initSpooky(); initParty(); initBanners(); initArena();
  on("self", () => { syncRail(); applySettings(); if (state.view === "admin" && !hasDash()) showView("browse"); if (state.view === "owner" && !hasOwnerPanel(state.me)) showView("browse"); });
  on("key", panicCheck);
  on("settings", () => { const s = $("#setEngine"); if (s) s.value = state.me.settings.engine; });
  showView("browse");
}
/* Resizable, collapsible sidebar. Width is remembered per browser. */
const RAIL_MIN = 78, RAIL_MAX = 340, RAIL_DEFAULT = 224;
function initSidebar() {
  const app = $("#app"), grip = $("#railGrip"), toggle = $("#railToggle");
  toggle.innerHTML = icon("back");
  let w = RAIL_DEFAULT;
  if (innerWidth < 1000) w = RAIL_MIN; /* small windows start with the slim icon sidebar */
  try { const v = Number(localStorage.getItem("artemis-rail")); if (v >= RAIL_MIN && v <= RAIL_MAX) w = v; } catch { /* storage unavailable */ }
  const apply = (n, save) => {
    w = Math.max(RAIL_MIN, Math.min(RAIL_MAX, Math.round(n)));
    app.style.setProperty("--rail-w", w + "px");
    const small = w < 140;
    app.classList.toggle("rail-collapsed", small);
    toggle.title = toggle.ariaLabel = small ? "Expand sidebar" : "Collapse sidebar";
    if (save) try { localStorage.setItem("artemis-rail", String(w)); } catch { /* ignore */ }
  };
  apply(w, false);
  grip.addEventListener("pointerdown", (e) => {
    e.preventDefault(); grip.setPointerCapture(e.pointerId); app.classList.add("rail-dragging");
    const left = $("#rail").getBoundingClientRect().left;
    const move = (ev) => apply(ev.clientX - left + 6, false);
    const up = () => { grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); app.classList.remove("rail-dragging"); apply(w, true); };
    grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up);
  });
  const flip = () => apply(w < 140 ? RAIL_DEFAULT : RAIL_MIN, true);
  grip.addEventListener("dblclick", flip); toggle.addEventListener("click", flip);
  grip.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); apply(w + (e.key === "ArrowRight" ? 16 : -16), true); } });
}
function syncRail() {
  $$(".admin-only").forEach((b) => b.classList.toggle("hidden", !hasDash()));
  $$(".owner-only").forEach((b) => b.classList.toggle("hidden", !hasOwnerPanel(state.me)));
}
export function showView(name) {
  if (name === "admin" && !hasDash()) return;
  if (name === "owner" && !hasOwnerPanel(state.me)) return;
  const prev = state.view;
  state.view = name;
  $$("#rail button[data-view]").forEach((b) => b.classList.toggle("on", b.dataset.view === name));
  $$(".view").forEach((v) => v.classList.toggle("on", v.id === "view-" + name));
  if (name === "chat") onChatShown();
  if (name === "admin") onAdminShown(true); else if (prev === "admin") onAdminShown(false);
  if (name === "owner") onOwnerShown();
  if (name === "updates") onUpdatesShown();
  if (name === "hub") onHubShown();
  if (name === "tube") onTubeShown();
  if (name === "packs") onShopShown();
  if (prev === "arcade" && name !== "arcade") onArcadeLeft();
  if (name === "arcade") onArcadeShown();
}
document.addEventListener("keydown", (e) => {
  panicCheck(e.key);
  if (!state.me) return;
  if (e.altKey && /^[1-9]$/.test(e.key)) { e.preventDefault(); showView(["browse", "chat", "updates", "admin", "owner", "settings", "hub", "arcade", "packs"][+e.key - 1]); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette(); }
});

/* ------------------------------ command palette ------------------------------ */
function palette() {
  if ($(".palette")) return;
  const o = overlay(`<div class="palette glass" role="dialog" aria-label="Command palette"><input placeholder="Search, open a site, jump to a channel, switch theme…" aria-label="Command"><div class="plist"></div></div>`, { center: false });
  const input = o.querySelector("input"), list = o.querySelector(".plist");
  const base = [
    ...[["browse", "Go to Browse"], ["chat", "Go to Chat"], ["hub", "Go to Hub"], ["arcade", "Play the Arcade"], ["packs", "Open packs"], ["updates", "Go to Update log"], ...(hasDash() ? [["admin", "Go to Mission control"]] : []), ...(isCoOwnerUp(state.me) ? [["owner", "Go to Owner console"]] : []), ["settings", "Go to Settings"]].map(([v, l]) => ({ l, h: "Navigate", run: () => showView(v) })),
    { l: "New tab", h: "Browser", run: () => { showView("browse"); newTab(); } },
    ...state.channels.map((c) => ({ l: `#${c.name}`, h: "Channel", run: () => openChannel(c.id) })),
    ...state.bookmarks.map((b) => ({ l: b.title, h: b.url, run: () => openUrl(b.url) })),
    ...THEMES.map(([id, n]) => ({ l: `Theme: ${n}`, h: "Appearance", run: () => saveSettings({ theme: id }) })),
    ...state.engines.map((e) => ({ l: `Search with ${e.name}`, h: "Default engine", run: () => { saveSettings({ engine: e.id }); toast(`Default engine: ${e.name}`, "ok"); } })),
    { l: "Sign out", h: "Account", run: async () => { await api("/logout", "POST", {}).catch(() => {}); (window.onbeforeunload = null, location.reload()); } },
  ];
  let items = [], sel = 0;
  const paint = () => {
    const q = input.value.trim(), lq = q.toLowerCase();
    items = base.filter((b) => !lq || (b.l + " " + b.h).toLowerCase().includes(lq)).slice(0, 8);
    if (q) {
      const r = interpret(q);
      const web = r.kind === "page" ? { l: `Open ${r.url}`, h: "Go", run: () => { showView("browse"); openOmni(q); } } : { l: `Search the web for “${q}”`, h: "Search", run: () => { showView("browse"); openOmni(q); } };
      if (r.kind === "page" || !items.length) items.unshift(web); else items.push(web);
    }
    sel = Math.min(sel, Math.max(0, items.length - 1));
    list.innerHTML = items.map((it, i) => `<button class="${i === sel ? "sel" : ""}" data-i="${i}"><span>${esc(it.l)}</span><small>${esc(it.h)}</small></button>`).join("") || `<p class="note" style="padding:14px">No matches.</p>`;
  };
  const close = () => { o.remove(); removeEventListener("keydown", key, true); };
  const exec = (i) => { const it = items[i]; close(); it?.run(); };
  const key = (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % items.length; paint(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel - 1 + items.length) % items.length; paint(); }
    else if (e.key === "Enter") { e.preventDefault(); exec(sel); }
  };
  addEventListener("keydown", key, true);
  input.addEventListener("input", () => { sel = 0; paint(); });
  o.addEventListener("click", (e) => { if (e.target === o) close(); const b = e.target.closest("[data-i]"); if (b) exec(+b.dataset.i); });
  paint(); input.focus();
}

boot();
