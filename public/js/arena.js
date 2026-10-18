/* Live event arena: a full-screen, themed, shared game ("Void Worms", the Gulper). Everyone in the event is in the same world.
   The server (or the preview's fake server) runs the rules in arena-core.js. This file draws the world, steers your worm and shows the phase timer. */
import { $, esc, on, state, toast, emit } from "./util.js";
import { chatSend } from "./chat.js";
import { syncParty } from "./party.js";
import { startMusic } from "./arena-music.js";
import { PHASE_KINDS } from "./cosmetics.js";

const THEMES = {
  halloween: { name: "Halloween Night", bg: ["#1b0a22", "#07030c"], fog: "#ff7a1a", sky: "🦇", ghost: "👻", orbs: ["#ff8a2b", "#b46bff", "#ffd166", "#7dffb0"], special: "🎃", grid: "#ff8a2b", accent: "#ff8a2b", tagline: "Eat the candy. Don't get eaten." },
  opening: { name: "Opening Event", bg: ["#0d1030", "#03040a"], fog: "#ffd76a", sky: "✦", ghost: "★", orbs: ["#ffd76a", "#8b7bff", "#4cc9f0", "#ff9ad5"], special: "🌟", grid: "#8b7bff", accent: "#ffd76a", tagline: "Grow your worm. Rule the void." },
};
const T = (k) => THEMES[k] ?? { ...THEMES.opening, name: "Live Event" };
const WORM = ["#ff8a2b", "#b46bff", "#7dffb0", "#ff5d8f", "#ffd166", "#4cc9f0", "#8b7bff", "#ff9ad5"];
const PWI = [["🧲", "Magnet", "#4cc9f0"], ["🛡", "Shield", "#7dffb0"], ["⚡", "Speed", "#ffd166"], ["✖2", "Double", "#ff9ad5"]];
const TURN = 0.075, SPEED = 3.1, BOOST = 5.4;
const CALL = ["", "", "DOUBLE KILL", "TRIPLE KILL", "RAMPAGE", "UNSTOPPABLE"];

let root = null, game = null, music = null;
export const arenaOpen = () => !!root;
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export function openArena() {
  if (root || !state.event) return;
  const ev = state.event, th = T(ev.kind);
  root = document.createElement("div"); root.id = "arena"; root.style.setProperty("--ac", th.accent);
  root.innerHTML = `<canvas class="ar-cv"></canvas>
    <div class="ar-hud"><div class="ar-l"><b>${esc(th.name)}</b><small id="arPhase">LIVE</small></div>
      <div class="ar-score"><small>EVENT POINTS</small><b id="arPts">0</b><small id="arLen">length 0</small><div class="ar-pw" id="arPw"></div></div>
      <div class="ar-r"><button type="button" class="ar-btn" id="arMus" title="Music on/off">🔊</button><button type="button" class="ar-btn" id="arChatBtn" title="Toggle chat">💬<span class="lbl"> Chat</span></button><button type="button" class="ar-btn" id="arX" title="Leave the arena (Esc)">✕<span class="lbl"> Leave</span></button></div></div>
    <div class="ar-timer" id="arTimer"><div class="ar-tt"><span id="arTname"></span><b id="arTime">–</b></div><div class="ar-tbar"><i id="arTbar"></i></div><small id="arNext"></small></div>
    <div class="ar-boss" id="arBoss" hidden><small>THE GULPER</small><div class="ar-bbar"><i id="arBbar"></i></div></div>
    <div class="ar-board" id="arBoard"></div>
    <canvas class="ar-mini" id="arMini" width="132" height="132"></canvas>
    <div class="ar-feed" id="arFeed"></div><div class="ar-call" id="arCall"></div>
    <div class="ar-hint" id="arHint">Move your mouse or finger to steer · hold click, touch or Space to boost · grab power-ups · touch the giant worm's head in boss rounds</div>
    <div class="ar-intro" id="arIntro"><small>${esc(ev.by ? "HOSTED BY " + ev.by.toUpperCase() : "LIVE EVENT")}</small><h1>${esc(th.name)}</h1><p>${esc(th.tagline)}</p></div>
    <div class="ar-phasecard" id="arPc"></div>
    <div class="ar-dead" id="arDead" hidden><h2>Wiped out</h2><p id="arDeadTxt"></p><button type="button" class="btn primary" id="arAgain">Respawn</button></div>
    <div class="ar-chat" id="arChat"><div class="ar-chead" id="arChead"><span>💬 Event chat</span><button type="button" id="arMin" aria-label="Minimise chat">–</button></div>
      <div class="ar-msgs" id="arMsgs" aria-live="polite"></div><form class="ar-cform" id="arForm"><input id="arIn" maxlength="300" placeholder="Say something…" autocomplete="off"><button class="btn sm primary" type="submit">Send</button></form></div>`;
  document.body.appendChild(root); document.documentElement.classList.add("arena-on");
  setupChat();
  let musicOn = true; try { musicOn = localStorage.getItem("artemis.arenaMusic") !== "off"; } catch { /* default */ }
  music = startMusic(ev.kind, () => state.event?.phase?.kind, musicOn); $("#arMus").textContent = musicOn ? "🔊" : "🔇";
  $("#arMus").onclick = () => { const v = music.on; music.mute(v); $("#arMus").textContent = v ? "🔇" : "🔊"; try { localStorage.setItem("artemis.arenaMusic", v ? "off" : "on"); } catch { /* ok */ } };
  game = startGame(th); chatSend({ t: "arena", a: "join" });
  $("#arX").onclick = closeArena; $("#arChatBtn").onclick = () => $("#arChat").classList.toggle("off");
  setTimeout(() => $("#arIntro")?.classList.add("go"), 3200); setTimeout(() => $("#arHint")?.classList.add("fade"), 14000);
  syncParty();
}
export function closeArena() { if (!root) return; chatSend({ t: "arena", a: "leave" }); game?.stop(); game = null; music?.stop(); music = null; root.remove(); root = null; document.documentElement.classList.remove("arena-on"); emit("liveevent"); }

