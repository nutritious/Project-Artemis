/* Secret cutscene: plays when someone pulls a Secret from a pack. About 27 seconds of canvas and Web Audio.
   A terminal types out a warning, the picture tears, a heartbeat speeds up, the screen cracks, a black hole opens, lightning, then the name decodes out of the noise.
   Built to stay light: few particles, no heavy blur, and it lowers its own resolution if the computer struggles. */
import { state } from "./util.js";
import { tierOf, oddsText, playForbidden, playOmega } from "./tiers.js";
import { playApex } from "./apex.js";

/* The real odds, worked out from the same numbers the pack roll uses: one hidden roll per pack slot, then a pick among every Secret. */
const TIER = { secret: { word: "SECRET", hue: 0 } };

/* the timeline, in seconds */
const T = { glitch: 5.0, black: 7.0, crack: 9.8, hole: 13.0, word: 14.6, reveal: 20.5 };
export const SDUR = 27.5;
const TAU = Math.PI * 2, clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const easeOut = (v) => 1 - Math.pow(1 - clamp(v), 3);
const KIND = { tag: "TITLE", effect: "PROFILE EFFECT", bg: "BACKDROP", theme: "THEME" };
const GLYPH = "█▓▒░#@%&$?/\\<>[]{}";
const BEATS = [7.2, 7.95, 8.6, 9.15, 9.55, 9.85, 10.1, 10.3, 10.5];
/* the terminal that types itself out before everything goes wrong */
const VARIANTS = {
  horizon: [["> opening pack...", 0], ["> reading contents... ok", 0], ["> WARNING: unlisted item detected", 1], ["> item.rarity = ???", 1], ["> item.owner = YOU", 0], ["> this was never supposed to be here", 1]],
  redacted: [["> opening pack...", 0], ["> reading contents... ok", 0], ["> ACCESS: [REDACTED]", 1], ["> authorised by: [REDACTED]", 1], ["> file status = CLASSIFIED", 1], ["> you were not supposed to see this", 1]],
  phantom: [["> opening pack...", 0], ["> reading contents... ok", 0], ["> WARNING: unregistered presence", 1], ["> source = directly behind you", 1], ["> it has been here the whole time", 1], ["> do not turn around", 1]],
  kernel: [["> opening pack...", 0], ["> reading contents... ok", 0], ["> FATAL: kernel panic, not syncing", 1], ["> stack overflow at 0xDEADC0DE", 1], ["> init process killed", 1], ["> halted by an unknown item", 1]],
  signal: [["> opening pack...", 0], ["> reading contents... ok", 0], ["> INCOMING: unknown transmission", 1], ["> origin = deep space", 1], ["> message length = unknown", 1], ["> it is replying to you", 1]],
  rift: [["> opening pack...", 0], ["> reading contents... ok", 0], ["> WARNING: spatial tear detected", 1], ["> source = the other side", 1], ["> something is looking back", 1], ["> do not look into it", 1]],
};
const variantOf = (item) => ({ redacted: "redacted", "the-rift": "rift", phantom: "phantom", "kernel-panic": "kernel", "deep-signal": "signal", eclipse: "horizon", "the-forbidden": "redacted", "blackout-zone": "rift", "omega-flare": "signal", "omega-prime": "kernel", "end-of-time": "phantom" }[item?.id] ?? "horizon");
const CPS = 26, LINE_GAP = 0.25;
const typedFor = (V) => VARIANTS[V].map(([t], i, a) => ({ t, start: a.slice(0, i).reduce((n, [x]) => n + x.length / CPS + LINE_GAP, 0.35) }));

