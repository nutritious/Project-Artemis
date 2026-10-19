/* Browser view: tabs, omnibox with suggestions, native search results, proxied pages. */
import { openCloud } from "./cloud.js";
import { $, $$, api, b64u, emit, esc, hooks, hostOf, hue, icon, on, state, toast } from "./util.js";

const TILES = [
  ["Wikipedia", "https://en.wikipedia.org/"], ["YouTube", "https://www.youtube.com/"], ["Reddit", "https://www.reddit.com/"],
  ["GitHub", "https://github.com/"], ["NASA", "https://www.nasa.gov/"], ["Internet Archive", "https://archive.org/"],
  ["Hacker News", "https://news.ycombinator.com/"], ["Wolfram Alpha", "https://www.wolframalpha.com/"],
];

let tabs = [];
let active = 0;
let seq = 0;
let histTimer = 0;
let sjWarned = false;
const cur = () => tabs.find((t) => t.id === active);

/** Scramjet runs in a small shell page; "#t" carries the signed token, "#u" the first address. */
const exitQ = () => (state.exitUrl && state.exitToken ? `&x=${encodeURIComponent(state.exitUrl)}&xt=${encodeURIComponent(state.exitToken)}` : "");
/** Engine choices live in Settings: "scramjet" (V2, default), "scramjet1" (V1) or "classic"; the tunnel is "libcurl" or "epoxy" (V2 only). */
const pref = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const sjBase = () => `${state.sjOrigin || ""}${pref("artemis.proxy", "scramjet") === "scramjet1" ? "/sj1" : "/sj"}/shell.html#t=${encodeURIComponent(state.proxyToken)}${exitQ()}${pref("artemis.proxy", "scramjet") === "scramjet" && pref("artemis.tunnel", "libcurl") === "epoxy" ? "&tr=epoxy" : ""}`;
export const sjSrc = (url) => `${sjBase()}&u=${encodeURIComponent(url)}`;
export const proxySrc = (url) => `${state.proxyOrigin}/p/${state.proxyToken}/${b64u(url)}`;
const favicon = (host) => `${state.proxyOrigin}/p/${state.proxyToken}/${b64u("https://" + host + "/favicon.ico")}`;

/** Decide whether omnibox text is a URL or a search. */
export function interpret(raw) {
  const s = raw.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return { kind: "page", url: s };
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^[a-z0-9.-]+:\d+/i.test(s)) return { kind: "search", q: s };
  if (!/\s/.test(s)) {
    if (/^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?(\/.*)?$/i.test(s)) return { kind: "page", url: "http://" + s };
    if (/^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(s)) return { kind: "page", url: "https://" + s };
  }
  return { kind: "search", q: s };
}

/* ------------------------------ building ------------------------------ */
export function buildBrowser() {
  $("#view-browse").innerHTML = `
  <div id="browser" style="display:flex;flex-direction:column;gap:8px;height:100%;min-height:0">
    <div id="tabstrip" role="tablist"></div>
    <div id="toolbar" class="glass">
      <button class="tb" id="tbBack" title="Back (Alt+←)">${icon("back")}</button>
      <button class="tb" id="tbFwd" title="Forward (Alt+→)">${icon("fwd")}</button>
      <button class="tb" id="tbReload" title="Reload">${icon("reload")}</button>
      <button class="tb" id="tbHome" title="New search">${icon("home")}</button>
      <div id="omniWrap">${icon("lock")}<input id="omni" placeholder="Search or enter address" autocomplete="off" spellcheck="false" aria-label="Search or enter address"><div id="suggest" class="hidden" role="listbox"></div></div>
      <span id="engTag" class="chip hidden" title="Which proxy engine this tab is using"></span>
      <button class="tb" id="tbCloud" title="Cloud browser: Chrome, Firefox or Edge running on the host computer">☁</button>
      <button class="tb" id="tbStar" title="Bookmark this page (Ctrl+D)">${icon("star")}</button>
      <button class="tb" id="tbFull" title="Full screen">${icon("expand")}</button>
    </div>
    <div id="bmbar"></div>
    <div id="stage"><div id="loadbar"></div></div>
  </div>`;
  $("#tbBack").onclick = back; $("#tbFwd").onclick = forward;
  $("#tbReload").onclick = reload;
  $("#tbHome").onclick = () => navigate(cur(), { kind: "home" });
  $("#tbCloud").onclick = () => openCloud(); 
  $("#tbStar").onclick = toggleBookmark;
  $("#tbFull").onclick = () => { const s = $("#stage"); (document.fullscreenElement ? document.exitFullscreen() : s.requestFullscreen?.())?.catch?.(() => {}); };
  setupOmnibox();
  $("#bmbar").addEventListener("click", (e) => { const b = e.target.closest("[data-url]"); if (b) openUrl(b.dataset.url, e.ctrlKey || e.metaKey || e.button === 1); });
  window.addEventListener("message", onFrameMessage);
  document.addEventListener("keydown", (e) => {
    if (state.view !== "browse") return;
    if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); back(); }
    if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); forward(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); toggleBookmark(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") { e.preventDefault(); $("#omni").focus(); $("#omni").select(); }
  });
  on("settings", renderBmBar);
  on("bookmarks", () => { renderBmBar(); syncToolbar(); renderTiles(); });
  newTab();
  renderBmBar();
  prewarmScramjet();
}

