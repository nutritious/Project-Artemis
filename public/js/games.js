/* The arcade games. Each factory returns { update(dt, input), draw(ctx), over, score(), tag }. Skins: "space" or "halloween". */
const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const SKINS = {
  space: { bg0: "#04050c", bg1: "#10122b", accent: "#8b7bff", good: "#ffc857", bad: "#ff5d73", glow: "rgba(139,123,255,.28)" },
  halloween: { bg0: "#0a0510", bg1: "#2a0f1c", accent: "#ff8a2b", good: "#7dff6a", bad: "#c14bff", glow: "rgba(255,138,43,.28)" },
};
function backdrop(x, W, H, sk, bg, speed, t) {
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, sk.bg0); g.addColorStop(1, sk.bg1); x.fillStyle = g; x.fillRect(0, 0, W, H); x.fillStyle = "#fff";
  for (const b of bg) { x.globalAlpha = 0.25 + b.z * 0.5; x.fillRect(b.x, b.y, b.z * 1.8, b.z * 1.8 + speed * b.z * 0.012); } x.globalAlpha = 1;
  const rg = x.createRadialGradient(W / 2, H + 30, 20, W / 2, H + 30, W * 0.7); rg.addColorStop(0, "transparent"); rg.addColorStop(0.35, sk.glow); rg.addColorStop(1, "transparent"); x.fillStyle = rg; x.fillRect(0, 0, W, H);
}
const mkbg = (W, H) => Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() }));
const moveBg = (bg, W, H, sp, dt) => { for (const b of bg) { b.y += sp * 0.35 * b.z * dt; if (b.y > H) { b.y = 0; b.x = Math.random() * W; } } };
function rock(x, sk, px, py, r, a, pts) {
  x.save(); x.translate(px, py); x.rotate(a);
  if (sk === SKINS.halloween) { x.fillStyle = "#ff8a2b"; x.strokeStyle = "#5a2a00"; x.lineWidth = 2; x.beginPath(); x.ellipse(0, 0, r, r * 0.88, 0, 0, TAU); x.fill(); x.stroke(); x.beginPath(); x.moveTo(0, -r * 0.88); x.quadraticCurveTo(-r * 0.4, 0, 0, r * 0.88); x.moveTo(0, -r * 0.88); x.quadraticCurveTo(r * 0.4, 0, 0, r * 0.88); x.stroke(); x.fillStyle = "#2a1400"; x.beginPath(); x.moveTo(-r * 0.5, -r * 0.2); x.lineTo(-r * 0.2, -r * 0.2); x.lineTo(-r * 0.35, -r * 0.5); x.moveTo(r * 0.5, -r * 0.2); x.lineTo(r * 0.2, -r * 0.2); x.lineTo(r * 0.35, -r * 0.5); x.moveTo(-r * 0.45, r * 0.25); x.lineTo(r * 0.45, r * 0.25); x.lineTo(r * 0.3, r * 0.5); x.lineTo(-r * 0.3, r * 0.5); x.fill(); x.fillStyle = "#3a7d2a"; x.fillRect(-2, -r * 1.08, 5, r * 0.25); }
  else { x.beginPath(); pts.forEach((m, i) => { const an = (i / pts.length) * TAU; x[i ? "lineTo" : "moveTo"](Math.cos(an) * r * m, Math.sin(an) * r * m); }); x.closePath(); x.fillStyle = "#2a2f52"; x.strokeStyle = sk.accent; x.lineWidth = 2; x.fill(); x.stroke(); }
  x.restore();
}
function pickup(x, sk, px, py, t) {
  x.save(); x.translate(px, py); x.shadowColor = sk.good; x.shadowBlur = 14; x.fillStyle = sk.good;
  if (sk === SKINS.halloween) { x.beginPath(); x.arc(0, 0, 8 + Math.sin(t * 8) * 1.5, 0, TAU); x.fill(); x.fillStyle = "#0a0510"; x.beginPath(); x.arc(-3, -1, 1.6, 0, TAU); x.arc(3, -1, 1.6, 0, TAU); x.fill(); }
  else { x.beginPath(); for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, r = i % 2 ? 4 : 10; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.fill(); }
  x.restore();
}
function ship(x, sk, px, py, flame) {
  x.save(); x.translate(px, py); x.shadowColor = sk.accent; x.shadowBlur = 16; x.fillStyle = "#e8ecff"; x.beginPath(); x.moveTo(0, -18); x.lineTo(12, 14); x.lineTo(0, 8); x.lineTo(-12, 14); x.closePath(); x.fill();
  if (flame) { x.fillStyle = sk.accent; x.beginPath(); x.moveTo(-5, 12); x.lineTo(0, 22 + Math.random() * 8); x.lineTo(5, 12); x.fill(); } x.restore();
}
const steer = (g, dt, inp, lim = 18) => { if (inp.x != null) g.x += (inp.x - g.x) * Math.min(1, dt * 14); else g.x += ((inp.keys.has("right") || inp.keys.has("d") ? 1 : 0) - (inp.keys.has("left") || inp.keys.has("a") ? 1 : 0)) * 440 * dt; g.x = clamp(g.x, lim, g.W - lim); };
const hud = (x, W, left, right, sk) => { x.font = "600 14px 'JetBrains Mono', monospace"; x.textAlign = "left"; x.fillStyle = "#e8ecff"; x.fillText(left, 14, 24); x.textAlign = "right"; x.fillStyle = sk.bad; x.fillText(right, W - 14, 24); };
const hearts = (n, m = 3) => "♥".repeat(Math.max(0, n)) + "·".repeat(Math.max(0, m - n));