/* ------------------------------- sound ------------------------------- */
function sound(ctx, V) {
  const typed = typedFor(V);
  const out = ctx.createGain(); out.gain.value = 0.9; out.connect(ctx.destination);
  const nbuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nbuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const T0 = ctx.currentTime + 0.05, srcs = [];
  const osc = (type, f0, f1, at, dur, vol, filt) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, T0 + at); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), T0 + at + dur);
    g.gain.setValueAtTime(0.0001, T0 + at); g.gain.exponentialRampToValueAtTime(vol, T0 + at + Math.min(0.03, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, T0 + at + dur);
    let node = o; if (filt) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = filt; o.connect(f); node = f; }
    node.connect(g); g.connect(out); o.start(T0 + at); o.stop(T0 + at + dur + 0.05); srcs.push(o);
  };
  const noise = (at, dur, vol, f0, f1, type = "bandpass") => {
    const s = ctx.createBufferSource(); s.buffer = nbuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, T0 + at); f.frequency.exponentialRampToValueAtTime(f1, T0 + at + dur); f.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, T0 + at); g.gain.exponentialRampToValueAtTime(vol, T0 + at + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, T0 + at + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(T0 + at, 0, Math.min(2, dur + 0.1)); srcs.push(s);
  };
  typed.forEach((l) => { for (let i = 0; i < l.t.length; i++) osc("square", 1300 + (i % 4) * 90, 1300, l.start + i / CPS, 0.012, 0.028); });  /* typing */
  osc("sine", 38, 36, 1.5, 6, 0.1, 120);                                          /* a hum that creeps in */
  noise(T.glitch - 0.1, 2.1, 0.14, 4000, 700);
  for (let i = 0; i < 14; i++) osc("square", rnd(300, 3200), rnd(100, 2000), T.glitch + rnd(0, 2), 0.05, 0.05);
  osc("sawtooth", 46, 26, T.black, 14, 0.2, 170);                                  /* the drone that never quite stops */
  BEATS.forEach((b, i) => { const v = 0.55 + i * 0.05; osc("sine", 95, 38, b, 0.28, v); osc("sine", 120, 45, b + 0.12, 0.2, v * 0.6); });
  noise(T.crack - 0.2, 3.4, 0.45, 220, 8000); osc("sawtooth", 60, 900, T.crack, 3.2, 0.09, 1100); /* the riser as the screen cracks */
  for (let i = 0; i < 7; i++) noise(T.crack + 0.4 + i * 0.4, 0.2, 0.2, 2500, 300);             /* the glass breaking */
  if (V === "horizon") {
  noise(T.hole, 2.2, 0.85, 3000, 55, "lowpass"); osc("sine", 55, 20, T.hole, 4.5, 0.95);        /* impact */
    osc("sawtooth", 82, 78, T.hole + 0.3, 14, 0.06, 260); osc("sawtooth", 83.5, 79, T.hole + 0.3, 14, 0.06, 260);
  } else if (V === "redacted") {                                                   /* stamps and a typewriter */
    for (let i = 0; i < 14; i++) { const at = T.hole + i * 0.42; osc("sine", 140, 40, at, 0.22, 0.7); noise(at, 0.12, 0.4, 1800, 300); if (i % 4 === 3) osc("sine", 2400, 2400, at + 0.1, 0.5, 0.05); }
    osc("sawtooth", 55, 52, T.hole, 14, 0.07, 200);
  } else if (V === "phantom") {                                                     /* whispers, a cold wind, a slow choir */
    for (let i = 0; i < 12; i++) noise(T.hole + i * 0.5, 0.9, 0.12, 900 + (i % 4) * 400, 2600);
    noise(T.hole - 0.2, 4, 0.35, 200, 1400, "bandpass"); osc("sine", 62, 30, T.hole, 5, 0.85);
    [220, 261.63, 311.13, 392].forEach((f, i) => osc("sine", f * 0.995, f * 1.005, T.hole + 0.8 + i * 0.4, 12, 0.05));
  } else if (V === "kernel") {                                                      /* error beeps, a crash, a boot chime */
    for (let i = 0; i < 24; i++) osc("square", 900 + (i % 3) * 300, 900 + (i % 3) * 300, T.hole + i * 0.18, 0.06, 0.07);
    noise(T.hole, 1.2, 0.8, 4000, 200, "lowpass"); osc("sine", 60, 25, T.hole, 3, 0.9);
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => osc("triangle", f, f, T.reveal - 0.4 + i * 0.12, 0.8, 0.07));
  } else if (V === "signal") {                                                      /* sonar pings, morse-like blips, a rising tone */
    for (let i = 0; i < 9; i++) { osc("sine", 1400, 1380, T.hole + i * 1.1, 1.1, 0.12); osc("sine", 700, 690, T.hole + i * 1.1 + 0.02, 1.6, 0.05); }
    for (let i = 0; i < 26; i++) osc("square", 1800, 1800, T.hole + 1 + i * 0.21 + (i % 3) * 0.04, 0.05 + (i % 2) * 0.1, 0.035);
    osc("sine", 120, 880, T.hole, 6, 0.1); osc("sine", 50, 22, T.hole, 5, 0.85); noise(T.hole, 2.2, 0.5, 5000, 200, "lowpass");
  } else {                                                                          /* the tearing of space, then a choir */
    noise(T.hole - 0.2, 3.2, 0.7, 300, 9000); noise(T.hole, 2, 0.6, 2500, 60, "lowpass"); osc("sine", 50, 18, T.hole, 5, 0.9);
    [196, 247, 294, 392, 494].forEach((f, i) => { osc("sine", f * 0.99, f * 1.01, T.hole + 1 + i * 0.3, 12, 0.06); osc("sine", f * 1.5, f * 1.52, T.hole + 3 + i * 0.3, 9, 0.025); });
  }
  osc("sine", 240, 60, T.word, 0.8, 0.55); noise(T.word, 0.6, 0.4, 5000, 400);                  /* SECRET slams */
  osc("sine", 70, 24, T.word, 2.5, 0.8);
  for (let i = 0; i < 9; i++) noise(T.word + 1.2 + i * 0.55, 0.18, 0.18, 6000, 800);          /* lightning */
  for (let i = 0; i < 18; i++) osc("square", 1700 + (i % 3) * 400, 1700, T.reveal + 0.5 + i * 0.12, 0.015, 0.045); /* the decode ticks */
  [110, 116.5, 164.8, 174.6, 220].forEach((f, i) => osc("sine", f, f * 0.995, T.reveal + 0.2, 6, 0.1 + i * 0.008));
  osc("sine", 880, 870, T.reveal + 2.4, 3.2, 0.08); osc("sine", 1318, 1300, T.reveal + 2.5, 3, 0.05);
  return () => { try { out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setValueAtTime(out.gain.value, ctx.currentTime); out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25); srcs.forEach((s) => { try { s.stop(ctx.currentTime + 0.3); } catch { /* done */ } }); } catch { /* closed */ } };
}

/* ------------------------------- picture ------------------------------- */
let scan = null;
const scanPattern = (x) => { if (!scan) { const c = document.createElement("canvas"); c.width = 1; c.height = 4; const g = c.getContext("2d"); g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(0, 0, 1, 2); scan = c; } return x.createPattern(scan, "repeat"); };
const crackPts = (cx, cy, len, wd, t, ang, off) => { const pts = []; for (let i = 0; i <= 28; i++) { const u = i / 28 - 0.5, d = u * len; pts.push([cx + Math.sin(ang) * d + Math.cos(ang) * Math.sin(i * 2.3 + off + Math.floor(t * 18)) * wd * 0.9 * (0.4 + Math.cos(u * Math.PI)), cy - Math.cos(ang) * d + Math.sin(ang) * Math.sin(i * 2.3 + off + Math.floor(t * 18)) * wd * 0.9 * (0.4 + Math.cos(u * Math.PI))]); } return pts; };

