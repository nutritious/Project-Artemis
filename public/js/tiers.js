/* Cutscenes for the two tiers above Secret. Each one is its own scene, not a recolour.
   FORBIDDEN: a sealed rune circle, chains pulled tight, the chains snap, the seal opens.
   OMEGA: a clock running backwards, stars dragged into a point, time stops, then a supernova.
   Canvas and Web Audio only, a few hundred shapes a frame, and it lowers its own resolution if the computer struggles. */
import { state } from "./util.js";
import { tierChance, APEX_CHANCE, EFFECTS, TAGS, BGS } from "./cosmetics.js";

const ALL = () => [...EFFECTS, ...TAGS, ...BGS];
export const tierOf = (item) => (item?.rarity && item.rarity !== "secret" ? item.rarity : ALL().find((x) => x.id === item?.id)?.rarity ?? "secret");
export const TIER_WORD = { secret: "SECRET", apex: "APEX", forbidden: "FORBIDDEN", omega: "OMEGA" };
export const oddsText = (tier) => tier.startsWith("apex_") ? `1 IN ${Math.round(1 / APEX_CHANCE[tier.slice(5)]).toLocaleString("en-US")}` : `1 IN ${Math.round(Math.max(1, ALL().filter((x) => x.rarity === tier).length) / tierChance(tier)).toLocaleString("en-US")}`;

const TAU = Math.PI * 2, clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const easeOut = (v) => 1 - Math.pow(1 - clamp(v), 3);
const KIND = { tag: "TITLE", effect: "PROFILE EFFECT", bg: "BACKDROP", theme: "THEME" };
const mono = (px, w = 700) => `${w} ${px}px ui-monospace, Menlo, Consolas, monospace`;

/* ---------- tiny audio kit ---------- */
function kit(ctx) {
  const master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
  const t0 = ctx.currentTime + 0.05;
  let nb; const buf = () => { if (!nb) { nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return nb; };
  const env = (g, at, dur, vol, atk) => { g.gain.setValueAtTime(0.0001, t0 + at); g.gain.linearRampToValueAtTime(vol, t0 + at + Math.min(atk, dur / 2)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur); };
  const osc = (type, f0, f1, at, dur, vol, atk = 0.04) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0 + at); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + at + dur);
    env(g, at, dur, vol, atk); o.connect(g).connect(master); o.start(t0 + at); o.stop(t0 + at + dur + 0.1);
  };
  const noise = (at, dur, vol, f0, f1, type = "bandpass", atk = 0.02) => {
    const s = ctx.createBufferSource(); s.buffer = buf(); s.loop = true; const f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = type;
    f.frequency.setValueAtTime(f0, t0 + at); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + at + dur); env(g, at, dur, vol, atk);
    s.connect(f).connect(g).connect(master); s.start(t0 + at); s.stop(t0 + at + dur + 0.1);
  };
  return { osc, noise, stop: () => { try { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15); } catch { /* ok */ } } };
}

