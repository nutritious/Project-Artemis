/* Level-up cutscenes (10 seconds each). Every rank has its own scene and its own sound design.
   Click or press Esc to skip. Scenes and sound are pure canvas / Web Audio, so they also render offline. */
import { state } from "./util.js";

const TAU = Math.PI * 2, clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k;
const ease = (v) => { v = clamp(v); return v * v * (3 - 2 * v); }, easeOut = (v) => 1 - Math.pow(1 - clamp(v), 3);
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const DUR = 10;
const mix = (c1, c2, k) => { const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); const a = p(c1), b = p(c2); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(",")})`; };
const pulse = (S, key, rate) => { S[key] = (S[key] ?? 0) + rate * S.dt; const n = Math.floor(S[key]); S[key] -= n; return n; };
const BLURB = ["First steps into the void", "Faster than light", "You can find your way anywhere", "Command of the crew", "Beyond the known map", "A legend of Artemis", "A star is born", "Feeding on the dark", "Your heartbeat, across the galaxy", "Past the point of no return", "You have been online enough. Go outside."];

function skyStars(x, W, H, S, t, alpha = 1, n = 160) {
  S.bg ??= Array.from({ length: n }, () => ({ x: Math.random(), y: Math.random(), p: Math.random() * 6, s: 0.5 + Math.random() * 1.4 }));
  x.fillStyle = "#fff"; for (const s of S.bg) { x.globalAlpha = alpha * (0.2 + 0.5 * Math.abs(Math.sin(t * 1.3 + s.p))); x.fillRect(s.x * W, s.y * H, s.s, s.s); } x.globalAlpha = 1;
}
function glow(x, cx, cy, r, col, a = 1) { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, "transparent"); x.globalAlpha = a; x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); x.globalAlpha = 1; }
function hud(x, R, lines, t0, col) { x.save(); x.font = `600 ${Math.max(11, R * 0.016)}px JB, 'JetBrains Mono', monospace`; x.letterSpacing = "2px"; x.textAlign = "left"; x.fillStyle = col; lines.forEach(([txt, at], i) => { if (txt && t0 >= at) { x.globalAlpha = 0.85; x.fillText(txt, R * 0.06, R * 0.14 + i * R * 0.028); } }); x.restore(); }
function ringPulse(x, cx, cy, k, maxR, col, w = 6, n = 3) { for (let i = 0; i < n; i++) { const r = (k * 0.9 - i * 0.13) * maxR; if (r > 0) { x.strokeStyle = i ? col : "#fff"; x.globalAlpha = Math.max(0, 1 - r / maxR) * 0.9; x.lineWidth = Math.max(1, w - i * 2); x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke(); } } x.globalAlpha = 1; }

/* ============================ the six scenes ============================ */
export const SCENES = [
  /* 1 CADET: countdown, ignition, liftoff, breaking into space */
  { tag: "LIFTOFF", hit: 5.0, draw(x, W, H, t, c, S, R) {
    const cx = W / 2, k = R / 720, up = ease((t - 2.2) / 3.2), alt = Math.pow(clamp((t - 2.2) / 2.8), 2);
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, mix("#05060f", "#3b6fc4", 1 - clamp(alt * 1.15))); g.addColorStop(1, mix("#0a0d1c", "#f0a56a", 1 - clamp(alt * 1.4))); x.fillStyle = g; x.fillRect(0, 0, W, H);
    skyStars(x, W, H, S, t, clamp(alt * 1.6 - 0.2));
    const ground = H * 0.84 + up * H * 1.6;
    if (ground < H) { x.fillStyle = "#0a0d1c"; x.fillRect(0, ground, W, H - ground); x.fillStyle = "#1a2040"; x.fillRect(cx - R * 0.5, ground, R, 6 * k);
      x.strokeStyle = "#39406b"; x.lineWidth = 3 * k; const tx = cx - R * 0.2; x.strokeRect(tx, ground - 330 * k, 22 * k, 330 * k); for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(tx, ground - i * 41 * k); x.lineTo(tx + 22 * k, ground - (i + 1) * 41 * k); x.stroke(); } }
    S.cl ??= Array.from({ length: 16 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() }));
    if (t > 2.4) for (const q of S.cl) { const yy = ((q.y * H + (t - 2.4) * (200 + alt * 2600) * q.s) % (H * 1.2)) - H * 0.1; x.globalAlpha = 0.22 * (1 - alt); x.fillStyle = "#fff"; x.beginPath(); x.ellipse(q.x * W, yy, 170 * k * q.s, 22 * k * q.s, 0, 0, TAU); x.fill(); } x.globalAlpha = 1;
    S.sm ??= []; const ignite = t > 1.5, base = ground - 4;
    if (ignite && t < 7) for (let i = pulse(S, "pu", 70 * (t < 4.5 ? 1 : 0.3)); i > 0; i--) S.sm.push({ x: cx + rnd(-30, 30) * k, y: t < 4 ? base : H * 0.62, vx: rnd(-1, 1) * (t < 3 ? 260 : 90) * k, vy: rnd(10, 90) * k, r: rnd(10, 26) * k, l: 1 });
    S.sm = S.sm.filter((p) => p.l > 0); for (const p of S.sm) { p.x += p.vx * S.dt; p.y += (p.vy + (t > 2.2 ? up * 900 * k * 0 : 0)) * S.dt; p.vx *= 0.985; p.r += 38 * k * S.dt; p.l -= 0.45 * S.dt; if (t > 2.2 && ground < H) p.y += 0; x.globalAlpha = p.l * 0.4; x.fillStyle = p.l > 0.75 ? "#ffd9a0" : "#c9cfe8"; x.beginPath(); x.arc(p.x, p.y, p.r, 0, TAU); x.fill(); } x.globalAlpha = 1;
    const ry = lerp(ground - 90 * k, H * 0.4, up) + (t < 2.2 ? 0 : 0), sh = t > 1.5 && t < 4.5 ? (t < 2.2 ? 2.4 : 3.5 * (1 - up)) * k : 0;
    x.save(); x.translate(cx + rnd(-sh, sh), ry + rnd(-sh, sh)); x.scale(k * 1.1, k * 1.1); x.shadowColor = c; x.shadowBlur = 22; x.fillStyle = "#e8ecff";
    x.beginPath(); x.moveTo(0, -86); x.quadraticCurveTo(30, -34, 25, 54); x.lineTo(-25, 54); x.quadraticCurveTo(-30, -34, 0, -86); x.fill();
    x.fillStyle = c; x.beginPath(); x.moveTo(-25, 22); x.lineTo(-52, 66); x.lineTo(-25, 54); x.fill(); x.beginPath(); x.moveTo(25, 22); x.lineTo(52, 66); x.lineTo(25, 54); x.fill(); x.fillStyle = "#0a0d1c"; x.beginPath(); x.arc(0, -24, 10, 0, TAU); x.fill();
    if (ignite) { const f = (ease((t - 1.5) / 0.7) * 55 + up * 90 + rnd(0, 24)); const fg = x.createLinearGradient(0, 54, 0, 54 + f); fg.addColorStop(0, "#fff"); fg.addColorStop(0.3, "#ffd36a"); fg.addColorStop(1, "rgba(255,90,40,0)"); x.fillStyle = fg; x.beginPath(); x.moveTo(-17, 54); x.lineTo(0, 54 + f); x.lineTo(17, 54); x.fill(); } x.restore();
    if (alt > 0.2) { x.strokeStyle = "#fff"; x.globalAlpha = 0.18 * alt; x.lineWidth = 1.2; for (let i = 0; i < 26; i++) { const sx = ((i * 97.3 + 13) % 100) / 100 * W, sy = ((t * 1500 * alt + i * 211) % (H * 1.3)) - 40; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx, sy + 70 * alt * k * 2); x.stroke(); } x.globalAlpha = 1; }
    const cd = t < 0.8 ? "T-03" : t < 1.5 ? "T-02" : t < 2.2 ? "T-01" : "T+" + Math.floor(Math.max(0, t - 2.2) * 10).toString().padStart(2, "0");
    hud(x, R, [["MISSION CONTROL · " + cd, 0.05], ["ALT " + Math.round(alt * 1000 * 100).toLocaleString() + " M", 2.2], ["VEL " + Math.round(alt * 7800).toLocaleString() + " M/S", 2.2], t > 5 ? ["ORBIT ACHIEVED", 5] : ["", 0]], t, "#9fd0ff");
    if (t > 5) ringPulse(x, cx, ry, (t - 5) * 0.55, R * 0.9, c, 7);
  } },
  /* 2 PILOT: charge the drive, jump, emerge at a ringed planet */
  { tag: "HYPERJUMP", hit: 4.6, draw(x, W, H, t, c, S, R) {
    const cx = W / 2, cy = H * 0.46, D = Math.hypot(cx, cy), k = R / 720;
    S.st ??= Array.from({ length: 360 }, () => ({ a: Math.random() * TAU, d: Math.random(), s: 0.4 + Math.random() }));
    const charge = clamp(t / 4.6), jumped = t >= 4.6, outk = clamp((t - 6.2) / 2.6);
    const warp = jumped ? lerp(1.0, 0.03, ease(outk)) : 0.01 + Math.pow(charge, 3) * 0.55;
    x.fillStyle = jumped && t < 4.9 ? "#fff" : "#03040a"; x.fillRect(0, 0, W, H);
    const sx = (t < 4.6 ? rnd(-1, 1) * charge ** 3 * 6 * k : 0); x.save(); x.translate(sx, sx);
    for (const s of S.st) { s.d += (jumped ? 0.016 * (0.3 + warp * 4.5) : (0.0006 + warp * 0.012)) * s.s * (S.dt * 60); if (s.d > 1) { s.d = 0.02; s.a = Math.random() * TAU; } const a = s.d * D, len = (warp * 0.14 * s.d * s.s + 0.002) * D; const ca = Math.cos(s.a), sa = Math.sin(s.a);
      for (const [off, col] of [[-2, "#ff4d6d"], [0, jumped ? "#fff" : c], [2, "#4cc9f0"]]) { x.strokeStyle = col; x.globalAlpha = Math.min(1, s.d * 1.8) * (off ? 0.5 : 1) * (jumped && outk < 1 ? 1 : 0.9); x.lineWidth = (0.6 + s.d * 2.2 * s.s) * (off ? 0.8 : 1); x.beginPath(); x.moveTo(cx + ca * (a + off * charge * 2), cy + sa * (a + off * charge * 2)); x.lineTo(cx + ca * (a + len), cy + sa * (a + len)); x.stroke(); } } x.globalAlpha = 1;
    if (!jumped) { x.lineWidth = 2 * k; for (let i = 0; i < 4; i++) { const r = (R * (0.34 - i * 0.05)) * (1 - charge * 0.35), seg = 8 + i * 2; x.strokeStyle = i % 2 ? "#fff" : c; x.globalAlpha = 0.3 + charge * 0.6; x.setLineDash([r * 0.3, r * 0.12]); x.lineDashOffset = -t * (60 + i * 40) * (i % 2 ? 1 : -1); x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke(); } x.setLineDash([]); x.globalAlpha = 1; glow(x, cx, cy, R * (0.05 + charge ** 2 * 0.3), "#fff", 0.4 + charge * 0.6); }
    else { const k2 = t - 4.6; x.lineWidth = 3; for (let i = 0; i < 12; i++) { const f = (i / 12 + k2 * 0.9) % 1, r = Math.pow(f, 2.2) * D * 1.1; x.strokeStyle = i % 2 ? "#4cc9f0" : c; x.globalAlpha = (1 - outk) * Math.min(1, f * 2) * 0.55; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke(); } x.globalAlpha = 1; ringPulse(x, cx, cy, k2 * 0.8, D * 1.1, c, 9); }
    x.restore();
    if (jumped && outk > 0) { const pr = R * 0.2 * (0.3 + 0.7 * easeOut(outk)), a = ease(outk), px = cx, py = cy + R * 0.02; x.save(); x.globalAlpha = a; x.translate(px, py);
      x.strokeStyle = mix(c, "#ffffff", 0.3); x.lineWidth = pr * 0.12; x.globalAlpha = a * 0.5; x.beginPath(); x.ellipse(0, 0, pr * 1.9, pr * 0.46, -0.3, Math.PI, TAU); x.stroke(); x.globalAlpha = a;
      x.beginPath(); x.arc(0, 0, pr, 0, TAU); x.clip(); const pg = x.createLinearGradient(-pr, -pr, pr, pr); pg.addColorStop(0, mix(c, "#ffffff", 0.35)); pg.addColorStop(1, "#0a0d1c"); x.fillStyle = pg; x.fillRect(-pr, -pr, pr * 2, pr * 2);
      for (let i = 0; i < 9; i++) { x.fillStyle = `rgba(255,255,255,${0.06 + (i % 3) * 0.04})`; x.fillRect(-pr, -pr + (i / 9) * pr * 2 + Math.sin(t + i) * 3, pr * 2, pr * 0.1); } x.restore();
      x.save(); x.globalAlpha = a; x.translate(px, py); x.strokeStyle = mix(c, "#ffffff", 0.3); x.lineWidth = pr * 0.12; x.beginPath(); x.ellipse(0, 0, pr * 1.9, pr * 0.46, -0.3, 0, Math.PI); x.stroke(); x.restore(); }
  } },
  /* 3 NAVIGATOR: a compass drawn in stars */
  { tag: "COMPASS", hit: 5.4, draw(x, W, H, t, c, S, R) {
    const cx = W / 2, cy = H * 0.41, r = R * 0.27, k = R / 720;
    const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#050816"); bg.addColorStop(1, "#0b1030"); x.fillStyle = bg; x.fillRect(0, 0, W, H);
    S.neb ??= [[0.2, 0.3, "#5b4bd6"], [0.8, 0.6, "#c2409b"], [0.5, 0.85, "#2a77d6"]]; S.neb.forEach(([a, b, col], i) => glow(x, W * (a + Math.sin(t * 0.2 + i) * 0.03), H * (b + Math.cos(t * 0.17 + i) * 0.03), R * 0.8, col + "55", 0.55));
    x.save(); x.translate(cx, cy); x.rotate(t * 0.012); x.translate(-cx, -cy); skyStars(x, W, H, S, t, 1, 200); x.restore();
    const ring = ease(t / 2.2); x.strokeStyle = "#9fb0ff"; x.lineWidth = 2 * k; x.globalAlpha = 0.7; x.beginPath(); x.arc(cx, cy, r * 1.32, -Math.PI / 2, -Math.PI / 2 + TAU * ring); x.stroke(); x.globalAlpha = 1;
    for (let i = 0; i < 72; i++) { const f = i / 72; if (f > ring) break; const a = f * TAU - Math.PI / 2, l = i % 6 === 0 ? 16 : 7; x.strokeStyle = i % 18 === 0 ? c : "#6f7bb8"; x.lineWidth = (i % 6 === 0 ? 2.4 : 1.2) * k; x.beginPath(); x.moveTo(cx + Math.cos(a) * r * 1.32, cy + Math.sin(a) * r * 1.32); x.lineTo(cx + Math.cos(a) * (r * 1.32 - l * k), cy + Math.sin(a) * (r * 1.32 - l * k)); x.stroke(); }
    S.pts ??= [0, 3, 6, 1, 4, 7, 2, 5, 0].map((q) => { const a = (q / 8) * TAU - Math.PI / 2, rr = q % 2 ? r * 0.55 : r; return [Math.cos(a) * rr, Math.sin(a) * rr]; });
    const n = S.pts.length - 1, prog = clamp((t - 1) / 4.2) * n; x.strokeStyle = c; x.lineWidth = 2.4 * k; x.shadowColor = c; x.shadowBlur = 16; x.beginPath();
    for (let i = 0; i <= Math.floor(prog) && i < n; i++) { const [a, b] = S.pts[i], [d, e] = S.pts[i + 1], f = Math.min(1, prog - i); x.moveTo(cx + a, cy + b); x.lineTo(cx + a + (d - a) * f, cy + b + (e - b) * f); } x.stroke(); x.shadowBlur = 0;
    S.pts.forEach(([a, b], i) => { if (i > prog + 0.05) return; const born = ease((prog - i) * 2.5 + 0.2); x.fillStyle = "#fff"; x.shadowColor = c; x.shadowBlur = 20; x.beginPath(); x.arc(cx + a, cy + b, (3.5 + 3 * Math.abs(Math.sin(t * 3 + i))) * born * k * 1.2, 0, TAU); x.fill(); x.shadowBlur = 0; });
    x.font = `800 ${R * 0.034}px Unbounded, Inter, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; [["N", 0, -1], ["E", 1, 0], ["S", 0, 1], ["W", -1, 0]].forEach(([ch, dx, dy], i) => { x.globalAlpha = ease((t - 2.4 - i * 0.5) / 0.6); x.fillStyle = i === 0 ? c : "#cfd6ff"; x.fillText(ch, cx + dx * r * 1.62, cy + dy * r * 1.62); }); x.globalAlpha = 1;
    const settle = t < 5.4 ? Math.sin(t * 9) * (5.4 - t) * 0.8 + (5.4 - t) * 6 : Math.sin((t - 5.4) * 14) * Math.exp(-(t - 5.4) * 3) * 0.2, na = settle; const nl = r * 1.05 * ease((t - 2) / 1);
    x.save(); x.translate(cx, cy); x.rotate(na); x.fillStyle = c; x.beginPath(); x.moveTo(0, -nl); x.lineTo(r * 0.07, 0); x.lineTo(-r * 0.07, 0); x.fill(); x.fillStyle = "#e8ecff"; x.beginPath(); x.moveTo(0, nl * 0.8); x.lineTo(r * 0.07, 0); x.lineTo(-r * 0.07, 0); x.fill(); x.restore();
    if (t > 3 && Math.random() < 0.02) S.sh = { x: rnd(W * 0.2, W), y: rnd(0, H * 0.4), l: 1 }; if (S.sh) { const s = S.sh; s.x -= 1100 * S.dt * k; s.y += 500 * S.dt * k; s.l -= 1.6 * S.dt; if (s.l <= 0) S.sh = null; else { const gg = x.createLinearGradient(s.x, s.y, s.x + 190 * k, s.y - 85 * k); gg.addColorStop(0, `rgba(255,255,255,${s.l})`); gg.addColorStop(1, "transparent"); x.strokeStyle = gg; x.lineWidth = 2; x.beginPath(); x.moveTo(s.x, s.y); x.lineTo(s.x + 190 * k, s.y - 85 * k); x.stroke(); } }
    if (t > 5.4) { const q = t - 5.4; ringPulse(x, cx, cy, q * 0.6, R * 1.1, c, 6); x.save(); x.translate(cx, cy); x.rotate(t * 0.15); x.globalAlpha = Math.max(0, 0.35 - q * 0.04); x.fillStyle = c; for (let i = 0; i < 16; i++) { x.rotate(TAU / 16); x.beginPath(); x.moveTo(0, 0); x.lineTo(R, -R * 0.02); x.lineTo(R, R * 0.02); x.fill(); } x.restore(); x.globalAlpha = 1; glow(x, cx, cy, r * 1.5, c, 0.25); }
  } },
  /* 4 CAPTAIN: total solar eclipse over a ridge line */
  { tag: "TOTALITY", hit: 5.2, draw(x, W, H, t, c, S, R) {
    const cx = W / 2, cy = H * 0.4, r = R * 0.14, k = R / 720, mx = cx - (1 - ease(t / 5.0)) * R * 0.85, cover = 1 - clamp(Math.abs(mx - cx) / (r * 1.9)), tot = t >= 5.0 ? 1 : 0;
    x.fillStyle = mix("#1b2a5e", "#02030a", ease(cover * 1.1)); x.fillRect(0, 0, W, H);
    skyStars(x, W, H, S, t, ease(cover) * 0.9, 150);
    const hz = x.createLinearGradient(0, H * 0.7, 0, H); hz.addColorStop(0, "transparent"); hz.addColorStop(1, c + (tot ? "aa" : "33")); x.fillStyle = hz; x.fillRect(0, H * 0.62, W, H * 0.38);
    glow(x, cx, cy, r * (3 + cover * 5 + (t > 5.2 ? Math.sin(t * 2) * 0.4 : 0)), c, 0.5 + cover * 0.5);
    x.save(); x.translate(cx, cy); x.rotate(t * 0.02); x.strokeStyle = mix(c, "#ffffff", 0.35); for (let i = 0; i < 64; i++) { const a = (i / 64) * TAU, L = r * (1.25 + 0.9 * Math.abs(Math.sin(i * 2.3 + t * 0.5) * Math.cos(i * 0.7))) * (1 + cover * 1.6); x.globalAlpha = 0.12 + cover * 0.55; x.lineWidth = (1 + (i % 3)) * k; x.beginPath(); x.moveTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05); x.lineTo(Math.cos(a) * L, Math.sin(a) * L); x.stroke(); } x.restore(); x.globalAlpha = 1;
    x.fillStyle = "#fff4d6"; x.shadowColor = "#fff"; x.shadowBlur = 28; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); x.shadowBlur = 0;
    if (cover > 0.9 || tot) { x.strokeStyle = "#ff5a3c"; x.lineWidth = 4 * k; x.globalAlpha = ease((cover - 0.85) * 8); for (let i = 0; i < 6; i++) { const a = i * 1.1 + 0.5 + Math.sin(t * 0.6 + i) * 0.1, h = r * (0.18 + 0.14 * Math.sin(t * 1.4 + i * 2)); x.beginPath(); x.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, h * 2.2, a + Math.PI * 0.5, a + Math.PI * 1.5); x.stroke(); } x.globalAlpha = 1; }
    x.fillStyle = "#000"; x.beginPath(); x.arc(mx, cy, r * 1.015, 0, TAU); x.fill();
    if (t > 4.5 && t < 5.1) { const q = (t - 4.5) / 0.6; for (let i = 0; i < 6; i++) { const a = -0.5 + i * 0.35, rr = r * 1.015; x.fillStyle = "#fff"; x.globalAlpha = Math.sin(q * Math.PI) * (0.6 + 0.4 * Math.sin(i * 7 + t * 20)); x.beginPath(); x.arc(cx + Math.cos(a - 0.3) * rr, cy + Math.sin(a - 0.3) * rr, 3 * k, 0, TAU); x.fill(); } x.globalAlpha = 1; }
    if (t >= 5.0 && t < 6.2) { const q = (t - 5.0) / 1.2, ex = cx + r * 0.82, ey = cy - r * 0.4; x.save(); x.globalCompositeOperation = "lighter"; glow(x, ex, ey, r * (1.2 + q * 1.4), "#ffffff", 1 - q); x.strokeStyle = "#fff"; x.globalAlpha = 1 - q; x.lineWidth = 2 * k; x.beginPath(); x.moveTo(ex - r * 2.4 * (1 - q * 0.5), ey); x.lineTo(ex + r * 2.4 * (1 - q * 0.5), ey); x.stroke(); x.restore(); x.globalAlpha = 1; }
    S.rd ??= Array.from({ length: 28 }, (_, i) => 0.75 + 0.2 * Math.sin(i * 1.7) + Math.random() * 0.1); x.fillStyle = "#010208"; x.beginPath(); x.moveTo(0, H); S.rd.forEach((v, i) => x.lineTo((i / 27) * W, H * (0.9 - (v - 0.55) * 0.2))); x.lineTo(W, H); x.fill();
  } },
  /* 5 VOYAGER: fly through a wormhole and out into a galaxy */
  { tag: "WORMHOLE", hit: 5.8, draw(x, W, H, t, c, S, R) {
    const cx = W / 2, cy = H * 0.45, D = Math.hypot(cx, cy), k = R / 720, jumped = t >= 5.8, q = Math.max(0, t - 5.8);
    x.fillStyle = "#02030a"; x.fillRect(0, 0, W, H);
    if (!jumped) {
      const sp = 0.3 + ease(t / 5.5) * 1.8; S.z = (S.z ?? 0) + sp * S.dt;
      for (let i = 0; i < 30; i++) { const f = (i / 30 + S.z) % 1, rr = Math.pow(f, 2.5) * D * 1.15 + 3; x.strokeStyle = `hsl(${(i * 13 + t * 70) % 360} 90% 62%)`; x.globalAlpha = Math.min(1, f * 1.6) * 0.8; x.lineWidth = 1 + f * 6; x.beginPath(); x.ellipse(cx + Math.sin(t * 0.9 + f * 4) * 18 * f * k, cy + Math.cos(t * 0.7 + f * 3) * 12 * f * k, rr, rr * 0.88, 0, 0, TAU); x.stroke(); }
      x.globalAlpha = 0.32; x.strokeStyle = "#fff"; x.lineWidth = 1; for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + t * 0.7 * (i % 2 ? 1 : -1); x.beginPath(); x.moveTo(cx, cy); for (let s = 1; s <= 14; s++) { const rr = (s / 14) * D, aa = a + s * 0.11; x.lineTo(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr * 0.88); } x.stroke(); } x.globalAlpha = 1;
      S.pa ??= []; for (let i = pulse(S, "pp", 120); i > 0; i--) S.pa.push({ a: rnd(TAU), d: 0.02, v: rnd(0.4, 1) }); S.pa = S.pa.filter((p) => p.d < 1.1); x.fillStyle = "#fff"; for (const p of S.pa) { p.d += p.v * (0.4 + sp) * 0.5 * S.dt; const rr = p.d * p.d * D; x.globalAlpha = Math.min(1, p.d * 2); x.fillRect(cx + Math.cos(p.a) * rr, cy + Math.sin(p.a) * rr * 0.88, 1 + p.d * 3, 1 + p.d * 3); } x.globalAlpha = 1;
      const sz = R * 0.07 * (1 - ease(t / 5.8) * 0.75), sy = cy + R * 0.2 * (1 - ease(t / 5.8)); x.save(); x.translate(cx + Math.sin(t * 1.3) * 10 * k, sy); x.shadowColor = "#fff"; x.shadowBlur = 20; x.fillStyle = "#e8ecff"; x.beginPath(); x.moveTo(0, -sz); x.lineTo(sz * 0.7, sz * 0.7); x.lineTo(0, sz * 0.35); x.lineTo(-sz * 0.7, sz * 0.7); x.fill(); x.restore();
      glow(x, cx, cy, R * (0.05 + ease((t - 3.5) / 2.3) * 0.7), "#ffffff", 0.9);
    } else {
      S.g ??= Array.from({ length: 1700 }, () => { const arm = (Math.random() * 3) | 0, d = Math.pow(Math.random(), 0.7); return { d, a: arm * (TAU / 3) + d * 7 + rnd(-0.35, 0.35) * (0.4 + d), s: rnd(1, 2.6), col: Math.random() < 0.18 ? c : Math.random() < 0.5 ? "#9fd0ff" : "#fff" }; });
      const zoom = lerp(3.2, 1, easeOut(q / 3.6)), rot = q * 0.1, gr = R * 0.5 * zoom; x.save(); x.globalAlpha = ease(q / 0.5); glow(x, cx, cy, gr * 0.9, c + "88", 0.7); glow(x, cx, cy, gr * 0.22, "#fff3d0", 1);
      x.globalCompositeOperation = "lighter"; for (const p of S.g) { const aa = p.a + rot * (1.4 - p.d), rr = p.d * gr; x.fillStyle = p.col; x.globalAlpha = 0.55 * ease(q / 0.5); x.fillRect(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr * 0.55, p.s * zoom * 0.7, p.s * zoom * 0.7); } x.restore(); x.globalAlpha = 1;
      skyStars(x, W, H, S, t, 0.8, 120); ringPulse(x, cx, cy, q * 0.5, D * 1.1, c, 8);
      const px = lerp(W * 0.15, W * 0.85, easeOut(q / 4)) , py = H * 0.72 - Math.sin(q * 0.8) * 24 * k; x.save(); x.translate(px, py); x.rotate(-0.2); x.fillStyle = "#e8ecff"; x.shadowColor = c; x.shadowBlur = 12; x.beginPath(); x.moveTo(R * 0.025, 0); x.lineTo(-R * 0.015, R * 0.012); x.lineTo(-R * 0.01, 0); x.lineTo(-R * 0.015, -R * 0.012); x.fill(); x.restore();
    }
  } },
  /* 6 LEGEND: a star's last heartbeat, then a supernova */
  { tag: "SUPERNOVA", hit: 5.0, draw(x, W, H, t, c, S, R) {
    const cx = W / 2, cy = H * 0.42, k = R / 720, D = Math.hypot(cx, cy);
    S.p ??= Array.from({ length: 320 }, () => ({ a: rnd(TAU), v: rnd(0.2, 1), s: rnd(1, 3.4), w: Math.random(), tr: rnd(0.6, 1.4) }));
    S.em ??= Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), v: rnd(10, 40), p: rnd(6) }));
    x.fillStyle = "#03040a"; x.fillRect(0, 0, W, H);
    if (t < 5.0) {
      const beat = t < 3.6 ? Math.pow(Math.max(0, Math.sin(t * (4 + t * 1.4))), 8) : 0, charge = clamp(t / 3.6), collapse = clamp((t - 3.6) / 0.8), dark = t > 3.6 ? 1 - ease(collapse) * 0.0 : 0;
      const sh = (charge ** 2 * 7 + beat * 4) * k * (t < 3.6 ? 1 : 0); x.save(); x.translate(rnd(-sh, sh), rnd(-sh, sh));
      for (const p of S.p) { const orb = p.a + t * (0.6 + p.v) * (t < 3.6 ? 1 : 3), d = (1 - ease(Math.max(0, t - 2.2) / 2.8) * 0.97) * D * 0.75 * p.v + R * 0.05; x.fillStyle = p.w > 0.5 ? c : "#fff"; x.globalAlpha = 0.25 + charge * 0.6; x.fillRect(cx + Math.cos(orb) * d, cy + Math.sin(orb) * d * 0.7, p.s, p.s); } x.globalAlpha = 1;
      const cr = R * (t < 3.6 ? 0.025 + charge * 0.045 + beat * 0.02 : 0.07 * (1 - ease(collapse)) + 0.004); glow(x, cx, cy, cr * 5, c, 0.6); const cg = x.createRadialGradient(cx, cy, 0, cx, cy, cr * 2); cg.addColorStop(0, "#fff"); cg.addColorStop(0.35, c); cg.addColorStop(1, "transparent"); x.fillStyle = cg; x.beginPath(); x.arc(cx, cy, cr * 2, 0, TAU); x.fill(); x.restore();
      if (t > 4.3) { const q2 = (t - 4.3) / 0.7; x.strokeStyle = "#fff"; x.globalAlpha = q2; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, (1 - q2) * R * 0.4 + 3, 0, TAU); x.stroke(); x.globalAlpha = 1; }
    } else {
      const q = t - 5.0, shake = Math.max(0, 1 - q / 1.2) * 18 * k; x.save(); x.translate(rnd(-shake, shake), rnd(-shake, shake));
      glow(x, cx, cy, R * (0.4 + easeOut(q / 3) * 1.1), c + "aa", Math.max(0, 0.8 - q * 0.12));
      ringPulse(x, cx, cy, q * 0.55, D * 1.2, c, 14, 4);
      x.save(); x.translate(cx, cy); x.rotate(q * 0.2); x.fillStyle = c; x.globalAlpha = Math.max(0, 0.45 - q * 0.06); for (let i = 0; i < 14; i++) { x.rotate(TAU / 14); x.beginPath(); x.moveTo(0, 0); x.lineTo(D, -D * 0.05); x.lineTo(D, D * 0.05); x.fill(); } x.restore(); x.globalAlpha = 1;
      x.lineWidth = 2 * k; for (const p of S.p) { const d = q * D * p.v * 0.75 * (1 - q * 0.04) + q * q * 24, ax = cx + Math.cos(p.a) * d, ay = cy + Math.sin(p.a) * d + q * q * 10 * p.w; const tl = 26 * p.v * p.tr * k * Math.max(0, 1 - q / 3); x.strokeStyle = p.w > 0.5 ? "#ffd76a" : "#fff"; x.globalAlpha = Math.max(0, 1 - q / 5.5); x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax - Math.cos(p.a) * tl, ay - Math.sin(p.a) * tl); x.stroke(); } x.globalAlpha = 1; x.restore();
      if (q > 1.3) { const f = ease((q - 1.3) / 1.5); x.save(); x.globalCompositeOperation = "lighter"; x.translate(cx, cy); x.rotate(q * 0.1); const L = R * 0.5 * f; for (const [ang, w] of [[0, 1], [Math.PI / 2, 0.7], [Math.PI / 4, 0.45], [-Math.PI / 4, 0.45]]) { x.save(); x.rotate(ang); const sg = x.createLinearGradient(-L, 0, L, 0); sg.addColorStop(0, "transparent"); sg.addColorStop(0.5, "#fff2c0"); sg.addColorStop(1, "transparent"); x.fillStyle = sg; x.beginPath(); x.moveTo(-L * w, 0); x.lineTo(0, -R * 0.01); x.lineTo(L * w, 0); x.lineTo(0, R * 0.01); x.fill(); x.restore(); } x.restore(); glow(x, cx, cy, R * 0.12 * f, "#fff", 0.9); }
      for (const e of S.em) { const yy = H - ((q * e.v * k * 3 + e.y * H) % H); x.fillStyle = "#ffd76a"; x.globalAlpha = Math.min(1, q / 2) * (0.3 + 0.4 * Math.sin(t * 3 + e.p)); x.fillRect(e.x * W, yy, 2, 2); } x.globalAlpha = 1;
    }
  } },
  /* 7 NOVA: a gas cloud collapses, a star ignites, planets fall into orbit */
  { tag: "STAR BIRTH", hit: 5.0, draw(x, W, H, t, c, S, R) {
    const cx = W / 2, cy = H * 0.46, k = R / 720, col = clamp(t / 5), q = Math.max(0, t - 5);
    S.g ??= Array.from({ length: 420 }, () => ({ a: rnd(TAU), d: rnd(0.15, 1), s: rnd(0.8, 2.4), h: rnd(290, 350) }));
    x.fillStyle = "#04030a"; x.fillRect(0, 0, W, H); skyStars(x, W, H, S, t, 0.7);
    if (t < 5) {
      const sh = col ** 3 * 5 * k; x.save(); x.translate(rnd(-sh, sh), rnd(-sh, sh));
      for (const p of S.g) { const d = p.d * R * 0.95 * (1 - ease(col) * 0.86), a = p.a + t * (0.25 + (1 - p.d) * 1.6) * (0.4 + col); x.fillStyle = `hsla(${p.h + col * 40},80%,${55 + col * 20}%,${0.15 + col * 0.5})`; x.beginPath(); x.arc(cx + Math.cos(a) * d * 1.3, cy + Math.sin(a) * d * 0.8, p.s * k * (1 + col), 0, TAU); x.fill(); }
      glow(x, cx, cy, R * (0.1 + col * 0.35), mix("#7a2a8a", "#ffe2a8", col), 0.35 + col * 0.6);
      x.fillStyle = "#fff"; x.globalAlpha = col; x.beginPath(); x.arc(cx, cy, (4 + col * 14) * k, 0, TAU); x.fill(); x.globalAlpha = 1; x.restore();
    } else {
      const sh = Math.max(0, 1 - q / 1.2) * 14 * k; x.save(); x.translate(rnd(-sh, sh), rnd(-sh, sh));
      glow(x, cx, cy, R * (0.5 + easeOut(q / 2) * 0.9), c + "aa", Math.max(0.25, 1 - q * 0.15)); glow(x, cx, cy, R * 0.3, "#fff", 0.9);
      ringPulse(x, cx, cy, q * 0.5, Math.hypot(W, H) * 0.6, c, 14, 4);
      x.save(); x.translate(cx, cy); x.globalCompositeOperation = "lighter";
      for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU + q * 0.15, L = R * (0.45 + 0.25 * Math.sin(q * 3 + i * 2)) * ease(q / 0.8); x.fillStyle = mix(c, "#ffd76a", (i % 3) / 3); x.globalAlpha = 0.25; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a - 0.05) * L, Math.sin(a - 0.05) * L); x.lineTo(Math.cos(a + 0.05) * L, Math.sin(a + 0.05) * L); x.fill(); }
      x.restore();
      const sr = R * 0.09 * (1 + 0.04 * Math.sin(q * 6)), g = x.createRadialGradient(cx, cy, 0, cx, cy, sr); g.addColorStop(0, "#fff"); g.addColorStop(0.6, "#ffe9b0"); g.addColorStop(1, c); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, sr, 0, TAU); x.fill();
      for (let i = 0; i < 4; i++) { const orb = R * (0.22 + i * 0.12) * ease(q / 1.2), a = q * (1.1 - i * 0.2) + i * 1.7; x.strokeStyle = "rgba(255,255,255,.14)"; x.lineWidth = 1; x.beginPath(); x.ellipse(cx, cy, orb * 1.25, orb * 0.5, 0, 0, TAU); x.stroke(); x.fillStyle = ["#99aadd", "#ee99aa", "#ffcc88", "#88ddcc"][i]; x.beginPath(); x.arc(cx + Math.cos(a) * orb * 1.25, cy + Math.sin(a) * orb * 0.5, (5 + i) * k, 0, TAU); x.fill(); }
      x.restore();
    }
  } },
  /* 8 QUASAR: a black hole feeds, a burning disk spins up, twin jets fire across the sky */
  { tag: "RELATIVISTIC JETS", hit: 5.0, draw(x, W, H, t, c, S, R) {
    const cx = W / 2, cy = H * 0.46, k = R / 720, spin = t * 1.4, build = ease(t / 4.5), q = Math.max(0, t - 5);
    x.fillStyle = "#020208"; x.fillRect(0, 0, W, H); skyStars(x, W, H, S, t, 0.8);
    x.save(); x.translate(cx, cy); x.rotate(-0.25);
    for (let r = 14; r >= 0; r--) { const rr = R * (0.12 + r * 0.045) * build; if (rr <= 0) continue; x.strokeStyle = mix("#fff6d0", c, r / 14); x.globalAlpha = (0.15 + 0.7 * (1 - r / 14)) * build; x.lineWidth = R * 0.03 * (1 - r / 20) + 2; x.setLineDash([rr * 0.5, rr * 0.2]); x.lineDashOffset = -spin * rr * 0.4 * (1 + (14 - r) * 0.1); x.beginPath(); x.ellipse(0, 0, rr * 1.6, rr * 1.6 * 0.28, 0, 0, TAU); x.stroke(); }
    x.setLineDash([]); x.restore(); x.globalAlpha = 1;
    x.fillStyle = "#000"; x.beginPath(); x.arc(cx, cy, R * 0.07 * build, 0, TAU); x.fill(); x.strokeStyle = "#fff"; x.globalAlpha = 0.6 * build; x.lineWidth = 2 * k; x.beginPath(); x.arc(cx, cy, R * 0.075 * build, 0, TAU); x.stroke(); x.globalAlpha = 1;
    if (t > 3) {
      const jet = clamp(ease((t - 3) / 1.8) + q * 0.6, 0, 1.4); x.save(); x.globalCompositeOperation = "lighter";
      for (const dir of [-1, 1]) { const L = H * 0.62 * jet, g = x.createLinearGradient(cx, cy, cx, cy + dir * L); g.addColorStop(0, "#fff"); g.addColorStop(0.3, c); g.addColorStop(1, "transparent"); x.fillStyle = g; const w = R * 0.03 * (1 + q * 0.5), sp = q * 20 * k; x.beginPath(); x.moveTo(cx - w, cy); x.lineTo(cx - w * 3.5 - sp, cy + dir * L); x.lineTo(cx + w * 3.5 + sp, cy + dir * L); x.lineTo(cx + w, cy); x.fill(); }
      S.jp ??= []; for (let i = pulse(S, "jpu", 60); i > 0; i--) S.jp.push({ d: Math.random() < 0.5 ? 1 : -1, y: 0, v: rnd(400, 900), x: rnd(-1, 1), l: 1 });
      S.jp = S.jp.filter((p) => p.l > 0); for (const p of S.jp) { p.y += p.v * S.dt * k; p.l -= 0.5 * S.dt; x.fillStyle = mix("#ffffff", c, 1 - p.l); x.globalAlpha = p.l; x.fillRect(cx + p.x * R * 0.04 + Math.sin(p.y * 0.02) * 8 * k, cy + p.d * p.y, 3 * k, 10 * k); }
      x.restore(); x.globalAlpha = 1;
    }
    if (t >= 5) { ringPulse(x, cx, cy, q * 0.6, Math.hypot(W, H) * 0.6, c, 12, 4); glow(x, cx, cy, R * 0.7, c + "88", Math.max(0, 0.8 - q * 0.2)); }
  } },
  /* 9 PULSAR: a spinning neutron star sweeps its beams, radio rings and a signal plot build to a flash */
  { tag: "PULSE DETECTED", hit: 5.0, draw(x, W, H, t, c, S, R) {
    const cx = W / 2, cy = H * 0.42, k = R / 720, q = Math.max(0, t - 5), rate = 0.9 + clamp(t / 5) * 4.6;
    x.fillStyle = "#03030c"; x.fillRect(0, 0, W, H); skyStars(x, W, H, S, t, 0.7);
    S.ph = (S.ph ?? 0) + rate * S.dt; const ph = S.ph, ang = ph * Math.PI, beat = Math.max(0, 1 - (ph % 1) * 3.2);
    S.rg ??= []; S.lastN ??= 0; const n = Math.floor(ph); if (n !== S.lastN) { S.lastN = n; S.rg.push({ r: 0 }); }
    S.rg = S.rg.filter((g) => g.r < 1.4); for (const g of S.rg) { g.r += S.dt * (0.55 + rate * 0.06); x.strokeStyle = c; x.globalAlpha = Math.max(0, 1 - g.r / 1.4) * 0.7; x.lineWidth = 3 * k; x.beginPath(); x.arc(cx, cy, g.r * Math.hypot(W, H) * 0.5, 0, TAU); x.stroke(); } x.globalAlpha = 1;
    x.save(); x.translate(cx, cy); x.rotate(ang); x.globalCompositeOperation = "lighter"; const L = Math.hypot(W, H) * (t < 5 ? 0.55 : 0.55 + q * 0.6);
    for (const s of [-1, 1]) { const g = x.createLinearGradient(0, 0, s * L, 0); g.addColorStop(0, "#fff"); g.addColorStop(0.25, c); g.addColorStop(1, "transparent"); x.fillStyle = g; const w = R * (0.012 + 0.012 * beat + q * 0.022); x.beginPath(); x.moveTo(0, -w); x.lineTo(s * L, -w * 7); x.lineTo(s * L, w * 7); x.lineTo(0, w); x.fill(); }
    x.restore(); glow(x, cx, cy, R * (0.16 + 0.1 * beat), c, 0.9); x.fillStyle = "#fff"; x.beginPath(); x.arc(cx, cy, R * 0.022 * (1 + beat * 0.5), 0, TAU); x.fill();
    const top = H * 0.66; x.lineWidth = 2 * k; for (let j = 0; j < 13; j++) { const y0 = top + j * R * 0.026, amp = R * (0.05 + 0.06 * beat + (t > 5 ? 0.1 : 0)) * (1 - j / 18); x.strokeStyle = mix("#ffffff", c, j / 13); x.globalAlpha = 0.35 + 0.5 * (1 - j / 13); x.fillStyle = "#03030c"; x.beginPath(); for (let i = 0; i <= 60; i++) { const u = i / 60, dx = (u - 0.5) * W * 0.7, sp = Math.exp(-Math.pow((u - 0.5) * 7, 2)) * amp * (0.55 + 0.45 * Math.sin(j * 1.7 + t * 3 + u * 40)); const px = cx + dx, py = y0 - sp; if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.stroke(); }
    x.globalAlpha = 1; if (t >= 5) glow(x, cx, cy, R * (0.6 + easeOut(q / 2)), c + "99", Math.max(0, 0.9 - q * 0.25));
  } },
  /* 10 SINGULARITY: light bends around a hole, the starfield is dragged in, then everything snaps back */
  { tag: "EVENT HORIZON", hit: 5.2, draw(x, W, H, t, c, S, R) {
    const cx = W / 2, cy = H * 0.46, k = R / 720, D = Math.hypot(W, H), pull = clamp(t / 5.2), q = Math.max(0, t - 5.2);
    S.sg ??= Array.from({ length: 300 }, () => ({ a: rnd(TAU), d: rnd(0.05, 1), s: rnd(0.6, 1.8) }));
    x.fillStyle = "#010106"; x.fillRect(0, 0, W, H);
    x.lineWidth = 1; x.strokeStyle = "rgba(160,170,255,.22)";
    for (let i = 1; i <= 9; i++) { const r0 = (i / 9) * D * 0.5, r = r0 * (1 - 0.55 * Math.exp(-r0 / (R * 0.5)) * ease(pull)); x.beginPath(); x.arc(cx, cy, Math.max(1, r), 0, TAU); x.stroke(); }
    for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU + t * 0.05; x.beginPath(); for (let j = 1; j <= 24; j++) { const r0 = (j / 24) * D * 0.5, r = r0 * (1 - 0.55 * Math.exp(-r0 / (R * 0.5)) * ease(pull)), aa = a + (0.35 * ease(pull)) * Math.exp(-r0 / (R * 0.7)); const px = cx + Math.cos(aa) * r, py = cy + Math.sin(aa) * r; if (j > 1) x.lineTo(px, py); else x.moveTo(px, py); } x.stroke(); }
    for (const s of S.sg) { s.d -= (0.02 + pull * 0.1 * (1.2 - s.d)) * S.dt * (t < 5.2 ? 1 : 0); s.a += (0.1 + 0.9 / (s.d + 0.15)) * S.dt * 0.25; if (s.d < 0.04) { s.d = 1; s.a = rnd(TAU); } const d = s.d * D * 0.5, px = cx + Math.cos(s.a) * d, py = cy + Math.sin(s.a) * d, st = 3 + (1 - s.d) * 36 * k; x.strokeStyle = mix("#ffffff", c, 1 - s.d); x.globalAlpha = 0.3 + (1 - s.d) * 0.7; x.lineWidth = s.s * k; x.beginPath(); x.moveTo(px, py); x.lineTo(px - Math.sin(s.a) * st, py + Math.cos(s.a) * st); x.stroke(); } x.globalAlpha = 1;
    const hr = R * (0.04 + 0.1 * ease(pull)) * (t < 5.2 ? 1 : Math.max(0.01, 1 - q * 1.5));
    const eg = x.createRadialGradient(cx, cy, hr * 0.95, cx, cy, hr * 1.9); eg.addColorStop(0, mix("#ffffff", c, 0.2)); eg.addColorStop(0.35, c + "cc"); eg.addColorStop(1, "transparent"); x.fillStyle = eg; x.beginPath(); x.arc(cx, cy, hr * 1.9, 0, TAU); x.fill();
    x.fillStyle = "#000"; x.beginPath(); x.arc(cx, cy, hr, 0, TAU); x.fill();
    if (t >= 5.2) { glow(x, cx, cy, R * (0.2 + easeOut(q / 1.5) * 1.1), "#fff", Math.max(0, 1 - q * 0.45)); ringPulse(x, cx, cy, q * 0.6, D * 0.6, c, 16, 5); }
  } },
  /* 11 TOUCH GRASS: fall out of orbit, break through the clouds, land in a sunny meadow */
  { tag: "GO OUTSIDE", hit: 5.0, draw(x, W, H, t, c, S, R) {
    const cx = W / 2, k = R / 720, q = Math.max(0, t - 5), desc = ease(t / 4.8);
    S.gr ??= Array.from({ length: 520 }, () => ({ x: Math.random(), y: rnd(0.66, 1.02), h: rnd(0.6, 1.4), p: rnd(TAU), hue: rnd(95, 135), l: rnd(28, 52) }));
    S.fl ??= Array.from({ length: 40 }, () => ({ x: Math.random(), y: rnd(0.72, 1), h: [330, 50, 280, 15, 200][Math.floor(Math.random() * 5)], p: rnd(TAU) }));
    S.bf ??= Array.from({ length: 7 }, () => ({ x: Math.random(), y: rnd(0.45, 0.8), p: rnd(TAU), h: [30, 300, 55, 190][Math.floor(Math.random() * 4)] }));
    const sky = x.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, mix("#02030a", "#3f9bff", desc)); sky.addColorStop(1, mix("#0a0d1c", "#bfe6ff", desc)); x.fillStyle = sky; x.fillRect(0, 0, W, H);
    if (desc < 0.95) skyStars(x, W, H, S, t, 1 - desc * 1.1);
    S.cl ??= Array.from({ length: 14 }, () => ({ x: Math.random(), y: Math.random(), s: rnd(0.6, 1.5) }));
    for (const p of S.cl) { const yy = t < 5 ? ((p.y * H + t * (240 + desc * 1500) * p.s) % (H * 1.3)) - H * 0.15 : H * (0.1 + p.y * 0.4); const xx = (p.x * W + q * 14 * p.s * k) % (W + 300 * k) - 150 * k; x.globalAlpha = (t < 5 ? 0.12 + desc * 0.6 : 0.85); x.fillStyle = "#fff"; for (let j = 0; j < 4; j++) { x.beginPath(); x.ellipse(xx + (j - 1.5) * 70 * k * p.s, yy + (j % 2) * 10 * k, 90 * k * p.s, 34 * k * p.s, 0, 0, TAU); x.fill(); } } x.globalAlpha = 1;
    const hz = H * (1 - ease((t - 2.6) / 2.6) * 0.38 - (t >= 5 ? 0 : 0));
    if (t > 2.6) {
      x.fillStyle = mix("#2c7a3a", "#4fc24a", ease((t - 3) / 2)); x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= 40; i++) { const u = i / 40; x.lineTo(u * W, hz + Math.sin(u * 5 + 1) * 22 * k * ease((t - 3) / 2) + Math.sin(u * 11) * 8 * k); } x.lineTo(W, H); x.fill();
    }
    if (t >= 5) {
      const sunx = W * 0.78, suny = H * 0.2; glow(x, sunx, suny, R * 0.9, "#fff3b0", 0.9); x.fillStyle = "#fffbe0"; x.beginPath(); x.arc(sunx, suny, R * 0.07, 0, TAU); x.fill();
      x.save(); x.translate(sunx, suny); x.globalCompositeOperation = "lighter"; for (let i = 0; i < 14; i++) { x.rotate(TAU / 14 + 0.0008); x.fillStyle = "rgba(255,240,170,.12)"; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.hypot(W, H) * 0.7, -40 * k); x.lineTo(Math.hypot(W, H) * 0.7, 40 * k); x.fill(); } x.restore();
      const gw = easeOut(q / 1.6);
      S.gr.sort((a, b) => a.y - b.y);
      for (const b of S.gr) { const by = b.y * H, bh = R * 0.2 * b.h * gw * (0.5 + b.y * 0.7), sw = Math.sin(t * 2.2 + b.x * 9 + b.p) * 14 * k, bx = b.x * W; x.strokeStyle = `hsl(${b.hue},60%,${b.l}%)`; x.lineWidth = (2 + b.y * 3) * k; x.beginPath(); x.moveTo(bx, by); x.quadraticCurveTo(bx + sw * 0.4, by - bh * 0.5, bx + sw, by - bh); x.stroke(); }
      for (const f of S.fl) { const fy = f.y * H - R * 0.1 * gw, fx = f.x * W + Math.sin(t * 2 + f.p) * 5 * k; x.strokeStyle = "#2f8a36"; x.lineWidth = 2 * k; x.beginPath(); x.moveTo(fx, f.y * H); x.lineTo(fx, fy); x.stroke(); for (let j = 0; j < 5; j++) { const a = (j / 5) * TAU; x.fillStyle = `hsl(${f.h},90%,70%)`; x.beginPath(); x.arc(fx + Math.cos(a) * 6 * k * gw, fy + Math.sin(a) * 6 * k * gw, 5 * k * gw, 0, TAU); x.fill(); } x.fillStyle = "#ffe066"; x.beginPath(); x.arc(fx, fy, 3.5 * k * gw, 0, TAU); x.fill(); }
      for (const b of S.bf) { const bx = ((b.x * W + q * 40 * k * (1 + b.p * 0.1)) % (W + 60)) - 30, by = b.y * H + Math.sin(q * 2 + b.p) * 40 * k, fl = Math.abs(Math.sin(t * 14 + b.p)); x.fillStyle = `hsl(${b.h},90%,62%)`; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(bx + s * 7 * k * fl, by, 9 * k * fl + 1, 6 * k, s * 0.5, 0, TAU); x.fill(); } }
    }
    if (t < 5 && t > 3.2) { const f = ease((t - 3.2) / 1.8); x.fillStyle = `rgba(255,255,255,${0.35 * f})`; x.fillRect(0, 0, W, H); }
  } },
];

