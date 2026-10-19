/* Arcade: five small games, each with its own leaderboard. During a live event they earn event points too. */
import { $, $$, api, esc, fmtNum, on, state, toast } from "./util.js";
import { GAMES } from "./cosmetics.js";
import { FACTORY, HELP, SKINS } from "./games.js";
import { setBoards } from "./hub.js";
import { buildCasino, onCasinoShown } from "./casino.js";

let cv, ctx, W = 0, H = 0, dpr = 1, raf = 0, G = null, mode = "idle", cur = "run", bests = {}, boards = {}, last = 0, started = 0;
const inp = { x: null, y: null, down: false, keys: new Set(), taps: [], swipe: null };
let sx = 0, sy = 0, sw = false;
const skin = () => (state.event?.kind === "halloween" ? SKINS.halloween : SKINS.space);

export function buildArcade() {
  $("#view-arcade").innerHTML = `<div class="page" id="arcPage">
    <div class="arc-head"><div><h2>Games</h2><p class="sub" style="margin:4px 0 0" id="arcHelp"></p></div><div class="seg2" id="arcMode"><button data-m="arcade" class="on">🕹 Arcade</button><button data-m="casino">🎰 Casino</button></div></div>
    <div id="casinoBox" hidden></div>
    <div id="arcEvent"></div>
    <div class="gtabs" id="gTabs">${GAMES.map((g) => `<button data-g="${g.id}"><b>${esc(g.name)}</b><small>${esc(g.desc)}</small></button>`).join("")}</div>
    <div class="arc-wrap" id="arcWrap"><div class="arc-stage glass"><canvas id="arcCv" aria-label="Game"></canvas><div class="arc-over" id="arcOver"></div></div>
      <div class="card glass arc-top"><h3 id="arcTopT">Top pilots</h3><div id="arcTop"></div></div></div></div>`;
  buildCasino($("#casinoBox"));
  $("#arcMode").addEventListener("click", (e) => { const b = e.target.closest("[data-m]"); if (b) setMode(b.dataset.m); });
  cv = $("#arcCv"); ctx = cv.getContext("2d"); cv.style.touchAction = "none";
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
  cv.addEventListener("pointermove", (e) => { const [px, py] = pos(e); inp.x = px; inp.y = py; if (sw) { const dx = px - sx, dy = py - sy; if (Math.hypot(dx, dy) > 26) { inp.swipe = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "r" : "l") : dy > 0 ? "d" : "u"; sx = px; sy = py; } } });
  cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); const [px, py] = pos(e); inp.x = px; inp.y = py; inp.down = true; inp.taps.push({ x: px, y: py }); sw = true; sx = px; sy = py; });
  const up = () => { inp.down = false; sw = false; }; cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  cv.addEventListener("pointerleave", () => { if (cur !== "lander") inp.x = inp.x; });
  addEventListener("keydown", (e) => {
    if (state.view !== "arcade" || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key === " " ? "space" : e.key.toLowerCase().replace("arrow", "");
    if (["left", "right", "up", "down", "space", "a", "d", "w", "s"].includes(k)) { inp.keys.add(k); inp.x = null; e.preventDefault(); }
    if ((e.key === " " || e.key === "Enter") && mode !== "play") { e.preventDefault(); start(); }
  });
  addEventListener("keyup", (e) => inp.keys.delete(e.key === " " ? "space" : e.key.toLowerCase().replace("arrow", "")));
  $("#arcOver").addEventListener("click", (e) => { if (e.target.closest("[data-go]")) start(); if (e.target.closest("[data-join]")) joinEvent(); });
  $("#gTabs").addEventListener("click", (e) => { const b = e.target.closest("[data-g]"); if (b) pick(b.dataset.g); });
  $("#arcEvent").addEventListener("click", (e) => { if (e.target.closest("[data-join]")) joinEvent(); });
  new ResizeObserver(size).observe(cv.parentElement);
  on("liveevent", () => { paintEvent(); if (mode === "idle") title(); });
}
let casinoOn = false;
function setMode(m) {
  casinoOn = m === "casino"; $$("#arcMode button").forEach((b) => b.classList.toggle("on", b.dataset.m === m));
  $("#casinoBox").hidden = !casinoOn; for (const q of ["#arcEvent", "#gTabs", "#arcWrap"]) $(q).hidden = casinoOn;
  if (casinoOn) { cancelAnimationFrame(raf); raf = 0; if (mode === "play") mode = "idle"; $("#arcHelp").textContent = "Test your luck with Artemis coins. Fake coins only, no real money."; onCasinoShown(); } else { pick(cur); size(); }
}
function pick(id) { cur = id; cancelAnimationFrame(raf); raf = 0; G = null; mode = "idle"; title(); paintTop(); $$("#gTabs button").forEach((b) => b.classList.toggle("on", b.dataset.g === id)); $("#arcHelp").textContent = HELP[id]; }
function size() {
  const box = cv.parentElement.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.max(240, Math.min(box.width, (box.height || 560) * 0.72)), h = Math.max(320, Math.min(box.height || 560, w / 0.72));
  cv.style.width = w + "px"; cv.style.height = h + "px"; W = Math.round(w); H = Math.round(h); cv.width = W * dpr; cv.height = H * dpr; if (!raf) preview();
}
function preview() { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); const g = FACTORY[cur](W, H, skin(), () => {}); g.draw(ctx); }
export async function onArcadeShown() {
  if (casinoOn) { onCasinoShown(); return; }
  pick(cur); size();
  try { const r = await api("/game"); setBoards(r); state.event = r.event; bests = r.game.bests ?? {}; boards = r.arcade; paintTop(); paintEvent(); title(); } catch { /* offline */ }
}
export function onArcadeLeft() { cancelAnimationFrame(raf); raf = 0; if (mode === "play") mode = "idle"; }
function paintTop() {
  const gm = GAMES.find((g) => g.id === cur); $("#arcTopT").textContent = `Top pilots · ${gm.name}`;
  $("#arcTop").innerHTML = (boards[cur] ?? []).map((r, i) => `<div class="lbrow ${r.id === state.me.id ? "me" : ""}"><span class="pos">${i + 1}</span><b>${esc(r.username)}</b><span class="grow"></span><span class="mono lbv">${fmtNum(r.best)}</span></div>`).join("") || `<p class="note">No scores yet. Be the first.</p>`;
}
function paintEvent() {
  const e = state.event, el = $("#arcEvent"); if (!el) return;
  if (!e) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="evbanner glass" style="--ec:${esc(e.color)}"><div><span class="ev-dot"></span> <b>${esc(e.name)} is live</b>${e.rush ? ` <span class="chip warn">2× rush on ${esc(e.rush.game ? (GAMES.find((g) => g.id === e.rush.game)?.name ?? "") : "every game")}</span>` : ""}<p class="note">${esc(e.blurb)}</p></div><div class="evstat"><span class="mono">${fmtNum(e.mine)}</span><small>your event points</small></div><div class="evstat"><span class="mono">${e.count}</span><small>playing</small></div>${e.joined ? `<span class="chip ok">You're in</span>` : `<button class="btn primary" data-join>Join the event</button>`}<div class="evtop">${e.top.map((t, i) => `<span>${i + 1}. ${esc(t.username)} <b class="mono">${fmtNum(t.points)}</b></span>`).join("")}</div></div>`;
}
async function joinEvent() { try { const r = await api("/event/join", "POST", {}); state.event = r.event; paintEvent(); toast("You're in the event. Play any game to score points.", "ok"); } catch (e) { toast(e.message, true); } }
function title() {
  mode = "idle"; const gm = GAMES.find((g) => g.id === cur), ev = state.event;
  $("#arcOver").innerHTML = `<div class="ao"><h3>${esc(gm.name.toUpperCase())}</h3><p>Best: <b class="mono">${fmtNum(bests[cur] ?? 0)}</b></p><button class="btn primary" data-go>Launch</button><small>Space or Enter to start${ev ? ` · counts for the ${esc(ev.name)}` : ""}</small></div>`;
  $("#arcOver").classList.remove("hidden"); if (ctx) preview();
}
function beep(f, d = 0.08, v = 0.04) {
  if (state.me?.settings?.chatSound === false) return;
  try { const a = (beep.a ??= new AudioContext()), o = a.createOscillator(), g = a.createGain(); o.type = "square"; o.frequency.value = f; g.gain.value = v; g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + d); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + d); } catch { /* no audio */ }
}
function start() {
  size(); mode = "play"; $("#arcOver").classList.add("hidden"); inp.taps.length = 0; inp.swipe = null; inp.x = null; G = FACTORY[cur](W, H, skin(), beep); last = performance.now(); started = last;
  cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  G.update(dt, inp); inp.taps.length = 0; G.draw(ctx);
  if (G.over) return end(); raf = requestAnimationFrame(loop);
}
async function end() {
  mode = "over"; cancelAnimationFrame(raf); raf = 0; const sc = G.score(), secs = Math.max(3, Math.round((performance.now() - started) / 1000)), isBest = sc > (bests[cur] ?? 0), gm = GAMES.find((g) => g.id === cur);
  await new Promise((r) => setTimeout(r, G.result ? 900 : 250));
  $("#arcOver").classList.remove("hidden");
  $("#arcOver").innerHTML = `<div class="ao"><h3>${isBest && sc > 0 ? "NEW BEST" : G.result || "SIGNAL LOST"}</h3><p class="big mono">${fmtNum(sc)}</p><p class="dim">${secs}s · ${esc(gm.name)}</p><button class="btn primary" data-go>Run again</button><small id="arcSave">Saving score…</small></div>`;
  try {
    const r = await api("/game/run", "POST", { game: cur, score: sc, secs }); setBoards(r); bests = r.game.bests ?? bests; boards = r.arcade; if (r.event !== undefined) state.event = r.event; paintTop(); paintEvent();
    const el = $("#arcSave"); if (el) el.textContent = state.event ? "Score saved · event points added" : "Score saved";
  } catch (e) { const el = $("#arcSave"); if (el) el.textContent = e.message; }
}