/** Boot Scramjet in a hidden frame while you look at the home page, so the first site opens fast. */
function prewarmScramjet() {
  if (hooks.frame || !state.proxyToken) return;
  const go = () => {
    const f = document.createElement("iframe");
    f.id = "sjWarm"; f.tabIndex = -1; f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;visibility:hidden;pointer-events:none";
    f.src = sjBase();
    document.body.append(f);
  };
  setTimeout(go, 250); /* start right away: the first site opens with the engine already warm */
}

/* ------------------------------ tabs ------------------------------ */
const wantClassic = () => pref("artemis.proxy", "scramjet") === "classic";
export function newTab(entry = { kind: "home" }, activate = true) {
  const t = { id: ++seq, title: "New tab", favicon: "", stack: [], idx: -1, pane: null, iframe: null, loading: false, expect: "", legacy: wantClassic() };
  t.pane = document.createElement("div");
  t.pane.className = "pane";
  $("#stage").append(t.pane);
  tabs.push(t);
  if (activate) active = t.id;
  navigate(t, entry);
  return t;
}
function closeTab(id) {
  const i = tabs.findIndex((t) => t.id === id);
  if (i < 0) return;
  tabs[i].iframe?.remove(); tabs[i].pane.remove(); tabs.splice(i, 1);
  if (!tabs.length) return newTab();
  if (active === id) active = tabs[Math.min(i, tabs.length - 1)].id;
  render();
}
function setActive(id) { active = id; render(); }

/* ------------------------------ navigation ------------------------------ */
function navigate(t, entry, { replace = false, fromFrame = false } = {}) {
  if (!t) t = newTab(entry);
  if (replace) t.stack[t.idx] = entry;
  else { t.stack = t.stack.slice(0, t.idx + 1); t.stack.push(entry); t.idx = t.stack.length - 1; }
  show(t, entry, fromFrame);
}
function show(t, entry, fromFrame) {
  if (entry.kind === "home") { t.title = "New tab"; t.favicon = ""; renderHome(t); }
  else if (entry.kind === "search") { t.title = entry.q; t.favicon = ""; runSearch(t, entry); }
  else if (entry.kind === "page") {
    t.title = hostOf(entry.url) || entry.url; t.favicon = "";
    if (!fromFrame) loadFrame(t, entry.url);
  }
  render();
}
function loadFrame(t, url) {
  if (!t.iframe) {
    t.iframe = document.createElement("iframe");
    t.iframe.allow = "fullscreen; autoplay; clipboard-write; encrypted-media; picture-in-picture";
    t.iframe.addEventListener("load", () => { if (t.legacy || hooks.frame) { t.loading = false; if (t.id === active) loadbar(1); render(true); } });
    $("#stage").append(t.iframe);
  }
  t.legacy = wantClassic(); t.loading = true; t.expect = url;
  if (t.id === active) loadbar(.3);
  if (hooks.frame) return hooks.frame(t.iframe, url);
  if (t.legacy) { t.iframe.src = proxySrc(url); return; }
  // Scramjet: once the shell is up, just tell it where to go (no page reload, no flicker).
  if (t.sjReady && t.iframe.contentWindow) t.iframe.contentWindow.postMessage({ artemis: "go", url, token: state.proxyToken, exit: state.exitUrl || "", exitToken: state.exitToken || "" }, "*");
  else { t.sjReady = false; t.iframe.src = sjSrc(url); }
  // Safety net: if Scramjet never answers (tunnel blocked, host timing out), switch this tab to the classic proxy.
  clearTimeout(t.watchdog);
  t.watchdog = setTimeout(() => {
    if (!t.loading || t.legacy || t.expect !== url) return;
    toast("The proxy engine is taking a while. Still trying. If it never loads, switch to Classic in Settings > Proxy engine.", true);
  }, 25000);
}
function back() { const t = cur(); if (t && t.idx > 0) go(t, t.idx - 1); }
function forward() { const t = cur(); if (t && t.idx < t.stack.length - 1) go(t, t.idx + 1); }
function go(t, i) { t.idx = i; const e = t.stack[i]; show(t, e, false); if (e.kind === "page") loadFrame(t, e.url); }
function reload() {
  const t = cur(); if (!t) return;
  const e = t.stack[t.idx];
  if (e.kind === "page") loadFrame(t, e.url); else show(t, e, false);
}
export function openUrl(url, newTabToo = false) {
  const e = { kind: "page", url };
  if (newTabToo) newTab(e); else navigate(cur(), e);
  setView("browse");
}
export function openSearch(q, newTabToo = false) {
  /* Google can't be read by the server, so it opens as a real page through the proxy */
  const e = state.me?.settings.engine === "google" ? { kind: "page", url: `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=en` } : { kind: "search", q, engine: state.me?.settings.engine };
  if (newTabToo) newTab(e); else navigate(cur(), e);
  setView("browse");
}
export function openOmni(raw, newTabToo = false) {
  const r = interpret(raw);
  if (!r) return;
  if (r.kind === "page") openUrl(r.url, newTabToo); else openSearch(r.q, newTabToo);
}
function setView(v) { emit("view", v); }

