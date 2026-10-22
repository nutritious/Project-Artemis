/* Live event cutscene. The owner starts it and everyone who is online sees it at the same moment. */
import { $, esc, state } from "./util.js";
import { playCinema } from "./cinema.js";
import { playLevelUp } from "./levelup.js";
import { worldOf } from "./cosmetics.js";
const RANKS = [{ name: "Stardust", color: "#8d96bd" }, { name: "Cadet", color: "#4cc9f0" }, { name: "Pilot", color: "#3ddc97" }, { name: "Navigator", color: "#ffc857" }, { name: "Captain", color: "#ff8a5b" }, { name: "Voyager", color: "#e879f9" }, { name: "Legend", color: "#ffd76a" }, { name: "Nova", color: "#ff7ab8" }, { name: "Quasar", color: "#5ad1ff" }, { name: "Pulsar", color: "#9d7bff" }, { name: "Singularity", color: "#c9d1ff" }, { name: "Paradox", color: "#22e3c9" }, { name: "Multiverse", color: "#ff4d6d" }, { name: "Infinity", color: "#fff0b8" }, { name: "Touch Grass", color: "#58d35a" }];

const STYLES = {
  launch: { a: "#8b7bff", b: "#4cc9f0", eyebrow: "LIVE FROM MISSION CONTROL", center: "ring" },
  eclipse: { a: "#ffc857", b: "#ff7a3d", eyebrow: "ECLIPSE EVENT", center: "eclipse" },
  party: { a: "#e879f9", b: "#3ddc97", eyebrow: "CREW PARTY", center: "ring" },
};
let running = false;

