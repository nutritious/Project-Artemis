/* Cutscenes for the season Apex items: the one super-limited item hidden in each limited pack.
   HALLOWEEN  "The Midnight Toll": a church bell strikes twelve, a lantern lights for every stroke, bats pour from the moon, a giant jack-o'-lantern rises and grins.
   FALL       "The Great Turning": leaves drift, the wind builds a funnel of leaves, it collapses to a point, and one giant golden leaf is born, then shatters into embers.
   Each is its own scene, nothing shared with Chroma, Secret, Forbidden or Omega. Canvas and Web Audio only. */
import { run, stepParticles, burst, revealText, easeOut, clamp, rnd, TAU, mono } from "./tiers.js";
import { EFFECTS, TAGS, BGS } from "./cosmetics.js";

const seasonOf = (item) => [...EFFECTS, ...TAGS, ...BGS].find((x) => x.id === item?.id)?.only === "fall" ? "fall" : "halloween";
const ease2 = (v) => { v = clamp(v); return v * v; };

/* ============================== HALLOWEEN ============================== */
const HDUR = 25, H_RISE = 11.4, H_GRIN = 12.8, H_WORD = 15.2, H_REVEAL = 18;
const TOLLS = Array.from({ length: 12 }, (_, i) => 1.5 + 9 * (1 - Math.pow(1 - i / 11, 1.7)));

function halloweenSound(a) {
  TOLLS.forEach((at, i) => { a.osc("sine", 196, 188, at, 2.4, 0.34, 0.01); a.osc("sine", 392, 380, at, 1.6, 0.1, 0.01); a.osc("triangle", 98, 96, at, 2.6, 0.18, 0.01); a.noise(at, 0.25, 0.12, 2500, 900, "bandpass", 0.005); });
  a.noise(0, 11, 0.06, 300, 700, "bandpass", 2);                       /* night wind */
  for (let i = 0; i < 9; i++) a.noise(1 + i * 1.1, 0.12, 0.05, 6000, 3000, "bandpass", 0.01); /* crickets */
  a.osc("sawtooth", 110, 55, H_RISE, 2.4, 0.22, 0.4); a.osc("square", 82, 41, H_RISE, 2.4, 0.08, 0.4);  /* the thing rising */
  a.noise(H_GRIN, 0.5, 0.3, 4000, 300, "lowpass", 0.01); a.osc("sawtooth", 70, 140, H_GRIN, 1.6, 0.2, 0.05); /* the grin */
  [0, 0.35, 0.7].forEach((d, i) => a.osc("sine", [147, 175, 220][i], [140, 170, 210][i], H_WORD + d, 3.5, 0.16, 0.05));
  a.osc("sine", 523, 520, H_REVEAL, 4, 0.1, 0.4);
}

function bat(x, px, py, s, flap) {
  const w = Math.sin(flap) * 0.7; x.save(); x.translate(px, py); x.fillStyle = "#0a0410";
  x.beginPath(); x.moveTo(0, -s * 0.15); x.quadraticCurveTo(s * 0.5, -s * (0.9 + w), s * 1.3, -s * (0.3 + w * 0.5)); x.quadraticCurveTo(s * 0.8, s * 0.05, s * 0.45, s * 0.1); x.quadraticCurveTo(s * 0.2, s * 0.35, 0, s * 0.15);
  x.quadraticCurveTo(-s * 0.2, s * 0.35, -s * 0.45, s * 0.1); x.quadraticCurveTo(-s * 0.8, s * 0.05, -s * 1.3, -s * (0.3 + w * 0.5)); x.quadraticCurveTo(-s * 0.5, -s * (0.9 + w), 0, -s * 0.15); x.fill();
  x.beginPath(); x.moveTo(-s * 0.12, -s * 0.12); x.lineTo(-s * 0.1, -s * 0.38); x.lineTo(0, -s * 0.15); x.lineTo(s * 0.1, -s * 0.38); x.lineTo(s * 0.12, -s * 0.12); x.fill(); x.restore();
}

