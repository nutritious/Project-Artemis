/* Cinematic cutscenes: the Opening, Halloween and Update-incoming intros. Pure canvas + synthesized sound, 12 seconds, skippable. */
import { esc, state } from "./util.js";

const DUR = 12;
const ease = (x) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const rnd = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; };
const FONT = (px, w = 900) => `${w} ${px}px Unbounded, Inter, system-ui, sans-serif`;
const MONO = (px) => `600 ${px}px 'JetBrains Mono', ui-monospace, monospace`;

function spaced(ctx, text, x, y, gap) { /* letter-spaced centered text */
  const ws = [...text].map((c) => ctx.measureText(c).width + gap), tot = ws.reduce((a, b) => a + b, 0) - gap; let cx = x - tot / 2;
  const prev = ctx.textAlign; ctx.textAlign = "left"; [...text].forEach((c, i) => { ctx.fillText(c, cx, y); cx += ws[i]; }); ctx.textAlign = prev;
}
function moon(ctx, x, y, r, tint = "#dfe6ff", glow = "#8b7bff", edge = "#7d86b8") {
  const g = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 2.4); g.addColorStop(0, glow + "66"); g.addColorStop(1, "transparent"); ctx.fillStyle = g; ctx.fillRect(x - r * 2.5, y - r * 2.5, r * 5, r * 5);
  const b = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r); b.addColorStop(0, "#fff"); b.addColorStop(0.5, tint); b.addColorStop(1, edge); ctx.fillStyle = b; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
  const R = rnd(7); ctx.fillStyle = "rgba(70,80,130,.22)"; for (let i = 0; i < 9; i++) { const a = R() * 6.283, d = R() * r * 0.7, cr = r * (0.06 + R() * 0.12); ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, cr, 0, 6.283); ctx.fill(); }
}
function starfield(ctx, W, H, t, speed = 1, n = 140) {
  const R = rnd(11); for (let i = 0; i < n; i++) { const z = 0.2 + R() * 0.8, x = (R() * W - t * 14 * speed * z + W * 4) % W, y = R() * H, tw = 0.5 + 0.5 * Math.sin(t * 2 + i); ctx.globalAlpha = (0.25 + 0.6 * tw) * z; ctx.fillStyle = "#fff"; ctx.fillRect(x, y, 1 + z * 1.4, 1 + z * 1.4); } ctx.globalAlpha = 1;
}
function burst(ctx, x, y, t0, t, colors, S, n = 46) { /* firework: particles outward then falling */
  const k = t - t0; if (k < 0 || k > 2.2) return; const R = rnd((x * 7 + y * 13) | 0);
  for (let i = 0; i < n; i++) { const a = R() * 6.283, v = 90 + R() * 190, px = x + Math.cos(a) * v * k, py = y + Math.sin(a) * v * k + 120 * k * k; ctx.globalAlpha = clamp(1 - k / 2.2); ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(px, py, 3, 3); } ctx.globalAlpha = 1;
}