/* ------------------------------ rendering ------------------------------ */
function render(light) {
  const t = cur();
  if (!t) return;
  const e = t.stack[t.idx] ?? { kind: "home" };
  if (!light) {
    $("#tabstrip").innerHTML = tabs.map((x) => `<div class="tab${x.id === active ? " on" : ""}${x.loading ? " loading" : ""}" role="tab" data-id="${x.id}" title="${esc(x.title)}">${x.favicon ? `<img src="${esc(x.favicon)}" alt="">` : `<span class="ti">${icon("globe")}</span>`}<span class="tt">${esc(x.title)}</span><button class="x" data-close="${x.id}" aria-label="Close tab">×</button></div>`).join("") + `<button id="newtab" title="New tab (Ctrl+T)" aria-label="New tab">+</button>`;
  } else {
    const el = $(`.tab[data-id="${t.id}"]`); el?.classList.toggle("loading", t.loading);
  }
  tabs.forEach((x) => {
    const isActive = x.id === active;
    const xe = x.stack[x.idx];
    x.pane.classList.toggle("on", isActive && xe?.kind !== "page");
    x.iframe?.classList.toggle("on", isActive && xe?.kind === "page");
  });
  const omni = $("#omni");
  if (document.activeElement !== omni) omni.value = e.kind === "page" ? e.url : e.kind === "search" ? e.q : "";
  syncToolbar();
  const tag = $("#engTag");
  if (tag) {
    const isPage = e.kind === "page" && !hooks.frame;
    tag.classList.toggle("hidden", !isPage);
    tag.textContent = t.legacy ? "Classic" : pref("artemis.proxy", "scramjet") === "scramjet1" ? "Scramjet V1" : "Scramjet V2";
    tag.classList.toggle("warn", !!t.legacy); tag.classList.toggle("ok", !t.legacy);
  }
}
function syncToolbar() {
  const t = cur(); if (!t) return;
  const e = t.stack[t.idx];
  $("#tbBack").disabled = t.idx <= 0; $("#tbFwd").disabled = t.idx >= t.stack.length - 1;
  const bookmarked = e?.kind === "page" && state.bookmarks.some((b) => b.url === e.url);
  $("#tbStar").classList.toggle("on", bookmarked);
  $("#tbStar").disabled = e?.kind !== "page";
}
function loadbar(p) {
  const b = $("#loadbar"); if (!b) return;
  b.style.opacity = 1; b.style.width = p * 100 + "%";
  if (p >= 1) setTimeout(() => { b.style.opacity = 0; setTimeout(() => (b.style.width = 0), 400); }, 250);
}