/* ============================ shared post effects + caption ============================ */
function post(x, W, H, t, S, hit) {
  const cv = x.canvas, bw = Math.max(2, Math.round(W / 4)), bh = Math.max(2, Math.round(H / 4));
  if (!S.bl) { S.bl = document.createElement("canvas"); S.bl.width = bw; S.bl.height = bh; S.b2 = document.createElement("canvas"); S.b2.width = Math.round(bw / 3); S.b2.height = Math.round(bh / 3); }
  const b = S.bl.getContext("2d"), b2 = S.b2.getContext("2d"); b.drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, bw, bh); b2.drawImage(S.bl, 0, 0, S.b2.width, S.b2.height);
  x.save(); x.globalCompositeOperation = "lighter"; x.globalAlpha = 0.3; x.drawImage(S.bl, 0, 0, W, H); x.globalAlpha = 0.35; x.drawImage(S.b2, 0, 0, W, H); x.restore();
  const f = t - hit; if (f > 0 && f < 0.7) { x.fillStyle = `rgba(255,255,255,${0.7 * Math.pow(1 - f / 0.7, 2)})`; x.fillRect(0, 0, W, H); }
  const v = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62); v.addColorStop(0, "transparent"); v.addColorStop(1, "rgba(0,0,0,.6)"); x.fillStyle = v; x.fillRect(0, 0, W, H);
  const bar = H * 0.075 * ease(t / 0.9) * (1 - ease((t - (DUR - 0.9)) / 0.7)); x.fillStyle = "#000"; x.fillRect(0, 0, W, bar); x.fillRect(0, H - bar, W, bar);
  const fade = 1 - ease(t / 0.5) + ease((t - (DUR - 0.7)) / 0.7); if (fade > 0) { x.fillStyle = `rgba(0,0,0,${clamp(fade)})`; x.fillRect(0, 0, W, H); }
}
function caption(x, W, H, t, hit, rank, idx, tag, R) {
  const t0 = hit + 0.4; if (t < t0) return;
  const name = rank.name.toUpperCase(), size = Math.min(R * 0.15, W / (name.length * 0.82)), sp = size * 0.07, y = Math.min(H * 0.8, H - size * 2.15), out = 1 - ease((t - (DUR - 0.9)) / 0.7);
  x.save(); x.textAlign = "left"; x.textBaseline = "middle"; x.globalAlpha = out;
  x.font = `700 ${Math.max(11, R * 0.017)}px JB, 'JetBrains Mono', monospace`; x.letterSpacing = "6px"; x.fillStyle = rank.color; x.textAlign = "center"; x.globalAlpha = out * ease((t - t0) / 0.6); x.fillText(`RANK UP · ${tag}`, W / 2, y - size * 0.95); x.textAlign = "left"; x.letterSpacing = "0px";
  x.font = `900 ${size}px Unbounded, Inter, sans-serif`;
  const widths = [...name].map((ch) => x.measureText(ch).width + sp), total = widths.reduce((a, b) => a + b, 0) - sp; let px = W / 2 - total / 2;
  [...name].forEach((ch, i) => { const e = easeOut((t - t0 - 0.15 - i * 0.075) / 0.55); x.save(); x.globalAlpha = out * e; x.translate(px + widths[i] / 2 - sp / 2, y + (1 - e) * size * 0.35); x.scale(1 + (1 - e) * 0.5, 1 + (1 - e) * 0.5); x.textAlign = "center"; x.shadowColor = rank.color; x.shadowBlur = size * 0.5; x.fillStyle = "#fff"; x.fillText(ch, 0, 0); x.shadowBlur = size * 0.12; x.fillText(ch, 0, 0); x.restore(); px += widths[i]; });
  x.textAlign = "center"; x.font = `400 ${Math.max(14, R * 0.026)}px Inter, system-ui, sans-serif`; x.fillStyle = "#b9c2ee"; x.globalAlpha = out * ease((t - t0 - 1.1) / 0.8); x.fillText(BLURB[idx] ?? "", W / 2, y + size * 0.78);
  const pa = out * ease((t - t0 - 1.6) / 0.7), pw = R * 0.03; for (let i = 0, n = SCENES.length; i < n; i++) { const dx = W / 2 + (i - (n - 1) / 2) * pw * 1.7, dy = y + size * 1.32; x.globalAlpha = pa; x.fillStyle = i <= idx ? rank.color : "rgba(255,255,255,.18)"; x.shadowColor = rank.color; x.shadowBlur = i <= idx ? 12 : 0; x.beginPath(); x.moveTo(dx, dy - pw * 0.55); x.lineTo(dx + pw * 0.45, dy); x.lineTo(dx, dy + pw * 0.55); x.lineTo(dx - pw * 0.45, dy); x.fill(); }
  x.restore();
}
/** Draw one frame. idx is 0..10 (Cadet..Touch Grass). S is per-run state. */
export function renderFrame(x, W, H, t, rank, idx, S) {
  const sc = SCENES[idx]; S.dt = clamp(S.lt === undefined ? 1 / 60 : t - S.lt, 0, 0.1); S.lt = t;
  x.save(); x.globalCompositeOperation = "source-over"; x.globalAlpha = 1; x.shadowBlur = 0; x.textAlign = "left"; x.letterSpacing = "0px";
  sc.draw(x, W, H, t, rank.color, S, Math.min(W, H)); x.restore();
  post(x, W, H, t, S, sc.hit); caption(x, W, H, t, sc.hit, rank, idx, sc.tag, Math.min(W, H));
}