/* ---------- scenes ---------- */
const SCENES = {
  opening(ctx, W, H, t, S, ev) {
    const cx = W / 2, cy = H / 2, m = Math.min(W, H);
    ctx.fillStyle = "#02030a"; ctx.fillRect(0, 0, W, H); starfield(ctx, W, H, t, 1 + clamp(t - 5, 0, 3));
    if (t < 3) { const beat = Math.exp(-((t % 1) * 5)); ctx.fillStyle = `rgba(255,215,106,${0.2 + 0.6 * beat})`; ctx.beginPath(); ctx.arc(cx, cy, 3 + beat * 8, 0, 6.283); ctx.fill(); }
    const rise = ease((t - 2) / 3.2), mr = m * 0.2, my = H * 0.3; if (t > 2) moon(ctx, cx, H + mr * 1.5 - rise * (H + mr * 1.5 - my), mr, "#e8ecff", "#8b7bff");
    if (t > 5.2 && t < 6.6) { const k = (t - 5.2) / 1.4; ctx.strokeStyle = `rgba(255,215,106,${1 - k})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, H * 0.3, k * Math.hypot(W, H) * 0.7, 0, 6.283); ctx.stroke(); }
    if (t > 5.2 && t < 5.6) { ctx.fillStyle = `rgba(255,255,255,${1 - (t - 5.2) / 0.4})`; ctx.fillRect(0, 0, W, H); }
    const a = ease((t - 5.3) / 0.5), sh = t < 6 ? (Math.random() - 0.5) * 8 * (1 - (t - 5.3)) : 0;
    if (t > 5.3) { ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = FONT(m * 0.075); ctx.fillStyle = "#ff3b8f"; spaced(ctx, "PROJECT ARTEMIS", cx - 3 + sh, H * 0.6, m * 0.01); ctx.fillStyle = "#3be8ff"; spaced(ctx, "PROJECT ARTEMIS", cx + 3 - sh, H * 0.6, m * 0.01); ctx.fillStyle = "#fff"; spaced(ctx, "PROJECT ARTEMIS", cx, H * 0.6, m * 0.01); ctx.globalAlpha = 1; }
    if (t > 7) { const b = ease((t - 7) / 0.6); ctx.globalAlpha = b; ctx.font = FONT(m * 0.12); const g = ctx.createLinearGradient(cx - 200, 0, cx + 200, 0); g.addColorStop(0, "#ffd76a"); g.addColorStop(1, "#ff5d9e"); ctx.fillStyle = g; ctx.fillText("IS OPEN", cx, H * 0.74 + (1 - b) * 30); ctx.globalAlpha = 1; }
    const cols = ["#ffd76a", "#3be8ff", "#ff5d9e", "#fff"];
    [[0.2, 0.3, 7.2], [0.8, 0.28, 7.6], [0.5, 0.18, 8.2], [0.12, 0.6, 8.8], [0.88, 0.58, 9.1], [0.35, 0.25, 9.6], [0.65, 0.22, 10]].forEach(([x, y, tt]) => burst(ctx, x * W, y * H, tt, t, cols, S));
    if (t > 8.2) { ctx.globalAlpha = ease((t - 8.4) / 0.6); ctx.font = MONO(Math.max(12, m * 0.022)); ctx.fillStyle = "#cfe0ff"; spaced(ctx, "THE GAMES START NOW", cx, H * 0.88, 4); ctx.globalAlpha = 1; }
  },
  halloween(ctx, W, H, t, S, ev) {
    const cx = W / 2, cy = H / 2, m = Math.min(W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#0a0414"); bg.addColorStop(1, "#2a0e05"); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); starfield(ctx, W, H, t, 0.4, 70);
    const mr = m * (0.16 + 0.12 * ease(t / 5)); moon(ctx, cx, cy - m * 0.2, mr * 0.9, "#ffb15a", "#ff7a2b", "#b8480f");
    const R = rnd(3); for (let i = 0; i < 14; i++) { const sp = 40 + R() * 90, x = ((R() * W + t * sp * (R() < 0.5 ? 1 : -1)) % (W + 80) + W + 80) % (W + 80) - 40, y = H * 0.12 + R() * H * 0.5 + Math.sin(t * 4 + i) * 14, f = Math.sin(t * 14 + i) * 0.5 + 0.5; ctx.fillStyle = "#06020b"; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 12, y - 10 * f - 3, x - 22, y + 2); ctx.quadraticCurveTo(x - 12, y + 4, x, y + 8); ctx.quadraticCurveTo(x + 12, y + 4, x + 22, y + 2); ctx.quadraticCurveTo(x + 12, y - 10 * f - 3, x, y); ctx.fill(); }
    ctx.fillStyle = "#05020a"; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H - m * 0.1 - Math.abs(Math.sin(x * 0.011) * m * 0.07) - (x % 140 < 50 ? m * 0.03 : 0)); ctx.lineTo(W, H); ctx.fill();
    for (let i = 0; i < 6; i++) { const x = W * (0.1 + i * 0.16), y = H - m * 0.075 + Math.sin(t * 2 + i) * 2; ctx.fillStyle = "#ff7a2b"; ctx.beginPath(); ctx.ellipse(x, y, m * 0.035, m * 0.03, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = "#1a0700"; ctx.fillRect(x - 6, y - 5, 4, 5); ctx.fillRect(x + 3, y - 5, 4, 5); ctx.fillRect(x - 7, y + 3, 14, 3); }
    for (let i = 0; i < 3; i++) { const gx = ((t * 40 + i * W / 3) % (W + 120)) - 60, gy = H * 0.55 + Math.sin(t * 1.5 + i * 2) * 24; ctx.globalAlpha = 0.5; ctx.fillStyle = "#e8ffe8"; ctx.beginPath(); ctx.arc(gx, gy, 18, Math.PI, 0); ctx.lineTo(gx + 18, gy + 28); for (let k = 3; k >= 0; k--) ctx.lineTo(gx - 18 + k * 12, gy + 28 + (k % 2 ? 7 : 0)); ctx.fill(); ctx.fillStyle = "#000"; ctx.fillRect(gx - 8, gy - 3, 4, 6); ctx.fillRect(gx + 4, gy - 3, 4, 6); ctx.globalAlpha = 1; }
    const fog = ctx.createLinearGradient(0, H * 0.6, 0, H); fog.addColorStop(0, "transparent"); fog.addColorStop(1, "rgba(120,255,130,.12)"); ctx.fillStyle = fog; ctx.fillRect(0, H * 0.6, W, H * 0.4);
    if ((t > 4.6 && t < 4.75) || (t > 4.9 && t < 5.0)) { ctx.fillStyle = "rgba(220,255,220,.85)"; ctx.fillRect(0, 0, W, H); }
    if (t > 5) { const a = ease((t - 5) / 0.7); ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = FONT(m * 0.085); ctx.fillStyle = "#000"; spaced(ctx, "HALLOWEEN", cx + 4, cy + m * 0.1 + 4, m * 0.008); const g = ctx.createLinearGradient(0, cy - 40, 0, cy + 40); g.addColorStop(0, "#ffb15a"); g.addColorStop(1, "#ff5a1f"); ctx.fillStyle = g; spaced(ctx, "HALLOWEEN", cx, cy + m * 0.1, m * 0.008); ctx.font = FONT(m * 0.05); ctx.fillStyle = "#7dff6a"; spaced(ctx, "NIGHT", cx, cy + m * 0.19, m * 0.02); ctx.globalAlpha = 1; for (let i = 0; i < 6; i++) { const dx = cx - m * 0.28 + i * m * 0.11, dl = clamp((t - 5.6 - i * 0.2) / 2) * m * 0.05; ctx.fillStyle = "#ff5a1f"; ctx.fillRect(dx, cy + m * 0.145, 3, dl * (0.5 + (i % 3) * 0.3)); } }
    if (t > 8) { ctx.globalAlpha = ease((t - 8.2) / 0.6); ctx.font = MONO(Math.max(12, m * 0.022)); ctx.fillStyle = "#ffd9b0"; ctx.textAlign = "center"; spaced(ctx, "SURVIVE THE HAUNTED GAMES", cx, cy + m * 0.29, 4); ctx.globalAlpha = 1; }
    if (t > 5 && t < 5.8 && Math.random() < 0.5) { ctx.fillStyle = "rgba(255,255,255,.06)"; ctx.fillRect(0, 0, W, H); }
  },
  update(ctx, W, H, t, S, ev) {
    const cx = W / 2, m = Math.min(W, H), items = String(ev.sub || "").split("|").map((x) => x.trim()).filter(Boolean).slice(0, 7);
    ctx.fillStyle = "#04060f"; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = "rgba(139,123,255,.08)"; ctx.lineWidth = 1; for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; const jit = t < 2.4 ? (Math.random() - 0.5) * 6 * (1 - t / 2.4) : 0;
    ctx.font = MONO(Math.max(12, m * 0.022)); ctx.fillStyle = "#4cc9f0"; spaced(ctx, "// INCOMING TRANSMISSION", cx, H * 0.2, 3);
    const ttl = String(ev.title || "UPDATE").toUpperCase().slice(0, 24); ctx.font = FONT(Math.min(m * 0.09, (W * 0.86) / (ttl.length * 0.9))); ctx.fillStyle = "#ff3b8f"; spaced(ctx, ttl, cx - 3 + jit, H * 0.3, m * 0.01); ctx.fillStyle = "#3be8ff"; spaced(ctx, ttl, cx + 3 - jit, H * 0.3, m * 0.01); ctx.fillStyle = "#fff"; spaced(ctx, ttl, cx, H * 0.3, m * 0.01);
    const bw = Math.min(W * 0.7, 640), bx = cx - bw / 2, by = H * 0.42, p = clamp((t - 0.6) / 3.4), pe = p < 0.7 ? p * 1.2 : 0.84 + (p - 0.7) * 0.53;
    ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(bx, by, bw, 14); const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, "#8b7bff"); g.addColorStop(1, "#3be8ff"); ctx.fillStyle = g; ctx.fillRect(bx, by, bw * clamp(pe), 14);
    ctx.font = MONO(14); ctx.fillStyle = "#cfe0ff"; ctx.textAlign = "left"; ctx.fillText(p < 1 ? `Installing… ${Math.round(clamp(pe) * 100)}%` : "Installed. Systems nominal.", bx, by + 34); ctx.textAlign = "center";
    items.forEach((it, i) => { const s = 4.2 + i * 0.55, a = ease((t - s) / 0.35); if (a <= 0) return; ctx.globalAlpha = a; ctx.textAlign = "left"; ctx.font = MONO(Math.max(13, m * 0.026)); ctx.fillStyle = "#3dff7a"; ctx.fillText("+", bx, by + 70 + i * (m * 0.052)); ctx.fillStyle = "#fff"; ctx.fillText(it.slice(0, 64), bx + 24 + (1 - a) * 30, by + 70 + i * (m * 0.052)); ctx.globalAlpha = 1; });
    if (t > 9.2) { const a = ease((t - 9.2) / 0.5); ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.font = FONT(m * 0.04); ctx.fillStyle = "#ffd76a"; spaced(ctx, "NEW VERSION LIVE", cx, H * 0.9, m * 0.01); ctx.globalAlpha = 1; }
    if (t > 3.9 && t < 4.1) { ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - (t - 3.9) / 0.2)})`; ctx.fillRect(0, 0, W, H); }
  },
};

