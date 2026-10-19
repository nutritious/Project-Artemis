/* Secret cutscene: plays when someone pulls a Secret from a pack. About 13 seconds of canvas and Web Audio.
   Glitch, blackout, a heartbeat, a crack in the screen, a black hole, then the name decodes out of the noise.
   Built to stay light: few particles, no heavy blur, and it lowers its own resolution if the computer struggles. */
import { state } from "./util.js";

export const SDUR = 13.5;
const TAU = Math.PI * 2, clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const easeOut = (v) => 1 - Math.pow(1 - clamp(v), 3);
const KIND = { tag: "TITLE", effect: "PROFILE EFFECT", bg: "BACKDROP", theme: "THEME" };
const GLYPH = "█▓▒░#@%&$?/\\<>[]{}";
const BEATS = [1.3, 1.85, 2.3, 2.65, 2.95, 3.2, 3.4];

/* ------------------------------- sound ------------------------------- */
function sound(ctx) {
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
  osc("sawtooth", 46, 26, 0.2, 9.5, 0.2, 170);                      /* the drone that never quite stops */
  for (let i = 0; i < 9; i++) osc("square", rnd(300, 3200), rnd(100, 2000), rnd(0, 1.2), 0.05, 0.05); /* glitch chirps */
  noise(0, 1.3, 0.12, 4000, 800);
  BEATS.forEach((b) => { osc("sine", 95, 38, b, 0.28, 0.65); osc("sine", 120, 45, b + 0.12, 0.2, 0.4); });
  noise(2.6, 1.9, 0.4, 250, 7000);                                     /* the riser as the screen cracks */
  osc("sawtooth", 70, 600, 2.7, 1.8, 0.08, 900);
  noise(4.5, 1.6, 0.8, 3000, 60, "lowpass");                         /* impact */
  osc("sine", 55, 22, 4.5, 3.2, 0.9);
  osc("sine", 240, 60, 5.4, 0.7, 0.5); noise(5.4, 0.5, 0.35, 5000, 400); /* SECRET slams */
  for (let i = 0; i < 18; i++) osc("square", 1700 + (i % 3) * 400, 1700, 9.3 + i * 0.1, 0.015, 0.045); /* the decode ticks */
  [110, 116.5, 164.8, 174.6].forEach((f, i) => osc("sine", f, f * 0.995, 9.2, 4, 0.1 + i * 0.01));
  return () => { try { out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setValueAtTime(out.gain.value, ctx.currentTime); out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25); srcs.forEach((s) => { try { s.stop(ctx.currentTime + 0.3); } catch { /* done */ } }); } catch { /* closed */ } };
}

/* ------------------------------- picture ------------------------------- */
let scan = null;
const scanPattern = (x) => { if (!scan) { const c = document.createElement("canvas"); c.width = 1; c.height = 4; const g = c.getContext("2d"); g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(0, 0, 1, 2); scan = c; } return x.createPattern(scan, "repeat"); };

