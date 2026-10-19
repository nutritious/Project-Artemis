/* Chroma cutscene: plays when someone opens a pack and pulls a Chroma item. About 9 seconds, canvas + Web Audio.
   Click (after the first second) or press Esc to skip. */
import { state } from "./util.js";

const TAU = Math.PI * 2, clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k;
const ease = (v) => { v = clamp(v); return v * v * (3 - 2 * v); }, easeOut = (v) => 1 - Math.pow(1 - clamp(v), 3);
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const hue = (h, l = 60, a = 1) => `hsla(${((h % 360) + 360) % 360},100%,${l}%,${a})`;
export const DUR = 9.2, HIT = 3.6;
const KIND = { effect: "PROFILE EFFECT", tag: "TITLE", bg: "PROFILE BACKDROP", theme: "THEME" };

/* ---------- sound ---------- */
function sound(ctx, variant = "prism") {
  const out = ctx.createGain(); out.gain.value = 0.9; out.connect(ctx.destination);
  const t0 = ctx.currentTime + 0.05, nodes = [];
  const osc = (type, f0, f1, at, dur, vol, dest = out) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0 + at); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + at + dur); g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(vol, t0 + at + Math.min(0.08, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur); o.connect(g).connect(dest); o.start(t0 + at); o.stop(t0 + at + dur + 0.05); nodes.push(o); };
  const noise = (at, dur, vol, f0, f1) => { const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; const s = ctx.createBufferSource(); s.buffer = buf; const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.setValueAtTime(f0, t0 + at); f.frequency.exponentialRampToValueAtTime(f1, t0 + at + dur); f.Q.value = 1.2; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(vol, t0 + at + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur); s.connect(f).connect(g).connect(out); s.start(t0 + at); nodes.push(s); };
  /* build-up: rising drone, riser noise, ticking heartbeat */
  osc("sawtooth", 55, 220, 0, HIT, 0.07); osc("sine", 110, 880, 0.2, HIT - 0.2, 0.09); osc("triangle", 220, 1760, 0.8, HIT - 0.8, 0.05); noise(0.4, HIT - 0.4, 0.22, 300, 7000);
  for (let i = 0; i < 6; i++) osc("sine", 70, 45, 0.6 + i * 0.5 - i * i * 0.02, 0.18, 0.16);
  /* the hit: sub boom, crack, glassy rainbow chord */
  osc("sine", 90, 28, HIT, 1.6, 0.55); noise(HIT, 1.2, 0.5, 6000, 300); osc("square", 1200, 120, HIT, 0.3, 0.08);
  (CHORDS[variant] ?? CHORDS.prism).forEach((f, i) => { osc("triangle", f, f, HIT + 0.05 + i * 0.07, 3.4, 0.07); osc("sine", f * 2, f * 2, HIT + 0.2 + i * 0.07, 2.6, 0.025); });
  /* sparkles over the tail */
  for (let i = 0; i < 18; i++) osc("sine", 1500 + Math.random() * 2600, 1500 + Math.random() * 2600, HIT + 0.6 + i * 0.22, 0.25, 0.03);
  /* resolve */
  [261.63, 329.63, 392, 523.25].forEach((f) => osc("sawtooth", f, f, HIT + 2.2, 3.2, 0.03));
  return () => { try { out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(0, ctx.currentTime, 0.08); nodes.forEach((n) => { try { n.stop(ctx.currentTime + 0.4); } catch { /* done */ } }); } catch { /* closed */ } };
}

