/* Artemis Tube: a YouTube front page in the style of Invidious. Lists come from public Invidious servers; the player loads through the proxy. */
import { $, api, esc, state, toast } from "./util.js";
import { sjSrc } from "./browser.js";

const pref = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
let tab = "popular", q = "", backends = [], watching = null, busy = 0;
const thumb = (id) => `/api/img?u=${encodeURIComponent(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`)}`;
const dur = (s) => { if (!s) return "LIVE"; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };
const num = (n) => n >= 1e9 ? (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(n);
const bsel = () => { const n = parseInt(pref("artemis.ytb", "-1"), 10); return Number.isInteger(n) ? n : -1; };

export function buildTube() {
  $("#view-tube").innerHTML = `<div id="tube">
    <header class="tu-head"><a class="tu-brand" href="#" data-home>ARTEMIS TUBE</a>
      <form class="tu-search" data-search><input name="q" placeholder="search" autocomplete="off" spellcheck="false" aria-label="Search videos"><button aria-label="Search">⌕</button></form><span class="tu-sp"></span></header>
    <div class="tu-back" id="tuBack"></div>
    <nav class="tu-tabs" id="tuTabs"><button data-tab="popular">POPULAR</button><button data-tab="trending">TRENDING</button></nav>
    <p class="tu-note" id="tuNote"></p>
    <div id="tuBody" class="tu-grid"></div></div>`;
  const root = $("#tube");
  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab],[data-home],[data-b],[data-v],[data-recheck],[data-stop]"); if (!t) return;
    if (t.matches("[data-home]")) { e.preventDefault(); q = ""; watching = null; root.querySelector("[data-search] input").value = ""; return void load(); }
    if (t.dataset.tab) { tab = t.dataset.tab; q = ""; watching = null; return void load(); }
    if (t.dataset.b !== undefined) { setPref("artemis.ytb", t.dataset.b); return void (watching ? watch(watching.id) : load()); }
    if (t.dataset.v) { e.preventDefault(); return void watch(t.dataset.v); }
    if (t.matches("[data-recheck]")) return void recheck();
    if (t.matches("[data-stop]")) { watching = null; return void load(); }
  });
  root.querySelector("[data-search]").addEventListener("submit", (e) => { e.preventDefault(); q = new FormData(e.target).get("q").toString().trim(); watching = null; load(); });
}
export function onTubeShown() { if (!$("#tuBody")?.dataset.ready) load(); }

function paintBack() {
  const sel = bsel();
  $("#tuBack").innerHTML = `<b>Switch backend:</b> ` + (backends.length ? backends.map((b) => `<button class="${b.i === sel ? "sel" : ""}" data-b="${b.i}" title="${b.ms ? b.ms + " ms" : "not checked yet"}">${b.name}<i class="${b.ok === true ? "up" : b.ok === false ? "down" : ""}"></i></button>`).join("") : "") + `<button data-recheck class="re" title="Check which servers are up">↻ check</button>`;
}
function paintTabs() { $("#tuTabs").classList.toggle("hidden", !!q || !!watching); $("#tuTabs").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab && !q)); }
async function recheck() { try { const r = await api("/yt/backends/check", "POST", {}); backends = r.backends; paintBack(); } catch (e) { toast(e.message, true); } }
const cardHtml = (v) => `<a class="tu-card" href="#" data-v="${esc(v.id)}"><span class="tu-th"><img src="${thumb(v.id)}" alt="" loading="lazy"><em>${dur(v.seconds)}</em></span><b class="tu-t">${esc(v.title)}</b><span class="tu-a">${esc(v.author)}</span><span class="tu-m"><span>${v.published ? "Shared " + esc(v.published) : ""}</span><span>${num(v.views)} views</span></span></a>`;

async function load() {
  const id = ++busy, body = $("#tuBody"); body.dataset.ready = "1"; body.className = "tu-grid";
  paintBack(); paintTabs(); $("#tuNote").textContent = "";
  body.innerHTML = `<p class="tu-msg">Loading…</p>`;
  try {
    const r = await api(q ? `/yt/search?q=${encodeURIComponent(q)}&b=${bsel()}` : `/yt/list?tab=${tab}&b=${bsel()}`);
    if (id !== busy) return;
    backends = r.backends; paintBack();
    body.innerHTML = r.videos.length ? r.videos.map(cardHtml).join("") : `<p class="tu-msg">Nothing found.</p>`;
  } catch (e) { if (id === busy) body.innerHTML = `<p class="tu-msg">${esc(e.message)}<br><button class="btn" data-recheck>Check the servers</button></p>`; }
}

async function watch(vid) {
  const id = ++busy, body = $("#tuBody"); body.className = "tu-watch"; paintTabs();
  body.innerHTML = `<p class="tu-msg">Opening…</p>`; $("#tube").scrollTo?.(0, 0);
  try {
    const r = await api(`/yt/video/${encodeURIComponent(vid)}?b=${bsel()}`);
    if (id !== busy) return;
    watching = r.video; backends = r.backends; paintBack(); paintTabs();
    const src = sjSrc(`${r.base}/embed/${vid}?autoplay=1&local=true&quality=dash`);
    body.innerHTML = `<div class="tu-main"><div class="tu-player"><iframe src="${esc(src)}" allow="fullscreen; autoplay; encrypted-media; picture-in-picture" allowfullscreen title="${esc(r.video.title)}"></iframe></div>
      <h2>${esc(r.video.title)}</h2><p class="tu-meta"><b>${esc(r.video.author)}</b> · ${num(r.video.views)} views${r.video.published ? " · " + esc(r.video.published) : ""}</p>
      <details class="tu-desc"><summary>Description</summary><pre>${esc(r.video.description)}</pre></details>
      <p class="tu-note">Player not loading? Pick another backend above. Playback runs through the Artemis proxy, so the first start can take a few seconds.</p><button class="btn" data-stop>← Back to videos</button></div>
      <aside class="tu-rel">${r.related.map(cardHtml).join("")}</aside>`;
  } catch (e) { if (id === busy) body.innerHTML = `<p class="tu-msg">${esc(e.message)}<br><button class="btn" data-stop>← Back</button></p>`; }
}