/* ---------- Eclipse Run ---------- */
export function run(W, H, sk, sfx) {
  const g = { W, H, x: W / 2, t: 0, hp: 3, inv: 0, stars: 0, rocks: [], pick: [], spawn: 0, sstar: 2, bg: mkbg(W, H), over: false, tag: "run" };
  g.score = () => Math.floor(g.t * 10 + g.stars * 25);
  g.update = (dt, inp) => {
    g.t += dt; const k = 1 + g.t / 35, sp = 190 * k; steer(g, dt, inp);
    g.spawn -= dt; if (g.spawn <= 0) { g.spawn = Math.max(0.16, 0.62 / k); const r = 12 + Math.random() * 22; g.rocks.push({ x: r + Math.random() * (W - 2 * r), y: -r, r, v: sp * (0.8 + Math.random() * 0.5), a: rnd(6), w: rnd(-1.5, 1.5), pts: Array.from({ length: 9 }, () => 0.75 + Math.random() * 0.3) }); }
    g.sstar -= dt; if (g.sstar <= 0) { g.sstar = rnd(1.4, 3); g.pick.push({ x: rnd(20, W - 20), y: -12, v: sp * 0.75 }); }
    for (const r of g.rocks) { r.y += r.v * dt; r.a += r.w * dt; } for (const p of g.pick) p.y += p.v * dt; g.inv = Math.max(0, g.inv - dt);
    const sy = H - 54;
    for (const r of g.rocks) if (!g.inv && Math.hypot(r.x - g.x, r.y - sy) < r.r * 0.85 + 11) { g.hp--; g.inv = 1.2; r.y = H + 99; sfx(110, 0.25, 0.08); if (g.hp <= 0) g.over = true; }
    for (const p of g.pick) if (Math.hypot(p.x - g.x, p.y - sy) < 24) { p.y = H + 99; g.stars++; sfx(880 + g.stars * 12, 0.07); }
    g.rocks = g.rocks.filter((r) => r.y < H + r.r + 10); g.pick = g.pick.filter((p) => p.y < H + 20); moveBg(g.bg, W, H, sp, dt);
  };
  g.draw = (x) => { backdrop(x, W, H, sk, g.bg, 190 + g.t * 5, g.t); for (const r of g.rocks) rock(x, sk, r.x, r.y, r.r, r.a, r.pts); for (const p of g.pick) pickup(x, sk, p.x, p.y, g.t); if (!(g.inv > 0 && Math.floor(g.inv * 12) % 2)) ship(x, sk, g.x, H - 54, true); hud(x, W, String(g.score()).padStart(5, "0"), hearts(g.hp), sk); };
  return g;
}