/* ---------- synthesized soundtracks ---------- */
function sound(kind) {
  const a = new (window.AudioContext || window.webkitAudioContext)(); a.resume?.();
  const out = a.createGain(); out.gain.value = 0.55; out.connect(a.destination);
  const tone = (f, s, d, type = "sine", v = 0.2, f2) => { const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + s; o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.03, d / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05); };
  const noise = (s, d, v = 0.3, hp = 200) => { const n = a.sampleRate * d, buf = a.createBuffer(1, n, a.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2; const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); f.type = "highpass"; f.frequency.value = hp; g.gain.value = v; src.buffer = buf; src.connect(f).connect(g).connect(out); src.start(a.currentTime + s); };
  if (kind === "opening") {
    for (let i = 0; i < 3; i++) { tone(60, i, 0.25, "sine", 0.5); tone(55, i + 0.28, 0.25, "sine", 0.35); }
    tone(80, 2, 3.3, "sawtooth", 0.1, 1200); tone(40, 5.2, 2.2, "sine", 0.7, 25); noise(5.2, 1.6, 0.5, 60);
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 5.5 + i * 0.16, 1.4, "triangle", 0.14));
    [7.2, 7.6, 8.2, 8.8, 9.1, 9.6, 10].forEach((s) => { noise(s, 0.5, 0.25, 1500); tone(900, s, 0.25, "sine", 0.08, 200); });
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 8.4 + i * 0.12, 2.5, "triangle", 0.1));
  } else if (kind === "halloween") {
    [110, 138, 165].forEach((f) => tone(f, 0, 5, "sawtooth", 0.05)); tone(55, 0, 5, "sine", 0.25);
    [0.5, 1.7, 3.2].forEach((s) => tone(1800, s, 0.25, "sine", 0.04, 2600));
    noise(4.6, 0.3, 0.8, 100); noise(4.9, 1.6, 0.6, 80); tone(48, 4.9, 2, "sine", 0.7, 30);
    [262, 311, 392, 311, 262, 233, 262, 466].forEach((f, i) => tone(f, 5.2 + i * 0.28, 0.5, "triangle", 0.12)); tone(131, 5.2, 4, "sawtooth", 0.06);
  } else {
    for (let i = 0; i < 12; i++) tone(900 + i * 40, i * 0.28, 0.05, "square", 0.05);
    tone(100, 0.4, 3.5, "sawtooth", 0.06, 900); noise(3.9, 0.5, 0.4, 300); tone(60, 3.9, 0.8, "sine", 0.5, 30);
    [659, 880, 1109, 1319].forEach((f, i) => tone(f, 4.2 + i * 0.3, 0.35, "triangle", 0.12)); [523, 659, 784, 1047].forEach((f, i) => tone(f, 9.2 + i * 0.1, 1.8, "triangle", 0.12));
  }
  setTimeout(() => out.gain.linearRampToValueAtTime(0, a.currentTime + 0.5), (DUR - 0.6) * 1000);
  return a;
}

