/* Rebirth cutscene (9 seconds): the old world collapses to a point, flashes white and a new world is born.
   Click or press Esc to skip. Pure canvas + Web Audio. */
import { WORLDS, worldOf } from "./cosmetics.js";
import { state } from "./util.js";

const TAU = Math.PI * 2, clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k;
const ease = (v) => { v = clamp(v); return v * v * (3 - 2 * v); }, easeOut = (v) => 1 - Math.pow(1 - clamp(v), 3);
let running = false;

function planet(x, cx, cy, r, c1, c2, ring) {
  if (ring) { x.save(); x.translate(cx, cy); x.rotate(-0.35); x.strokeStyle = c2; x.globalAlpha = 0.5; x.lineWidth = r * 0.14; x.beginPath(); x.ellipse(0, 0, r * 1.9, r * 0.5, 0, Math.PI, TAU); x.stroke(); x.restore(); }
  const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r); g.addColorStop(0, "#fff"); g.addColorStop(0.25, c1); g.addColorStop(1, "#05060f");
  x.globalAlpha = 1; x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
  if (ring) { x.save(); x.translate(cx, cy); x.rotate(-0.35); x.strokeStyle = c2; x.globalAlpha = 0.8; x.lineWidth = r * 0.14; x.beginPath(); x.ellipse(0, 0, r * 1.9, r * 0.5, 0, 0, Math.PI); x.stroke(); x.restore(); }
}
function sound(dur) {
  const A = new (window.AudioContext || window.webkitAudioContext)(), m = A.createGain(); m.gain.value = 0.5; m.connect(A.destination);
  const osc = (type, f0, f1, t, d, v) => { const o = A.createOscillator(), g = A.createGain(); o.type = type; o.frequency.setValueAtTime(f0, A.currentTime + t); o.frequency.exponentialRampToValueAtTime(f1, A.currentTime + t + d); g.gain.setValueAtTime(0.0001, A.currentTime + t); g.gain.linearRampToValueAtTime(v, A.currentTime + t + d * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, A.currentTime + t + d); o.connect(g).connect(m); o.start(A.currentTime + t); o.stop(A.currentTime + t + d + 0.05); };
  osc("sawtooth", 60, 900, 0, 4, 0.12); osc("sine", 220, 2600, 0.5, 3.5, 0.1);
  osc("sine", 70, 30, 4, 2.5, 0.5);
  [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => osc("triangle", f, f, 4.6 + i * 0.28, 2.6, 0.11));
  return A;
}
export function playRebirth(rb) {
  if (running) return; running = true;
  const to = WORLDS[worldOf(rb)], from = WORLDS[worldOf(rb - 1)], cyc = rb >= WORLDS.length;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, dur = reduce ? 3 : 9;
  const el = document.createElement("div"); el.className = "lu-cut"; el.innerHTML = `<canvas></canvas><button type="button" class="ev-skip">SKIP ▸</button>`;
  document.body.append(el);
  const cv = el.querySelector("canvas"), x = cv.getContext("2d"), dpr = Math.min(devicePixelRatio || 1, 2);
  let W, H; const fit = () => { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0); }; fit(); addEventListener("resize", fit);
  let audio = null; if (!reduce && state.me?.settings?.chatSound !== false) { try { audio = sound(dur); } catch { /* no audio */ } }
  const stars = Array.from({ length: 220 }, () => ({ a: Math.random() * TAU, d: 0.05 + Math.random(), s: 0.5 + Math.random() * 1.6 }));
  const T0 = performance.now(); let done = false, raf = 0;
  const end = () => { if (done) return; done = true; cancelAnimationFrame(raf); removeEventListener("resize", fit); removeEventListener("keydown", onKey, true); try { audio?.close(); } catch { /* */ } el.classList.add("out"); setTimeout(() => { el.remove(); running = false; }, 600); };
  const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); end(); } };
  addEventListener("keydown", onKey, true); el.onclick = end;
  const frame = (now) => {
    const t = reduce ? 6 : (now - T0) / 1000; if ((now - T0) / 1000 > dur) return end();
    const cx = W / 2, cy = H / 2, R = Math.min(W, H), D = Math.hypot(cx, cy);
    x.fillStyle = "#03040a"; x.fillRect(0, 0, W, H);
    const collapse = ease((t - 1.2) / 2.6), born = easeOut((t - 4.1) / 2.4), after = t >= 4;
    const col = after ? to.color : from.color, col2 = after ? to.color2 : from.color2;
    /* stars rush inward, then outward after the flash */
    for (const s of stars) {
      const d = after ? s.d * easeOut((t - 4) / 2) + 0.02 : s.d * (1 - collapse * 0.92), r = d * D, px = cx + Math.cos(s.a) * r, py = cy + Math.sin(s.a) * r;
      x.globalAlpha = 0.35 + 0.5 * s.s / 2; x.fillStyle = s.s > 1.5 ? col2 : "#fff"; x.fillRect(px, py, s.s, s.s);
    }
    x.globalAlpha = 1;
    if (!after) {
      const k = 1 - collapse, r = R * 0.18 * (0.15 + 0.85 * k) * (1 + 0.04 * Math.sin(t * 9));
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, R * 0.6 * (0.2 + k)); g.addColorStop(0, col + "cc"); g.addColorStop(1, "transparent"); x.fillStyle = g; x.fillRect(0, 0, W, H);
      planet(x, cx, cy, r, from.color, from.color2, worldOf(rb - 1) % 2 === 1);
      for (let i = 0; i < 3; i++) { const rr = (R * 0.5) * (1 - ((t * 0.5 + i / 3) % 1)); x.strokeStyle = col2; x.globalAlpha = 0.5 * (1 - rr / (R * 0.5)); x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, Math.max(1, rr), 0, TAU); x.stroke(); }
      x.globalAlpha = 1;
    }
    const flash = t < 3.8 ? 0 : t < 4.0 ? (t - 3.8) / 0.2 : Math.max(0, 1 - (t - 4) / 0.9);
    if (after) {
      for (let i = 0; i < 4; i++) { const k = clamp((t - 4 - i * 0.18) / 2.2), r = k * D * 1.1; x.strokeStyle = i % 2 ? col2 : col; x.globalAlpha = (1 - k) * 0.8; x.lineWidth = 6 - i; x.beginPath(); x.arc(cx, cy, Math.max(1, r), 0, TAU); x.stroke(); }
      x.globalAlpha = born; const g = x.createRadialGradient(cx, cy, 0, cx, cy, R * 0.75); g.addColorStop(0, col + "55"); g.addColorStop(1, "transparent"); x.fillStyle = g; x.fillRect(0, 0, W, H);
      const pr = R * (0.04 + 0.16 * born); planet(x, cx, cy - R * 0.06, pr, to.color, to.color2, worldOf(rb) % 2 === 1); x.globalAlpha = 1;
      const a = ease((t - 5.4) / 1.2); x.textAlign = "center"; x.fillStyle = col2; x.globalAlpha = a; x.font = `600 ${Math.max(12, R * 0.022)}px 'JetBrains Mono', monospace`; x.letterSpacing = "6px";
      x.fillText(cyc ? `REBIRTH #${rb} · THE CYCLE CONTINUES` : `REBIRTH #${rb}`, cx, cy + R * 0.24);
      x.fillStyle = "#fff"; x.letterSpacing = "2px"; x.font = `900 ${Math.max(22, R * 0.07)}px Unbounded, 'Segoe UI', sans-serif`; x.shadowColor = col; x.shadowBlur = 24; x.fillText(to.name.toUpperCase(), cx, cy + R * 0.33); x.shadowBlur = 0;
      x.globalAlpha = ease((t - 6.4) / 1) * 0.85; x.fillStyle = "#cfd6ff"; x.letterSpacing = "0px"; x.font = `500 ${Math.max(12, R * 0.022)}px 'Segoe UI', sans-serif`; x.fillText(to.sub, cx, cy + R * 0.39); x.globalAlpha = 1;
    }
    if (flash > 0) { x.fillStyle = `rgba(255,255,255,${flash})`; x.fillRect(0, 0, W, H); }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}