/** a jack-o'-lantern. glow 0..1 lights the face, grin 0..1 opens the mouth */
function jack(x, cx, cy, r, glow, grin) {
  x.save(); x.translate(cx, cy);
  const g = x.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.2); g.addColorStop(0, `rgba(255,140,30,${0.45 * glow})`); g.addColorStop(1, "rgba(255,120,0,0)"); x.fillStyle = g; x.fillRect(-r * 2.2, -r * 2.2, r * 4.4, r * 4.4);
  const body = x.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.1); body.addColorStop(0, "#ff9a2e"); body.addColorStop(0.6, "#e0560f"); body.addColorStop(1, "#6b1d05");
  x.fillStyle = body; for (const [dx, w] of [[-0.45, 0.62], [0.45, 0.62], [-0.2, 0.7], [0.2, 0.7], [0, 0.72]]) { x.beginPath(); x.ellipse(dx * r, 0, r * w, r * 0.85, 0, 0, TAU); x.fill(); }
  x.fillStyle = "#2c3d0e"; x.beginPath(); x.moveTo(-r * 0.08, -r * 0.8); x.lineTo(-r * 0.04, -r * 1.12); x.lineTo(r * 0.14, -r * 1.2); x.lineTo(r * 0.1, -r * 0.8); x.fill();
  const f = `rgba(255,${Math.round(190 + 60 * glow)},${Math.round(60 * glow)},${0.35 + 0.65 * glow})`;
  x.fillStyle = "#1a0600"; x.fillRect(-r * 0.62, -r * 0.34, r * 1.24, r * 0.26 * 0); /* (no brow, the eyes carry it) */
  x.fillStyle = f; x.shadowColor = "#ff8a1f"; x.shadowBlur = r * 0.35 * glow;
  for (const sx of [-1, 1]) { x.beginPath(); x.moveTo(sx * r * 0.18, -r * 0.1); x.lineTo(sx * r * 0.52, -r * 0.4); x.lineTo(sx * r * 0.58, -r * 0.05); x.closePath(); x.fill(); }
  x.beginPath(); x.moveTo(0, r * 0.02); x.lineTo(-r * 0.08, r * 0.16); x.lineTo(r * 0.08, r * 0.16); x.closePath(); x.fill();
  const m = 0.25 + 0.75 * grin; x.beginPath(); x.moveTo(-r * 0.62 * m, r * 0.22);
  for (let i = 0; i <= 8; i++) { const u = i / 8, px = (-0.62 + 1.24 * u) * r * m, py = r * (0.26 + 0.04 * (i % 2 ? 1 : -1) + 0.5 * Math.sin(u * Math.PI) * m); x.lineTo(px, py); }
  for (let i = 8; i >= 0; i--) { const u = i / 8, px = (-0.62 + 1.24 * u) * r * m, py = r * (0.24 + 0.08 * (i % 2 ? -1 : 1)); x.lineTo(px, py); } x.closePath(); x.fill();
  x.shadowBlur = 0; x.restore();
}