function frame(x, W, H, t, S, item) {
  const V = (S.V ??= variantOf(item)), typed = (S.typed ??= typedFor(V)), LINES = VARIANTS[V];
  const R = Math.min(W, H) / 2, cx = W / 2, cy = H / 2, k = R / 380;
  S.dt = Math.min(0.05, t - (S.last ?? t)); S.last = t;
  S.stars ??= Array.from({ length: 150 }, () => ({ a: rnd(TAU), d: rnd(0.15, 1.3), s: rnd(0.6, 2) }));
  S.sp ??= []; S.bolts ??= []; S.sparks ??= [];
  x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
  x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
  const mono = (px, w = 700) => `${w} ${px}px ui-monospace, Menlo, Consolas, monospace`;

  /* 0. the terminal types itself out (0 to 5s) */
  if (t < T.glitch + 0.4) {
    const fs = Math.max(14, Math.min(26, R * 0.058)), lh = fs * 1.7, x0 = cx - Math.min(W * 0.42, 420 * Math.max(1, k)), y0 = cy - lh * 2.5, fade = 1 - clamp((t - T.glitch) / 0.4);
    x.font = mono(fs); x.textAlign = "left"; x.textBaseline = "alphabetic"; x.globalAlpha = fade;
    let lastY = y0, lastW = 0;
    typed.forEach((l, i) => { const n = Math.floor(clamp((t - l.start) * CPS, 0, l.t.length)); if (n <= 0 && t < l.start) return; const txt = l.t.slice(0, n), y = y0 + i * lh; x.fillStyle = LINES[i][1] ? "#ff2e4d" : "#9ab"; const jit = LINES[i][1] && t > 3 ? rnd(-1, 1) * (t - 3) * 1.2 : 0; x.fillText(txt, x0 + jit, y); lastY = y; lastW = x.measureText(txt).width; });
    if (Math.floor(t * 2.5) % 2 === 0) { x.fillStyle = "#ff2e4d"; x.fillRect(x0 + lastW + 4, lastY - fs * 0.85, fs * 0.55, fs); }
    x.globalAlpha = 1;
    if (t > 3.2) { const a = clamp((t - 3.2) / 1.8) * 0.5; x.fillStyle = `rgba(255,46,77,${a * (0.5 + 0.5 * Math.sin(t * 9))})`; x.fillRect(0, 0, W, H * 0.012); x.fillRect(0, H * 0.988, W, H * 0.012); }
  }

  /* A. the picture tears (5 to 7s) */
  if (t >= T.glitch && t < T.black) {
    const inten = clamp((t - T.glitch) / 1.7);
    for (let i = 0; i < 6 + inten * 30; i++) { const y = rnd(H), h = rnd(2, 8 + inten * 52), r = Math.random(); x.fillStyle = r < 0.4 ? "#ff2e4d" : r < 0.7 ? "#fff" : "#16001a"; x.globalAlpha = rnd(0.25, 0.9) * (0.4 + inten * 0.6); x.fillRect(rnd(-50, W * 0.5), y, rnd(W * 0.2, W), h); }
    x.globalAlpha = 1; x.fillStyle = Math.random() < 0.5 ? "#ff2e4d" : "#fff"; x.font = mono(Math.max(14, R * 0.07)); x.textAlign = "center";
    x.fillText(["SIGNAL LOST", "ERROR 0x5EC2E7", "UNKNOWN ITEM", "DO NOT OPEN", "IT SEES YOU"][Math.floor((t - T.glitch) * 12) % 5], cx + rnd(-8, 8), cy + rnd(-6, 6));
    if (t > T.black - 0.12) { x.fillStyle = "#000"; x.fillRect(0, 0, W, H); }
  }

  /* B. blackout and a heartbeat that speeds up (7 to 9.8s) */
  if (t >= T.black && t < T.hole) {
    let pulse = 0; for (const b of BEATS) if (t >= b) pulse += Math.exp(-(t - b) * 7) * 1.1;
    const r = R * (0.03 + 0.1 * Math.min(1.6, pulse)), g = x.createRadialGradient(cx, cy, 0, cx, cy, r * 3.4);
    g.addColorStop(0, "rgba(255,70,90,.95)"); g.addColorStop(0.35, "rgba(255,46,77,.45)"); g.addColorStop(1, "rgba(255,46,77,0)"); x.fillStyle = g; x.fillRect(cx - r * 3.4, cy - r * 3.4, r * 6.8, r * 6.8);
    if (t < T.crack) { const e = Math.min(1, pulse) * 0.35; const eg = x.createRadialGradient(cx, cy, Math.min(W, H) * 0.45, cx, cy, Math.max(W, H) * 0.75); eg.addColorStop(0, "rgba(255,46,77,0)"); eg.addColorStop(1, `rgba(255,46,77,${e})`); x.fillStyle = eg; x.fillRect(0, 0, W, H); }
  }

  /* C. the screen cracks, more and more (9.8 to 13s) */
  if (t >= T.crack && t < T.hole + 0.1) {
    const p = clamp((t - T.crack) / 3.2), len = H * 1.1 * easeOut(p * 1.25), wd = (2 + 52 * p * p) * k;
    x.save(); x.translate(rnd(-1, 1) * p * 12 * k, rnd(-1, 1) * p * 12 * k);
    const cracks = [[0, 0, 1], [0.5, 0.35, 0.6], [-0.45, 0.5, 0.55], [1.2, 0.65, 0.4]];
    for (const [ang, st, sc] of cracks) { const pp = clamp((p - st) / (1 - st)); if (pp <= 0) continue; const pts = crackPts(cx, cy, len * sc * pp * 1.2, wd * sc, t, ang, ang * 5);
      for (const [w, c, a] of [[wd * 3.4, "#ff2e4d", 0.18], [wd * 1.6, "#ff6a7d", 0.5], [wd * 0.55, "#fff", 1]]) { x.strokeStyle = c; x.globalAlpha = a; x.lineWidth = Math.max(1, w * sc); x.lineJoin = "round"; x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke(); } }
    x.restore(); x.globalAlpha = 1;
    if (p > 0.55) { const a = (p - 0.55) / 0.45 * 0.5, lg = x.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5); lg.addColorStop(0, `rgba(255,255,255,${a})`); lg.addColorStop(1, "rgba(255,46,77,0)"); x.fillStyle = lg; x.fillRect(0, 0, W, H); }
    for (let i = 0; i < 4 && S.sp.length < 180; i++) S.sp.push({ x: rnd(W), y: rnd(H), l: 1 });
    x.fillStyle = "#ff6a7d";
    for (const q of S.sp) { const dx = cx - q.x, dy = cy - q.y; q.x += dx * 2.6 * S.dt; q.y += dy * 2.6 * S.dt; q.l -= 0.9 * S.dt; x.globalAlpha = clamp(q.l); x.fillRect(q.x, q.y, 2.5 * k + 1, 2.5 * k + 1); }
    S.sp = S.sp.filter((q) => q.l > 0); x.globalAlpha = 1;
  }

  /* E. the centrepiece (13s on): a black hole, a redaction, or a rift */
  if (t >= T.hole && V === "horizon") {
    const tt = t - T.hole, grow = easeOut(tt / 1.5), r0 = R * 0.3 * grow * (1 + 0.025 * Math.sin(tt * 3));
    x.globalCompositeOperation = "lighter";
    for (const s of S.stars) { s.d -= (0.05 + (1.2 / (s.d + 0.15)) * 0.09) * S.dt; s.a += (0.5 / (s.d + 0.2)) * S.dt; if (s.d < 0.07) { s.d = rnd(0.9, 1.3); s.a = rnd(TAU); }
      const px = cx + Math.cos(s.a) * s.d * R * 1.6, py = cy + Math.sin(s.a) * s.d * R * 1.6, tx = px - Math.cos(s.a + 1.4) * 6 * s.s * k, ty = py - Math.sin(s.a + 1.4) * 6 * s.s * k;
      x.strokeStyle = s.d < 0.4 ? "#ff6a7d" : "#c9cfff"; x.globalAlpha = clamp(s.d * 1.2) * 0.8; x.lineWidth = s.s * k + 0.4; x.beginPath(); x.moveTo(px, py); x.lineTo(tx, ty); x.stroke(); }
    x.globalAlpha = 1;
    /* shockwaves when it opens and when the word lands */
    for (const t1 of [T.hole, T.word]) { const q = (t - t1) / 1.6; if (q > 0 && q < 1) { x.strokeStyle = t1 === T.word ? "#fff" : "#ff6a7d"; x.globalAlpha = (1 - q) * 0.8; x.lineWidth = (14 - 10 * q) * k + 1; x.beginPath(); x.arc(cx, cy, easeOut(q) * Math.max(W, H) * 0.7, 0, TAU); x.stroke(); } }
    x.globalAlpha = 1;
    /* lightning off the hole */
    if (t > T.word + 0.8 && t < T.reveal + 2 && S.bolts.length < 5 && Math.random() < 0.18) { const a = rnd(TAU), pts = [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0]]; let aa = a, d = r0; for (let i = 0; i < 9; i++) { aa += rnd(-0.35, 0.35); d += R * rnd(0.12, 0.26); pts.push([cx + Math.cos(aa) * d, cy + Math.sin(aa) * d]); } S.bolts.push({ pts, l: 1 }); }
    for (const b of S.bolts) { b.l -= 3.2 * S.dt; x.globalAlpha = clamp(b.l); for (const [w, c] of [[6 * k, "#ff2e4d"], [2 * k, "#fff"]]) { x.strokeStyle = c; x.lineWidth = Math.max(1, w); x.beginPath(); b.pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke(); } }
    S.bolts = S.bolts.filter((b) => b.l > 0); x.globalAlpha = 1;
    /* the accretion disk */
    x.save(); x.translate(cx, cy); x.rotate(-0.35); x.scale(1, 0.3);
    for (let i = 0; i < 6; i++) { const rr = r0 * (1.25 + i * 0.28), a = tt * (2.2 - i * 0.25); x.strokeStyle = ["#fff", "#ffb36b", "#ff6a3d", "#ff2e4d", "#a00022", "#5a0014"][i]; x.globalAlpha = 0.9 - i * 0.1; x.lineWidth = (12 - i * 1.4) * k;
      x.beginPath(); x.arc(0, 0, rr, a, a + TAU * 0.78); x.stroke(); }
    x.restore(); x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
    const g = x.createRadialGradient(cx, cy, r0 * 0.9, cx, cy, r0 * 1.9); g.addColorStop(0, "rgba(255,46,77,.5)"); g.addColorStop(1, "rgba(255,46,77,0)"); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r0 * 1.9, 0, TAU); x.fill();
    x.fillStyle = "#000"; x.beginPath(); x.arc(cx, cy, r0, 0, TAU); x.fill();
    x.strokeStyle = "#ff2e4d"; x.lineWidth = 3 * k + 1; x.beginPath(); x.arc(cx, cy, r0, 0, TAU); x.stroke();
  }


  if (t >= T.hole && V === "redacted") {
    const tt = t - T.hole, rows = 18, rh = H / rows, fs = Math.max(8, rh * 0.62);
    x.fillStyle = "#0d0d0f"; x.fillRect(0, 0, W, H);
    x.font = mono(fs, 600); x.textAlign = "left"; x.textBaseline = "middle";
    for (let i = 0; i < rows; i++) {
      const y = i * rh + rh / 2, seed = i * 97.3;
      x.fillStyle = "rgba(220,220,230,.35)"; x.fillText("the quick report on item ".repeat(6).slice(0, 90 + (i % 5) * 9), W * 0.04 + ((i * 37) % 30), y);
      const delay = (i * 0.37) % 4.2, p = easeOut((tt - delay) / 0.35);
      if (p > 0) { const len = W * (0.55 + 0.42 * ((Math.sin(seed) + 1) / 2)), left = i % 2 ? W - len * p : 0; x.fillStyle = "#000"; x.fillRect(left, y - rh * 0.42, len * p, rh * 0.84); x.strokeStyle = "rgba(255,255,255,.18)"; x.lineWidth = 1; x.strokeRect(left + 0.5, y - rh * 0.42, len * p, rh * 0.84); }
    }
    for (const [at, ang, tx, ty, label] of [[0.2, -0.2, 0.5, 0.3, "CLASSIFIED"], [3.2, 0.14, 0.32, 0.68, "TOP SECRET"], [6, -0.1, 0.68, 0.5, "REDACTED"]]) {
      const q = (t - T.hole - at); if (q <= 0) continue; const sc = 1 + 2.2 * Math.exp(-q * 14), fsz = R * 0.2 * sc;
      x.save(); x.translate(W * tx, H * ty); x.rotate(ang); x.font = `900 ${fsz}px Impact, "Arial Black", sans-serif`; x.textAlign = "center"; x.globalAlpha = clamp(q * 8) * 0.85; const w = x.measureText(label).width;
      x.lineWidth = 6 * k + 1; x.strokeStyle = "#ff2e4d"; x.fillStyle = "rgba(20,0,4,.6)"; x.fillRect(-w / 2 - 20 * k, -fsz * 0.65, w + 40 * k, fsz * 1.3); x.strokeRect(-w / 2 - 20 * k, -fsz * 0.65, w + 40 * k, fsz * 1.3); x.fillStyle = "#ff2e4d"; x.fillText(label, 0, 0); x.restore();
    }
    x.globalAlpha = 1;
  }
  if (t >= T.hole && V === "rift") {
    const tt = t - T.hole, open = easeOut(tt / 2.6), gw = (6 + 0.42 * W * open) * 0.5 * (1 + 0.03 * Math.sin(tt * 4));
    x.fillStyle = "#04000a"; x.fillRect(0, 0, W, H);
    /* the other side, seen through the gap */
    x.save(); x.beginPath(); x.moveTo(cx, -10);
    for (let i = 0; i <= 60; i++) { const yy = (i / 60) * (H + 20) - 10; x.lineTo(cx - gw * (0.82 + 0.18 * Math.sin(i * 0.9 + tt * 2)) * Math.sin(Math.PI * i / 60), yy); }
    for (let i = 60; i >= 0; i--) { const yy = (i / 60) * (H + 20) - 10; x.lineTo(cx + gw * (0.82 + 0.18 * Math.sin(i * 1.1 - tt * 2.4)) * Math.sin(Math.PI * i / 60), yy); }
    x.closePath(); x.clip();
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.6); g.addColorStop(0, "#fff"); g.addColorStop(0.25, "#b9a2ff"); g.addColorStop(0.55, "#4b1d9a"); g.addColorStop(1, "#0a0020"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = "lighter"; x.strokeStyle = "rgba(120,220,255,.35)"; x.lineWidth = 2 * k + 1;
    for (let i = 0; i < 14; i++) { x.beginPath(); for (let j = 0; j <= 16; j++) { const yy = (j / 16) * H, xx = cx + Math.sin(j * 0.7 + tt * (1 + i * 0.12) + i) * gw * (0.2 + i * 0.05); j ? x.lineTo(xx, yy) : x.moveTo(xx, yy); } x.stroke(); }
    x.globalCompositeOperation = "source-over"; x.restore();
    x.strokeStyle = "#c9b8ff"; x.globalAlpha = 0.9; x.lineWidth = 3 * k + 1; x.beginPath(); x.moveTo(cx, 0); for (let i = 0; i <= 60; i++) x.lineTo(cx - gw * (0.82 + 0.18 * Math.sin(i * 0.9 + tt * 2)) * Math.sin(Math.PI * i / 60), (i / 60) * H); x.stroke(); x.globalAlpha = 1;
    /* something opens its eye */
    const e = clamp((tt - 3.2) / 1.6), ey = cy - R * 0.66;
    if (e > 0) {
      const ew = R * 0.5 * easeOut(e), blink = (tt % 5.5) > 5.2 ? 0.1 : 1, eh = ew * 0.34 * blink, look = Math.sin(tt * 0.7) * ew * 0.12, lookY = Math.cos(tt * 0.5) * eh * 0.15;
      x.save(); x.beginPath(); x.moveTo(cx - ew, ey); x.quadraticCurveTo(cx, ey - eh * 2, cx + ew, ey); x.quadraticCurveTo(cx, ey + eh * 2, cx - ew, ey); x.clip();
      x.fillStyle = "#f2ecff"; x.fillRect(cx - ew, ey - eh * 2, ew * 2, eh * 4);
      const ig = x.createRadialGradient(cx + look, ey + lookY, 0, cx + look, ey + lookY, eh * 1.1); ig.addColorStop(0, "#000"); ig.addColorStop(0.35, "#000"); ig.addColorStop(0.4, "#ff2e4d"); ig.addColorStop(1, "#5a0014"); x.fillStyle = ig; x.beginPath(); x.arc(cx + look, ey + lookY, eh * 1.1, 0, TAU); x.fill();
      x.restore(); x.strokeStyle = "#000"; x.lineWidth = 3 * k + 1; x.beginPath(); x.moveTo(cx - ew, ey); x.quadraticCurveTo(cx, ey - eh * 2, cx + ew, ey); x.quadraticCurveTo(cx, ey + eh * 2, cx - ew, ey); x.stroke();
    }
  }


  if (t >= T.hole && V === "phantom") {
    const tt = t - T.hole, flick = tt > 2.2 && Math.sin(t * 41) > 0.82 ? 0.25 : 1;
    const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#04060d"); bg.addColorStop(1, "#0a1222"); x.fillStyle = bg; x.fillRect(0, 0, W, H);
    S.fog ??= Array.from({ length: 9 }, () => ({ x: rnd(W), y: rnd(H * 0.5, H), r: rnd(0.3, 0.7), s: rnd(8, 22) }));
    for (const f of S.fog) { const fx = (f.x + t * f.s * k) % (W + 400 * k) - 200 * k, g = x.createRadialGradient(fx, f.y, 0, fx, f.y, R * f.r); g.addColorStop(0, "rgba(170,200,235,.13)"); g.addColorStop(1, "rgba(170,200,235,0)"); x.fillStyle = g; x.fillRect(fx - R, f.y - R, R * 2, R * 2); }
    const ghost = (gx, gy, sz, a, wob) => {
      x.save(); x.translate(gx, gy); x.globalAlpha = a * flick;
      const g = x.createLinearGradient(0, -sz, 0, sz * 1.1); g.addColorStop(0, "rgba(235,246,255,.95)"); g.addColorStop(1, "rgba(150,190,235,.05)"); x.fillStyle = g; x.shadowColor = "rgba(190,230,255,.9)"; x.shadowBlur = 24 * k;
      x.beginPath(); x.moveTo(-sz * 0.6, sz); x.lineTo(-sz * 0.6, -sz * 0.2); x.arc(0, -sz * 0.2, sz * 0.6, Math.PI, 0); x.lineTo(sz * 0.6, sz);
      for (let i = 4; i >= -4; i--) x.lineTo((i / 4) * sz * 0.6, sz + (i % 2 ? 1 : -1) * sz * 0.14 + Math.sin(t * 3 + i + wob) * sz * 0.05);
      x.closePath(); x.fill(); x.shadowBlur = 0; x.fillStyle = "#02040a"; x.beginPath(); x.ellipse(-sz * 0.22, -sz * 0.25, sz * 0.1, sz * 0.15, 0, 0, TAU); x.ellipse(sz * 0.22, -sz * 0.25, sz * 0.1, sz * 0.15, 0, 0, TAU); x.fill(); x.beginPath(); x.ellipse(0, sz * 0.05, sz * 0.09, sz * 0.15, 0, 0, TAU); x.fill(); x.restore();
    };
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + tt * 0.3, rr = R * (0.85 - 0.35 * easeOut(tt / 4)), gp = clamp((tt - i * 0.35) / 1.2); ghost(cx + Math.cos(a) * rr * 1.2, cy + R * 0.1 + Math.sin(a) * rr * 0.5, R * 0.16, 0.5 * gp, i); }
    ghost(cx, cy + R * 0.05, R * (0.12 + 0.34 * easeOut((tt - 1.5) / 3)), clamp((tt - 1.2) / 1.4) * 0.95, 9);
  }
  if (t >= T.hole && V === "kernel") {
    const tt = t - T.hole, cols = 26, rows = 14, cw = W / cols, rh = H / rows;
    x.fillStyle = "#00102e"; x.fillRect(0, 0, W, H);
    S.hex ??= Array.from({ length: cols * rows }, () => "0123456789ABCDEF"[Math.floor(Math.random() * 16)] + "0123456789ABCDEF"[Math.floor(Math.random() * 16)]);
    for (let n = 0; n < 8; n++) S.hex[Math.floor(Math.random() * S.hex.length)] = "0123456789ABCDEF"[Math.floor(Math.random() * 16)] + "0123456789ABCDEF"[Math.floor(Math.random() * 16)];
    x.font = mono(Math.max(9, rh * 0.5), 600); x.textAlign = "center"; x.textBaseline = "middle";
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) { const lit = (Math.sin(c * 1.7 + tt * 2.2 - r * 0.8) + 1) / 2; x.fillStyle = `rgba(80,160,255,${0.08 + lit * 0.3})`; x.fillText(S.hex[c * rows + r], c * cw + cw / 2, r * rh + rh / 2); }
    const bw = Math.min(W * 0.8, 760 * Math.max(1, k)), bx = cx - bw / 2, by = cy - R * 0.5, bh = R * 0.9, ap = easeOut(tt / 0.4);
    x.globalAlpha = ap; x.fillStyle = "#0a47ff"; x.fillRect(bx, by, bw, bh); x.strokeStyle = "#fff"; x.lineWidth = 2 * k + 1; x.strokeRect(bx + 8 * k, by + 8 * k, bw - 16 * k, bh - 16 * k);
    x.textAlign = "left"; x.fillStyle = "#fff"; x.font = `900 ${R * 0.2}px ui-monospace, Menlo, Consolas, monospace`; x.fillText(":(", bx + 28 * k, by + bh * 0.28);
    x.font = mono(Math.max(13, R * 0.05), 800); x.fillText("KERNEL PANIC", bx + 28 * k, by + bh * 0.5); x.font = mono(Math.max(10, R * 0.034), 600);
    const pct = Math.min(100, Math.floor(clamp((tt - 1) / 6) * 100)); x.fillText(`an unknown item crashed the system  ${pct}%`, bx + 28 * k, by + bh * 0.64); x.fillText(["0xDEADC0DE", "0xBADF00D", "0xC0FFEE", "0xFEEDFACE"][Math.floor(tt * 3) % 4] + "  at  secret.sys", bx + 28 * k, by + bh * 0.78);
    x.fillStyle = "rgba(255,255,255,.25)"; x.fillRect(bx + 28 * k, by + bh * 0.86, bw - 56 * k, 6 * k); x.fillStyle = "#fff"; x.fillRect(bx + 28 * k, by + bh * 0.86, (bw - 56 * k) * pct / 100, 6 * k);
    x.globalAlpha = 1; if (Math.random() < 0.06 && tt > 2) { x.fillStyle = "rgba(255,255,255,.12)"; x.fillRect(0, rnd(H), W, rnd(4, 30)); }
  }
  if (t >= T.hole && V === "signal") {
    const tt = t - T.hole, by = H * 0.86;
    x.fillStyle = "#010d0a"; x.fillRect(0, 0, W, H);
    x.strokeStyle = "rgba(80,255,170,.12)"; x.lineWidth = 1; for (let i = 1; i < 14; i++) { x.beginPath(); x.moveTo((i / 14) * W, 0); x.lineTo((i / 14) * W, H); x.stroke(); } for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo(0, (i / 8) * H); x.lineTo(W, (i / 8) * H); x.stroke(); }
    for (let i = 0; i < 6; i++) { const q = ((tt * 0.35 + i / 6) % 1), r = q * R * 1.9; x.strokeStyle = `rgba(80,255,170,${(1 - q) * 0.7})`; x.lineWidth = (4 - q * 3) * k + 1; x.beginPath(); x.arc(cx, by, r, Math.PI, TAU); x.stroke(); }
    const amp = R * 0.34 * easeOut(tt / 4) * (tt > 8 ? 1 + 0.2 * Math.sin(tt * 3) : 1), fy = cy - R * 0.05;
    for (const [w, col, al] of [[10 * k, "rgba(80,255,170,.25)", 1], [2.5 * k + 1, "#c8ffe6", 1]]) { x.strokeStyle = col; x.lineWidth = w; x.globalAlpha = al; x.beginPath(); for (let px = 0; px <= W; px += 4) { const u = px / W, env = Math.sin(u * Math.PI), v = Math.sin(u * 22 + tt * 5) * 0.5 + Math.sin(u * 9 - tt * 2.4) * 0.35 + Math.sin(u * 47 + tt * 11) * 0.15 * Math.sin(tt); const yy = fy + v * amp * env; px ? x.lineTo(px, yy) : x.moveTo(px, yy); } x.stroke(); } x.globalAlpha = 1;
    x.font = mono(Math.max(11, R * 0.04), 700); x.textAlign = "left"; x.fillStyle = "rgba(80,255,170,.8)"; x.fillText("FREQ 1420.405 MHZ", W * 0.04, H * 0.09); x.textAlign = "right"; x.fillText(tt < 3 ? "SIGNAL: WEAK" : tt < 6 ? "SIGNAL: LOCKED" : "SIGNAL: REPLYING", W * 0.96, H * 0.09);
    const sc = clamp((tt - 2.5) / 5); x.textAlign = "center"; x.font = mono(Math.max(12, R * 0.045), 700); x.fillStyle = "rgba(80,255,170,.65)"; const msg = "HELLO WE HAVE BEEN WAITING FOR YOU"; x.fillText(msg.slice(0, Math.floor(msg.length * sc)) + (Math.floor(tt * 3) % 2 ? "_" : ""), cx, H * 0.72);
  }
  if (t >= T.reveal - 0.3 && V !== "horizon") { x.fillStyle = `rgba(0,0,0,${(V === "rift" ? 0.82 : 0.7) * clamp((t - T.reveal + 0.3) / 0.9)})`; x.fillRect(0, 0, W, H); }
  /* the word and the reveal */
  if (t >= T.word) {
    const WORD = TIER[tierOf(item)].word, tt = t - T.word, slam = easeOut(tt / 0.28), lift = easeOut((t - T.reveal) / 0.8), size = R * (0.34 - 0.16 * lift) * (3 - 2 * slam), ty = cy + R * (0.02 - 0.5 * lift);
    const glitch = (Math.floor(t * 22) % 9 === 0) ? rnd(-14, 14) * k : 0;
    const shake = tt < 0.6 ? (1 - tt / 0.6) * 14 * k : 0; x.save(); x.translate(rnd(-1, 1) * shake, rnd(-1, 1) * shake);
    x.textAlign = "center"; x.textBaseline = "middle"; x.font = `900 ${size}px Impact, "Arial Black", system-ui, sans-serif`; x.letterSpacing = `${size * 0.08}px`;
    x.globalAlpha = clamp(tt / 0.1);
    x.globalCompositeOperation = "lighter"; x.fillStyle = "#ff2038"; x.fillText(WORD, cx - 7 * k + glitch, ty); x.fillStyle = "#18e0ff"; x.fillText(WORD, cx + 7 * k - glitch, ty);
    x.globalCompositeOperation = "source-over"; x.fillStyle = "#fff"; x.fillText(WORD, cx + glitch * 0.4, ty); x.globalAlpha = 1; x.letterSpacing = "0px";
    if (t >= T.word + 2.4 && t < T.reveal - 0.2) { const fl = 0.5 + 0.5 * Math.sin(t * 5); x.font = mono(Math.max(12, R * 0.05)); x.fillStyle = `rgba(255,46,77,${0.4 + fl * 0.5})`; x.letterSpacing = `${R * 0.02}px`; x.fillText(t < T.word + 5.5 ? "SOMEONE JUST PULLED SOMETHING" : t < T.word + 8.5 ? "EVERYONE ONLINE HAS BEEN TOLD" : "IT HAS CHOSEN YOU", cx, cy + R * 0.62); x.letterSpacing = "0px"; }
    if (t >= T.reveal + 0.2) {
      const name = String(item.name ?? "???"), n = Math.floor((t - T.reveal - 0.2) / 0.12), seed = Math.floor(t * 14);
      let shown = ""; for (let i = 0; i < name.length; i++) shown += i < n || name[i] === " " ? name[i] : GLYPH[(seed * 7 + i * 13) % GLYPH.length];
      const done = n >= name.length;
      if (done) { const gl = x.createRadialGradient(cx, cy + R * 0.18, 0, cx, cy + R * 0.18, R * 0.9); gl.addColorStop(0, `rgba(255,46,77,${0.25 + 0.12 * Math.sin(t * 3)})`); gl.addColorStop(1, "rgba(255,46,77,0)"); x.fillStyle = gl; x.fillRect(0, 0, W, H); }
      x.font = `800 ${Math.max(18, R * 0.15)}px Impact, "Arial Black", system-ui, sans-serif`; x.fillStyle = "#fff"; x.globalAlpha = clamp((t - T.reveal - 0.2) / 0.3); x.fillText(shown, cx, cy + R * 0.18);
      x.font = mono(Math.max(12, R * 0.055)); x.fillStyle = "#ff2e4d"; x.letterSpacing = `${R * 0.02}px`; x.fillText(KIND[item.type] ?? "ITEM", cx, cy + R * 0.34); x.letterSpacing = "0px";
      if (n >= name.length + 3) { x.fillStyle = "rgba(255,255,255,.55)"; x.font = mono(Math.max(11, R * 0.045), 600); x.fillText("no one else has this", cx, cy + R * 0.46); }
      if (n >= name.length + 6) { const o = clamp((t - T.reveal - 0.2 - (name.length + 6) * 0.12) / 0.8); x.globalAlpha = o; x.fillStyle = "#ff2e4d"; x.font = mono(Math.max(14, R * 0.07), 800); x.letterSpacing = `${R * 0.012}px`; x.fillText(oddsText(tierOf(item)), cx, cy + R * 0.6); x.fillStyle = "rgba(255,255,255,.5)"; x.font = mono(Math.max(10, R * 0.034), 600); x.letterSpacing = `${R * 0.014}px`; x.fillText("CHANCE PER PACK SLOT", cx, cy + R * 0.68); x.letterSpacing = "0px"; x.globalAlpha = 1; }
      x.globalAlpha = 1;
      if (done) { for (let i = 0; i < 2 && S.sparks.length < 90; i++) S.sparks.push({ x: cx + rnd(-1, 1) * R * 0.9, y: cy + R * 0.5, v: rnd(30, 120) * k, l: 1 }); x.fillStyle = "#ff8a9a"; for (const q of S.sparks) { q.y -= q.v * S.dt; q.l -= 0.35 * S.dt; x.globalAlpha = clamp(q.l); x.fillRect(q.x, q.y, 2.2 * k + 1, 2.2 * k + 1); } S.sparks = S.sparks.filter((q) => q.l > 0); x.globalAlpha = 1; }
    }
    x.restore();
  }

  /* flash, scanlines, vignette, fade */
  if (t >= T.hole - 0.05 && t < T.hole + 1.1) { x.fillStyle = `rgba(255,255,255,${(1 - clamp((t - T.hole) / 1.1)) * (t < T.hole ? (t - T.hole + 0.05) / 0.05 : 1)})`; x.fillRect(0, 0, W, H); }
  if (t >= T.word && t < T.word + 0.35) { x.fillStyle = `rgba(255,255,255,${0.5 * (1 - (t - T.word) / 0.35)})`; x.fillRect(0, 0, W, H); }
  if (t >= T.glitch) { x.fillStyle = scanPattern(x); x.fillRect(0, 0, W, H); }
  const v = x.createRadialGradient(cx, cy, R * 0.5, cx, cy, Math.max(W, H) * 0.75); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(40,0,6,.7)"); x.fillStyle = v; x.fillRect(0, 0, W, H);
  if (t > SDUR - 1.2) { x.fillStyle = `rgba(0,0,0,${clamp((t - (SDUR - 1.2)) / 1.2)})`; x.fillRect(0, 0, W, H); }
}