/* ---------- the shared runner: canvas, quality governor, skip, safety timeout ---------- */
function run(item, dur, soundFn, draw, label) {
  return new Promise((resolve) => {
    const cv = document.createElement("canvas"); cv.className = "secret-cut"; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", label);
    const LV = [Math.min(1, window.devicePixelRatio || 1), 0.7, 0.5]; let lv = 0, ema = 16, nf = 0;
    const fit = () => { cv.width = Math.max(2, Math.round(innerWidth * LV[lv])); cv.height = Math.max(2, Math.round(innerHeight * LV[lv])); };
    fit(); document.body.appendChild(cv); addEventListener("resize", fit);
    const x = cv.getContext("2d");
    let ctx, ks = null;
    if (state.me?.settings?.chatSound !== false) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); ks = kit(ctx); soundFn(ks); } catch { /* silent */ } }
    const S = {}, t0 = performance.now(); let raf = 0, done = false;
    const end = () => { if (done) return; done = true; clearTimeout(fail); cancelAnimationFrame(raf); ks?.stop(); removeEventListener("resize", fit); removeEventListener("keydown", key, true); cv.classList.add("out"); setTimeout(() => { cv.remove(); try { ctx?.close(); } catch { /* ok */ } }, 450); resolve(); };
    const key = (e) => { if (e.key === "Escape" && (performance.now() - t0) / 1000 > 2) { e.preventDefault(); end(); } };
    addEventListener("keydown", key, true);
    cv.addEventListener("click", () => { if ((performance.now() - t0) / 1000 > 2) end(); });
    const fail = setTimeout(end, (dur + 1.5) * 1000);
    let prev = performance.now();
    const loop = () => {
      const now = performance.now(), t = (now - t0) / 1000; ema = ema * 0.85 + Math.min(200, now - prev) * 0.15; prev = now;
      if (++nf % 10 === 0 && ema > 30 && lv < LV.length - 1) { lv++; fit(); ema = 16; }
      try {
        x.setTransform(1, 0, 0, 1, 0, 0); x.scale(cv.width / innerWidth, cv.height / innerHeight); x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
        const W = innerWidth, H = innerHeight, R = Math.min(W, H) / 2; S.dt = Math.min(0.05, t - (S.last ?? t)); S.last = t;
        draw(x, { W, H, R, cx: W / 2, cy: H / 2, k: R / 380 }, t, S, item);
      } catch (e) { console.error("[tier cutscene]", e); return end(); }
      if (t >= dur) return end(); raf = requestAnimationFrame(loop);
    };
    loop();
  });
}

/* particles shared by both scenes */
function stepParticles(x, S, color, g = 0) {
  S.sp ??= []; const dt = S.dt;
  for (let i = S.sp.length - 1; i >= 0; i--) { const p = S.sp[i]; p.l -= dt * p.d; if (p.l <= 0) { S.sp.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += g * dt; x.globalAlpha = clamp(p.l); x.fillStyle = p.c ?? color; x.fillRect(p.x, p.y, p.s, p.s); }
  x.globalAlpha = 1;
}
const burst = (S, cx, cy, n, sp, colors, k) => { S.sp ??= []; for (let i = 0; i < n && S.sp.length < 260; i++) { const a = rnd(TAU), v = rnd(0.2, 1) * sp * k; S.sp.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, d: rnd(0.5, 1.2), s: rnd(1.5, 4) * Math.max(1, k), c: colors[i % colors.length] }); } };

/* the reveal text, identical layout for both so the player always sees the same facts: kind, name, "nobody has this", odds */
function revealText(x, G, t, T0, item, tier, col, line) {
  const { cx, cy, R, k } = G, tt = t - T0; if (tt < 0) return;
  const name = item.name ?? "???", a = easeOut(tt / 0.8);
  x.textAlign = "center"; x.textBaseline = "middle";
  x.globalAlpha = a; x.fillStyle = col; x.font = mono(Math.max(12, R * 0.055)); x.letterSpacing = `${R * 0.02}px`; x.fillText(KIND[item.type] ?? "ITEM", cx, cy + R * 0.34); x.letterSpacing = "0px";
  x.fillStyle = "#fff"; x.font = `800 ${Math.max(22, R * 0.15)}px system-ui, sans-serif`; x.fillText(name.slice(0, Math.floor(clamp((tt - 0.3) / 1.2) * (name.length + 1))), cx, cy + R * 0.5);
  const o = clamp((tt - 1.6) / 0.8); x.globalAlpha = o; x.fillStyle = col; x.font = mono(Math.max(13, R * 0.06), 800); x.letterSpacing = `${R * 0.012}px`; x.fillText(oddsText(tier), cx, cy + R * 0.7);
  x.font = mono(Math.max(10, R * 0.035)); x.fillStyle = "rgba(255,255,255,.55)"; x.fillText("CHANCE PER PACK SLOT", cx, cy + R * 0.78);
  x.fillStyle = "rgba(255,255,255,.6)"; x.font = mono(Math.max(11, R * 0.04)); x.fillText(line, cx, cy + R * 0.88);
  x.letterSpacing = "0px"; x.globalAlpha = 1;
  if (tt > 3) { x.globalAlpha = 0.35 + 0.25 * Math.sin(t * 3); x.fillStyle = "#fff"; x.font = mono(Math.max(10, R * 0.032)); x.fillText("click to continue", cx, cy + R * 0.97); x.globalAlpha = 1; }
}