function halloweenDraw(x, G, t, S, item) {
  const { W, H, R, cx, cy, k } = G, hz = H * 0.76;
  const sky = x.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, "#04010a"); sky.addColorStop(0.7, "#1a0828"); sky.addColorStop(1, "#3a1230"); x.fillStyle = sky; x.fillRect(0, 0, W, H);
  /* stars */
  S.stars ??= Array.from({ length: 70 }, () => [rnd(W), rnd(hz * 0.8), rnd(0.6, 1.6)]); x.fillStyle = "#fff";
  for (const [sx, sy, ss] of S.stars) { x.globalAlpha = 0.25 + 0.4 * Math.abs(Math.sin(t * 1.2 + sx)); x.fillRect(sx, sy, ss, ss); } x.globalAlpha = 1;
  /* the moon rises and swells with every stroke */
  const toll = TOLLS.filter((v) => t >= v).length, last = toll ? TOLLS[toll - 1] : -9, pulse = Math.exp(-(t - last) * 4);
  const mr = R * (0.46 + 0.02 * pulse), my = H * 0.34 + (1 - easeOut(t / 4)) * R * 1.1, mg = x.createRadialGradient(cx, my, mr * 0.9, cx, my, mr * 2.6);
  mg.addColorStop(0, `rgba(255,214,140,${0.35 + 0.2 * pulse})`); mg.addColorStop(1, "rgba(255,160,60,0)"); x.fillStyle = mg; x.fillRect(0, 0, W, H);
  const mb = x.createRadialGradient(cx - mr * 0.25, my - mr * 0.25, mr * 0.1, cx, my, mr); mb.addColorStop(0, "#fff7dc"); mb.addColorStop(1, "#f0b86a"); x.fillStyle = mb; x.beginPath(); x.arc(cx, my, mr, 0, TAU); x.fill();
  x.fillStyle = "rgba(160,100,40,.22)"; for (const [a, b, c] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.13], [-0.1, 0.35, 0.1], [0.4, -0.35, 0.08]]) { x.beginPath(); x.arc(cx + a * mr, my + b * mr, c * mr, 0, TAU); x.fill(); }
  /* fog */
  for (let i = 0; i < 3; i++) { const fy = hz - R * (0.05 + i * 0.12), fg = x.createLinearGradient(0, fy - 40 * k, 0, fy + 40 * k); fg.addColorStop(0, "rgba(180,150,220,0)"); fg.addColorStop(0.5, "rgba(180,150,220,.13)"); fg.addColorStop(1, "rgba(180,150,220,0)"); x.fillStyle = fg; x.fillRect(Math.sin(t * 0.3 + i) * 60 * k - 60, fy - 40 * k, W + 120, 80 * k); }
  /* dead trees and the ground */
  x.strokeStyle = "#050208"; x.lineCap = "round";
  for (let i = 0; i < 6; i++) { const bx = W * (i + 0.5) / 6 + (i % 2 ? 30 : -30) * k, bh = R * (0.35 + 0.15 * ((i * 7) % 3)); x.lineWidth = 7 * k; x.beginPath(); x.moveTo(bx, hz + 4); x.lineTo(bx + 6 * k, hz - bh); x.stroke(); x.lineWidth = 3 * k;
    for (const [dx, dy, l] of [[-1, 0.55, 0.3], [1, 0.7, 0.34], [-1, 0.85, 0.2], [1, 0.4, 0.22]]) { x.beginPath(); x.moveTo(bx + 3 * k, hz - bh * dy); x.lineTo(bx + 3 * k + dx * bh * l, hz - bh * dy - bh * l * 0.7); x.stroke(); } }
  x.fillStyle = "#050208"; x.beginPath(); x.moveTo(0, H); x.lineTo(0, hz); for (let i = 0; i <= 24; i++) x.lineTo(W * i / 24, hz + Math.sin(i * 1.7) * 8 * k); x.lineTo(W, H); x.fill();
  /* a lantern for every stroke */
  for (let i = 0; i < toll; i++) { const age = t - TOLLS[i], lx = W * (i + 0.5) / 12, big = 1 + 0.5 * Math.exp(-age * 3.5); jack(x, lx, hz + R * 0.2, R * 0.085 * big, clamp(age / 0.2) * (0.8 + 0.2 * Math.sin(t * 9 + i)), 1); }
  /* bats pour out of the moon, one pair per stroke, and are drawn in when the thing rises */
  S.bats ??= []; S.nb ??= 0;
  while (S.nb < toll) { for (let j = 0; j < 3; j++) S.bats.push({ x: cx + rnd(-30, 30) * k, y: my, vx: rnd(-1, 1) * W * 0.22, vy: rnd(-0.55, -0.1) * H * 0.3, s: rnd(10, 20) * k, f: rnd(TAU) }); S.nb++; }
  for (let i = S.bats.length - 1; i >= 0; i--) { const b = S.bats[i]; b.f += S.dt * 16; b.x += b.vx * S.dt; b.y += (b.vy + Math.sin(t * 3 + i) * 40 * k) * S.dt;
    if (t > H_RISE) { const dx = cx - b.x, dy = cy - b.y, d = Math.hypot(dx, dy) || 1, pull = (t - H_RISE) * 500 * k; b.vx += dx / d * pull * S.dt; b.vy += dy / d * pull * S.dt; if (d < R * 0.2 && t > H_RISE + 1.5) { S.bats.splice(i, 1); continue; } }
    if (b.x < -80 || b.x > W + 80 || b.y < -80) { b.vx = -b.vx; b.vy = Math.abs(b.vy) * 0.6; }
    bat(x, b.x, b.y, b.s, b.f); }
  /* every stroke flashes the world orange */
  if (pulse > 0.02) { x.fillStyle = `rgba(255,130,30,${0.2 * pulse})`; x.fillRect(0, 0, W, H); }
  /* the giant jack-o'-lantern */
  if (t >= H_RISE) {
    const q = easeOut((t - H_RISE) / 1.8), lift = easeOut((t - H_WORD) / 1.1), pr = R * (0.1 + 0.62 * q) * (1 - 0.35 * lift), py = cy + (1 - q) * R * 0.9 - R * 0.3 * lift;
    const shake = t > H_GRIN && t < H_GRIN + 0.6 ? (rnd(-1, 1) * 8 * k) : 0;
    x.fillStyle = `rgba(0,0,0,${0.6 * q})`; x.fillRect(0, 0, W, H);
    jack(x, cx + shake, py, pr, clamp((t - H_RISE - 0.6) / 1.2) * (0.85 + 0.15 * Math.sin(t * 12)), clamp((t - H_GRIN) / 0.8));
    if (t >= H_GRIN && t < H_GRIN + 0.8) { x.fillStyle = `rgba(255,200,120,${0.6 * (1 - (t - H_GRIN) / 0.8)})`; x.fillRect(0, 0, W, H); }
    if (t >= H_GRIN && !S.fired) { S.fired = true; burst(S, cx, py, 70, 420, ["#ff9a2e", "#ffd24a", "#fff3c4", "#ff5a14"], k); }
  }
  /* the word, dripping */
  if (t >= H_WORD) {
    const a = clamp((t - H_WORD) / 0.9), fs = R * 0.24, ty = cy + R * 0.18; x.save(); x.globalAlpha = a; x.textAlign = "center"; x.textBaseline = "middle"; x.font = `900 ${fs}px Georgia, "Times New Roman", serif`; x.letterSpacing = `${fs * 0.08}px`;
    x.shadowColor = "#ff7a1a"; x.shadowBlur = 28 * k; x.fillStyle = "#ffae42"; x.fillText("HALLOWEEN", cx, ty); x.shadowBlur = 0; x.fillStyle = "#ff7a1a";
    const tw = x.measureText("HALLOWEEN").width; S.drips ??= Array.from({ length: 12 }, (_, i) => [(i + 0.5) / 12, rnd(0.4, 1)]);
    for (const [u, sp] of S.drips) { const len = Math.min(R * 0.22, (t - H_WORD - 0.6) * R * 0.1 * sp); if (len > 0) { x.fillRect(cx - tw / 2 + u * tw - 2 * k, ty + fs * 0.3, 4 * k, len); x.beginPath(); x.arc(cx - tw / 2 + u * tw, ty + fs * 0.3 + len, 4 * k, 0, TAU); x.fill(); } }
    x.letterSpacing = "0px"; x.restore();
  }
  stepParticles(x, S, "#ff9a2e", 140 * k);
  if (t >= H_REVEAL - 0.3) { x.fillStyle = `rgba(0,0,0,${0.55 * clamp((t - H_REVEAL + 0.3) / 0.8)})`; x.fillRect(0, cy + R * 0.28, W, H); }
  revealText(x, G, t, H_REVEAL, item, "apex_halloween", "#ff9a2e", "THE NIGHT BELONGS TO YOU.");
  const v = x.createRadialGradient(cx, cy, R * 0.5, cx, cy, Math.max(W, H) * 0.75); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(10,0,16,.65)"); x.fillStyle = v; x.fillRect(0, 0, W, H);
  if (t > HDUR - 1.2) { x.fillStyle = `rgba(0,0,0,${clamp((t - (HDUR - 1.2)) / 1.2)})`; x.fillRect(0, 0, W, H); }
}

