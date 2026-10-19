/* Artemis Tube: YouTube through public Invidious servers.
   Full site (default): the chosen server's own website, opened through the Artemis proxy, so it works even when the server's JSON API is switched off.
   Grid: Artemis draws the video list itself from the server's API (only works where the API is on). */
import { $, api, esc, state, toast } from "./util.js";
import { sjSrc } from "./browser.js";

const pref = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
const PROXY_VIDEOS = "PREFS=" + encodeURIComponent(JSON.stringify({ local: true })) + "; path=/; max-age=31536000"; /* Invidious: "proxy videos" on, so the server (not YouTube) sends the video */
let mode = pref("artemis.ytmode", "site"), tab = "popular", q = "", backends = [], watching = null, busy = 0;
const thumb = (id) => `/api/img?u=${encodeURIComponent(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`)}`;
const dur = (s) => { if (!s) return "LIVE"; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };
const num = (n) => n >= 1e9 ? (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(n);
/** The server in use: your pick, else the first one that answered, else the first on the list. */
const bsel = () => { const n = parseInt(pref("artemis.ytb", "-1"), 10); if (Number.isInteger(n) && n >= 0 && n < backends.length) return n; const up = backends.find((b) => b.ok); return up ? up.i : 0; };
const baseOf = () => backends[bsel()]?.base ?? "";

export function buildTube() {
  $("#view-tube").innerHTML = `<div id="tube">
    <header class="tu-head"><a class="tu-brand" href="#" data-home>ARTEMIS TUBE</a>
      <form class="tu-search" data-search><input name="q" placeholder="search" autocomplete="off" spellcheck="false" aria-label="Search videos"><button aria-label="Search">⌕</button></form>
      <span class="tu-mode"><button data-mode="site">Full site</button><button data-mode="grid">Grid</button></span></header>
    <div class="tu-back" id="tuBack"></div>
    <nav class="tu-tabs" id="tuTabs"><button data-tab="popular">POPULAR</button><button data-tab="trending">TRENDING</button></nav>
    <p class="tu-note" id="tuNote"></p>
    <div id="tuBody" class="tu-grid"></div></div>`;
  const root = $("#tube");
  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab],[data-home],[data-b],[data-v],[data-recheck],[data-stop],[data-mode]"); if (!t) return;
    if (t.matches("[data-home]")) { e.preventDefault(); q = ""; watching = null; root.querySelector("[data-search] input").value = ""; return void show(); }
    if (t.dataset.mode) { mode = t.dataset.mode; setPref("artemis.ytmode", mode); watching = null; return void show(); }
    if (t.dataset.tab) { tab = t.dataset.tab; q = ""; watching = null; return void show(); }
    if (t.dataset.b !== undefined) { setPref("artemis.ytb", t.dataset.b); return void (watching && mode === "grid" ? watch(watching.id) : show()); }
    if (t.dataset.v) { e.preventDefault(); return void watch(t.dataset.v); }
    if (t.matches("[data-recheck]")) return void recheck();
    if (t.matches("[data-stop]")) { watching = null; return void show(); }
  });
  root.querySelector("[data-search]").addEventListener("submit", (e) => { e.preventDefault(); q = new FormData(e.target).get("q").toString().trim(); watching = null; show(); });
}
export async function onTubeShown() {
  if ($("#tuBody")?.dataset.ready) return;
  $("#tuBody").dataset.ready = "1";
  try { backends = (await api("/yt/backends")).backends; } catch { backends = []; }
  show(); recheck(true);
}

function paintBack() {
  const sel = bsel();
  $("#tuBack").innerHTML = `<b>Switch backend:</b> ` + backends.map((b) => `<button class="${b.i === sel ? "sel" : ""}" data-b="${b.i}" title="${esc(b.host)}${b.ok === null ? " · not checked yet" : b.ok ? " · " + b.ms + " ms" : " · not answering"}${mode === "grid" ? (b.api === false ? " · list API is off" : "") : ""}">${b.name}<i class="${b.ok === true ? "up" : b.ok === false ? "down" : ""}"></i></button>`).join("") + `<button data-recheck class="re" title="Check which servers are up">↻ check</button>`;
  $("#tube").querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
}
function paintTabs() { $("#tuTabs").classList.toggle("hidden", mode !== "grid" || !!q || !!watching); $("#tuTabs").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab && !q)); }
async function recheck(quiet) {
  if (!quiet) $("#tuNote").textContent = "Checking the servers…";
  try {
    const before = bsel(); const r = await api("/yt/backends/check", "POST", {}); backends = r.backends; paintBack();
    if (!quiet) $("#tuNote").textContent = "";
    if (mode === "site" && !pref("artemis.ytb", "") && bsel() !== before) show(); /* no pick of your own: move to the server that answered */
  } catch (e) { if (!quiet) toast(e.message, true); $("#tuNote").textContent = ""; }
}
const cardHtml = (v) => `<a class="tu-card" href="#" data-v="${esc(v.id)}"><span class="tu-th"><img src="${thumb(v.id)}" alt="" loading="lazy"><em>${dur(v.seconds)}</em></span><b class="tu-t">${esc(v.title)}</b><span class="tu-a">${esc(v.author)}</span><span class="tu-m"><span>${v.published ? "Shared " + esc(v.published) : ""}</span><span>${num(v.views)} views</span></span></a>`;

async function ensureToken() {
  if (state.proxyToken) return;
  try { const t = await api("/proxy-token"); state.proxyToken = t.proxyToken; state.proxyOrigin = t.proxyOrigin; state.sjOrigin = t.sjOrigin ?? ""; state.exitUrl = t.exitUrl ?? ""; state.exitToken = t.exitToken ?? ""; } catch { /* the player will say so */ }
}
const siteSrc = (url) => sjSrc(url) + "&pc=" + encodeURIComponent(PROXY_VIDEOS);

function show() { return mode === "site" ? showSite() : load(); }

/* ---- Full site: the server's own website in the proxy ---- */
async function showSite() {
  const id = ++busy, body = $("#tuBody"); body.dataset.ready = "1"; body.className = "tu-site"; paintBack(); paintTabs();
  const base = baseOf();
  if (!base) { body.innerHTML = `<p class="tu-msg">No video servers are set up.</p>`; return; }
  await ensureToken(); if (id !== busy) return;
  const url = q ? `${base}/search?q=${encodeURIComponent(q)}` : `${base}/feed/popular`;
  $("#tuNote").textContent = `Showing ${backends[bsel()].host} through the Artemis proxy. If it is blank or says an error, pick a different backend above (green means it answered).`;
  body.innerHTML = `<iframe class="tu-frame" src="${esc(siteSrc(url))}" allow="fullscreen; autoplay; encrypted-media; picture-in-picture; clipboard-write" allowfullscreen title="Videos"></iframe>`;
}

/* ---- Grid: Artemis draws the list from the server's API ---- */
async function load() {
  const id = ++busy, body = $("#tuBody"); body.dataset.ready = "1"; body.className = "tu-grid";
  paintBack(); paintTabs(); $("#tuNote").textContent = "";
  body.innerHTML = `<p class="tu-msg">Loading…</p>`;
  try {
    const r = await api(q ? `/yt/search?q=${encodeURIComponent(q)}&b=${bsel()}` : `/yt/list?tab=${tab}&b=${bsel()}`);
    if (id !== busy) return;
    backends = r.backends; paintBack();
    body.innerHTML = r.videos.length ? r.videos.map(cardHtml).join("") : `<p class="tu-msg">Nothing found.</p>`;
  } catch (e) { if (id === busy) body.innerHTML = `<p class="tu-msg">${esc(e.message)}<br>Most public servers have turned their list API off. <b>Full site</b> mode does not need it.<br><button class="btn" data-mode="site">Switch to Full site</button></p>`; }
}

async function watch(vid) {
  const id = ++busy, body = $("#tuBody"); body.className = "tu-watch"; paintTabs();
  body.innerHTML = `<p class="tu-msg">Opening…</p>`; $("#tube").scrollTo?.(0, 0);
  try {
    const r = await api(`/yt/video/${encodeURIComponent(vid)}?b=${bsel()}`);
    if (id !== busy) return;
    watching = r.video; backends = r.backends; paintBack(); paintTabs(); await ensureToken(); if (id !== busy) return;
    const src = siteSrc(`${r.base}/embed/${vid}?autoplay=1&local=true`);
    body.innerHTML = `<div class="tu-main"><div class="tu-player"><iframe src="${esc(src)}" allow="fullscreen; autoplay; encrypted-media; picture-in-picture" allowfullscreen title="${esc(r.video.title)}"></iframe></div>
      <h2>${esc(r.video.title)}</h2><p class="tu-meta"><b>${esc(r.video.author)}</b> · ${num(r.video.views)} views${r.video.published ? " · " + esc(r.video.published) : ""}</p>
      <details class="tu-desc"><summary>Description</summary><pre>${esc(r.video.description)}</pre></details>
      <p class="tu-note">Player not loading? Pick another backend above. Playback runs through the Artemis proxy, so the first start can take a few seconds.</p><button class="btn" data-stop>← Back to videos</button></div>
      <aside class="tu-rel">${r.related.map(cardHtml).join("")}</aside>`;
  } catch (e) { if (id === busy) body.innerHTML = `<p class="tu-msg">${esc(e.message)}<br><button class="btn" data-stop>← Back</button></p>`; }
}