/* =====================================================================================================
   FORBIDDEN (22 s): rune circle, chains, snap, open, burning word
   ===================================================================================================== */
const F = { rune: 0.8, chain: 3.6, snap: 9.0, open: 9.5, word: 12.2, reveal: 15.6 }, FDUR = 22.5;
const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";

function forbiddenSound(a) {
  for (let i = 0; i < 5; i++) a.osc("sine", 55 * (1 + i * 0.5), 55 * (1 + i * 0.5) * 1.01, 0.2 + i * 0.3, 8.5, 0.07, 2);                  /* low choir drone */
  for (let i = 0; i < 14; i++) a.noise(F.rune + i * 0.55, 0.5, 0.06, 1500 + (i % 3) * 700, 3000, "bandpass");                              /* whispers */
  for (let i = 0; i < 12; i++) { const at = F.chain + i * 0.42 + (i > 7 ? 0.2 : 0); a.osc("square", 1800 + rnd(400), 900, at, 0.09, 0.05, 0.005); a.noise(at, 0.12, 0.12 + i * 0.012, 3500, 800); } /* chain links clink and tighten */
  a.osc("sawtooth", 80, 220, 5.5, 3.5, 0.06, 2.5);                                                                                        /* tension rising */
  a.noise(F.snap - 0.05, 1.4, 0.9, 6000, 200, "lowpass", 0.005); a.osc("sine", 90, 20, F.snap, 3, 0.95, 0.005);                           /* the snap and the boom */
  for (let i = 0; i < 9; i++) a.noise(F.snap + 0.1 + i * 0.06, 0.2, 0.2, 5000, 1500);                                                     /* links scatter */
  [110, 138.6, 164.8, 220, 277.2].forEach((f, i) => a.osc("sine", f, f * 1.003, F.open + i * 0.25, 9, 0.07, 1.5));                         /* the seal opens: a dark chord */
  a.osc("sine", 880, 880, F.word, 4, 0.1, 0.01); a.osc("sine", 1320, 1320, F.word, 3.4, 0.06, 0.01); a.osc("sine", 70, 28, F.word, 2.5, 0.8, 0.01); /* bell + slam */
  [330, 415, 494, 659].forEach((f, i) => a.osc("triangle", f, f, F.reveal - 0.3 + i * 0.12, 3, 0.05, 0.1));
}