/* ---------- drawing ---------- */
/* ---------- one centrepiece per Chroma item ---------- */
const spectrum = (g, n, off, l = 60, a = 1) => { for (let i = 0; i <= n; i++) g.addColorStop(i / n, hue((i / n) * 360 + off, l, a)); return g; };
const CENTER = {
  /* Prism (effect): a spinning hexagonal crystal */
  prism(x, cx, cy, k, tt, sc) {
    const pr = 150 * k * sc; x.save(); x.translate(cx, cy); x.rotate(tt * 0.5);
    for (let layer = 3; layer >= 0; layer--) { const rr = pr * (1 - layer * 0.18); x.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); x.fillStyle = spectrum(x.createLinearGradient(-rr, -rr, rr, rr), 6, tt * 110 + layer * 40, 58 + layer * 4, 0.92); x.shadowColor = hue(tt * 110, 60); x.shadowBlur = layer === 0 ? 50 * k : 0; x.fill(); x.lineWidth = 2.5 * k; x.strokeStyle = "rgba(255,255,255,.75)"; x.stroke(); }
    x.shadowBlur = 0; x.strokeStyle = "rgba(255,255,255,.55)"; x.lineWidth = 1.5 * k; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * pr, Math.sin(a) * pr); x.stroke(); } x.restore(); return pr;
  },
  /* Holo Burst (effect): a rotating foil starburst */
  holo(x, cx, cy, k, tt, sc) {
    const pr = 170 * k * sc; x.save(); x.translate(cx, cy); x.globalCompositeOperation = "lighter";
    for (let ring = 0; ring < 3; ring++) { const n = 24 + ring * 6, ro = pr * (1 - ring * 0.22), ri = ro * 0.55, rot = tt * (ring % 2 ? -0.7 : 0.9) + ring; x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU + rot, r = i % 2 ? ri : ro; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fillStyle = spectrum(x.createLinearGradient(-ro, 0, ro, 0), 5, tt * 140 + ring * 90, 62, 0.5); x.fill(); x.strokeStyle = hue(tt * 100 + ring * 120, 80, 0.9); x.lineWidth = 2 * k; x.stroke(); }
    x.restore(); x.globalCompositeOperation = "source-over"; return pr;
  },
  /* Prismatic Jack (effect): a carved pumpkin lit from inside by a rainbow flame */
  jack(x, cx, cy, k, tt, sc) {
    const pr = 150 * k * sc; x.save(); x.translate(cx, cy + Math.sin(tt * 2) * 6 * k);
    x.globalCompositeOperation = "lighter";
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU + tt * 0.6, r = pr * (1.05 + 0.18 * Math.sin(tt * 5 + i)); x.beginPath(); x.moveTo(Math.cos(a) * pr * 0.8, Math.sin(a) * pr * 0.8); x.lineTo(Math.cos(a + 0.12) * r, Math.sin(a + 0.12) * r); x.lineTo(Math.cos(a + 0.24) * pr * 0.8, Math.sin(a + 0.24) * pr * 0.8); x.fillStyle = hue(i * 26 + tt * 160, 60, 0.55); x.fill(); }
    x.globalCompositeOperation = "source-over";
    x.beginPath(); x.ellipse(0, 0, pr * 0.9, pr * 0.78, 0, 0, TAU); x.fillStyle = spectrum(x.createLinearGradient(-pr, -pr, pr, pr), 6, tt * 90, 48, 1); x.fill();
    x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = 3 * k; for (let i = -2; i <= 2; i++) { x.beginPath(); x.ellipse(0, 0, pr * (0.9 - Math.abs(i) * 0.2), pr * 0.78, 0, -1.2, 1.2 + Math.PI * 0.0); x.stroke(); }
    x.fillStyle = "#0a0510"; x.beginPath(); x.moveTo(-pr * 0.5, -pr * 0.1); x.lineTo(-pr * 0.15, -pr * 0.1); x.lineTo(-pr * 0.32, -pr * 0.42); x.closePath(); x.fill(); x.beginPath(); x.moveTo(pr * 0.5, -pr * 0.1); x.lineTo(pr * 0.15, -pr * 0.1); x.lineTo(pr * 0.32, -pr * 0.42); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(-pr * 0.55, pr * 0.18); for (let i = 0; i <= 8; i++) x.lineTo(-pr * 0.55 + i * pr * 0.1375, pr * (i % 2 ? 0.42 : 0.2)); x.lineTo(pr * 0.55, pr * 0.18); x.closePath(); x.fill();
    x.fillStyle = hue(tt * 200, 70, 0.9); x.shadowColor = hue(tt * 200, 60, 1); x.shadowBlur = 24 * k; x.beginPath(); x.arc(-pr * 0.32, -pr * 0.2, 6 * k, 0, TAU); x.arc(pr * 0.32, -pr * 0.2, 6 * k, 0, TAU); x.fill(); x.shadowBlur = 0;
    x.fillStyle = "#3a7a2a"; x.fillRect(-8 * k, -pr * 0.95, 16 * k, pr * 0.22); x.restore(); return pr;
  },
  /* Spectral Wraith (effect): a rainbow ghost drifting through its own light */
  ghost(x, cx, cy, k, tt, sc) {
    const pr = 160 * k * sc; x.save(); x.translate(cx, cy + Math.sin(tt * 2.2) * 10 * k);
    for (let t = 5; t >= 0; t--) { x.globalAlpha = 0.07 * (6 - t); x.beginPath(); x.ellipse(Math.sin(tt * 2 - t * 0.5) * 14 * k, pr * 0.1 + t * 22 * k, pr * 0.9, pr * 0.3, 0, 0, TAU); x.fillStyle = hue(tt * 120 + t * 40, 62, 1); x.fill(); }
    x.globalAlpha = 0.92; x.beginPath(); x.moveTo(-pr * 0.62, pr * 0.62); x.lineTo(-pr * 0.62, -pr * 0.1); x.bezierCurveTo(-pr * 0.62, -pr * 0.95, pr * 0.62, -pr * 0.95, pr * 0.62, -pr * 0.1); x.lineTo(pr * 0.62, pr * 0.62);
    for (let i = 0; i < 5; i++) { const bx = pr * 0.62 - (i + 1) * pr * 0.248, by = pr * 0.62 + (i % 2 ? -1 : 1) * 16 * k * Math.sin(tt * 6 + i); x.quadraticCurveTo(bx + pr * 0.124, by + (i % 2 ? 22 : -22) * k, bx, pr * 0.62); }
    x.closePath(); x.fillStyle = spectrum(x.createLinearGradient(-pr * 0.6, -pr, pr * 0.6, pr * 0.6), 6, tt * 110, 78, 0.95); x.shadowColor = hue(tt * 110, 70, 1); x.shadowBlur = 34 * k; x.fill(); x.shadowBlur = 0;
    x.globalAlpha = 1; x.fillStyle = "#0a0510"; x.beginPath(); x.ellipse(-pr * 0.24, -pr * 0.2, pr * 0.09, pr * 0.14, 0, 0, TAU); x.ellipse(pr * 0.24, -pr * 0.2, pr * 0.09, pr * 0.14, 0, 0, TAU); x.fill(); x.beginPath(); x.ellipse(0, pr * 0.1, pr * 0.1, pr * 0.15 + Math.sin(tt * 5) * 4 * k, 0, 0, TAU); x.fill();
    x.restore(); return pr;
  },
  /* CHROMA (title): jagged rainbow lightning around an orb with orbiting sparks */
  prime(x, cx, cy, k, tt, sc, S) {
    const pr = 120 * k * sc; x.save(); x.translate(cx, cy); x.globalCompositeOperation = "lighter"; x.lineJoin = "round";
    S.bolt ??= { n: 0, seed: 0 }; if (Math.floor(tt * 14) !== S.bolt.n) { S.bolt.n = Math.floor(tt * 14); S.bolt.seed = Math.random() * 1000; }
    for (let b = 0; b < 9; b++) { let a = (b / 9) * TAU + tt * 0.3, px = 0, py = 0; x.beginPath(); x.moveTo(0, 0); for (let seg = 0; seg < 9; seg++) { a += Math.sin(S.bolt.seed + b * 7 + seg * 3.1) * 0.35; const l = (pr * 1.9 / 9) * (0.7 + 0.5 * Math.abs(Math.sin(S.bolt.seed + seg + b))); px += Math.cos(a) * l; py += Math.sin(a) * l; x.lineTo(px, py); } x.strokeStyle = hue(b * 40 + tt * 200, 70, 0.95); x.lineWidth = (4 - 0) * k; x.shadowColor = hue(b * 40 + tt * 200, 60); x.shadowBlur = 18 * k; x.stroke(); }
    x.shadowBlur = 0; for (let i = 0; i < 6; i++) { const a = tt * 2.2 + (i / 6) * TAU; x.fillStyle = hue(i * 60 + tt * 120, 70); x.beginPath(); x.arc(Math.cos(a) * pr * 1.25, Math.sin(a) * pr * 0.55, 9 * k, 0, TAU); x.fill(); }
    x.globalCompositeOperation = "source-over"; const g = x.createRadialGradient(0, 0, 0, 0, 0, pr * 0.6); g.addColorStop(0, "#fff"); g.addColorStop(0.5, hue(tt * 160, 70)); g.addColorStop(1, hue(tt * 160 + 120, 55, 0)); x.fillStyle = g; x.beginPath(); x.arc(0, 0, pr * 0.6, 0, TAU); x.fill(); x.restore(); return pr;
  },
  /* Spectrum Walker (title): ribbons of colour flowing across the whole screen */
  ribbon(x, cx, cy, k, tt, sc, S, W) {
    const pr = 110 * k * sc; x.save(); x.globalCompositeOperation = "lighter"; x.lineCap = "round";
    for (let r = 0; r < 7; r++) { x.beginPath(); for (let px = 0; px <= W; px += 12) { const u = px / W, env = Math.sin(u * Math.PI), y = cy + Math.sin(u * 6 + tt * 2.2 + r * 0.7) * (50 + r * 9) * k * env * sc + (r - 3) * 14 * k; px ? x.lineTo(px, y) : x.moveTo(px, y); } x.strokeStyle = hue(r * 51 + tt * 90, 62, 0.8); x.lineWidth = 12 * k; x.shadowColor = hue(r * 51 + tt * 90, 60); x.shadowBlur = 22 * k; x.stroke(); }
    x.restore(); const bob = Math.sin(tt * 3) * 6 * k; x.save(); x.translate(cx, cy + bob); x.fillStyle = "#fff"; x.shadowColor = "#fff"; x.shadowBlur = 26 * k; x.beginPath(); x.arc(0, -pr * 0.45, pr * 0.2, 0, TAU); x.fill(); x.beginPath(); x.moveTo(-pr * 0.22, -pr * 0.2); x.lineTo(pr * 0.22, -pr * 0.2); x.lineTo(pr * 0.3, pr * 0.5); x.lineTo(-pr * 0.3, pr * 0.5); x.closePath(); x.fill(); x.restore(); return pr;
  },
  /* Prism (theme): an iris of hue bands that repaints the screen outward */
  wipe(x, cx, cy, k, tt, sc, S, W, H) {
    const pr = 160 * k * sc, R = Math.hypot(W, H) * 0.6; x.save(); x.globalCompositeOperation = "lighter";
    for (let i = 11; i >= 0; i--) { const q = easeOut((tt - i * 0.07) / 1.6); if (q <= 0) continue; x.fillStyle = hue(i * 30 + tt * 60, 55, 0.13); x.beginPath(); x.arc(cx, cy, R * q * (0.35 + i * 0.05) + 20 * k * Math.sin(tt * 2 + i), 0, TAU); x.fill(); }
    x.restore(); for (let i = 0; i < 12; i++) { x.strokeStyle = hue(i * 30 + tt * 120, 65, 0.95); x.lineWidth = 8 * k; x.beginPath(); x.arc(cx, cy, pr * (0.3 + i * 0.055) * (1 + 0.04 * Math.sin(tt * 4 + i)), 0, TAU); x.stroke(); } return pr;
  },
  /* Spectrum (backdrop): a banner unfolds with flowing rainbow and a diagonal shine */
  panel(x, cx, cy, k, tt, sc) {
    const w = 520 * k * easeOut(tt / 0.8), h = 220 * k * easeOut((tt - 0.3) / 0.7), pr = 120 * k; if (w < 2) return pr; x.save(); x.translate(cx, cy);
    const rr = 22 * k; x.beginPath(); x.roundRect?.(-w / 2, -h / 2, w, h, rr) ?? x.rect(-w / 2, -h / 2, w, h); x.fillStyle = spectrum(x.createLinearGradient(-w / 2 + ((tt * 140) % w) - w, 0, w / 2 + ((tt * 140) % w), 0), 6, 0, 58, 1); x.shadowColor = hue(tt * 90, 60); x.shadowBlur = 50 * k; x.fill(); x.shadowBlur = 0; x.strokeStyle = "rgba(255,255,255,.8)"; x.lineWidth = 3 * k; x.stroke();
    x.clip(); const sx = -w + ((tt * 0.55) % 1) * w * 2; const g = x.createLinearGradient(sx - 80 * k, -h, sx + 80 * k, h); g.addColorStop(0, "transparent"); g.addColorStop(0.5, "rgba(255,255,255,.65)"); g.addColorStop(1, "transparent"); x.fillStyle = g; x.fillRect(-w / 2, -h / 2, w, h); x.restore(); return pr;
  },
  /* Holo Foil (backdrop): a tilting holographic card with a sweeping sheen and sparkles */
  foil(x, cx, cy, k, tt, sc, S) {
    const pr = 170 * k * sc, tilt = Math.sin(tt * 1.6), w = 250 * k * sc * (0.75 + 0.25 * Math.abs(Math.cos(tt * 1.6))), h = 330 * k * sc;
    x.save(); x.translate(cx, cy); x.transform(1, 0, tilt * 0.12, 1, 0, 0); x.beginPath(); x.roundRect?.(-w / 2, -h / 2, w, h, 20 * k) ?? x.rect(-w / 2, -h / 2, w, h); x.fillStyle = spectrum(x.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2), 5, tt * 120 + tilt * 80, 72, 1); x.shadowColor = hue(tt * 90, 70); x.shadowBlur = 44 * k; x.fill(); x.shadowBlur = 0; x.strokeStyle = "rgba(255,255,255,.9)"; x.lineWidth = 4 * k; x.stroke(); x.clip();
    const sy = -h + ((tt * 0.45) % 1) * h * 2.2; const g = x.createLinearGradient(-w, sy - 50 * k, w, sy + 50 * k); g.addColorStop(0, "transparent"); g.addColorStop(0.5, "rgba(255,255,255,.8)"); g.addColorStop(1, "transparent"); x.fillStyle = g; x.fillRect(-w / 2, -h / 2, w, h);
    S.fs ??= Array.from({ length: 26 }, () => ({ x: rnd(-0.5, 0.5), y: rnd(-0.5, 0.5), p: rnd(TAU) })); for (const f of S.fs) { x.globalAlpha = Math.max(0, Math.sin(tt * 4 + f.p)); x.fillStyle = "#fff"; x.beginPath(); x.arc(f.x * w, f.y * h, 3 * k, 0, TAU); x.fill(); } x.globalAlpha = 1; x.restore(); return pr;
  },
};
const VARIANT = { "effect:wraith": "ghost", "effect:prismjack": "jack", "tag:h-nightmare": "prime", "theme:witchfire": "wipe", "bg:carnival": "foil", "effect:prism": "prism", "effect:holo": "holo", "tag:chroma-prime": "prime", "tag:spectrum": "ribbon", "theme:prism": "wipe", "bg:spectrum": "panel", "bg:holo-foil": "foil" };
const CHORDS = { jack: [293.66, 349.23, 440, 587.33, 698.46, 880, 1174.7], ghost: [329.63, 392, 493.88, 659.25, 783.99, 987.77, 1318.5], prism: [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093], holo: [587.33, 740, 880, 1174.7, 1480, 1760, 2349], prime: [440, 554.4, 659.25, 880, 1108.7, 1318.5, 1760], ribbon: [392, 493.9, 587.33, 783.99, 987.8, 1174.7, 1568], wipe: [349.2, 440, 523.25, 698.5, 880, 1046.5, 1396.9], panel: [466.2, 587.33, 698.5, 932.3, 1174.7, 1396.9, 1864.7], foil: [622.25, 783.99, 932.3, 1244.5, 1568, 1864.7, 2489] };
export const chromaVariant = (type, id) => VARIANT[`${type}:${id}`] ?? "prism";