/* tab strip interactions */
document.addEventListener("click", (e) => {
  const strip = e.target.closest("#tabstrip"); if (!strip) return;
  const c = e.target.closest("[data-close]"); if (c) return closeTab(+c.dataset.close);
  if (e.target.closest("#newtab")) { newTab(); $("#omni").focus(); return; }
  const tab = e.target.closest(".tab"); if (tab) setActive(+tab.dataset.id);
});
document.addEventListener("auxclick", (e) => { const tab = e.target.closest?.("#tabstrip .tab"); if (tab && e.button === 1) closeTab(+tab.dataset.id); });
document.addEventListener("keydown", (e) => {
  if (state.view !== "browse") return;
  if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "t") { e.preventDefault(); newTab(); $("#omni").focus(); }
  if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "w") { e.preventDefault(); closeTab(active); }
});

/* ------------------------------ home ------------------------------ */
function renderHome(t) {
  const engines = state.engines;
  const eng = state.me?.settings.engine ?? "ddg";
  t.pane.innerHTML = `<div class="home">
    <div class="brand"><div class="moon"></div>PROJECT ARTEMIS</div>
    <div class="clock" data-clock></div>
    <form class="bigsearch" data-form>${icon("search")}<input autocomplete="off" spellcheck="false" placeholder="Search the web, or type an address" aria-label="Search"></form>
    <div class="engine-pick" role="group" aria-label="Search engine">${engines.map((x) => `<button type="button" data-eng="${x.id}" class="${x.id === eng ? "on" : ""}">${esc(x.name)}</button>`).join("")}</div>
    <div class="tiles" data-tiles></div>
  </div>`;
  const tick = () => {
    const el = t.pane.querySelector("[data-clock]"); if (!el) return clearInterval(t.clock);
    const d = new Date();
    el.textContent = d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }).toUpperCase() + "  ·  " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  tick(); clearInterval(t.clock); t.clock = setInterval(tick, 15000);
  const form = t.pane.querySelector("[data-form]");
  form.addEventListener("submit", (e) => { e.preventDefault(); openOmni(form.querySelector("input").value); });
  t.pane.querySelector(".engine-pick").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-eng]"); if (!b) return;
    try { const r = await api("/settings", "PUT", { engine: b.dataset.eng }); state.me.settings = r.settings; emit("settings"); renderHome(t); } catch (err) { toast(err.message, true); }
  });
  fillTiles(t.pane.querySelector("[data-tiles]"));
  t.pane.addEventListener("click", (e) => { const a = e.target.closest("[data-url]"); if (a) openUrl(a.dataset.url, e.ctrlKey || e.metaKey); });
  setTimeout(() => t.id === active && !matchMedia("(pointer:coarse)").matches && form.querySelector("input").focus(), 50);
}
function tileHtml(name, url) {
  const host = hostOf(url);
  return `<button class="tile" data-url="${esc(url)}" title="${esc(url)}"><div class="ic" style="background:linear-gradient(135deg,hsl(${hue(host)} 60% 50%),hsl(${(hue(host) + 40) % 360} 55% 38%))">${esc(name[0].toUpperCase())}</div><span class="n">${esc(name)}</span></button>`;
}
function fillTiles(el) {
  const marks = state.bookmarks.slice(0, 8).map((b) => [b.title, b.url]);
  const seen = new Set(marks.map((m) => hostOf(m[1])));
  const defaults = TILES.filter(([, u]) => !seen.has(hostOf(u))).slice(0, Math.max(0, 8 - marks.length));
  el.innerHTML = [...marks, ...defaults].map(([n, u]) => tileHtml(n, u)).join("");
}
function renderTiles() { tabs.forEach((t) => { const el = t.pane.querySelector("[data-tiles]"); if (el) fillTiles(el); }); }