/* ---------- movable chat ---------- */
let chatList = [];
function setupChat() {
  const box = $("#arChat"), head = $("#arChead"); let pos = null;
  try { pos = JSON.parse(localStorage.getItem("artemis.arenaChat") || "null"); } catch { /* none */ }
  const place = (x, y) => { x = Math.max(0, Math.min(innerWidth - 120, x)); y = Math.max(0, Math.min(innerHeight - 50, y)); box.style.left = x + "px"; box.style.top = y + "px"; box.style.right = box.style.bottom = "auto"; return { x, y }; };
  if (pos) place(pos.x, pos.y);
  head.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return; const r = box.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top; head.setPointerCapture(e.pointerId);
    const mv = (ev) => { pos = place(ev.clientX - dx, ev.clientY - dy); }, up = () => { head.removeEventListener("pointermove", mv); head.removeEventListener("pointerup", up); try { localStorage.setItem("artemis.arenaChat", JSON.stringify(pos)); } catch { /* ok */ } };
    head.addEventListener("pointermove", mv); head.addEventListener("pointerup", up);
  });
  $("#arMin").onclick = () => box.classList.toggle("min");
  if (innerWidth < 640) box.classList.add("min");
  paintChat(); chatSend({ t: "history", channel: "live-event" });
  $("#arForm").onsubmit = (e) => { e.preventDefault(); const i = $("#arIn"), t = i.value.trim(); if (!t) return; chatSend({ t: "send", channel: "live-event", text: t }); i.value = ""; };
  $("#arIn").addEventListener("keydown", (e) => e.stopPropagation());
}
function paintChat() { const m = $("#arMsgs"); if (!m) return; const near = m.scrollHeight - m.scrollTop - m.clientHeight < 80; m.innerHTML = chatList.slice(-60).map((x) => `<div class="ar-m"><b>${esc(x.username)}</b> ${esc(x.text)}</div>`).join("") || `<p class="faint">Be the first to say hi.</p>`; if (near) m.scrollTop = m.scrollHeight; }
on("livechat", (e) => { if (e.history) chatList = [...e.history]; else if (e.msg) chatList.push(e.msg); if (root) paintChat(); });