/* ---------- Asteroid Blaster ---------- */
export function blaster(W, H, sk, sfx) {
  const g = { W, H, x: W / 2, t: 0, hp: 3, inv: 0, pts: 0, rocks: [], bul: [], pick: [], spawn: 0.5, cd: 0, rapid: 0, bg: mkbg(W, H), over: false, tag: "blaster" };
  const R = [0, 13, 22, 34], PTS = [0, 30, 20, 10];
  g.score = () => Math.floor(g.pts + g.t * 2);
  const mk = (size, x, y, vx) => ({ size, r: R[size], x, y, vx: vx ?? rnd(-40, 40), vy: rnd(70, 130) + g.t * 1.6, a: rnd(6), w: rnd(-1.5, 1.5), pts: Array.from({ length: 9 }, () => 0.75 + Math.random() * 0.3) });
  g.update = (dt, inp) => {
    g.t += dt; steer(g, dt, inp); g.inv = Math.max(0, g.inv - dt); g.rapid = Math.max(0, g.rapid - dt); g.cd -= dt;
    if (g.cd <= 0) { g.cd = g.rapid ? 0.11 : 0.22; const sh = g.rapid ? [-10, 0, 10] : [0]; for (const o of sh) g.bul.push({ x: g.x + o, y: H - 74, vx: o * 3 }); sfx(520, 0.04, 0.02); }
    g.spawn -= dt; if (g.spawn <= 0) { g.spawn = Math.max(0.35, 1.25 - g.t * 0.012); g.rocks.push(mk(Math.random() < 0.35 ? 3 : Math.random() < 0.6 ? 2 : 1, rnd(30, W - 30), -40)); }
    for (const b of g.bul) { b.y -= 560 * dt; b.x += b.vx * dt; } g.bul = g.bul.filter((b) => b.y > -10);
    for (const r of g.rocks) { r.x += r.vx * dt; r.y += r.vy * dt; r.a += r.w * dt; if (r.x < r.r || r.x > W - r.r) r.vx *= -1; }
    for (const b of g.bul) for (const r of g.rocks) if (!b.dead && !r.dead && Math.hypot(b.x - r.x, b.y - r.y) < r.r + 4) {
      b.dead = true; r.dead = true; g.pts += PTS[r.size]; sfx(300 - r.size * 40, 0.08, 0.04);
      if (r.size > 1) { g.rocks.push(mk(r.size - 1, r.x - 6, r.y, -60), mk(r.size - 1, r.x + 6, r.y, 60)); } if (Math.random() < 0.07) g.pick.push({ x: r.x, y: r.y, v: 110 });
    }
    g.bul = g.bul.filter((b) => !b.dead); g.rocks = g.rocks.filter((r) => !r.dead && r.y < H + 50);
    const sy = H - 54; for (const r of g.rocks) if (!g.inv && Math.hypot(r.x - g.x, r.y - sy) < r.r * 0.85 + 11) { g.hp--; g.inv = 1.3; r.dead = true; sfx(100, 0.3, 0.08); if (g.hp <= 0) g.over = true; }
    for (const p of g.pick) { p.y += p.v * dt; if (Math.hypot(p.x - g.x, p.y - sy) < 24) { p.y = H + 99; g.rapid = 8; sfx(900, 0.15, 0.05); } } g.pick = g.pick.filter((p) => p.y < H + 20); moveBg(g.bg, W, H, 160, dt);
  };
  g.draw = (x) => { backdrop(x, W, H, sk, g.bg, 160, g.t); for (const r of g.rocks) rock(x, sk, r.x, r.y, r.r, r.a, r.pts); x.fillStyle = sk.accent; for (const b of g.bul) { x.fillRect(b.x - 1.5, b.y - 8, 3, 12); } for (const p of g.pick) pickup(x, sk, p.x, p.y, g.t); if (!(g.inv > 0 && Math.floor(g.inv * 12) % 2)) ship(x, sk, g.x, H - 54, true); hud(x, W, String(g.score()).padStart(5, "0") + (g.rapid ? "  ⚡" : ""), hearts(g.hp), sk); };
  return g;
}