function forbiddenDraw(x, G, t, S, item) {
  const { W, H, R, cx, cy, k } = G, P = "#a855ff", P2 = "#d9b3ff";
  S.links ??= Array.from({ length: 6 }, (_, c) => { const a = c / 6 * TAU + 0.3, links = []; for (let i = 0; i < 15; i++) { const d = 1.45 - i * 0.092; links.push({ d, a, vx: Math.cos(a + (i % 2 ? 1 : -1) * 0.9) * rnd(80, 380), vy: Math.sin(a + (i % 2 ? 1 : -1) * 0.9) * rnd(80, 380) - 120, vr: rnd(-6, 6) }); } return links; });
  const snapT = t - F.snap, openT = t - F.open;
  /* background */
  x.fillStyle = "#05000a"; x.fillRect(0, 0, W, H);
  const shake = snapT > 0 && snapT < 0.9 ? (1 - snapT / 0.9) * 16 * k : (t > F.chain && t < F.snap ? clamp((t - F.chain) / (F.snap - F.chain)) * 3 * k : 0);
  x.save(); x.translate(rnd(-1, 1) * shake, rnd(-1, 1) * shake);
  const vg = x.createRadialGradient(cx, cy, R * 0.2, cx, cy, Math.max(W, H) * 0.7); vg.addColorStop(0, `rgba(80,10,140,${0.3 + 0.12 * Math.sin(t * 2)})`); vg.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = vg; x.fillRect(0, 0, W, H);
  /* the rune circle draws itself, then spins faster once the seal opens */
  const draw = clamp((t - F.rune) / 3.2), spin = t * (openT > 0 ? 0.9 : 0.18) + (openT > 0 ? openT * openT * 0.3 : 0), r0 = R * 0.62;
  if (draw > 0) {
    x.save(); x.translate(cx, cy); x.lineCap = "round";
    const glow = openT > 0 ? 1 : 0.55 + 0.2 * Math.sin(t * 4);
    for (const [r, w, a] of [[r0, 3, 1], [r0 * 1.18, 1.5, 0.7], [r0 * 0.72, 1.5, 0.6]]) { x.strokeStyle = P; x.globalAlpha = a * glow; x.lineWidth = w * k + 0.5; x.beginPath(); x.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + TAU * draw); x.stroke(); }
    /* seven-point star, connected every third point */
    x.globalAlpha = 0.8 * glow; x.lineWidth = 1.6 * k + 0.4; x.rotate(spin * 0.5); x.beginPath();
    for (let i = 0; i <= 7 * draw; i++) { const a = (i * 3 % 7) / 7 * TAU - Math.PI / 2, px = Math.cos(a) * r0, py = Math.sin(a) * r0; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); x.rotate(-spin * 0.5);
    /* two rings of runes turning opposite ways */
    x.fillStyle = P2; x.textAlign = "center"; x.textBaseline = "middle";
    for (const [r, n, dir, sz] of [[r0 * 1.09, 28, 1, 0.055], [r0 * 0.86, 20, -1, 0.045]]) { x.font = `${Math.max(9, R * sz)}px serif`; for (let i = 0; i < n * draw; i++) { const a = i / n * TAU + dir * spin; x.save(); x.rotate(a); x.translate(0, -r); x.globalAlpha = (0.4 + 0.5 * Math.sin(t * 3 + i)) * glow; x.fillText(RUNES[(i * 7) % RUNES.length], 0, 0); x.restore(); } }
    x.restore(); x.globalAlpha = 1;
  }
  /* chains pull in, tighten, snap */
  if (t > F.chain) {
    const reach = easeOut((t - F.chain) / 1.6), tension = clamp((t - F.chain - 1.5) / (F.snap - F.chain - 1.5));
    x.lineWidth = 3 * k + 1; x.strokeStyle = "#8a8aa6"; x.lineCap = "round";
    for (const ch of S.links) for (const L of ch) {
      const dd = L.d * R, x0 = Math.cos(L.a) * dd, y0 = Math.sin(L.a) * dd;
      if (snapT < 0 && L.d < 1.45 - reach * 1.4) continue;
      const jit = snapT < 0 ? Math.sin(t * 30 + L.a * 9 + L.d * 20) * tension * 2.2 * k : 0, px = cx + x0 + jit, py = cy + y0 + jit;
      let ox = px, oy = py, ang = L.a + (L.d * 30 % 2 > 1 ? Math.PI / 2 : 0);
      if (snapT >= 0) { const q = snapT; ox = px + L.vx * q * k; oy = py + L.vy * q * k + 220 * q * q * k; ang += L.vr * q; x.globalAlpha = clamp(1 - q / 1.6); if (x.globalAlpha <= 0) continue; }
      else { x.globalAlpha = clamp(reach * 2); x.strokeStyle = tension > 0.8 && Math.sin(t * 20) > 0 ? P2 : "#8a8aa6"; }
      x.save(); x.translate(ox, oy); x.rotate(ang); x.beginPath(); x.ellipse(0, 0, 13 * k + 3, 7 * k + 2, 0, 0, TAU); x.stroke(); x.restore();
    }
    x.globalAlpha = 1;
    /* the lock glows hotter as the chains tighten */
    if (snapT < 0) { const g = x.createRadialGradient(cx, cy, 0, cx, cy, R * 0.45), a = tension * (0.5 + 0.3 * Math.sin(t * 14)); g.addColorStop(0, `rgba(217,179,255,${a})`); g.addColorStop(1, "rgba(168,85,255,0)"); x.fillStyle = g; x.fillRect(cx - R, cy - R, R * 2, R * 2); }
  }
  /* the snap: flash, shockwave, sparks */
  if (snapT >= 0 && !S.snapped) { S.snapped = true; burst(S, cx, cy, 110, 560, [P, P2, "#fff"], k); }
  if (snapT >= 0 && snapT < 1.6) { for (let i = 0; i < 3; i++) { const q = clamp(snapT / 1.4 - i * 0.12); if (q <= 0) continue; x.strokeStyle = i ? P : "#fff"; x.globalAlpha = (1 - q) * 0.8; x.lineWidth = (8 - i * 2) * k * (1 - q) + 1; x.beginPath(); x.arc(cx, cy, easeOut(q) * R * 1.9, 0, TAU); x.stroke(); } x.globalAlpha = 1; }
  stepParticles(x, S, P, 200 * k);
  /* the seal opens: a column of violet light and rising embers */
  if (openT > 0) {
    const h = easeOut(openT / 1.6), w = R * (0.2 + 0.1 * Math.sin(t * 6));
    const bg = x.createLinearGradient(cx - w, 0, cx + w, 0); bg.addColorStop(0, "rgba(168,85,255,0)"); bg.addColorStop(0.5, `rgba(235,215,255,${0.85 * h})`); bg.addColorStop(1, "rgba(168,85,255,0)");
    x.fillStyle = bg; x.fillRect(cx - w, cy - H * h * 0.5 - R * 0.05, w * 2, H * h + R * 0.1);
    const cg = x.createRadialGradient(cx, cy, 0, cx, cy, r0 * 0.9); cg.addColorStop(0, `rgba(255,255,255,${0.9 * h})`); cg.addColorStop(1, "rgba(168,85,255,0)"); x.fillStyle = cg; x.beginPath(); x.arc(cx, cy, r0 * 0.9, 0, TAU); x.fill();
    if (Math.random() < 0.6 && (S.sp?.length ?? 0) < 200) S.sp.push({ x: cx + rnd(-R * 0.4, R * 0.4), y: cy + R * 0.4, vx: rnd(-20, 20), vy: -rnd(80, 260) * k, l: 1, d: rnd(0.3, 0.7), s: rnd(1.5, 3.5) * Math.max(1, k), c: Math.random() < 0.5 ? P2 : "#fff" });
  }
  if (snapT >= 0 && snapT < 0.45) { x.fillStyle = `rgba(235,215,255,${(1 - snapT / 0.45) * 0.85})`; x.fillRect(-20, -20, W + 40, H + 40); }
  x.restore();
  /* the word burns in letter by letter */
  if (t >= F.word) {
    const tt = t - F.word, lift = easeOut((t - F.reveal) / 0.9), W9 = "FORBIDDEN", size = R * (0.25 - 0.1 * lift), ty = cy + R * (0.0 - 0.52 * lift);
    x.textAlign = "center"; x.textBaseline = "middle"; x.font = `900 ${size}px Georgia, "Times New Roman", serif`; x.letterSpacing = `${size * 0.06}px`;
    const total = x.measureText(W9).width, step = total / W9.length; let lx = cx - total / 2;
    for (let i = 0; i < W9.length; i++) {
      const q = clamp((tt - i * 0.14) / 0.45), cw = x.measureText(W9[i]).width + size * 0.06; if (q <= 0) { lx += cw; continue; }
      x.save(); x.translate(lx + cw / 2, ty); const sc = 1 + (1 - easeOut(q)) * 1.2; x.scale(sc, sc); x.globalAlpha = q;
      x.fillStyle = P; x.fillText(W9[i], 3 * k, 3 * k); x.fillStyle = q < 0.7 ? "#fff" : P2; x.fillText(W9[i], 0, 0); x.restore(); lx += cw;
    }
    x.letterSpacing = "0px"; x.globalAlpha = 1; void step;
    if (tt < 2.5) { x.fillStyle = `rgba(168,85,255,${0.18 * (1 - tt / 2.5)})`; x.fillRect(0, 0, W, H); }
  }
  if (t >= F.reveal - 0.3) { x.fillStyle = `rgba(0,0,0,${0.55 * clamp((t - F.reveal + 0.3) / 0.8)})`; x.fillRect(0, cy + R * 0.25, W, H); }
  revealText(x, G, t, F.reveal, item, "forbidden", P, "THE SEAL WAS BROKEN. IT IS YOURS NOW.");
  const sc = x.createPattern(S.scan ??= (() => { const c = document.createElement("canvas"); c.width = 1; c.height = 4; const g = c.getContext("2d"); g.fillStyle = "rgba(0,0,0,.22)"; g.fillRect(0, 0, 1, 2); return c; })(), "repeat"); x.fillStyle = sc; x.fillRect(0, 0, W, H);
}