function glow(x, cx, cy, r, col, a = 1) { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, "transparent"); x.globalAlpha = a; x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); x.globalAlpha = 1; }
function frame(x, W, H, t, S, item) {
  const cx = W / 2, cy = H * 0.46, R = Math.min(W, H), k = R / 800;
  S.dt = Math.min(0.05, t - (S.last ?? t)); S.last = t;
  x.globalCompositeOperation = "source-over"; x.fillStyle = "#03020a"; x.fillRect(0, 0, W, H);
  /* background stars */
  S.stars ??= Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), p: Math.random() * 7, s: 0.5 + Math.random() * 1.6 }));
  for (const s of S.stars) { x.globalAlpha = 0.15 + 0.5 * Math.abs(Math.sin(t * 1.2 + s.p)); x.fillStyle = "#fff"; x.fillRect(s.x * W, s.y * H, s.s, s.s); } x.globalAlpha = 1;
  const pre = clamp(t / HIT), post = clamp((t - HIT) / (DUR - HIT));
  const shake = t < HIT ? Math.pow(pre, 3) * 7 * k : Math.max(0, 1 - (t - HIT) / 0.9) * 22 * k;
  x.save(); x.translate(rnd(-shake, shake), rnd(-shake, shake));

  if (t < HIT) {
    /* 1: a point of light pulls colour out of the dark */
    const p = ease(pre), r = (6 + p * 38) * k;
    glow(x, cx, cy, R * (0.15 + 0.4 * p), hue(t * 90, 55, 0.5 * p + 0.1), 1);
    x.globalCompositeOperation = "lighter";
    const beams = 7;
    for (let i = 0; i < beams; i++) { const a = (i / beams) * TAU + t * (0.4 + p * 1.8), len = R * (0.1 + 0.9 * easeOut((t - 1.4) / 2.0)); if (t < 1.4) continue; const g = x.createLinearGradient(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len); g.addColorStop(0, hue(i * 51 + t * 60, 65, 0.9)); g.addColorStop(1, "transparent"); x.strokeStyle = g; x.lineWidth = (3 + p * 12) * k; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); x.stroke(); }
    /* spiral of sparks drawn into the centre */
    S.sp ??= []; for (let i = 0; i < 4 + Math.floor(p * 10); i++) S.sp.push({ a: rnd(TAU), d: R * rnd(0.45, 0.8), h: rnd(360), s: rnd(1.2, 3.2) });
    S.sp = S.sp.filter((q) => q.d > 6 * k); for (const q of S.sp) { q.d -= (R * 0.55 + q.d * 1.2) * S.dt; q.a += (1.5 + 3 / (q.d / R + 0.1) * 0.15) * S.dt; x.fillStyle = hue(q.h + t * 80, 68, 0.9); x.globalAlpha = clamp(1 - q.d / (R * 0.8)) + 0.2; x.beginPath(); x.arc(cx + Math.cos(q.a) * q.d, cy + Math.sin(q.a) * q.d, q.s * k * 1.6, 0, TAU); x.fill(); } x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";
    x.fillStyle = "#fff"; x.shadowColor = "#fff"; x.shadowBlur = 30 * k; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); x.shadowBlur = 0;
    if (t > 2.6) { const w = easeOut((t - 2.6) / 0.9); x.fillStyle = `rgba(255,255,255,${0.12 * w})`; x.fillRect(0, 0, W, H); }
    x.font = `600 ${Math.max(11, R * 0.018)}px 'JetBrains Mono', monospace`; x.letterSpacing = "3px"; x.textAlign = "center"; x.fillStyle = hue(t * 120, 75, clamp(t / 0.8) * 0.8); x.fillText("A SPECTRUM IS FORMING…", cx, H * 0.86);
  } else {
    const tt = t - HIT;
    /* 2: the hit. white flash, chromatic shockwaves, then the rotating prism and rays */
    const rays = 18; x.globalCompositeOperation = "lighter";
    for (let i = 0; i < rays; i++) { const a = (i / rays) * TAU + tt * 0.35, w = 0.09 + 0.03 * Math.sin(tt * 2 + i), len = R * (0.9 + 0.5 * Math.sin(tt * 1.4 + i * 1.7)); x.fillStyle = hue(i * 20 + tt * 70, 60, 0.16 * easeOut(tt / 0.8)); x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, len, a - w, a + w); x.closePath(); x.fill(); }
    for (let i = 0; i < 5; i++) { const q = tt - i * 0.12, r = easeOut(q / 1.8) * R * 1.05; if (q < 0 || r <= 0) continue; x.lineWidth = (26 - i * 3) * k; x.globalAlpha = Math.max(0, 1 - q / 1.8); x.strokeStyle = hue(i * 70 + 10, 62); x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke(); }
    x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
    glow(x, cx, cy, R * (0.5 + 0.05 * Math.sin(tt * 3)), hue(tt * 70 + 280, 55, 0.55), 1);
    /* confetti shards */
    S.sh ??= []; if (tt < 1.4) for (let i = 0; i < 14; i++) S.sh.push({ x: cx, y: cy, vx: rnd(-1, 1) * R * 0.9, vy: rnd(-1.1, 0.5) * R * 0.9, h: rnd(360), r: rnd(0, TAU), vr: rnd(-8, 8), s: rnd(5, 13) * k, l: 1 });
    S.sh = S.sh.filter((q) => q.l > 0 && q.y < H + 40); x.globalCompositeOperation = "lighter";
    for (const q of S.sh) { q.vy += R * 0.55 * S.dt; q.x += q.vx * S.dt; q.y += q.vy * S.dt; q.vx *= 0.992; q.r += q.vr * S.dt; q.l -= 0.12 * S.dt; x.save(); x.translate(q.x, q.y); x.rotate(q.r); x.fillStyle = hue(q.h + tt * 90, 62, clamp(q.l)); x.fillRect(-q.s, -q.s * 0.35, q.s * 2, q.s * 0.7); x.restore(); }
    x.globalCompositeOperation = "source-over";
    /* the centrepiece is different for every Chroma item */
    const sc = easeOut(tt / 0.9) * (1 + 0.03 * Math.sin(tt * 4)), pr = (CENTER[item.variant] ?? CENTER.prism)(x, cx, cy, k, tt, sc, S, W, H);
    glow(x, cx, cy, pr * 0.8, "rgba(255,255,255,.9)", 0.5 * sc);
    /* lens streak */
    x.globalCompositeOperation = "lighter"; const ls = ease(tt / 0.5) * (1 - clamp((tt - 0.5) / 1.6)); if (ls > 0) { const g = x.createLinearGradient(0, cy, W, cy); g.addColorStop(0, "transparent"); g.addColorStop(0.5, `rgba(255,255,255,${ls})`); g.addColorStop(1, "transparent"); x.fillStyle = g; x.fillRect(0, cy - 3 * k, W, 6 * k); } x.globalCompositeOperation = "source-over";
    /* titles */
    const ty = cy + pr + 70 * k, word = "CHROMA", reveal = tt * 7;
    x.textAlign = "center"; x.shadowColor = "rgba(0,0,0,.6)"; x.shadowBlur = 16 * k; x.font = `800 ${R * 0.1}px Unbounded, Inter, system-ui, sans-serif`; x.letterSpacing = `${R * 0.012}px`;
    const wd = x.measureText(word).width, g = x.createLinearGradient(cx - wd / 2, 0, cx + wd / 2, 0); for (let s = 0; s <= 6; s++) g.addColorStop(s / 6, hue(s * 60 + tt * 140, 62));
    x.save(); x.beginPath(); x.rect(0, 0, cx - wd / 2 + wd * clamp(reveal / word.length), H); x.clip(); x.fillStyle = g; x.fillText(word, cx, ty + R * 0.07); x.restore();
    if (tt > 1.1) { const a = ease((tt - 1.1) / 0.7); x.globalAlpha = a; x.shadowBlur = 8 * k; x.fillStyle = "#fff"; x.font = `700 ${R * 0.045}px Inter, system-ui, sans-serif`; x.letterSpacing = "1px"; x.fillText(item.name, cx, ty + R * 0.07 + R * 0.075 + (1 - a) * 12 * k); x.font = `600 ${Math.max(11, R * 0.02)}px 'JetBrains Mono', monospace`; x.letterSpacing = "4px"; x.fillStyle = hue(tt * 120, 75); x.fillText((KIND[item.type] ?? "ITEM") + " · THE RAREST TIER", cx, ty + R * 0.07 + R * 0.12); x.globalAlpha = 1; }
    if (tt > 4.2) { x.globalAlpha = 0.4 + 0.4 * Math.sin(tt * 3); x.shadowBlur = 0; x.fillStyle = "#cfd6ff"; x.font = `500 ${Math.max(11, R * 0.018)}px Inter, system-ui, sans-serif`; x.letterSpacing = "1px"; x.fillText("Tap to continue", cx, H * 0.94); x.globalAlpha = 1; }
    x.shadowBlur = 0;
  }
  x.restore();
  /* white flash at the hit and a fade-in/out over the whole scene */
  if (t >= HIT - 0.05) { const f = 1 - clamp((t - HIT) / 0.55); if (f > 0) { x.fillStyle = `rgba(255,255,255,${f})`; x.fillRect(0, 0, W, H); } }
  if (t < 0.5) { x.fillStyle = `rgba(0,0,0,${1 - t / 0.5})`; x.fillRect(0, 0, W, H); }
}