/* ================================ FALL ================================= */
const FDUR = 24, F_VORTEX = 4.6, F_PULL = 10.0, F_FLASH = 11.6, F_SHATTER = 15.0, F_WORD = 14.0, F_REVEAL = 17.6;
const PAL = ["#e0662a", "#f2a33a", "#c9382b", "#ffcf5a", "#8a3b12", "#d98b1f"];

function fallSound(a) {
  a.noise(0, 11, 0.07, 180, 600, "bandpass", 2); a.noise(4, 7, 0.28, 300, 2400, "bandpass", 2.5); a.noise(4, 7, 0.16, 120, 900, "lowpass", 2.5);
  for (let i = 0; i < 18; i++) a.noise(0.5 + i * 0.55, 0.18, 0.06 + i * 0.004, 5000, 2200, "highpass", 0.01);       /* leaves rustling */
  a.osc("sine", 90, 400, F_PULL, 1.6, 0.18, 0.5);                                                                       /* the funnel tightens */
  a.noise(F_FLASH - 0.05, 0.6, 0.35, 1200, 100, "lowpass", 0.005);
  [523, 659, 784, 1047].forEach((f, i) => a.osc("sine", f, f * 0.995, F_FLASH + i * 0.12, 4.5, 0.17, 0.02));         /* a chime as the leaf is born */
  a.noise(F_SHATTER, 1.8, 0.2, 6000, 1500, "highpass", 0.01);
  [392, 523, 659].forEach((f, i) => a.osc("triangle", f, f, F_REVEAL + i * 0.2, 4, 0.1, 0.4));
}