/* =====================================================================================================
   OMEGA (25 s): a clock runs backwards, the stars fall in, time stops, supernova
   ===================================================================================================== */
const O = { freeze: 7.6, quiet: 9.1, nova: 10.2, glyph: 11.6, word: 15.0, reveal: 19.8 }, ODUR = 26;

function omegaSound(a) {
  for (let i = 0; i < 70; i++) { const at = 0.4 + 7.1 * (1 - Math.pow(1 - i / 70, 1.7)); a.osc("square", i % 2 ? 1500 : 1100, 700, at, 0.05, 0.035 + (i / 70) * 0.05, 0.003); a.noise(at, 0.04, 0.05, 4000, 2500); } /* ticks that speed up */
  a.osc("sawtooth", 50, 400, 1.5, 6, 0.05, 4); a.osc("sine", 30, 30, 2, 5.6, 0.18, 4);                                                           /* the pull */
  a.osc("sine", 6000, 6000, O.freeze, 0.05, 0.1, 0.005);                                                                                       /* the freeze click, then near silence */
  for (let i = 0; i < 6; i++) a.osc("sine", 38 + i * 0.4, 38, O.quiet + i * 0.1, 1.2, 0.05 + i * 0.03, 0.9);                                    /* a held breath: low swell */
  a.noise(O.nova - 0.05, 3.2, 1, 9000, 90, "lowpass", 0.004); a.osc("sine", 110, 16, O.nova, 5, 1, 0.004); a.osc("sawtooth", 880, 55, O.nova, 2, 0.15, 0.004); /* supernova */
  [261.6, 329.6, 392, 523.3, 659.3, 784, 1046.5].forEach((f, i) => { a.osc("sine", f, f * 1.002, O.glyph + i * 0.15, 11, 0.06, 1); a.osc("triangle", f * 2, f * 2, O.glyph + 0.8 + i * 0.15, 8, 0.02, 1); }); /* a huge golden chord */
  a.osc("sine", 1568, 1568, O.word, 4.5, 0.1, 0.01); a.osc("sine", 55, 20, O.word, 3, 0.9, 0.01); a.noise(O.word, 0.9, 0.5, 6000, 300, "lowpass");
}