/* ============================ sound design ============================ */
export function sound(i, dur, ctx) {
  const a = ctx ?? new AudioContext(); a.resume?.().catch?.(() => {}); const T = a.currentTime, sr = a.sampleRate;
  const master = a.createGain(); master.gain.value = 0.85; const comp = a.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.3; master.connect(comp); comp.connect(a.destination);
  const rev = a.createConvolver(), len = Math.floor(sr * 3.4), ir = a.createBuffer(2, len, sr); for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let n = 0; n < len; n++) d[n] = (Math.random() * 2 - 1) * Math.pow(1 - n / len, 2.6); } rev.buffer = ir; const rg = a.createGain(); rg.gain.value = 0.55; rev.connect(rg); rg.connect(master);
  const nbuf = a.createBuffer(1, sr * 4, sr); { const d = nbuf.getChannelData(0); for (let n = 0; n < d.length; n++) d[n] = Math.random() * 2 - 1; }
  const route = (node, wet = 0.25) => { node.connect(master); if (wet) { const g = a.createGain(); g.gain.value = wet; node.connect(g); g.connect(rev); } };
  const env = (g, s, d, v, att) => { g.gain.setValueAtTime(0.0001, T + s); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), T + s + Math.max(0.005, att)); g.gain.exponentialRampToValueAtTime(0.0001, T + s + d); };
  const osc = (type, f0, f1, s, d, v, o = {}) => { const n = a.createOscillator(), g = a.createGain(); n.type = type; n.frequency.setValueAtTime(f0, T + s); if (f1 !== f0) n.frequency.exponentialRampToValueAtTime(f1, T + s + d); if (o.det) n.detune.value = o.det; env(g, s, d, v, o.att ?? 0.015); let out = n; if (o.lp) { const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(o.lp[0], T + s); f.frequency.exponentialRampToValueAtTime(o.lp[1], T + s + d); n.connect(f); out = f; } out.connect(g); route(g, o.wet ?? 0.2); n.start(T + s); n.stop(T + s + d + 0.1); };
  const nz = (s, d, v, o = {}) => { const n = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(); n.buffer = nbuf; n.loop = true; f.type = o.type ?? "bandpass"; f.Q.value = o.q ?? 0.8; f.frequency.setValueAtTime(o.f0 ?? 1000, T + s); if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, T + s + d); env(g, s, d, v, o.att ?? 0.02); n.connect(f); f.connect(g); route(g, o.wet ?? 0.2); n.start(T + s, Math.random() * 2); n.stop(T + s + d + 0.1); };
  const kick = (s, v = 0.7) => { osc("sine", 150, 38, s, 0.38, v, { wet: 0.05 }); nz(s, 0.04, v * 0.25, { type: "highpass", f0: 2000, wet: 0 }); };
  const boom = (s, v = 0.9) => { osc("sine", 95, 22, s, 2.6, v, { wet: 0.3 }); nz(s, 2.2, v * 0.8, { type: "lowpass", f0: 2800, f1: 70, q: 0.6, wet: 0.5, att: 0.01 }); nz(s, 0.25, v * 0.5, { type: "highpass", f0: 1500, wet: 0.2, att: 0.005 }); };
  const bell = (f, s, v = 0.18, d = 3) => { const c = a.createOscillator(), m = a.createOscillator(), mg = a.createGain(), g = a.createGain(); c.frequency.value = f; m.frequency.value = f * 3.51; mg.gain.setValueAtTime(f * 1.8, T + s); mg.gain.exponentialRampToValueAtTime(1, T + s + d * 0.5); m.connect(mg); mg.connect(c.frequency); env(g, s, d, v, 0.004); c.connect(g); route(g, 0.6); c.start(T + s); m.start(T + s); c.stop(T + s + d + 0.1); m.stop(T + s + d + 0.1); };
  const pad = (fs, s, d, v, cut = [400, 2400], att = d * 0.35) => { for (const f of fs) for (const det of [-7, 7]) osc("sawtooth", f, f, s, d, v / fs.length, { det, att, lp: cut, wet: 0.45 }); };
  const pluck = (f, s, v = 0.13) => osc("sawtooth", f, f, s, 0.35, v, { lp: [4200, 300], wet: 0.4, att: 0.004 });
  const riser = (s, d, v = 0.3, f0 = 500, f1 = 9000) => nz(s, d, v, { type: "bandpass", f0, f1, q: 1.2, att: d * 0.92, wet: 0.3 });
  const M = [261.63, 329.63, 392, 523.25, 659.25];
  if (i === 0) { /* Cadet: countdown, ignition, roar, breach */
    [0.05, 0.75, 1.45].forEach((s) => osc("sine", 880, 880, s, 0.18, 0.12, { wet: 0.2 })); osc("sine", 1320, 1320, 2.15, 0.5, 0.14, { wet: 0.3 });
    for (let n = 0; n < 22; n++) nz(1.45 + n * 0.045 + Math.random() * 0.03, 0.05, 0.22, { type: "highpass", f0: 2800, wet: 0.1 });
    nz(1.45, 4, 0.5, { type: "lowpass", f0: 140, f1: 520, att: 1.4, q: 0.7, wet: 0.2 }); osc("sine", 36, 84, 1.45, 4, 0.35, { att: 1.5, wet: 0.1 }); nz(2.2, 3, 0.38, { f0: 260, f1: 2600, q: 0.6, att: 2, wet: 0.3 }); riser(3, 2, 0.3);
    boom(5.0, 0.85); nz(4.95, 1.2, 0.45, { type: "highpass", f0: 700, f1: 7000, q: 0.5, att: 0.05, wet: 0.4 }); pad([M[0], M[1], M[2], M[3]], 5.0, 5, 0.22, [500, 3200]); [0, 1, 2, 3, 4, 3, 2].forEach((k, n) => bell(M[k % 5] * 2, 5.4 + n * 0.28, 0.1));
  } else if (i === 1) { /* Pilot: charge, jump, emerge */
    osc("sine", 110, 1900, 0, 4.6, 0.14, { att: 4 }); osc("sawtooth", 55, 700, 0, 4.6, 0.08, { att: 4, lp: [300, 2500] }); riser(0.5, 4.1, 0.38, 400, 11000);
    [0.5, 1.3, 2, 2.6, 3.1, 3.5, 3.8, 4.05, 4.25, 4.4, 4.5].forEach((s, n) => osc("square", 2400, 2400, s, 0.04, 0.05 + n * 0.012, { wet: 0.1 }));
    boom(4.6, 0.9); nz(4.55, 1.8, 0.6, { f0: 9000, f1: 160, q: 0.9, att: 0.04, wet: 0.5 }); osc("sawtooth", 1800, 90, 4.6, 1.4, 0.18, { lp: [8000, 300] }); nz(4.8, 2.2, 0.22, { f0: 700, f1: 700, q: 6, att: 0.3, wet: 0.4 });
    pad([220, 261.63, 329.63, 440], 5.2, 4.8, 0.22, [500, 3000]); osc("sine", 55, 55, 4.6, 5, 0.3, { att: 0.3, wet: 0.1 }); [1319, 1568, 1760, 2093, 1760, 1568].forEach((f, n) => bell(f, 6.1 + n * 0.36, 0.08, 2.5));
  } else if (i === 2) { /* Navigator: star chimes, compass ticks, resolve */
    pad([110, 164.81, 220], 0, 10, 0.2, [300, 1600], 3.5);
    [523.25, 659.25, 783.99, 880, 1046.5, 783.99, 659.25, 880, 1046.5].forEach((f, n) => bell(f, 1.0 + (n / 8) * 4.2, 0.13, 3));
    for (let n = 0; n < 16; n++) osc("square", 2600, 2600, 2.1 + Math.pow(n / 15, 1.5) * 3.2, 0.025, 0.04, { wet: 0.2 }); nz(3.1, 0.7, 0.2, { type: "highpass", f0: 7000, f1: 2500, att: 0.05, wet: 0.5 });
    riser(3.6, 1.8, 0.2, 800, 9000); boom(5.4, 0.5); [523.25, 783.99, 1046.5, 1567.98].forEach((f) => bell(f, 5.4, 0.16, 4.5)); pad([M[0], M[1], M[2], M[3]], 5.4, 4.6, 0.24, [600, 3800]); [1046.5, 1318.5, 1568, 2093, 2637, 3136].forEach((f, n) => bell(f, 5.9 + n * 0.22, 0.07, 2.4));
  } else if (i === 3) { /* Captain: drone, choir, reverse-cymbal, totality */
    pad([55, 82.41, 110], 0, 10, 0.3, [160, 800], 4); pad([220, 277.18, 329.63], 1.5, 3.7, 0.12, [300, 1400], 2.5); riser(1.7, 3.5, 0.34, 1500, 11000);
    [4.6, 4.75, 4.9].forEach((s) => bell(2093, s, 0.1, 1.4)); boom(5.2, 0.95); bell(220, 5.2, 0.3, 6); bell(329.63, 5.2, 0.2, 6); nz(5.2, 1.4, 0.4, { type: "highpass", f0: 1200, f1: 5000, wet: 0.5 });
    pad([196, 246.94, 293.66, 392, 493.88], 5.2, 4.8, 0.3, [700, 2600], 0.5); [783.99, 987.77, 1174.66, 1567.98, 1975.5].forEach((f, n) => bell(f, 5.9 + n * 0.3, 0.08, 3));
  } else if (i === 4) { /* Voyager: tunnel, accelerating arpeggio, exit */
    nz(0, 5.8, 0.35, { f0: 250, f1: 3200, q: 3, att: 4.5, wet: 0.3 }); osc("sawtooth", 70, 320, 0, 5.8, 0.1, { att: 5, lp: [200, 2500] }); osc("sine", 40, 40, 0, 5.8, 0.18, { att: 2 });
    let s = 0.9, step = 0.42; const sc = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]; for (let n = 0; s < 5.7; n++) { pluck(130.81 * Math.pow(2, sc[n % sc.length] / 12) * (1 + ((n / sc.length) | 0) * 1), s, 0.12); s += step; step = Math.max(0.085, step * 0.88); }
    riser(3.4, 2.4, 0.3, 600, 10000); boom(5.8, 0.9); pad([261.63, 329.63, 392, 493.88, 659.25], 5.8, 4.2, 0.3, [600, 3600], 0.8); [1568, 1318.5, 1174.66, 987.77, 783.99, 659.25].forEach((f, n) => bell(f, 6.3 + n * 0.45, 0.1, 3));
  } else if (i === 5) { /* Legend: heartbeat, silence, implosion, supernova, fanfare */
    [0.4, 1.4, 2.3, 3.0, 3.5].forEach((s, n) => { kick(s, 0.55 + n * 0.08); kick(s + 0.17, 0.35 + n * 0.05); });
    osc("sine", 2600, 3400, 3.6, 1.2, 0.035, { att: 0.8, wet: 0.5 }); osc("sine", 55, 40, 3.6, 1.4, 0.2, { att: 0.2 }); nz(4.2, 0.8, 0.5, { f0: 5000, f1: 160, q: 1.2, att: 0.7, wet: 0.4 });
    boom(5.0, 1); nz(5.0, 3.6, 0.7, { type: "lowpass", f0: 3500, f1: 60, wet: 0.5, att: 0.01 }); for (let n = 0; n < 24; n++) nz(5.1 + Math.random() * 1.6, 0.06, 0.2, { type: "highpass", f0: 2500, wet: 0.3 });
    pad([196, 246.94, 293.66, 392, 493.88], 5.2, 3.2, 0.35, [900, 3200], 0.12); pad([220, 277.18, 329.63, 440, 554.37], 6.6, 3.2, 0.38, [900, 3800], 0.12);
    [1046.5, 1318.5, 1568, 2093, 2637, 3136, 2637, 2093].forEach((f, n) => bell(f, 5.5 + n * 0.3, 0.07, 3)); osc("sine", 55, 55, 5, 5, 0.3, { att: 0.5 });
  } else if (i === 6) { /* Nova: swelling rumble, ignition, warm chords */
    pad([55, 82.41, 110], 0, 5, 0.26, [150, 900], 4); osc("sine", 40, 120, 0, 5, 0.22, { att: 4.5 }); riser(0.5, 4.5, 0.4, 300, 10000);
    [0.6, 1.6, 2.4, 3.0, 3.5, 3.9, 4.2, 4.45, 4.65, 4.8, 4.9].forEach((s, n) => osc("sine", 1800 + n * 120, 1800 + n * 120, s, 0.06, 0.07, { wet: 0.3 }));
    boom(5.0, 1); nz(5.0, 2.4, 0.5, { type: "highpass", f0: 900, f1: 6000, att: 0.05, wet: 0.5 }); pad([261.63, 329.63, 392, 523.25, 659.25], 5.0, 5, 0.34, [700, 3800], 0.4); [1046.5, 1318.5, 1568, 2093, 2637, 3136].forEach((f, n) => bell(f, 5.5 + n * 0.4, 0.09, 3));
  } else if (i === 7) { /* Quasar: low drone, disk whine, jet roar */
    osc("sawtooth", 38, 150, 0, 5, 0.12, { att: 4, lp: [150, 1800] }); osc("sine", 30, 30, 0, 10, 0.2, { att: 1 }); nz(0.5, 4.2, 0.2, { f0: 200, f1: 1800, q: 3, att: 3.5, wet: 0.3 });
    for (let n = 0; n < 16; n++) osc("sine", 700 + n * 90, 1500 + n * 90, 0.3 + n * 0.28, 0.5, 0.04, { wet: 0.4 });
    nz(3, 2.2, 0.5, { f0: 500, f1: 6000, q: 0.8, att: 1.6, wet: 0.4 }); riser(3.2, 1.8, 0.35, 800, 11000); boom(5.0, 1); osc("sawtooth", 1200, 60, 5.0, 2.4, 0.18, { lp: [6000, 200] });
    pad([196, 246.94, 293.66, 392], 5.0, 5, 0.32, [500, 2800], 0.4); [783.99, 987.77, 1174.66, 1567.98].forEach((f, n) => bell(f, 5.6 + n * 0.45, 0.1, 3.5));
  } else if (i === 8) { /* Pulsar: accelerating heartbeat, radio blips, flash */
    let s = 0.3, step = 0.62; for (let n = 0; s < 4.9; n++) { kick(s, 0.5 + Math.min(0.4, n * 0.03)); osc("sine", 3200, 3200, s + 0.02, 0.05, 0.06, { wet: 0.4 }); s += step; step = Math.max(0.11, step * 0.9); }
    osc("sine", 300, 2600, 0.3, 4.6, 0.07, { att: 4.2, wet: 0.4 }); riser(2, 3, 0.3, 700, 10000); boom(5.0, 1);
    pad([220, 261.63, 329.63, 440], 5.0, 5, 0.32, [600, 3200], 0.4); [1318.5, 1760, 2093, 1760, 2637, 3136].forEach((f, n) => bell(f, 5.3 + n * 0.28, 0.1, 3)); for (let n = 0; n < 10; n++) kick(5.1 + n * 0.5, 0.3 - n * 0.02);
  } else if (i === 9) { /* Singularity: sinking pitch, silence, snap */
    osc("sine", 900, 30, 0, 5.1, 0.16, { wet: 0.4 }); osc("sawtooth", 400, 28, 0, 5.1, 0.07, { lp: [1500, 100] }); pad([65.41, 98, 130.81], 0, 5.1, 0.24, [120, 500], 3); nz(0.5, 4.5, 0.3, { f0: 6000, f1: 120, q: 1.1, att: 4, wet: 0.4 });
    [0.5, 1.5, 2.4, 3.2, 3.8, 4.3, 4.7].forEach((s, n) => kick(s, 0.3 + n * 0.07)); nz(4.9, 0.3, 0.1, { type: "highpass", f0: 3000, wet: 0 });
    boom(5.2, 1); nz(5.2, 3.6, 0.8, { type: "lowpass", f0: 5000, f1: 50, wet: 0.5, att: 0.01 }); [196, 246.94, 293.66, 392, 493.88].forEach((f) => osc("sawtooth", f, f, 5.4, 4.4, 0.05, { att: 1.2, lp: [800, 3000], wet: 0.5 })); [1568, 1975.5, 2349, 2637, 3136].forEach((f, n) => bell(f, 5.6 + n * 0.34, 0.09, 3.5));
  } else if (i === 10) { /* Touch Grass: wind, a chirpy morning, a calm major chord */
    pad([55, 82.41], 0, 5, 0.2, [150, 700], 3); nz(0, 4.9, 0.3, { f0: 400, f1: 2200, q: 0.5, att: 4.2, wet: 0.3 }); riser(2.6, 2.3, 0.3, 600, 9000);
    boom(5.0, 0.8); nz(5.0, 3, 0.22, { f0: 3000, f1: 800, q: 0.6, att: 0.05, wet: 0.5 });
    pad([261.63, 329.63, 392, 523.25], 5.0, 5, 0.34, [800, 4200], 0.3); [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, n) => pluck(f, 5.2 + n * 0.22, 0.12));
    for (let n = 0; n < 22; n++) { const t0 = 5.3 + Math.random() * 4.2, f = 2400 + Math.random() * 1400; osc("sine", f, f * (1.2 + Math.random() * 0.4), t0, 0.09, 0.05, { wet: 0.4 }); osc("sine", f * 1.1, f * 0.9, t0 + 0.1, 0.07, 0.04, { wet: 0.4 }); }
    [1046.5, 1318.5, 1568, 2093].forEach((f, n) => bell(f, 6.4 + n * 0.35, 0.08, 3));
  }
  master.gain.setValueAtTime(0.85, T + dur - 0.9); master.gain.linearRampToValueAtTime(0, T + dur - 0.1);
  return a;
}