let running = false;
export function playCinema(kind, ev = {}) {
  if (running || !SCENES[kind]) return false; running = true;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = document.createElement("div"); el.className = "lu-cut"; el.innerHTML = `<canvas></canvas><button type="button" class="ev-skip">SKIP ▸</button>`; document.body.append(el);
  try { document.fonts.load("900 60px Unbounded"); document.fonts.load("600 14px 'JetBrains Mono'"); } catch { /* optional */ }
  const cv = el.querySelector("canvas"), ctx = cv.getContext("2d"), dpr = Math.min(devicePixelRatio || 1, 2);
  let W, H; const fit = () => { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }; fit(); addEventListener("resize", fit);
  let audio = null; if (!reduce && state.me?.settings?.chatSound !== false) { try { audio = sound(kind); } catch { /* no audio */ } }
  const S = {}, T0 = performance.now(), dur = reduce ? 3 : DUR; let done = false, raf = 0;
  const end = () => { if (done) return; done = true; cancelAnimationFrame(raf); removeEventListener("resize", fit); removeEventListener("keydown", onKey, true); try { audio?.close(); } catch { /* */ } el.classList.add("out"); setTimeout(() => { el.remove(); running = false; }, 600); };
  const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); end(); } };
  addEventListener("keydown", onKey, true); el.querySelector(".ev-skip").onclick = end;
  const draw = (now) => { const t = reduce ? DUR - 1 : (now - T0) / 1000; if (t > dur + (reduce ? 0 : 0.01) && !reduce) return end(); if (reduce && now - T0 > 3000) return end(); SCENES[kind](ctx, W, H, t, S, ev); raf = requestAnimationFrame(draw); };
  raf = requestAnimationFrame(draw);
  return true;
}