function omegaDraw(x, G, t, S, item) {
  const { W, H, R, cx, cy, k } = G, Y = "#ffd24a", Y2 = "#fff2b8";
  S.stars ??= Array.from({ length: 220 }, () => ({ a: rnd(TAU), d: rnd(0.08, 1.5), s: rnd(0.6, 2.2) }));
  const novaT = t - O.nova, pull = clamp((t - 2) / (O.freeze - 2)), P = pull * pull;
  x.fillStyle = novaT >= 0 ? "#0a0600" : "#000"; x.fillRect(0, 0, W, H);
  const shake = novaT > 0 && novaT < 1.4 ? (1 - novaT / 1.4) * 26 * k : 0;
  x.save(); x.translate(rnd(-1, 1) * shake, rnd(-1, 1) * shake);
  /* stars: drift, then get dragged into a point, then freeze, then are blown away */
  const frozen = t >= O.freeze && novaT < 0;
  for (const s of S.stars) {
    const base = s.d * R * 1.3, rr = novaT >= 0 ? base * (1 + novaT * 1.6) : base * (1 - 0.94 * P), prevR = rr / Math.max(0.1, 1 - (frozen ? 0 : 0.08)), a = s.a + (frozen || novaT >= 0 ? 0 : t * 0.05 * (1 + P * 6));
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; x.strokeStyle = novaT >= 0 ? Y : "#fff"; x.globalAlpha = clamp(0.35 + s.s * 0.3) * (novaT >= 0 ? clamp(1 - novaT / 2.5) : 1);
    x.lineWidth = s.s * Math.max(1, k * 0.8); x.beginPath(); x.moveTo(cx + Math.cos(a) * prevR, cy + Math.sin(a) * prevR); x.lineTo(px, py); x.stroke();
  }
  x.globalAlpha = 1;
  /* the clock, running backwards faster and faster, then dead still */
  if (novaT < 0) {
    const cr = R * 0.58 * (1 - 0.5 * P) * (t > O.quiet ? 1 - 0.8 * clamp((t - O.quiet) / (O.nova - O.quiet)) : 1), hold = frozen ? 0 : 1;
    const ang = frozen ? S.fAng ?? 0 : -(t * t * 0.9) - t * 0.5; if (!frozen) S.fAng = ang;
    x.save(); x.translate(cx, cy); x.lineCap = "round"; const col = frozen ? "#bbb" : Y;
    x.strokeStyle = col; x.lineWidth = 3 * k + 1; x.globalAlpha = 0.9; x.beginPath(); x.arc(0, 0, cr, 0, TAU); x.stroke();
    x.lineWidth = 1.5 * k + 0.5; for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, l = i % 5 ? 0.04 : 0.09; x.beginPath(); x.moveTo(Math.cos(a) * cr * (1 - l), Math.sin(a) * cr * (1 - l)); x.lineTo(Math.cos(a) * cr, Math.sin(a) * cr); x.stroke(); }
    for (const [len, w, m] of [[0.82, 3, 1], [0.58, 5, 1 / 12]]) { const a = ang * m - Math.PI / 2; x.lineWidth = w * k + 1; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * cr * len, Math.sin(a) * cr * len); x.stroke(); }
    x.fillStyle = col; x.beginPath(); x.arc(0, 0, 6 * k + 2, 0, TAU); x.fill(); x.restore(); x.globalAlpha = 1; void hold;
    /* the countdown */
    const sec = Math.max(0, Math.ceil(60 * (1 - clamp(t / O.freeze) ** 2))), z = (n) => String(n).padStart(2, "0");
    x.textAlign = "center"; x.textBaseline = "middle"; x.font = mono(Math.max(20, R * 0.12), 800); x.fillStyle = frozen ? "#999" : Y; x.globalAlpha = clamp(t / 0.8);
    x.fillText(`00:00:${z(frozen || t >= O.freeze ? 0 : sec)}`, cx, cy - R * 0.9 * (1 - 0.15 * P)); x.font = mono(Math.max(10, R * 0.035)); x.fillStyle = "rgba(255,255,255,.5)"; x.fillText(frozen ? "TIME HAS STOPPED" : "TIME REMAINING", cx, cy - R * 0.9 * (1 - 0.15 * P) + R * 0.1); x.globalAlpha = 1;
    /* the centre: a white point that grows while everything holds its breath */
    if (t > O.freeze) { const q = clamp((t - O.freeze) / (O.nova - O.freeze)), g = x.createRadialGradient(cx, cy, 0, cx, cy, R * (0.05 + 0.5 * q * q)); g.addColorStop(0, `rgba(255,255,255,${0.4 + q * 0.6})`); g.addColorStop(1, "rgba(255,210,74,0)"); x.fillStyle = g; x.fillRect(cx - R, cy - R, R * 2, R * 2); }
    if (frozen) { x.fillStyle = `rgba(0,0,0,${0.35 * Math.sin(clamp((t - O.freeze) / 0.3) * Math.PI / 2)})`; x.fillRect(0, 0, W, H); }
  }
  /* supernova: white-out, shockwave rings, gold embers */
  if (novaT >= 0) {
    if (!S.boom) { S.boom = true; burst(S, cx, cy, 150, 900, [Y, Y2, "#fff", "#ff9a2e"], k); }
    const cg = x.createRadialGradient(cx, cy, 0, cx, cy, R * (0.3 + 2.4 * easeOut(novaT / 1.6))); cg.addColorStop(0, `rgba(255,255,255,${clamp(1 - novaT / 2.2)})`); cg.addColorStop(0.5, `rgba(255,190,60,${0.6 * clamp(1 - novaT / 3)})`); cg.addColorStop(1, "rgba(255,150,30,0)"); x.fillStyle = cg; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) { const q = clamp(novaT / 2.2 - i * 0.13); if (q <= 0 || q >= 1) continue; x.strokeStyle = i % 2 ? Y : "#fff"; x.globalAlpha = (1 - q) * 0.9; x.lineWidth = (14 - i * 3) * k * (1 - q) + 1; x.beginPath(); x.arc(cx, cy, easeOut(q) * R * 2.6, 0, TAU); x.stroke(); }
    x.globalAlpha = 1;
    /* rotating gold rays behind the glyph */
    const ra = clamp((novaT - 1) / 1.5) * 0.35; if (ra > 0) { x.save(); x.translate(cx, cy); x.rotate(t * 0.12); x.fillStyle = `rgba(255,210,74,${ra})`; for (let i = 0; i < 18; i++) { x.rotate(TAU / 18); x.beginPath(); x.moveTo(0, 0); x.lineTo(R * 2.4, -R * 0.07); x.lineTo(R * 2.4, R * 0.07); x.closePath(); x.fill(); } x.restore(); }
  }
  stepParticles(x, S, Y, 60 * k);
  x.restore();
  /* the Omega glyph forms, with a lens flare streak */
  if (t >= O.glyph) {
    const tt = t - O.glyph, lift = easeOut((t - O.reveal) / 0.9), sc = easeOut(tt / 1.6), size = R * (1.1 - 0.5 * lift) * (0.4 + 0.6 * sc), gy = cy - R * 0.5 * lift;
    const hw = R * 2.6 * easeOut(tt / 1.2), hg = x.createLinearGradient(cx - hw, 0, cx + hw, 0); hg.addColorStop(0, "rgba(255,210,74,0)"); hg.addColorStop(0.5, `rgba(255,245,200,${0.9 * (1 - lift)})`); hg.addColorStop(1, "rgba(255,210,74,0)");
    x.fillStyle = hg; x.fillRect(cx - hw, gy - 3 * k - 1, hw * 2, 6 * k + 2);
    x.globalAlpha = clamp(tt / 0.5); x.textAlign = "center"; x.textBaseline = "middle"; x.font = `900 ${size}px Georgia, "Times New Roman", serif`;
    const gg = x.createLinearGradient(0, gy - size * 0.5, 0, gy + size * 0.5); gg.addColorStop(0, "#fffbe6"); gg.addColorStop(0.5, Y); gg.addColorStop(1, "#b8780a");
    x.fillStyle = "rgba(255,210,74,.35)"; x.fillText("Ω", cx, gy + 6 * k); x.fillStyle = gg; x.fillText("Ω", cx, gy); x.globalAlpha = 1;
    if (t >= O.word && t < O.reveal + 0.5) { /* the word sweeps in from both sides */
      const q = easeOut((t - O.word) / 0.9), fs = R * 0.2 * (1 - 0.0), off = (1 - q) * W * 0.6; x.font = `900 ${fs}px Georgia, "Times New Roman", serif`; x.letterSpacing = `${fs * 0.3}px`; x.globalAlpha = q * (1 - clamp((t - O.reveal) / 0.4));
      x.fillStyle = Y; x.fillText("OMEGA", cx - off * 0.2, cy + R * 0.42 + 4 * k); x.fillStyle = "#fff"; x.fillText("OMEGA", cx + off * 0.0, cy + R * 0.42); x.letterSpacing = "0px"; x.globalAlpha = 1;
    }
    if (t >= O.reveal) { x.font = `900 ${R * 0.12}px Georgia, serif`; x.letterSpacing = `${R * 0.05}px`; x.fillStyle = Y; x.globalAlpha = easeOut((t - O.reveal) / 0.7); x.fillText("OMEGA", cx, cy - R * 0.12); x.letterSpacing = "0px"; x.globalAlpha = 1; }
  }
  if (t >= O.reveal - 0.3) { x.fillStyle = `rgba(0,0,0,${0.5 * clamp((t - O.reveal + 0.3) / 0.8)})`; x.fillRect(0, cy + R * 0.25, W, H); }
  revealText(x, G, t, O.reveal, item, "omega", Y, "THE LAST THING THERE WILL EVER BE.");
}

export const playForbidden = (item) => run(item, FDUR, forbiddenSound, forbiddenDraw, "A Forbidden item was pulled");
export const playOmega = (item) => run(item, ODUR, omegaSound, omegaDraw, "An Omega item was pulled");

/* shared with the season Apex scenes (apex.js) */
export { run, stepParticles, burst, revealText, easeOut, clamp, rnd, TAU, mono };