/* ---------- Moon Lander ---------- */
export function lander(W, H, sk, sfx) {
  const N = 48, hs = [], padW = 5, padAt = 6 + Math.floor(Math.random() * (N - 12)), big = Math.random() < 0.4;
  for (let i = 0; i <= N; i++) hs.push(H * 0.82 - (Math.sin(i * 0.55) * 26 + Math.sin(i * 1.3) * 14 + Math.random() * 10));
  const padY = hs[padAt]; for (let i = 0; i < padW; i++) hs[padAt + i] = padY;
  const g = { W, H, t: 0, x: rnd(W * 0.2, W * 0.8), y: 60, vx: rnd(-40, 40), vy: 0, ang: 0, fuel: 100, over: false, result: "", pts: 0, bg: mkbg(W, H), tag: "lander", thrust: false };
  const gy = (px) => { const f = clamp(px / W, 0, 1) * N, i = Math.min(N - 1, Math.floor(f)); return hs[i] + (hs[i + 1] - hs[i]) * (f - i); };
  g.score = () => g.pts;
  g.update = (dt, inp) => {
    if (g.result) return; g.t += dt;
    const left = inp.keys.has("left") || inp.keys.has("a") || (inp.down && inp.x != null && inp.x < W / 3), right = inp.keys.has("right") || inp.keys.has("d") || (inp.down && inp.x != null && inp.x > W * 2 / 3);
    g.thrust = (inp.keys.has("up") || inp.keys.has("space") || inp.keys.has("w") || (inp.down && inp.x != null && inp.x >= W / 3 && inp.x <= W * 2 / 3)) && g.fuel > 0;
    g.ang += ((right ? 1 : 0) - (left ? 1 : 0)) * 2.2 * dt; g.ang = clamp(g.ang, -1.2, 1.2);
    if (g.thrust) { g.vx += Math.sin(g.ang) * 230 * dt; g.vy -= Math.cos(g.ang) * 230 * dt; g.fuel = Math.max(0, g.fuel - 20 * dt); }
    g.vy += 85 * dt; g.x += g.vx * dt; g.y += g.vy * dt; if (g.x < 10 || g.x > W - 10) { g.x = clamp(g.x, 10, W - 10); g.vx *= -0.4; }
    const gnd = gy(g.x);
    if (g.y + 12 >= gnd) {
      const onPad = g.x >= (padAt / N) * W && g.x <= ((padAt + padW) / N) * W, soft = g.vy < 48 && Math.abs(g.vx) < 32 && Math.abs(g.ang) < 0.28;
      if (onPad && soft) { g.pts = Math.floor((500 + g.fuel * 5) * (big ? 1.5 : 1)); g.result = "LANDED"; sfx(660, 0.3, 0.06); } else { const d = Math.abs(g.x - (padAt + padW / 2) / N * W); g.pts = Math.max(0, Math.floor(100 - d / W * 200)); g.result = onPad ? "TOO HARD" : "CRASHED"; sfx(90, 0.4, 0.09); }
      g.y = gnd - 12; g.over = true;
    }
    moveBg(g.bg, W, H, 0, dt);
  };
  g.draw = (x) => {
    backdrop(x, W, H, sk, g.bg, 0, g.t); x.fillStyle = sk === SKINS.halloween ? "#1d0f25" : "#2a2f52"; x.beginPath(); x.moveTo(0, H); hs.forEach((v, i) => x.lineTo((i / N) * W, v)); x.lineTo(W, H); x.fill(); x.strokeStyle = sk.accent; x.lineWidth = 2; x.beginPath(); hs.forEach((v, i) => x[i ? "lineTo" : "moveTo"]((i / N) * W, v)); x.stroke();
    x.strokeStyle = sk.good; x.lineWidth = 5; x.beginPath(); x.moveTo((padAt / N) * W, padY); x.lineTo(((padAt + padW) / N) * W, padY); x.stroke(); if (big) { x.fillStyle = sk.good; x.font = "700 11px monospace"; x.textAlign = "center"; x.fillText("x1.5", ((padAt + padW / 2) / N) * W, padY + 16); }
    x.save(); x.translate(g.x, g.y); x.rotate(g.ang); x.shadowColor = sk.accent; x.shadowBlur = 14; x.fillStyle = "#e8ecff"; x.beginPath(); x.moveTo(0, -14); x.lineTo(10, 8); x.lineTo(-10, 8); x.closePath(); x.fill(); x.fillRect(-12, 8, 24, 3); if (g.thrust) { x.fillStyle = sk.good; x.beginPath(); x.moveTo(-5, 11); x.lineTo(0, 22 + Math.random() * 10); x.lineTo(5, 11); x.fill(); } x.restore();
    x.font = "600 13px 'JetBrains Mono', monospace"; x.textAlign = "left"; x.fillStyle = "#e8ecff"; x.fillText(`FUEL ${Math.round(g.fuel)}`, 14, 22); x.fillText(`VSPD ${Math.round(g.vy)}`, 14, 40); x.fillStyle = g.vy < 48 ? "#3ddc97" : sk.bad; x.fillText(g.vy < 48 ? "SPEED OK" : "TOO FAST", 14, 58);
    if (g.result) { x.textAlign = "center"; x.font = "800 24px Unbounded, sans-serif"; x.fillStyle = g.result === "LANDED" ? "#3ddc97" : sk.bad; x.fillText(g.result, W / 2, H * 0.3); }
  };
  return g;
}