/* ------------------------------ search ------------------------------ */
async function runSearch(t, entry, more) {
  if (!more) {
    t.pane.innerHTML = `<div class="results"><div class="rhead"><span class="chip">Searching…</span></div>${'<div class="skel"></div>'.repeat(5)}</div>`;
  }
  let data;
  try {
    const qs = new URLSearchParams({ q: entry.q });
    if (entry.engine) qs.set("engine", entry.engine);
    if (more) { qs.set("next", more.next); qs.set("nextEngine", more.engine); }
    data = await api("/search?" + qs);
  } catch (err) {
    t.pane.innerHTML = `<div class="empty"><b>Search failed</b><span>${esc(err.message)}</span></div>`;
    return;
  }
  if (cur()?.stack[cur().idx] !== entry && !more) { /* user navigated away; still keep results for the entry */ }
  entry.data = entry.data ? { ...data, results: [...entry.data.results, ...data.results] } : data;
  paintResults(t, entry);
}
function paintResults(t, entry) {
  const d = entry.data;
  const engName = state.engines.find((e) => e.id === d.engine)?.name ?? d.engine;
  const fellBack = d.tried?.length > 1 || (d.tried?.[0] && d.tried[0].engine !== (entry.engine ?? state.me?.settings.engine));
  const body = d.results.length
    ? d.results.map((r) => `<a class="res" href="${esc(r.url)}" data-url="${esc(r.url)}"><div class="rh"><img src="${esc(favicon(r.host || hostOf(r.url)))}" alt="" loading="lazy" data-hide><span>${esc(r.host || hostOf(r.url))}</span></div><div class="rt">${esc(r.title)}</div><div class="rs">${esc(r.snippet)}</div></a>`).join("")
    : `<div class="empty"><b>No results parsed</b><span>The engine returned nothing we could read. You can still open its results page through the proxy.</span></div>`;
  t.pane.innerHTML = `<div class="results">
    <div class="rhead"><span class="chip">${esc(engName)}</span><span>${d.results.length} results for <b>${esc(d.q)}</b></span>${fellBack ? `<span class="chip warn">auto-switched engine</span>` : ""}<span style="flex:1"></span><button class="btn sm" data-fallback>Open ${esc(engName)} page via proxy</button></div>
    ${body}
    ${d.next ? `<button class="btn" data-more style="justify-self:center;margin-top:12px">Load more results</button>` : ""}
  </div>`;
  t.pane.scrollTop = entry._scroll ?? 0;
  t.pane.onclick = (e) => {
    const a = e.target.closest("a.res");
    if (a) { e.preventDefault(); entry._scroll = t.pane.scrollTop; openUrl(a.dataset.url, e.ctrlKey || e.metaKey || e.button === 1); return; }
    if (e.target.closest("[data-fallback]")) { openUrl(d.fallbackUrl); return; }
    if (e.target.closest("[data-more]")) { e.target.closest("[data-more]").textContent = "Loading…"; runSearch(t, entry, { next: d.next, engine: d.engine }); }
  };
}

/* ------------------------------ omnibox ------------------------------ */
function setupOmnibox() {
  const omni = $("#omni"), box = $("#suggest");
  let items = [], sel = -1, seqN = 0, timer = 0;
  const hide = () => { box.classList.add("hidden"); sel = -1; };
  const paint = () => {
    if (!items.length) return hide();
    box.classList.remove("hidden");
    box.innerHTML = items.map((it, i) => `<button type="button" role="option" data-i="${i}" class="${i === sel ? "sel" : ""}">${icon(it.kind === "page" ? "globe" : it.kind === "mark" ? "star" : "search")}<span class="st">${esc(it.label)}</span><small>${it.kind === "page" ? "Go" : it.kind === "mark" ? "Bookmark" : "Search"}</small></button>`).join("");
  };
  const pick = (it) => { hide(); omni.blur(); if (it.kind === "search") openSearch(it.value); else if (it.kind === "mark" || it.kind === "page") openUrl(it.value); };
  omni.addEventListener("focus", () => omni.select());
  omni.addEventListener("input", () => {
    const v = omni.value.trim();
    clearTimeout(timer);
    if (!v) return hide();
    const r = interpret(v);
    const marks = state.bookmarks.filter((b) => (b.title + " " + b.url).toLowerCase().includes(v.toLowerCase())).slice(0, 3).map((b) => ({ kind: "mark", label: b.title + " — " + hostOf(b.url), value: b.url }));
    const base = [r.kind === "page" ? { kind: "page", label: r.url, value: r.url } : { kind: "search", label: v, value: v }, ...marks];
    items = base; sel = 0; paint();
    const my = ++seqN;
    timer = setTimeout(async () => {
      try {
        const { suggestions } = await api("/suggest?q=" + encodeURIComponent(v));
        if (my !== seqN) return;
        items = [...base, ...suggestions.filter((s) => s.toLowerCase() !== v.toLowerCase()).slice(0, 6).map((s) => ({ kind: "search", label: s, value: s }))];
        paint();
      } catch { /* suggestions are optional */ }
    }, 130);
  });
  omni.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!items.length || box.classList.contains("hidden")) return;
      e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; paint();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (sel >= 0 && !box.classList.contains("hidden") && items[sel] && items[sel].value !== omni.value.trim()) pick(items[sel]);
      else { hide(); omni.blur(); openOmni(omni.value, e.ctrlKey || e.metaKey); }
    } else if (e.key === "Escape") { hide(); render(); }
  });
  box.addEventListener("mousedown", (e) => { const b = e.target.closest("[data-i]"); if (b) { e.preventDefault(); pick(items[+b.dataset.i]); } });
  omni.addEventListener("blur", () => setTimeout(() => { hide(); render(true); const t = cur(); const e = t?.stack[t.idx]; if (e) omni.value = e.kind === "page" ? e.url : e.kind === "search" ? e.q : ""; }, 120));
}