/** Play the Secret cutscene. Resolves when it ends or the viewer skips it. item = { name, type } */
export function playSecret(item) {
  { const tier = tierOf(item); if (tier === "forbidden") return playForbidden(item); if (tier === "omega") return playOmega(item); if (tier === "apex") return playApex(item); }
  return new Promise((resolve) => {
    const cv = document.createElement("canvas"); cv.className = "secret-cut"; { const th = TIER[tierOf(item)].hue; if (th) cv.style.filter = `hue-rotate(${th}deg) saturate(1.15)`; } cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "A Secret was pulled");
    const LV = [Math.min(1, window.devicePixelRatio || 1), 0.7, 0.5]; let lv = 0, ema = 16, nf = 0;
    const fit = () => { cv.width = Math.max(2, Math.round(innerWidth * LV[lv])); cv.height = Math.max(2, Math.round(innerHeight * LV[lv])); };
    fit(); document.body.appendChild(cv); addEventListener("resize", fit);
    const x = cv.getContext("2d");
    let stop = () => {}, ctx;
    if (state.me?.settings?.chatSound !== false) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); stop = sound(ctx, variantOf(item)); } catch { /* silent */ } }
    const S = {}, t0 = performance.now(); let raf = 0, done = false;
    const end = () => { if (done) return; done = true; clearTimeout(fail); cancelAnimationFrame(raf); stop(); removeEventListener("resize", fit); removeEventListener("keydown", key, true); cv.classList.add("out"); setTimeout(() => { cv.remove(); try { ctx?.close(); } catch { /* ok */ } }, 450); resolve(); };
    const key = (e) => { if (e.key === "Escape" && (performance.now() - t0) / 1000 > 2) { e.preventDefault(); end(); } };
    addEventListener("keydown", key, true);
    cv.addEventListener("click", () => { if ((performance.now() - t0) / 1000 > 2) end(); });
    const fail = setTimeout(end, (SDUR + 1.5) * 1000); /* never leave the screen covered */
    let prev = performance.now();
    const loop = () => {
      const now = performance.now(), t = (now - t0) / 1000; ema = ema * 0.85 + Math.min(200, now - prev) * 0.15; prev = now;
      if (++nf % 10 === 0 && ema > 30 && lv < LV.length - 1) { lv++; fit(); ema = 16; }
      try { x.setTransform(1, 0, 0, 1, 0, 0); x.scale(cv.width / innerWidth, cv.height / innerHeight); frame(x, innerWidth, innerHeight, t, S, item); }
      catch (e) { console.error("[secret]", e); return end(); }
      if (t >= SDUR) return end(); raf = requestAnimationFrame(loop);
    };
    loop();
  });
}
