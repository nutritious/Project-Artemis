/* Redeem codes: the code box (Packs and Hub) and the gift-opening reward animation. */
import { $, api, esc, on, emit, state, toast, rarityColor } from "./util.js";
import { RARITY } from "./cosmetics.js";
import { playChroma } from "./chroma.js";

export const redeemCard = () => `<form class="card glass redeem" data-redeem><div class="rd-ico" aria-hidden="true">🎁</div><div class="grow"><h3 style="margin:0">Got a code?</h3><p class="note" style="margin:2px 0 0">Codes come from the crew during events and drops. Each code works once per player.</p></div>
  <input name="code" placeholder="ENTER CODE" maxlength="32" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Redeem code"><button class="btn primary" type="submit">Redeem</button></form>`;

let bound = false, busy = false;
export function bindRedeem() {
  if (bound) return; bound = true;
  document.addEventListener("submit", async (e) => {
    const f = e.target.closest?.("[data-redeem]"); if (!f) return;
    e.preventDefault(); if (busy) return;
    const inp = f.elements.code, code = inp.value.trim(); if (!code) return void toast("Type a code first", true);
    busy = true; f.classList.add("busy");
    try { const r = await api("/redeem", "POST", { code }); inp.value = ""; await playReward(r); emit("redeemed", r); }
    catch (err) { f.classList.remove("busy"); f.classList.add("bad"); setTimeout(() => f.classList.remove("bad"), 500); toast(err.message, true); }
    busy = false; f.classList.remove("busy");
  });
}

/* ---------- sound ---------- */
function sound(ctx) {
  const t = ctx.currentTime, g = ctx.createGain(); g.gain.value = 0.16; g.connect(ctx.destination);
  const tone = (f, at, d, type = "triangle", v = 1) => { const o = ctx.createOscillator(), e = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t + at); e.gain.setValueAtTime(0.0001, t + at); e.gain.exponentialRampToValueAtTime(v, t + at + 0.02); e.gain.exponentialRampToValueAtTime(0.0001, t + at + d); o.connect(e).connect(g); o.start(t + at); o.stop(t + at + d + 0.05); };
  for (let i = 0; i < 7; i++) tone(180 + i * 12, i * 0.16, 0.1, "square", 0.25);          // rattling box
  [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 1.25 + i * 0.07, 0.5, "triangle", 0.8)); // pop and sparkle
  tone(90, 1.2, 0.5, "sine", 1.2);
  return t;
}
const tick = (ctx, i) => { try { const o = ctx.createOscillator(), e = ctx.createGain(); o.type = "sine"; o.frequency.value = 700 + i * 90; e.gain.setValueAtTime(0.09, ctx.currentTime); e.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18); o.connect(e).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.2); } catch { /* silent */ } };

/* ---------- the animation ---------- */
export function playReward(r) {
  return new Promise((resolve) => {
    const root = document.createElement("div"); root.className = "rw"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Code reward");
    const cards = [];
    if (r.coins) cards.push({ k: "coins", html: `<div class="rw-ico">◎</div><b class="rw-n" data-count="${r.coins}">0</b><small>coins</small>`, c: "#ffc857" });
    if (r.crates) cards.push({ k: "crate", html: `<div class="rw-ico">📦</div><b class="rw-n">${r.crates}</b><small>free crate${r.crates > 1 ? "s" : ""}</small>`, c: "#8b7bff" });
    for (const i of r.items) cards.push({ k: "item", html: `<div class="rw-ico">${i.rarity === "chroma" ? "🌈" : "✨"}</div><b>${esc(i.name)}</b><small>${esc(RARITY[i.rarity]?.name ?? i.rarity)} ${esc(i.type === "bg" ? "backdrop" : i.type)}${i.isNew ? "" : " · you already own it"}</small>`, c: rarityColor(i.rarity), chroma: i.rarity === "chroma" });
    root.innerHTML = `<canvas class="rw-fx"></canvas><div class="rw-glow"></div>
      <div class="rw-stage"><div class="rw-box"><i class="rw-lid"></i><i class="rw-body"></i><i class="rw-ribbon"></i></div>
      <div class="rw-title"><small>CODE ${esc(r.code)}</small><h2>Rewards unlocked</h2>${r.note ? `<p>${esc(r.note)}</p>` : ""}</div>
      <div class="rw-cards">${cards.map((c, i) => `<div class="rw-card ${c.chroma ? "chroma" : ""}" style="--rc:${c.c};--i:${i}">${c.html}</div>`).join("")}</div>
      <button class="btn primary rw-done" type="button">Awesome</button></div>`;
    document.body.appendChild(root);
    const cv = root.querySelector(".rw-fx"), x = cv.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1);
    const fit = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }; fit(); addEventListener("resize", fit);
    let ctx; if (state.me?.settings?.chatSound !== false) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); sound(ctx); } catch { /* silent */ } }
    const P = []; const burst = (n) => { const cx = innerWidth / 2, cy = innerHeight * 0.38; for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = 3 + Math.random() * 11; P.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4, r: 2 + Math.random() * 4, h: Math.random() * 360, l: 1, rot: Math.random() * 6, star: Math.random() < 0.3 }); } };
    let raf = 0, done = false; const t0 = performance.now(); let popped = false;
    const loop = () => {
      const t = (performance.now() - t0) / 1000; x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, innerWidth, innerHeight);
      if (t > 1.25 && !popped) { popped = true; root.classList.add("pop"); burst(160); setTimeout(() => burst(70), 350); }
      for (const p of P) { p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.vx *= 0.99; p.l -= 0.007; p.rot += 0.15; x.globalAlpha = Math.max(0, p.l); x.fillStyle = `hsl(${p.h},95%,62%)`; x.save(); x.translate(p.x, p.y); x.rotate(p.rot); if (p.star) { x.fillRect(-p.r, -1, p.r * 2, 2); x.fillRect(-1, -p.r, 2, p.r * 2); } else x.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); x.restore(); }
      while (P.length && P[0].l <= 0) P.shift(); x.globalAlpha = 1;
      if (!done) raf = requestAnimationFrame(loop);
    };
    loop();
    root.querySelectorAll(".rw-card").forEach((c, i) => setTimeout(() => { c.classList.add("in"); tick(ctx, i); const n = c.querySelector("[data-count]"); if (n) { const end = +n.dataset.count, s = performance.now(); const step = () => { const k = Math.min(1, (performance.now() - s) / 1100); n.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))).toLocaleString(); if (k < 1) requestAnimationFrame(step); }; step(); } }, 1900 + i * 450));
    setTimeout(() => root.classList.add("ready"), 1900 + cards.length * 450 + 300);
    const finish = async () => { if (done) return; done = true; cancelAnimationFrame(raf); removeEventListener("resize", fit); removeEventListener("keydown", key, true); root.classList.add("out"); setTimeout(() => { root.remove(); try { ctx?.close(); } catch { /* ok */ } }, 350); for (const i of r.items) if (i.rarity === "chroma" && i.isNew) await playChroma({ name: i.name, type: i.type, id: i.id }); resolve(); };
    const key = (e) => { if ((e.key === "Escape" || e.key === "Enter") && root.classList.contains("ready")) { e.preventDefault(); finish(); } };
    addEventListener("keydown", key, true);
    root.querySelector(".rw-done").addEventListener("click", finish);
    root.addEventListener("click", (e) => { if (e.target === root && root.classList.contains("ready")) finish(); });
  });
}