/* ------------------------------ bookmarks ------------------------------ */
function renderBmBar() {
  const bar = $("#bmbar");
  if (!bar) return;
  const show = state.me?.settings.bookmarksBar && state.bookmarks.length;
  bar.classList.toggle("hidden", !show);
  bar.innerHTML = state.bookmarks.slice(0, 30).map((b) => `<button data-url="${esc(b.url)}" title="${esc(b.url)}"><img src="${esc(favicon(hostOf(b.url)))}" alt="" data-hide><span>${esc(b.title)}</span></button>`).join("");
  bar.querySelectorAll("img[data-hide]").forEach((i) => i.addEventListener("error", () => { i.style.visibility = "hidden"; }, { once: true }));
}
async function toggleBookmark() {
  const t = cur(); const e = t?.stack[t.idx];
  if (e?.kind !== "page") return;
  try {
    const have = state.bookmarks.find((b) => b.url === e.url);
    if (have) { await api("/bookmarks/" + have.id, "DELETE"); state.bookmarks = state.bookmarks.filter((b) => b !== have); toast("Bookmark removed"); }
    else { const { bookmark } = await api("/bookmarks", "POST", { url: e.url, title: t.title }); state.bookmarks.push(bookmark); toast("Bookmarked ★", "ok"); }
    emit("bookmarks");
  } catch (err) { toast(err.message, true); }
}

/* ------------------------------ frame messages ------------------------------ */
async function refreshToken() {
  try { const r = await api("/proxy-token"); state.proxyToken = r.proxyToken; state.proxyOrigin = r.proxyOrigin; state.sjOrigin = r.sjOrigin ?? ""; state.exitUrl = r.exitUrl ?? ""; state.exitToken = r.exitToken ?? ""; } catch { /* ignore */ }
}
export function startTokenRefresh() { setInterval(refreshToken, 5 * 60 * 1000); }
function onFrameMessage(e) {
  const d = e.data;
  if (!d || !d.artemis) return;
  const t = tabs.find((x) => x.iframe && x.iframe.contentWindow === e.source);
  if (d.artemis === "ready" && t) { t.sjReady = true; return; }
  if (d.artemis === "sj-failed" && t) {
    // Scramjet couldn't start here (old browser, plain http, blocked service workers): fall back to the classic proxy.
    t.loading = false; clearTimeout(t.watchdog); render();
    if (!sjWarned) { sjWarned = true; toast("Scramjet V2 couldn't start in this browser. You can switch to Classic in Settings > Proxy engine.", true); }
    return;
  }
  if (d.artemis === "nav" && t) {
    t.loading = false; clearTimeout(t.watchdog); if (t.id === active) loadbar(1);
    const url = d.url || "";
    t.title = d.title || hostOf(url) || "Page";
    t.favicon = d.favicon || "";
    const entry = t.stack[t.idx];
    if (url && entry?.kind === "page" && entry.url !== url) {
      // The page navigated itself (link click, SPA route): record it so Back works.
      if (t.expect) entry.url = url; // first report after our own load (redirects, normalisation)
      else { t.stack = t.stack.slice(0, t.idx + 1); t.stack.push({ kind: "page", url }); t.idx = t.stack.length - 1; }
    }
    t.expect = "";
    render();
    clearTimeout(histTimer);
    histTimer = setTimeout(() => api("/history", "POST", { url, title: t.title, via: t.legacy || hooks.frame ? undefined : "sj" }).catch(() => {}), 800);
  } else if (d.artemis === "open" && d.url) openUrl(d.url, true);
  else if (d.artemis === "key") emit("key", d.key);
  else if (d.artemis === "need-auth") refreshToken().then(() => { const x = t ?? cur(); if (x) x.sjReady = false; const en = x?.stack[x.idx]; if (en?.kind === "page") loadFrame(x, en.url); });
}