function frame(x, W, H, t, S, item) {
  const R = Math.min(W, H) / 2, cx = W / 2, cy = H / 2, k = R / 380;
  S.dt = Math.min(0.05, t - (S.last ?? t)); S.last = t;
  S.stars ??= Array.from({ length: 150 }, () => ({ a: rnd(TAU), d: rnd(0.15, 1.3), s: rnd(0.6, 2) }));
  S.sp ??= [];
  x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
  x.fillStyle = "#000"; x.fillRect(0, 0, W, H);

  /* A. the picture tears (0 to 1.3s) */
  if (t < 1.3) {
    const inten = clamp(t / 1.1);
    for (let i = 0; i < 6 + inten * 26; i++) { const y = rnd(H), h = rnd(2, 8 + inten * 48), r = Math.random(); x.fillStyle = r < 0.4 ? "#ff2e4d" : r < 0.7 ? "#fff" : "#16001a"; x.globalAlpha = rnd(0.25, 0.9) * (0.4 + inten * 0.6); x.fillRect(rnd(-50, W * 0.5), y, rnd(W * 0.2, W), h); }
    x.globalAlpha = 1; x.fillStyle = Math.random() < 0.5 ? "#ff2e4d" : "#fff"; x.font = `700 ${Math.max(14, R * 0.07)}px ui-monospace, Menlo, monospace`; x.textAlign = "center";
    x.fillText(["SIGNAL LOST", "▲ ERROR 0x5EC2E7", "UNKNOWN ITEM", "DO NOT OPEN"][Math.floor(t * 14) % 4], cx + rnd(-8, 8), cy + rnd(-6, 6));
  }

  /* B. blackout and a heartbeat (1.3 to 2.9s) */
  if (t >= 1.3 && t < 4.5) {
    let pulse = 0; for (const b of BEATS) if (t >= b) pulse += Math.exp(-(t - b) * 7) * (b < 2.9 ? 1 : 1.2);
    const r = R * (0.03 + 0.09 * Math.min(1.5, pulse)), g = x.createRadialGradient(cx, cy, 0, cx, cy, r * 3.2);
    g.addColorStop(0, "rgba(255,70,90,.95)"); g.addColorStop(0.35, "rgba(255,46,77,.45)"); g.addColorStop(1, "rgba(255,46,77,0)"); x.fillStyle = g; x.fillRect(cx - r * 3.2, cy - r * 3.2, r * 6.4, r * 6.4);
  }

  /* C. the crack (2.9 to 4.5s) */
  if (t >= 2.9 && t < 4.6) {
    const p = clamp((t - 2.9) / 1.6), len = H * easeOut(p * 1.3), wd = (2 + 46 * p * p) * k;
    x.save(); x.translate(rnd(-1, 1) * p * 7 * k, rnd(-1, 1) * p * 7 * k);
    const pts = []; for (let i = 0; i <= 28; i++) { const y = cy - len / 2 + (i / 28) * len; pts.push([cx + Math.sin(i * 2.3 + Math.floor(t * 18)) * wd * 0.9 * (0.4 + Math.sin(i / 28 * Math.PI)), y]); }
    for (const [w, c, a] of [[wd * 3.4, "#ff2e4d", 0.18], [wd * 1.6, "#ff6a7d", 0.5], [wd * 0.55, "#fff", 1]]) { x.strokeStyle = c; x.globalAlpha = a; x.lineWidth = w; x.lineJoin = "round"; x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke(); }
    x.restore(); x.globalAlpha = 1;
    for (let i = 0; i < 3 && S.sp.length < 160; i++) S.sp.push({ x: rnd(W), y: rnd(H), l: 1 });
    x.fillStyle = "#ff6a7d";
    for (const q of S.sp) { const dx = cx - q.x, dy = cy - q.y; q.x += dx * 2.4 * S.dt; q.y += dy * 2.4 * S.dt; q.l -= 0.9 * S.dt; x.globalAlpha = clamp(q.l); x.fillRect(q.x, q.y, 2.5 * k + 1, 2.5 * k + 1); }
    S.sp = S.sp.filter((q) => q.l > 0); x.globalAlpha = 1;
  }

  /* E. the black hole (4.5s on) */
  if (t >= 4.5) {
    const tt = t - 4.5, grow = easeOut(tt / 1.1), r0 = R * 0.3 * grow;
    x.globalCompositeOperation = "lighter";
    for (const s of S.stars) { s.d -= (0.05 + (1.2 / (s.d + 0.15)) * 0.09) * S.dt; s.a += (0.5 / (s.d + 0.2)) * S.dt; if (s.d < 0.07) { s.d = rnd(0.9, 1.3); s.a = rnd(TAU); }
      const px = cx + Math.cos(s.a) * s.d * R * 1.6, py = cy + Math.sin(s.a) * s.d * R * 1.6, tx = px - Math.cos(s.a + 1.4) * 6 * s.s * k, ty = py - Math.sin(s.a + 1.4) * 6 * s.s * k;
      x.strokeStyle = s.d < 0.4 ? "#ff6a7d" : "#c9cfff"; x.globalAlpha = clamp(s.d * 1.2) * 0.8; x.lineWidth = s.s * k + 0.4; x.beginPath(); x.moveTo(px, py); x.lineTo(tx, ty); x.stroke(); }
    x.globalAlpha = 1;
    /* the accretion disk */
    x.save(); x.translate(cx, cy); x.rotate(-0.35); x.scale(1, 0.3);
    for (let i = 0; i < 6; i++) { const rr = r0 * (1.25 + i * 0.28), a = tt * (2.2 - i * 0.25); x.strokeStyle = ["#fff", "#ffb36b", "#ff6a3d", "#ff2e4d", "#a00022", "#5a0014"][i]; x.globalAlpha = 0.9 - i * 0.1; x.lineWidth = (12 - i * 1.4) * k;
      x.beginPath(); x.arc(0, 0, rr, a, a + TAU * 0.78); x.stroke(); }
    x.restore(); x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
    const g = x.createRadialGradient(cx, cy, r0 * 0.9, cx, cy, r0 * 1.9); g.addColorStop(0, "rgba(255,46,77,.5)"); g.addColorStop(1, "rgba(255,46,77,0)"); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r0 * 1.9, 0, TAU); x.fill();
    x.fillStyle = "#000"; x.beginPath(); x.arc(cx, cy, r0, 0, TAU); x.fill();
    x.strokeStyle = "#ff2e4d"; x.lineWidth = 3 * k + 1; x.beginPath(); x.arc(cx, cy, r0, 0, TAU); x.stroke();
  }

  /* the word and the reveal (5.4s on) */
  if (t >= 5.4) {
    const tt = t - 5.4, slam = easeOut(tt / 0.28), lift = easeOut((t - 9) / 0.8), size = R * (0.34 - 0.16 * lift) * (3 - 2 * slam), ty = cy + R * (0.02 - 0.5 * lift) * 1;
    const glitch = (Math.floor(t * 22) % 9 === 0) ? rnd(-14, 14) * k : 0;
    x.textAlign = "center"; x.textBaseline = "middle"; x.font = `900 ${size}px Impact, "Arial Black", system-ui, sans-serif`; x.letterSpacing = `${size * 0.08}px`;
    x.globalAlpha = clamp(tt / 0.1);
    x.globalCompositeOperation = "lighter"; x.fillStyle = "#ff2038"; x.fillText("SECRET", cx - 7 * k + glitch, ty); x.fillStyle = "#18e0ff"; x.fillText("SECRET", cx + 7 * k - glitch, ty);
    x.globalCompositeOperation = "source-over"; x.fillStyle = "#fff"; x.fillText("SECRET", cx + glitch * 0.4, ty); x.globalAlpha = 1; x.letterSpacing = "0px";
    if (t >= 9.1) {
      const name = String(item.name ?? "???"), n = Math.floor((t - 9.2) / 0.1), seed = Math.floor(t * 14);
      let shown = ""; for (let i = 0; i < name.length; i++) shown += i < n || name[i] === " " ? name[i] : GLYPH[(seed * 7 + i * 13) % GLYPH.length];
      x.font = `800 ${Math.max(18, R * 0.15)}px Impact, "Arial Black", system-ui, sans-serif`; x.fillStyle = "#fff"; x.globalAlpha = clamp((t - 9.1) / 0.3); x.fillText(shown, cx, cy + R * 0.18);
      x.font = `700 ${Math.max(12, R * 0.055)}px ui-monospace, Menlo, monospace`; x.fillStyle = "#ff2e4d"; x.letterSpacing = `${R * 0.02}px`; x.fillText(KIND[item.type] ?? "ITEM", cx, cy + R * 0.34); x.letterSpacing = "0px";
      if (n >= name.length + 3) { x.fillStyle = "rgba(255,255,255,.55)"; x.font = `600 ${Math.max(11, R * 0.045)}px ui-monospace, Menlo, monospace`; x.fillText("no one else has this", cx, cy + R * 0.46); }
      x.globalAlpha = 1;
    }
  }

  /* flash, scanlines, vignette, fade */
  if (t >= 4.45 && t < 5.4) { x.fillStyle = `rgba(255,255,255,${(1 - clamp((t - 4.5) / 0.9)) * (t < 4.5 ? (t - 4.45) / 0.05 : 1)})`; x.fillRect(0, 0, W, H); }
  if (t >= 4.5) { x.fillStyle = scanPattern(x); x.fillRect(0, 0, W, H); }
  const v = x.createRadialGradient(cx, cy, R * 0.5, cx, cy, Math.max(W, H) * 0.75); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(40,0,6,.7)"); x.fillStyle = v; x.fillRect(0, 0, W, H);
  if (t > SDUR - 0.9) { x.fillStyle = `rgba(0,0,0,${clamp((t - (SDUR - 0.9)) / 0.9)})`; x.fillRect(0, 0, W, H); }
}

/** Play the Secret cutscene. Resolves when it ends or the viewer skips it. item = { name, type } */
export function playSecret(item) {
  return new Promise((resolve) => {
    const cv = document.createElement("canvas"); cv.className = "secret-cut"; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "A Secret was pulled");
    const LV = [Math.min(1, window.devicePixelRatio || 1), 0.7, 0.5]; let lv = 0, ema = 16, nf = 0;
    const fit = () => { cv.width = Math.max(2, Math.round(innerWidth * LV[lv])); cv.height = Math.max(2, Math.round(innerHeight * LV[lv])); };
    fit(); document.body.appendChild(cv); addEventListener("resize", fit);
    const x = cv.getContext("2d");
    let stop = () => {}, ctx;
    if (state.me?.settings?.chatSound !== false) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); stop = sound(ctx); } catch { /* silent */ } }
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