/** Play the cutscene. Resolves when it ends or the viewer skips it. item = { name, type } */
export function playChroma(item) {
  item = { ...item, variant: chromaVariant(item.type, item.id) };
  return new Promise((resolve) => {
    const cv = document.createElement("canvas"); cv.className = "chroma-cut"; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", `Chroma pull: ${item.name}`);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fit = () => { cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); };
    fit(); document.body.appendChild(cv); addEventListener("resize", fit);
    const x = cv.getContext("2d"); { const arc = x.arc.bind(x); x.arc = (cx, cy, r, ...q) => arc(cx, cy, Math.max(0, r), ...q); } let stop = () => {}, ctx;
    if (state.me?.settings?.chatSound !== false) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); stop = sound(ctx, item.variant); } catch { /* silent */ } }
    const S = {}, t0 = performance.now(); let raf = 0, done = false;
    const end = () => { if (done) return; done = true; cancelAnimationFrame(raf); stop(); removeEventListener("resize", fit); removeEventListener("keydown", key, true); cv.classList.add("out"); setTimeout(() => { cv.remove(); try { ctx?.close(); } catch { /* ok */ } }, 450); resolve(); };
    const key = (e) => { if (e.key === "Escape" && (performance.now() - t0) / 1000 > 1) { e.preventDefault(); end(); } };
    addEventListener("keydown", key, true);
    cv.addEventListener("click", () => { if ((performance.now() - t0) / 1000 > 1) end(); });
    const loop = () => { const t = (performance.now() - t0) / 1000; x.setTransform(1, 0, 0, 1, 0, 0); x.scale(dpr, dpr); frame(x, innerWidth, innerHeight, t, S, item); if (t >= DUR) return end(); raf = requestAnimationFrame(loop); };
    loop();
  });
}