const MAPLE = [[0, -1], [.13, -.72], [.32, -.8], [.27, -.48], [.62, -.6], [.52, -.3], [.95, -.12], [.72, .05], [.8, .3], [.45, .28], [.18, .5], [.06, .42], [.05, .75]];
function leafPath(x, s) { /* a maple leaf, mirrored so it is symmetric */
  x.beginPath(); MAPLE.forEach(([px, py], i) => (i ? x.lineTo(px * s, py * s) : x.moveTo(px * s, py * s))); for (let i = MAPLE.length - 1; i >= 0; i--) x.lineTo(-MAPLE[i][0] * s, MAPLE[i][1] * s); x.closePath();
}

function fallDraw(x, G, t, S, item) {
  const { W, H, R, cx, cy, k } = G, hz = H * 0.78, sun = clamp((t - F_FLASH) / 1.2);
  const sky = x.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, "#241030"); sky.addColorStop(0.5, "#8a2a2c"); sky.addColorStop(1, "#ffb347"); x.fillStyle = sky; x.fillRect(0, 0, W, H);
  const sy = hz - R * 0.12 - (1 - Math.min(1, t / 9)) * R * 0.2 + clamp((t - 9) / 2) * R * 0.1, sg = x.createRadialGradient(cx, sy, R * 0.04, cx, sy, R * (0.9 + 0.5 * sun)); sg.addColorStop(0, "rgba(255,244,200,.95)"); sg.addColorStop(0.2, "rgba(255,190,80,.5)"); sg.addColorStop(1, "rgba(255,120,40,0)"); x.fillStyle = sg; x.fillRect(0, 0, W, H);
  x.fillStyle = "#fff1c4"; x.beginPath(); x.arc(cx, sy, R * 0.09, 0, TAU); x.fill();
  for (const [c, amp, y0, ph] of [["#3a1a1c", 40, 0.80, 0], ["#1f0d12", 55, 0.9, 2]]) { x.fillStyle = c; x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= 30; i++) x.lineTo(W * i / 30, H * y0 - Math.sin(i * 0.45 + ph) * amp * k - Math.sin(i * 1.1) * 12 * k); x.lineTo(W, H); x.fill(); }
  /* the leaves: free-falling first, then dragged into a funnel */
  const OX = cx, OY = H * 0.6; S.leaves ??= Array.from({ length: 200 }, (_, i) => ({ fx: rnd(W), fy: rnd(-H, H), vy: rnd(40, 110), sw: rnd(20, 70), ph: rnd(TAU), s: rnd(9, 22), c: PAL[i % PAL.length], rot: rnd(TAU), rs: rnd(-3, 3), h: Math.random(), a: rnd(TAU), spd: rnd(0.8, 1.4) }));
  const vb = easeOut((t - F_VORTEX) / 3), collapse = ease2((t - F_PULL) / 1.4), spin = t < F_VORTEX ? 0 : 1.5 + (t - F_VORTEX) * 0.9;
  if (t < F_FLASH) for (const l of S.leaves) {
    l.fy += l.vy * S.dt * (t < F_VORTEX ? 1 : 0.3); if (l.fy > H + 30) l.fy = -30; const fx = l.fx + Math.sin(t * 1.4 + l.ph) * l.sw * k * (1 + t * 0.15);
    l.a += spin * l.spd * S.dt; const fr = R * (0.12 + 0.95 * l.h) * (1 - collapse), vx = OX + Math.cos(l.a) * fr * (0.4 + 0.6 * l.h), vy2 = OY - (1 - l.h) * R * 1.0 + Math.sin(l.a) * fr * 0.18 * (1 - collapse) + collapse * (cy - OY + (1 - l.h) * R * 1.0);
    const px = fx + (vx - fx) * vb, py = l.fy + (vy2 - l.fy) * vb; l.rot += l.rs * S.dt * (1 + vb * 3);
    x.save(); x.translate(px, py); x.rotate(l.rot); x.scale(1, 0.6 + 0.4 * Math.cos(l.rot * 2)); x.fillStyle = l.c; leafPath(x, l.s * k * (1 - 0.6 * collapse)); x.fill(); x.restore();
  }
  /* dark swirl behind the funnel */
  if (false) { x.fillStyle = "rgba(30,8,6,0)"; x.beginPath(); x.moveTo(OX - R * 0.1, OY - R); x.lineTo(OX + R * 0.1, OY - R); x.lineTo(OX + R * 0.5 * vb, OY + R * 0.2); x.lineTo(OX - R * 0.5 * vb, OY + R * 0.2); x.fill(); }
  /* the flash and the golden leaf */
  if (t >= F_FLASH) {
    const q = clamp((t - F_FLASH) / 1.6), pop = q < 1 ? easeOut(q) * (1 + 0.15 * Math.sin(q * 9)) : 1, lift = easeOut((t - F_REVEAL) / 1.1), shat = clamp((t - F_SHATTER) / 0.6), size = R * 0.62 * pop * (1 - 0.35 * lift), ly = cy - R * 0.18 - R * 0.32 * lift;
    if (t < F_FLASH + 0.8) { x.fillStyle = `rgba(255,240,200,${1 - (t - F_FLASH) / 0.8})`; x.fillRect(0, 0, W, H); }
    x.save(); x.translate(cx, ly);
    x.save(); x.globalAlpha = 0.35 * (1 - shat); x.rotate(t * 0.05); for (let i = 0; i < 14; i++) { x.rotate(TAU / 14); x.fillStyle = i % 2 ? "rgba(255,210,100,.5)" : "rgba(255,150,40,.3)"; x.beginPath(); x.moveTo(0, 0); x.lineTo(-size * 0.12, -size * 2.4); x.lineTo(size * 0.12, -size * 2.4); x.fill(); } x.restore(); x.globalAlpha = 1;
    if (shat < 1) {
      x.globalAlpha = 1 - shat; x.rotate(Math.sin(t * 1.5) * 0.05); const lg = x.createLinearGradient(0, -size, 0, size); lg.addColorStop(0, "#fff3b0"); lg.addColorStop(0.5, "#ffb52e"); lg.addColorStop(1, "#c4521a");
      x.shadowColor = "#ffb52e"; x.shadowBlur = 40 * k; x.fillStyle = lg; leafPath(x, size); x.fill(); x.shadowBlur = 0;
      x.strokeStyle = "rgba(120,40,8,.7)"; x.lineWidth = 3 * k; const vp = clamp((t - F_FLASH - 0.6) / 1.4); x.beginPath(); x.moveTo(0, size * 1.05); x.lineTo(0, -size * 0.95 * vp); for (let i = 0; i < 6; i++) { const a = [-1, 1][i % 2] * (0.6 + 0.18 * (i >> 1)), yy = size * (0.5 - 0.28 * (i >> 1)); x.moveTo(0, yy); x.lineTo(Math.sin(a) * size * 0.8 * vp, yy - Math.cos(a) * size * 0.5 * vp); } x.stroke(); x.globalAlpha = 1;
    }
    x.restore();
    if (t >= F_SHATTER && !S.fired) { S.fired = true; burst(S, cx, ly, 140, 520, ["#ffcf5a", "#ffb52e", "#ff7a2e", "#fff3b0", "#c9382b"], k); }
  }
  if (t >= F_WORD) {
    const a = clamp((t - F_WORD) / 1), fs = R * 0.19, sp = fs * (0.9 - 0.62 * easeOut((t - F_WORD) / 1.6)); x.save(); x.globalAlpha = a; x.textAlign = "center"; x.textBaseline = "middle"; x.font = `800 ${fs}px Georgia, "Times New Roman", serif`; x.letterSpacing = `${sp}px`;
    x.shadowColor = "#ff8a2e"; x.shadowBlur = 22 * k; x.fillStyle = "#fff3d0"; x.fillText("THE GREAT TURNING", cx, cy + R * 0.2); x.restore();
  }
  stepParticles(x, S, "#ffcf5a", 220 * k);
  if (t >= F_REVEAL - 0.3) { x.fillStyle = `rgba(20,4,2,${0.55 * clamp((t - F_REVEAL + 0.3) / 0.8)})`; x.fillRect(0, cy + R * 0.28, W, H); }
  revealText(x, G, t, F_REVEAL, item, "apex_fall", "#ffb347", "THE SEASON ENDS. THE LEAF STAYS.");
  const v = x.createRadialGradient(cx, cy, R * 0.55, cx, cy, Math.max(W, H) * 0.75); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(20,4,2,.55)"); x.fillStyle = v; x.fillRect(0, 0, W, H);
  if (t > FDUR - 1.2) { x.fillStyle = `rgba(0,0,0,${clamp((t - (FDUR - 1.2)) / 1.2)})`; x.fillRect(0, 0, W, H); }
}

export function playApex(item) {
  return seasonOf(item) === "fall" ? run(item, FDUR, fallSound, fallDraw, "A super-limited Fall item was pulled") : run(item, HDUR, halloweenSound, halloweenDraw, "A super-limited Halloween item was pulled");
}