export function playEvent(ev) {
  if (/^levelup:([1-9]|1[0-4])$/.test(ev.kind)) { const i = +ev.kind.slice(8); return void playLevelUp(i, RANKS[i], worldOf(state.me?.rb ?? 0)); }
  if (["opening", "halloween", "update"].includes(ev.kind)) return void playCinema(ev.kind, ev);
  if (running) return; running = true;
  const st = STYLES[ev.kind] ?? STYLES.launch, reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = document.createElement("div"); el.className = "event-cut";
  el.innerHTML = `<canvas></canvas><div class="ev-cap"><div class="ev-eye">${esc(st.eyebrow)}</div><h1></h1><p></p><small></small></div><button type="button" class="ev-skip">SKIP ▸</button>`;
  el.querySelector("h1").textContent = ev.title || "LIFTOFF"; el.querySelector("p").textContent = ev.sub || ""; el.querySelector("small").textContent = ev.by ? `Started by ${ev.by}` : "";
  document.body.append(el);
  const cv = el.querySelector("canvas"), ctx = cv.getContext("2d"), cap = el.querySelector(".ev-cap"), dpr = Math.min(devicePixelRatio || 1, 2);
  let W, H; const fit = () => { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }; fit(); addEventListener("resize", fit);
  const stars = Array.from({ length: 260 }, () => ({ a: Math.random() * 6.283, d: Math.random(), s: 0.4 + Math.random() }));
  const conf = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random() * -1, v: 0.15 + Math.random() * 0.3, c: Math.random() < 0.5 ? st.a : Math.random() < 0.5 ? st.b : "#fff", r: Math.random() * 6 }));
  const DUR = reduce ? 5 : 14, T0 = performance.now();
  let audio = null;
  if (!reduce && state.me?.settings?.chatSound !== false) { try { audio = sound(DUR); } catch { /* no audio */ } }
  let done = false, raf = 0;
  const end = () => { if (done) return; done = true; cancelAnimationFrame(raf); removeEventListener("resize", fit); removeEventListener("keydown", onKey, true); try { audio?.close(); } catch { /* */ } el.classList.add("out"); setTimeout(() => { el.remove(); running = false; }, 600); };
  const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); end(); } };
  addEventListener("keydown", onKey, true); el.querySelector(".ev-skip").onclick = end;
  const draw = (now) => {
    const t = (now - T0) / 1000; if (t > DUR) return end();
    const cx = W / 2, cy = H / 2, R = Math.hypot(cx, cy);
    ctx.fillStyle = "#03040a"; ctx.fillRect(0, 0, W, H);
    const count = t < 6 ? Math.ceil(6 - t) - 1 : 0, warp = t < 6 ? 0.04 + (t / 6) ** 3 * 0.25 : t < 7 ? 1 : 0.35 + 0.15 * Math.sin(t);
    /* stars: slow drift while counting down, then stretching into a warp */
    for (const s of stars) {
      s.d += (reduce ? 0.0006 : warp * 0.012) * s.s; if (s.d > 1) { s.d = 0.02; s.a = Math.random() * 6.283; }
      const d0 = s.d * R, d1 = (s.d + (reduce ? 0 : warp * 0.07 * s.s * s.d)) * R;
      ctx.strokeStyle = s.d > 0.6 ? "#fff" : st.b; ctx.globalAlpha = Math.min(1, s.d * 1.6); ctx.lineWidth = 0.6 + s.d * 1.8 * s.s;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(s.a) * d0, cy + Math.sin(s.a) * d0); ctx.lineTo(cx + Math.cos(s.a) * d1, cy + Math.sin(s.a) * d1); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (t < 6) { /* countdown */
      const f = (6 - t) % 1, n = count + 1;
      if (st.center === "eclipse") { const r = Math.min(W, H) * 0.16; const g = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * (2 + (6 - t) * 0.1)); g.addColorStop(0, st.a); g.addColorStop(1, "transparent"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(cx + (t - 3) * 14, cy, r, 0, 6.283); ctx.fill(); }
      else { ctx.strokeStyle = st.a; ctx.lineWidth = 3; ctx.globalAlpha = 0.25 + f * 0.6; ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * (0.1 + (1 - f) * 0.12), 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.fillStyle = "#fff"; ctx.font = `800 ${Math.min(W, H) * 0.2}px Unbounded, Inter, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.globalAlpha = 0.35 + f * 0.65; ctx.fillText(String(n), cx, cy); ctx.globalAlpha = 1;
      ctx.font = "600 14px 'JetBrains Mono', monospace"; ctx.fillStyle = st.b; ctx.fillText("T-MINUS", cx, cy - Math.min(W, H) * 0.17);
      cap.classList.remove("on");
    } else {
      const k = t - 6;
      if (k < 0.8) { ctx.fillStyle = `rgba(255,255,255,${1 - k / 0.8})`; ctx.fillRect(0, 0, W, H); }
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.8); g.addColorStop(0, st.a + "55"); g.addColorStop(1, "transparent"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      cap.classList.add("on");
      if (ev.kind === "party" || t > 9) for (const c of conf) { c.y += c.v * 0.016; if (c.y > 1.05) c.y = -0.05; ctx.fillStyle = c.c; ctx.fillRect(c.x * W, c.y * H, c.r, c.r * 1.6); }
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
}

/* a small synthesized soundtrack: countdown ticks, a rising sweep, then a boom */
function sound(dur) {
  const a = new AudioContext(); a.resume?.();
  const out = a.createGain(); out.gain.value = 0.5; out.connect(a.destination);
  for (let i = 0; i < 5; i++) { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 660; g.gain.setValueAtTime(0.0001, a.currentTime + i); g.gain.exponentialRampToValueAtTime(0.25, a.currentTime + i + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + i + 0.2); o.connect(g).connect(out); o.start(a.currentTime + i); o.stop(a.currentTime + i + 0.25); }
  const sw = a.createOscillator(), sg = a.createGain(); sw.type = "sawtooth"; sw.frequency.setValueAtTime(60, a.currentTime); sw.frequency.exponentialRampToValueAtTime(900, a.currentTime + 6); sg.gain.setValueAtTime(0.0001, a.currentTime); sg.gain.exponentialRampToValueAtTime(0.18, a.currentTime + 5.9); sg.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 6.4); sw.connect(sg).connect(out); sw.start(); sw.stop(a.currentTime + 6.5);
  const boom = a.createOscillator(), bg = a.createGain(); boom.frequency.setValueAtTime(120, a.currentTime + 6); boom.frequency.exponentialRampToValueAtTime(30, a.currentTime + 8); bg.gain.setValueAtTime(0.6, a.currentTime + 6); bg.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 8.5); boom.connect(bg).connect(out); boom.start(a.currentTime + 6); boom.stop(a.currentTime + 8.6);
  for (const [i, f] of [[0, 392], [1, 523], [2, 659], [3, 784]]) { const o = a.createOscillator(), g = a.createGain(); o.type = "triangle"; o.frequency.value = f; const s = a.currentTime + 6.6 + i * 0.35; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.14, s + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, s + 3); o.connect(g).connect(out); o.start(s); o.stop(s + 3.1); }
  setTimeout(() => out.gain.linearRampToValueAtTime(0, a.currentTime + 0.5), (dur - 0.6) * 1000);
  return a;
}