/** Play the scene for rank index i (1..11; Stardust has none). */
export function playLevelUp(i, rank) {
  const idx = Math.max(0, Math.min(SCENES.length - 1, i - 1));
  if (running) return; running = true;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, dur = reduce ? 3 : DUR;
  const el = document.createElement("div"); el.className = "lu-cut"; el.innerHTML = `<canvas></canvas><button type="button" class="ev-skip">SKIP ▸</button>`;
  document.body.append(el); try { document.fonts.load("900 60px Unbounded"); document.fonts.load("600 14px 'JetBrains Mono'"); } catch { /* fonts optional */ }
  const cv = el.querySelector("canvas"), ctx = cv.getContext("2d"), dpr = Math.min(devicePixelRatio || 1, 2);
  let W, H; const fit = () => { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }; fit(); addEventListener("resize", fit);
  let audio = null; if (!reduce && state.me?.settings?.chatSound !== false) { try { audio = sound(idx, dur); } catch { /* no audio */ } }
  const S = {}, T0 = performance.now(); let done = false, raf = 0;
  const end = () => { if (done) return; done = true; cancelAnimationFrame(raf); removeEventListener("resize", fit); removeEventListener("keydown", onKey, true); try { audio?.close(); } catch { /* */ } el.classList.add("out"); setTimeout(() => { el.remove(); running = false; }, 600); };
  const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); end(); } };
  addEventListener("keydown", onKey, true); el.onclick = end;
  const frame = (now) => { const t = (now - T0) / 1000; if (t > dur) return end(); renderFrame(ctx, W, H, reduce ? Math.max(t, SCENES[idx].hit + 2.5) : t, rank, idx, S); raf = requestAnimationFrame(frame); };
  raf = requestAnimationFrame(frame);
}
let running = false;