/* ---------- Star Memory ---------- */
const GLY = {
  space: [(x, s) => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, r = i % 2 ? s * 0.22 : s * 0.5; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.fill(); }, (x, s) => { x.beginPath(); x.arc(0, 0, s * 0.45, 0, TAU); x.fill(); x.globalCompositeOperation = "destination-out"; x.beginPath(); x.arc(s * 0.2, -s * 0.1, s * 0.4, 0, TAU); x.fill(); x.globalCompositeOperation = "source-over"; }, (x, s) => { x.beginPath(); x.arc(0, 0, s * 0.3, 0, TAU); x.fill(); x.lineWidth = s * 0.07; x.beginPath(); x.ellipse(0, 0, s * 0.55, s * 0.16, -0.4, 0, TAU); x.stroke(); }, (x, s) => { x.beginPath(); x.arc(s * 0.2, -s * 0.2, s * 0.17, 0, TAU); x.fill(); x.lineWidth = s * 0.08; x.beginPath(); x.moveTo(s * 0.2, -s * 0.2); x.lineTo(-s * 0.5, s * 0.4); x.stroke(); }, (x, s) => { x.beginPath(); x.moveTo(0, -s * 0.5); x.quadraticCurveTo(s * 0.3, -s * 0.1, s * 0.2, s * 0.3); x.lineTo(-s * 0.2, s * 0.3); x.quadraticCurveTo(-s * 0.3, -s * 0.1, 0, -s * 0.5); x.fill(); }, (x, s) => { x.beginPath(); x.arc(0, 0, s * 0.28, 0, TAU); x.fill(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; x.fillRect(Math.cos(a) * s * 0.4 - 1.5, Math.sin(a) * s * 0.4 - 1.5, 3, 3); } }, (x, s) => { x.lineWidth = s * 0.07; x.beginPath(); for (let i = 0; i < 40; i++) { const a = i * 0.4, r = i * s * 0.012; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.stroke(); }, (x, s) => { x.beginPath(); x.moveTo(0, -s * 0.5); x.lineTo(s * 0.45, s * 0.4); x.lineTo(-s * 0.45, s * 0.4); x.closePath(); x.fill(); }],
  halloween: [(x, s) => { x.beginPath(); x.ellipse(0, 0, s * 0.45, s * 0.38, 0, 0, TAU); x.fill(); }, (x, s) => { x.beginPath(); x.arc(0, -s * 0.05, s * 0.34, Math.PI, TAU); x.lineTo(s * 0.34, s * 0.4); x.lineTo(s * 0.17, s * 0.28); x.lineTo(0, s * 0.4); x.lineTo(-s * 0.17, s * 0.28); x.lineTo(-s * 0.34, s * 0.4); x.closePath(); x.fill(); }, (x, s) => { x.beginPath(); x.moveTo(0, -s * 0.1); x.quadraticCurveTo(-s * 0.2, -s * 0.5, -s * 0.5, -s * 0.2); x.quadraticCurveTo(-s * 0.3, 0, -s * 0.2, s * 0.1); x.quadraticCurveTo(0, s * 0.2, 0, s * 0.2); x.quadraticCurveTo(0, s * 0.2, s * 0.2, s * 0.1); x.quadraticCurveTo(s * 0.3, 0, s * 0.5, -s * 0.2); x.quadraticCurveTo(s * 0.2, -s * 0.5, 0, -s * 0.1); x.fill(); }, (x, s) => { x.beginPath(); x.arc(0, -s * 0.05, s * 0.36, 0, TAU); x.fill(); x.fillRect(-s * 0.2, s * 0.25, s * 0.4, s * 0.2); }, (x, s) => { x.beginPath(); x.arc(0, 0, s * 0.22, 0, TAU); x.fill(); x.beginPath(); x.moveTo(-s * 0.22, 0); x.lineTo(-s * 0.5, -s * 0.2); x.lineTo(-s * 0.5, s * 0.2); x.moveTo(s * 0.22, 0); x.lineTo(s * 0.5, -s * 0.2); x.lineTo(s * 0.5, s * 0.2); x.fill(); }, (x, s) => { x.beginPath(); x.arc(0, 0, s * 0.45, 0, TAU); x.fill(); x.globalCompositeOperation = "destination-out"; x.beginPath(); x.arc(s * 0.2, -s * 0.1, s * 0.4, 0, TAU); x.fill(); x.globalCompositeOperation = "source-over"; }, (x, s) => { x.beginPath(); x.arc(0, 0, s * 0.18, 0, TAU); x.fill(); x.lineWidth = s * 0.05; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.4); x.stroke(); } }, (x, s) => { x.beginPath(); x.moveTo(-s * 0.5, s * 0.3); x.lineTo(s * 0.5, s * 0.3); x.lineTo(s * 0.12, -s * 0.5); x.lineTo(-s * 0.12, -s * 0.1); x.closePath(); x.fill(); }],
};
export function memory(W, H, sk, sfx) {
  const set = sk === SKINS.halloween ? GLY.halloween : GLY.space, ids = [...Array(8).keys(), ...Array(8).keys()].sort(() => Math.random() - 0.5);
  const cols = 4, pad = 14, cw = (W - pad * (cols + 1)) / cols, ch = Math.min(cw * 1.1, (H - 80 - pad * 5) / 4), top = 56;
  const cards = ids.map((id, i) => ({ id, i, x: pad + (i % cols) * (cw + pad), y: top + Math.floor(i / cols) * (ch + pad), up: 0, done: false, flip: 0 }));
  const g = { W, H, t: 0, over: false, first: null, second: null, lock: 0, misses: 0, pairs: 0, tag: "memory" };
  g.score = () => (g.pairs < 8 ? 0 : 500 + Math.max(0, Math.floor(1200 - g.t * 10 - g.misses * 25)));
  g.update = (dt, inp) => {
    g.t += dt; for (const c of cards) c.flip += ((c.up || c.done ? 1 : 0) - c.flip) * Math.min(1, dt * 12);
    if (g.lock > 0) { g.lock -= dt; if (g.lock <= 0) { if (g.first.id === g.second.id) { g.first.done = g.second.done = true; g.pairs++; sfx(880, 0.12, 0.05); if (g.pairs === 8) g.over = true; } else { g.first.up = g.second.up = 0; g.misses++; sfx(200, 0.1, 0.04); } g.first = g.second = null; } }
    for (const t of inp.taps) { if (g.lock > 0) continue; const c = cards.find((c) => !c.up && !c.done && t.x >= c.x && t.x <= c.x + cw && t.y >= c.y && t.y <= c.y + ch); if (!c) continue; c.up = 1; sfx(520 + c.id * 40, 0.06, 0.03); if (!g.first) g.first = c; else { g.second = c; g.lock = 0.7; } }
  };
  g.draw = (x) => {
    backdrop(x, W, H, sk, [], 0, g.t);
    for (const c of cards) { const k = Math.abs(Math.cos(c.flip * Math.PI)), face = c.flip > 0.5; x.save(); x.translate(c.x + cw / 2, c.y + ch / 2); x.scale(Math.max(0.02, k), 1);
      x.fillStyle = face ? (c.done ? "rgba(61,220,151,.18)" : "#1a1f40") : "#0e1226"; x.strokeStyle = face ? (c.done ? "#3ddc97" : sk.accent) : "#39406b"; x.lineWidth = 2; x.beginPath(); x.roundRect(-cw / 2, -ch / 2, cw, ch, 10); x.fill(); x.stroke();
      if (face) { x.fillStyle = c.done ? "#3ddc97" : sk.good; x.strokeStyle = x.fillStyle; set[c.id](x, Math.min(cw, ch) * 0.8); } else { x.fillStyle = "#39406b"; x.beginPath(); x.arc(0, 0, 4, 0, TAU); x.fill(); } x.restore(); }
    x.font = "600 14px 'JetBrains Mono', monospace"; x.textAlign = "left"; x.fillStyle = "#e8ecff"; x.fillText(`${g.pairs}/8 PAIRS`, 14, 30); x.textAlign = "right"; x.fillStyle = sk.good; x.fillText(`${Math.floor(g.t)}s · ${g.misses} MISS`, W - 14, 30);
  };
  return g;
}