/* ---------- the game ---------- */
function startGame(th) {
  const cv = $(".ar-cv"), x = cv.getContext("2d"), mini = $("#arMini"), mx = mini.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1), reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0; const fit = () => { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; }; fit(); addEventListener("resize", fit);
  const rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)];
  const orbs = new Map(), others = new Map(), pings = [], parts = [];
  let SIZE = 2600, mode = "gulper", boss = null, me = { x: 1300, y: 1300, a: 0, len: 14, segs: [], alive: false, spawnAt: 0 }, fxEnd = {}, total = 0, shown = 0, lenShown = 0;
  let boosting = false, mouse = null, raf = 0, last = performance.now(), shake = 0, sendT = 0, hitT = 0, boardTab = "phase", ready = false, shieldBreak = 0;
  const keys = new Set(); const t00 = performance.now();
  const puff = (px, py, c, n = 10) => { for (let i = 0; i < (reduce ? n / 3 : n); i++) { const a = rnd(0, 6.28), s = rnd(1, 5); parts.push({ x: px, y: py, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 1, c }); } };
  const props = Array.from({ length: reduce ? 14 : 34 }, () => ({ x: rnd(0, 2600), y: rnd(0, 2600), s: rnd(14, 40), sp: rnd(0.2, 0.8), ph: rnd(0, 6.28), g: Math.random() < 0.35 ? th.ghost : th.sky }));
  const fogs = Array.from({ length: 7 }, () => ({ x: rnd(0, 2600), y: rnd(0, 2600), r: rnd(220, 460), sp: rnd(0.05, 0.2), ph: rnd(0, 6.28) }));

  /* ---- sound ---- */
  let ac; const blip = (f, d = 0.08, type = "sine", v = 0.05, w = 0, to) => { if (state.me?.settings?.chatSound === false) return; try { ac ??= new (window.AudioContext || window.webkitAudioContext)(); const t = ac.currentTime + w, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + 0.02); } catch { /* silent */ } };

  /* ---- input ---- */
  const onMove = (e) => { const p = e.touches ? e.touches[0] : e; mouse = { x: p.clientX, y: p.clientY }; };
  const onDown = (e) => { if (e.target.closest(".ar-chat,.ar-btn,.ar-dead,.ar-board,#partyCard,.ar-timer")) return; boosting = true; onMove(e); }, onUp = () => { boosting = false; };
  const onKey = (e, d) => { if (e.target.closest?.("input")) return; if (e.key === " ") { boosting = d; e.preventDefault(); } if (e.key === "Escape" && d && performance.now() - t00 > 2500) { e.preventDefault(); closeArena(); } if (d) keys.add(e.key); else keys.delete(e.key); };
  const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);
  addEventListener("pointermove", onMove); addEventListener("pointerdown", onDown); addEventListener("pointerup", onUp); addEventListener("touchmove", onMove, { passive: true }); addEventListener("keydown", kd, true); addEventListener("keyup", ku, true);
  $("#arAgain").onclick = () => chatSend({ t: "arena", a: "spawn" });
  document.addEventListener("click", boardClick); function boardClick(e) { const b = e.target.closest?.("[data-bt]"); if (b) { boardTab = b.dataset.bt; board(); } }

  /* ---- messages from the server ---- */
  const bossShow = () => { const e = $("#arBoss"); if (!e) return; e.hidden = !boss || boss.hp <= 0; if (boss) $("#arBbar").style.width = Math.max(0, (boss.hp / boss.max) * 100) + "%"; };
  const callout = (text, color) => { const c = $("#arCall"); if (!c) return; const d = document.createElement("div"); d.textContent = text; d.style.color = color ?? "var(--ac)"; c.appendChild(d); setTimeout(() => d.remove(), 1700); };
  const feed = (text) => { const f = $("#arFeed"); if (!f) return; const d = document.createElement("div"); d.textContent = text; f.appendChild(d); while (f.children.length > 4) f.firstChild.remove(); setTimeout(() => d.remove(), 6000); };
  let dead = false;
  const handle = (m) => {
    if (dead) return;
    switch (m.a) {
      case "init": SIZE = m.size; mode = m.mode; orbs.clear(); for (const o of m.orbs) orbs.set(o[0], { id: o[0], x: o[1], y: o[2], c: o[3], v: o[4], k: o[5], pw: o[6], ph: Math.random() * 6 }); me.x = m.x; me.y = m.y; me.a = rnd(0, 6.28); me.segs = Array.from({ length: 30 }, (_, i) => ({ x: me.x - Math.cos(me.a) * i * 5, y: me.y - Math.sin(me.a) * i * 5 })); me.alive = true; me.spawnAt = performance.now(); boss = m.boss; ready = true; bossShow(); break;
      case "mode": mode = m.mode; boss = m.boss; bossShow(); if (m.mode !== "none") { me.alive = true; me.spawnAt = performance.now(); } break;
      case "orbs": for (const id of m.rm) { const o = orbs.get(id); if (o && Math.hypot(o.x - me.x, o.y - me.y) < 120) puff(o.x, o.y, th.orbs[o.c % 4], 4); orbs.delete(id); } for (const o of m.add) orbs.set(o[0], { id: o[0], x: o[1], y: o[2], c: o[3], v: o[4], k: o[5], pw: o[6], ph: Math.random() * 6 }); break;
      case "s": { const seen = new Set(); for (const r of m.w) { const id = r[0]; seen.add(id); const segs = r.slice(8); let w = others.get(id); const tgt = { x: r[2], y: r[3], a: r[4] / 100, len: r[5], f: r[6], color: r[7], segs }; if (!w) others.set(id, (w = { id, name: r[1], x: tgt.x, y: tgt.y, a: tgt.a, segs: segs.slice(), tgt })); w.name = r[1]; w.tgt = tgt; } for (const id of [...others.keys()]) if (!seen.has(id)) others.delete(id); boss = m.boss; bossShow(); break; }
      case "eat": total += m.pts; if (m.grow) me.len += m.grow; if (m.big) { blip(660, 0.12, "triangle", 0.06); blip(990, 0.15, "triangle", 0.05, 0.06); } else if (Math.random() < 0.5) blip(500 + Math.random() * 500, 0.05, "sine", 0.025); break;
      case "fx": fxEnd[m.type] = performance.now() + m.ms; blip(440, 0.1, "square", 0.05); blip(880, 0.2, "triangle", 0.06, 0.08); callout(PWI[["magnet", "shield", "speed", "x2"].indexOf(m.type)]?.[1].toUpperCase() ?? "POWER-UP", "#fff"); break;
      case "snap": me.x = m.x; me.y = m.y; break;
      case "dead": me.alive = false; shake = 14; blip(160, 0.5, "sawtooth", 0.08, 0, 50); $("#arDeadTxt").textContent = `${m.by ? m.by + " got you. " : ""}${Math.round(total).toLocaleString()} points this visit.`; $("#arDead").hidden = mode === "none"; break;
      case "spawned": me.x = m.x; me.y = m.y; me.a = m.a2; me.len = 14; me.segs = Array.from({ length: 30 }, (_, i) => ({ x: me.x - Math.cos(me.a) * i * 5, y: me.y - Math.sin(me.a) * i * 5 })); me.alive = true; me.spawnAt = performance.now(); fxEnd = {}; $("#arDead").hidden = true; break;
      case "kill": callout((CALL[Math.min(5, m.streak)] || "TAKEDOWN") + ` +${m.pts}`); total += m.pts; blip(700, 0.15, "triangle", 0.07); blip(990, 0.2, "triangle", 0.07, 0.07); if (m.streak >= 3) blip(1320, 0.3, "triangle", 0.07, 0.15); break;
      case "feed": feed(m.text); break;
      case "drop": pings.push({ x: m.x, y: m.y, t: performance.now(), kind: m.kind }); callout(m.kind === "crate" ? "📦 LOOT CRATE DROPPED" : "💰 COIN DROP", "#ffd166"); blip(880, 0.15, "triangle", 0.06); break;
      case "loot": if (m.kind === "coin") { total += 0; blip(1200, 0.06, "square", 0.03); } else { callout("📦 CRATE +1", "#ffd166"); blip(523, 0.3, "triangle", 0.08); blip(784, 0.4, "triangle", 0.08, 0.1); } break;
      case "bosshit": blip(220, 0.1, "square", 0.06); shake = 5; break;
      case "bossdead": callout(`BOSS DOWN · +${m.coins} coins`, "#7dffb0"); blip(523, 0.5, "triangle", 0.08); blip(784, 0.5, "triangle", 0.08, 0.12); blip(1047, 0.6, "triangle", 0.08, 0.24); break;
      case "boss": boss = m.hp > 0 ? { hp: m.hp, max: m.max } : null; bossShow(); break;
    }
  };
  on("arena", handle);

  /* ---- own worm ---- */
  const bodyHit = () => {
    const now = performance.now(); if (!me.alive || mode === "none" || now - me.spawnAt < 2500 || fxEnd.shield > now) return null;
    for (const w of others.values()) {
      const f = w.tgt.f; if (f & 32) continue; const s = w.segs, skip = f & 2 ? 14 : 0, r = f & 2 ? 34 : 25;
      for (let i = skip * 2; i + 1 < s.length; i += 2) if ((s[i] - me.x) ** 2 + (s[i + 1] - me.y) ** 2 < r * r) return w;
      if (!(f & 2) && (w.x - me.x) ** 2 + (w.y - me.y) ** 2 < 22 * 22) return w;
    }
    return null;
  };
  const stepMe = (dt) => {
    if (!me.alive || mode === "none") return; const now = performance.now();
    let want = me.a; if (mouse) want = Math.atan2(mouse.y - H / 2, mouse.x - W / 2);
    const kx = (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0); if (kx) want = me.a + kx * 0.6; if (keys.has("ArrowUp") || keys.has("w")) boosting = true;
    const diff = ((want - me.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; me.a += Math.max(-TURN * dt * 60, Math.min(TURN * dt * 60, diff));
    const boost = boosting && me.len > 12, sp = (boost ? BOOST : SPEED) * (fxEnd.speed > now ? 1.35 : 1) * dt * 60;
    me.x = Math.max(6, Math.min(SIZE - 6, me.x + Math.cos(me.a) * sp)); me.y = Math.max(6, Math.min(SIZE - 6, me.y + Math.sin(me.a) * sp));
    if (me.x <= 6 || me.y <= 6 || me.x >= SIZE - 6 || me.y >= SIZE - 6) me.a = Math.atan2(SIZE / 2 - me.y, SIZE / 2 - me.x);
    if (boost) { me.len -= 0.03 * dt * 60; if (Math.random() < 0.25) puff(me.x - Math.cos(me.a) * 14, me.y - Math.sin(me.a) * 14, th.accent, 1); }
    me.segs.unshift({ x: me.x, y: me.y }); const keep = Math.round(me.len * 3.2); while (me.segs.length > keep) me.segs.pop();
    const hitter = bodyHit(); if (hitter) { me.alive = false; chatSend({ t: "arena", a: "die", by: hitter.id }); }
    /* boss: touching its head hurts it */
    if (boss && now - hitT > 400) for (const w of others.values()) if (w.tgt.f & 2 && Math.hypot(w.x - me.x, w.y - me.y) < 62) { hitT = now; chatSend({ t: "arena", a: "hit" }); puff(w.x, w.y, "#ff5d6e", 10); break; }
    sendT -= dt; if (sendT <= 0) { sendT = 0.07; const s = []; for (let i = 0; i < me.segs.length && s.length < 60; i += 5) s.push(Math.round(me.segs[i].x), Math.round(me.segs[i].y)); chatSend({ t: "arena", a: "pos", x: me.x, y: me.y, ang: me.a, len: me.len, boost, s }); }
  };

  /* ---- drawing ---- */
  const drawWorm = (segs, hx, hy, ang, len, color, name, f, t, isMe, now) => {
    const n = segs.length, big = !!(f & 2), base = big ? 1.9 : 1;
    for (let i = n - 1; i >= 0; i -= (isMe ? 2 : 1)) { const s = segs[i], k = i / n, r = (10 + Math.min(10, len / 12) * (1 - k * 0.5)) * base; x.fillStyle = isMe ? `hsl(${(t * 80 + i * 5) % 360},85%,${60 - k * 15}%)` : color; x.globalAlpha = 1 - k * 0.4; x.shadowColor = isMe ? "#fff" : color; x.shadowBlur = 8; x.beginPath(); x.arc(s.x, s.y, r, 0, 6.283); x.fill(); }
    x.globalAlpha = 1; x.shadowBlur = 0;
    const hr = (11 + Math.min(10, len / 12)) * base; if (f & 4 || (isMe && fxEnd.shield > now)) { x.strokeStyle = "#7dffb0"; x.lineWidth = 3; x.globalAlpha = 0.5 + Math.sin(t * 8) * 0.3; x.beginPath(); x.arc(hx, hy, hr + 8, 0, 6.283); x.stroke(); x.globalAlpha = 1; }
    if (f & 32 || (isMe && now - me.spawnAt < 2500)) { x.globalAlpha = 0.5; x.strokeStyle = "#fff"; x.setLineDash([5, 5]); x.beginPath(); x.arc(hx, hy, hr + 6, 0, 6.283); x.stroke(); x.setLineDash([]); x.globalAlpha = 1; }
    x.fillStyle = "#fff"; for (const sd of [-1, 1]) { const ex = hx + Math.cos(ang + sd * 0.7) * hr * 0.7, ey = hy + Math.sin(ang + sd * 0.7) * hr * 0.7; x.beginPath(); x.arc(ex, ey, hr * 0.32, 0, 6.283); x.fill(); x.fillStyle = big ? "#f00" : "#111"; x.beginPath(); x.arc(ex + Math.cos(ang) * 2, ey + Math.sin(ang) * 2, hr * 0.16, 0, 6.283); x.fill(); x.fillStyle = "#fff"; }
    x.font = `700 ${big ? 18 : 13}px Inter, sans-serif`; x.fillStyle = isMe ? th.accent : big ? "#ff6b7a" : "#ffffffb0"; x.textAlign = "center"; x.fillText(name, hx, hy - hr - 12);
  };
  const draw = (t, now) => {
    const sc = Math.max(0.6, Math.min(1, Math.min(W, H) / 700)) * (1 - Math.min(0.25, me.len / 400));
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const sx = shake ? rnd(-shake, shake) : 0, sy = shake ? rnd(-shake, shake) : 0; shake *= 0.9; if (shake < 0.3) shake = 0;
    x.save(); x.translate(W / 2 + sx, H / 2 + sy); x.scale(sc, sc); x.translate(-me.x, -me.y);
    for (const f of fogs) { const fx = f.x + Math.sin(t * f.sp + f.ph) * 80, fy = f.y + Math.cos(t * f.sp + f.ph) * 60; const gr = x.createRadialGradient(fx, fy, 0, fx, fy, f.r); gr.addColorStop(0, th.fog + "26"); gr.addColorStop(1, th.fog + "00"); x.fillStyle = gr; x.fillRect(fx - f.r, fy - f.r, f.r * 2, f.r * 2); }
    x.strokeStyle = th.grid + "18"; x.lineWidth = 1; x.beginPath(); for (let i = 0; i <= SIZE; i += 100) { x.moveTo(i, 0); x.lineTo(i, SIZE); x.moveTo(0, i); x.lineTo(SIZE, i); } x.stroke();
    x.textAlign = "center"; x.textBaseline = "middle"; for (const p of props) { x.globalAlpha = 0.28; x.font = `${p.s}px serif`; x.fillText(p.g, (p.x + t * 18 * p.sp) % SIZE, p.y + Math.sin(t * p.sp + p.ph) * 26); } x.globalAlpha = 1;
    x.strokeStyle = th.accent; x.lineWidth = 6; x.shadowColor = th.accent; x.shadowBlur = 24; x.strokeRect(0, 0, SIZE, SIZE); x.shadowBlur = 0;
    const vw = W / sc / 2 + 40, vh = H / sc / 2 + 40;
    for (const o of orbs.values()) {
      if (Math.abs(o.x - me.x) > vw || Math.abs(o.y - me.y) > vh) continue; const p = 1 + Math.sin(t * 3 + o.ph) * 0.18;
      if (o.k === 4) { const [ic, , col] = PWI[o.pw] ?? PWI[0]; x.shadowColor = col; x.shadowBlur = 20; x.fillStyle = col + "44"; x.beginPath(); x.arc(o.x, o.y, 22 * p, 0, 6.283); x.fill(); x.shadowBlur = 0; x.font = "700 22px Inter, sans-serif"; x.fillStyle = "#fff"; x.fillText(ic, o.x, o.y + 1); continue; }
      if (o.k === 3) { x.shadowColor = "#ffd166"; x.shadowBlur = 30; x.font = `${38 * p}px serif`; x.fillText("📦", o.x, o.y); x.shadowBlur = 0; continue; }
      if (o.k === 2) { x.shadowColor = "#ffd166"; x.shadowBlur = 14; x.fillStyle = "#ffd166"; x.beginPath(); x.arc(o.x, o.y, 8 * p, 0, 6.283); x.fill(); x.shadowBlur = 0; x.fillStyle = "#7a5200"; x.font = "700 9px Inter"; x.fillText("◎", o.x, o.y + 1); continue; }
      const col = th.orbs[o.c % th.orbs.length]; if (o.k === 1) { x.font = `${22 * p}px serif`; x.fillText(th.special, o.x, o.y); } else { x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 14; x.beginPath(); x.arc(o.x, o.y, (o.v > 1 ? 6 : 4.5) * p, 0, 6.283); x.fill(); x.shadowBlur = 0; }
    }
    for (const p of pings) { const a = (now - p.t) / 20000; if (a > 1) continue; x.strokeStyle = "#ffd166"; x.globalAlpha = 1 - a; x.lineWidth = 4; x.beginPath(); x.arc(p.x, p.y, 40 + ((now - p.t) / 5) % 120, 0, 6.283); x.stroke(); x.globalAlpha = 1; }
    for (const w of others.values()) { const c = w.tgt; drawWorm(w.segsC ?? [], w.x, w.y, w.a, c.len, WORM[c.color % 8], w.name, c.f, t, false, now); }
    if (me.alive) drawWorm(me.segs, me.x, me.y, me.a, me.len, "#fff", state.me?.username ?? "You", 0, t, true, now);
    for (const p of parts) { x.globalAlpha = Math.max(0, p.l); x.fillStyle = p.c; x.fillRect(p.x - 2, p.y - 2, 4, 4); } x.globalAlpha = 1;
    if (fxEnd.magnet > now && me.alive) { x.strokeStyle = "#4cc9f066"; x.lineWidth = 2; x.setLineDash([6, 8]); x.beginPath(); x.arc(me.x, me.y, 150, 0, 6.283); x.stroke(); x.setLineDash([]); }
    x.restore();
    const v = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); v.addColorStop(0, "#0000"); v.addColorStop(1, "#000000aa"); x.fillStyle = v; x.fillRect(0, 0, W, H);
  };
  const drawMini = (now) => {
    const S = 132, k = S / SIZE; mx.clearRect(0, 0, S, S); mx.fillStyle = "#000a"; mx.fillRect(0, 0, S, S); mx.strokeStyle = th.accent; mx.lineWidth = 2; mx.strokeRect(1, 1, S - 2, S - 2);
    for (const o of orbs.values()) if (o.k >= 2) { mx.fillStyle = o.k === 4 ? (PWI[o.pw]?.[2] ?? "#fff") : "#ffd166"; mx.fillRect(o.x * k - 1.5, o.y * k - 1.5, o.k === 3 ? 5 : 3, o.k === 3 ? 5 : 3); }
    for (const p of pings) { const a = (now - p.t) / 20000; if (a < 1) { mx.strokeStyle = "#ffd166"; mx.globalAlpha = 1 - a; mx.beginPath(); mx.arc(p.x * k, p.y * k, 4 + (now / 90) % 8, 0, 6.283); mx.stroke(); mx.globalAlpha = 1; } }
    for (const w of others.values()) { const b = w.tgt.f & 2; mx.fillStyle = b ? "#ff3b4d" : w.tgt.f & 1 ? "#ffffff66" : "#ffffffcc"; mx.beginPath(); mx.arc(w.x * k, w.y * k, b ? 4.5 : 2, 0, 6.283); mx.fill(); }
    mx.fillStyle = th.accent; mx.beginPath(); mx.arc(me.x * k, me.y * k, 3.5, 0, 6.283); mx.fill(); mx.strokeStyle = "#fff"; mx.lineWidth = 1; mx.stroke();
  };

  /* ---- hud ---- */
  const hud = () => {
    const e = state.event, ph = e?.phase, now = Date.now(); if (!e) return;
    if (ph) {
      const k = PHASE_KINDS[ph.kind], left = ph.endsAt - now, total = ph.endsAt - ph.startsAt, wait = ph.startsAt - now;
      $("#arPhase").textContent = `PHASE ${ph.idx + 1}/${ph.of}`;
      $("#arTname").textContent = `${k?.icon ?? ""} ${k?.name ?? ph.kind}`; $("#arTime").textContent = wait > 0 ? "starting…" : mmss(left); $("#arTbar").style.width = (wait > 0 ? 0 : Math.max(0, Math.min(100, (left / total) * 100))) + "%";
      $("#arNext").textContent = ph.next ? `Next: ${PHASE_KINDS[ph.next]?.name ?? ph.next}` : "Final phase · rewards when the timer ends";
    }
    const pw = $("#arPw"); if (pw) { const n = performance.now(); pw.innerHTML = ["magnet", "shield", "speed", "x2"].map((t, i) => fxEnd[t] > n ? `<span style="--c:${PWI[i][2]}">${PWI[i][0]} ${Math.ceil((fxEnd[t] - n) / 1000)}s</span>` : "").join(""); }
  };
  const board = () => {
    const e = state.event, el = $("#arBoard"); if (!el || !e) return; const ph = e.phase;
    const list = boardTab === "phase" && ph ? ph.top : e.top, mine = boardTab === "phase" && ph ? ph.mine : e.mine;
    el.innerHTML = `<div class="ar-tabs"><button type="button" data-bt="phase" class="${boardTab === "phase" ? "on" : ""}">This phase</button><button type="button" data-bt="all" class="${boardTab === "all" ? "on" : ""}">Overall</button></div>` + (list ?? []).map((p, i) => `<div class="${p.username === state.me?.username ? "me" : ""}"><span>${i + 1}. ${esc(p.username)}</span><b>${p.points.toLocaleString()}</b></div>`).join("") + (list?.length ? "" : `<div class="faint"><span>Nobody yet</span></div>`) + `<div class="you"><span>You</span><b>${(mine ?? 0).toLocaleString()}</b></div>`;
    const m = (e.mine ?? 0); if (m > total) total = m; /* the server's number is the truth */
  };
  const phasePc = () => { const e = state.event; if (!e?.phase) return; const el = $("#arPc"); if (!el) return; const nowMode = mode; el.className = "ar-phasecard" + (nowMode === "none" ? " on" : ""); if (nowMode === "none") el.innerHTML = `<b>${PHASE_KINDS[e.phase.kind]?.icon ?? "❓"} ${esc(PHASE_KINDS[e.phase.kind]?.name ?? "Round time")}</b><small>Answer the round cards. The arena is paused.</small>`; };
  const hudT = setInterval(() => { hud(); board(); phasePc(); }, 500); hud(); board();

  /* ---- loop ---- */
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
    stepMe(dt);
    for (const w of others.values()) { const c = w.tgt; w.x += (c.x - w.x) * 0.35; w.y += (c.y - w.y) * 0.35; w.a = c.a; const s = c.segs, out = (w.segsC ??= []); const n = s.length / 2; while (out.length < n) out.push({ x: s[out.length * 2], y: s[out.length * 2 + 1] }); out.length = n; for (let i = 0; i < n; i++) { out[i].x += (s[i * 2] - out[i].x) * 0.35; out[i].y += (s[i * 2 + 1] - out[i].y) * 0.35; } }
    for (const p of parts) { p.x += p.vx; p.y += p.vy; p.l -= 0.03; } while (parts.length && parts[0].l <= 0) parts.shift();
    shown += (total - shown) * 0.2; lenShown += (me.len - lenShown) * 0.2; const pe = $("#arPts"); if (pe) { pe.textContent = Math.round(shown).toLocaleString(); $("#arLen").textContent = "length " + Math.round(lenShown * 3); }
    if (ready) { draw(t, now); drawMini(now); } raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop() { dead = true; cancelAnimationFrame(raf); clearInterval(hudT); document.removeEventListener("click", boardClick); removeEventListener("resize", fit); removeEventListener("pointermove", onMove); removeEventListener("pointerdown", onDown); removeEventListener("pointerup", onUp); removeEventListener("touchmove", onMove); removeEventListener("keydown", kd, true); removeEventListener("keyup", ku, true); try { ac?.close(); } catch { /* ok */ } } };
}

/* ---------- when does it open? ---------- */
export function initArena() {
  /* the owner starts an event: after the opening cinematic everyone drops straight into the arena */
  on("event", (m) => {
    if (!m.live) return; let tries = 0;
    const go = () => { if (root) return; if (document.querySelector(".lu-cut,.event-cut") && tries++ < 80) return void setTimeout(go, 500); if (state.event) openArena(); else if (tries++ < 20) setTimeout(go, 500); };
    setTimeout(go, 800);
  });
  on("liveevent", () => { if (root && !state.event) { closeArena(); toast("The live event has ended", "ok"); } });
  on("openarena", openArena);
  on("phase", (m) => {
    if (root) { const c = $("#arCall"); if (c) { const d = document.createElement("div"); d.className = "big"; d.innerHTML = `${esc(m.icon)} ${esc(m.name)}<small>${esc(m.blurb)}</small>`; c.appendChild(d); setTimeout(() => d.remove(), 3800); } }
    else toast(`${m.icon} ${m.name} is starting in the live event`, "ok");
  });
}