/* ---------- Comet Snake ---------- */
export function snake(W, H, sk, sfx) {
  const n = 18, cs = Math.floor(Math.min(W, H - 40) / n), ox = (W - cs * n) / 2, oy = 44 + (H - 44 - cs * n) / 2;
  const g = { W, H, t: 0, over: false, dir: [1, 0], q: [], body: [[9, 9], [8, 9], [7, 9]], acc: 0, food: null, eaten: 0, bg: mkbg(W, H), tag: "snake" };
  const place = () => { let p; do p = [Math.floor(Math.random() * n), Math.floor(Math.random() * n)]; while (g.body.some((b) => b[0] === p[0] && b[1] === p[1])); g.food = p; }; place();
  g.score = () => g.eaten * 10;
  const turn = (d) => { const last = g.q.length ? g.q[g.q.length - 1] : g.dir; if (d[0] + last[0] === 0 && d[1] + last[1] === 0) return; if (g.q.length < 3) g.q.push(d); };
  g.update = (dt, inp) => {
    g.t += dt; const K = inp.keys; for (const [k, d] of [["left", [-1, 0]], ["right", [1, 0]], ["up", [0, -1]], ["down", [0, 1]], ["a", [-1, 0]], ["d", [1, 0]], ["w", [0, -1]], ["s", [0, 1]]]) if (K.has(k) && !K.has("_" + k)) { K.add("_" + k); turn(d); } for (const k of [...K]) if (k[0] === "_" && !K.has(k.slice(1))) K.delete(k);
    if (inp.swipe) { turn(inp.swipe === "l" ? [-1, 0] : inp.swipe === "r" ? [1, 0] : inp.swipe === "u" ? [0, -1] : [0, 1]); inp.swipe = null; }
    g.acc += dt * (7 + Math.min(8, g.eaten * 0.35));
    while (g.acc >= 1 && !g.over) {
      g.acc -= 1; if (g.q.length) g.dir = g.q.shift(); const h = [g.body[0][0] + g.dir[0], g.body[0][1] + g.dir[1]];
      if (h[0] < 0 || h[1] < 0 || h[0] >= n || h[1] >= n || g.body.some((b) => b[0] === h[0] && b[1] === h[1])) { g.over = true; sfx(90, 0.3, 0.08); break; }
      g.body.unshift(h); if (h[0] === g.food[0] && h[1] === g.food[1]) { g.eaten++; place(); sfx(700 + g.eaten * 15, 0.07, 0.04); } else g.body.pop();
    }
    moveBg(g.bg, W, H, 20, dt);
  };
  g.draw = (x) => {
    backdrop(x, W, H, sk, g.bg, 20, g.t); x.strokeStyle = "rgba(255,255,255,.06)"; x.lineWidth = 1; x.strokeRect(ox, oy, cs * n, cs * n);
    g.body.forEach((b, i) => { const f = 1 - i / g.body.length; x.globalAlpha = 0.25 + f * 0.75; x.fillStyle = i === 0 ? "#fff" : sk.accent; x.shadowColor = sk.accent; x.shadowBlur = i === 0 ? 16 : 6; x.beginPath(); x.arc(ox + b[0] * cs + cs / 2, oy + b[1] * cs + cs / 2, cs * (0.2 + f * 0.3), 0, TAU); x.fill(); }); x.globalAlpha = 1; x.shadowBlur = 0;
    pickup(x, sk, ox + g.food[0] * cs + cs / 2, oy + g.food[1] * cs + cs / 2, g.t);
    x.font = "600 14px 'JetBrains Mono', monospace"; x.textAlign = "left"; x.fillStyle = "#e8ecff"; x.fillText(String(g.score()).padStart(4, "0"), 14, 26); x.textAlign = "right"; x.fillStyle = sk.good; x.fillText(`LEN ${g.body.length}`, W - 14, 26);
  };
  return g;
}
export const FACTORY = { run, blaster, lander, memory, snake };
export const HELP = { run: "Drag or use the arrow keys. Dodge asteroids, grab stars.", blaster: "Drag or use the arrow keys. Your ship fires by itself. Grab a star for triple shot.", lander: "Hold the middle of the screen (or Space) to thrust. Left and right edges (or arrow keys) rotate. Land gently on the gold pad.", memory: "Tap two cards to flip them. Match all eight pairs as fast as you can.", snake: "Arrow keys or swipe. Eat stars, grow your comet tail, do not hit yourself." };
