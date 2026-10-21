/* Project Artemis — global announcements, quick events (coin rain, meteors, boosts…), the live-event bar and rewards. */
import { $, api, esc, on, state, toast, overlay, titleChip, emit } from "./util.js";
import { GAMES, effectMap } from "./cosmetics.js";
const gameName = (id) => GAMES.find((g) => g.id === id)?.name ?? id;

let ac;
function blip(f, d = 0.2, type = "sine", v = 0.08, w = 0) {
  if (state.me?.settings?.chatSound === false) return;
  try { ac ??= new (window.AudioContext || window.webkitAudioContext)(); const t = ac.currentTime + w, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + 0.05); } catch { /* silent */ }
}
const chord = (fs, d = 0.7) => fs.forEach((f, i) => blip(f, d, "triangle", 0.1, i * 0.11));
const layer = () => { let l = $("#fxLayer"); if (!l) { l = document.createElement("div"); l.id = "fxLayer"; document.body.appendChild(l); } return l; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A gold banner slides across the top for everyone online when somebody reaches the top rank, Touch Grass. */
function legendBanner(m) {
  const u = m.user ?? {}, mine = u.id === state.me?.id;
  const el = document.createElement("div");
  el.className = "legend-banner";
  el.innerHTML = `<span class="lg-star">✦</span><div><b>${mine ? "You have" : esc(u.username) + " has"} reached TOUCH GRASS</b><small>${mine ? "The whole crew just saw that." : "The top rank in Project Artemis. Say congrats in chat!"}</small></div><span class="lg-star">✦</span>`;
  document.body.appendChild(el);
  chord([523.25, 659.25, 783.99, 1046.5], 0.9);
  setTimeout(() => el.classList.add("out"), 12000);
  setTimeout(() => el.remove(), 12800);
}

/** A rainbow banner for everyone online when somebody pulls a Chroma item. */
function chromaBanner(m) {
  const mine = m.user === state.me?.username, kind = { tag: "title", effect: "profile effect", bg: "backdrop", theme: "theme" }[m.item?.type] ?? "item";
  const el = document.createElement("div"); el.className = "chroma-banner";
  el.innerHTML = `<span class="cb-i">✦</span><div><b>${mine ? "You" : esc(m.user)} pulled CHROMA: ${esc(m.item?.name ?? "")}</b><small>${mine ? "The rarest tier in the game. The whole crew saw that." : `A Chroma ${kind}. Congratulate them in chat!`}</small></div><span class="cb-i">✦</span>`;
  document.body.appendChild(el);
  chord([523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093], 1.1);
  setTimeout(() => el.classList.add("out"), 7000); setTimeout(() => el.remove(), 7900);
}
function secretBanner(m) {
  const mine = m.user === state.me?.username;
  const fl = document.createElement("div"); fl.className = "secret-flash"; document.body.appendChild(fl); setTimeout(() => fl.remove(), 1200);
  const tier = ["forbidden", "omega", "apex"].includes(m.tier) ? m.tier : "secret", fall = m.season === "fall", word = { secret: "a SECRET", forbidden: "a FORBIDDEN item", omega: "an OMEGA item", apex: fall ? "the FALL APEX" : "the HALLOWEEN APEX" }[tier], ic = tier === "apex" ? (fall ? "\ud83c\udf41" : "\ud83c\udf83") : tier === "omega" ? "\u03a9" : tier === "forbidden" ? "\u16df" : "\u25fc";
  const el = document.createElement("div"); el.className = "secret-banner " + tier + (mine ? " mine" : "");
  el.innerHTML = `<span class="sb-i">${ic}</span><div><b>${mine ? "You" : esc(m.user)} pulled ${word}</b><small>${mine ? (tier === "secret" ? "Nobody knows what it is. Nobody else has it." : tier === "apex" ? "A super-limited item that leaves with the season." : tier === "forbidden" ? "The seal is broken. Almost nobody will ever see this." : "The last thing there will ever be. Nobody else has it.") : "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 \u00b7 nobody knows what it is"}</small></div><span class="sb-i">${ic}</span>`;
  document.body.appendChild(el);
  try { chord([55, 58, 110, 116.5], 1.6); } catch { /* sound is optional */ }
  setTimeout(() => el.classList.add("out"), 8000); setTimeout(() => el.remove(), 8900);
}
function achToast(m) {
  const el = document.createElement("div"); el.className = "ach-toast";
  el.innerHTML = `<span class="ai">${esc(m.icon ?? "🏆")}</span><div><small>ACHIEVEMENT UNLOCKED</small><b>${esc(m.name)}</b><small>+${m.coins} coins</small></div>`;
  document.body.appendChild(el); chord([659, 880, 1175], 0.6);
  setTimeout(() => el.classList.add("out"), 5200); setTimeout(() => el.remove(), 5800);
}

/** A big centered banner for one-line announcements (packdrop, jackpot, etc). */
function shout(title, sub, color = "#8b7bff") {
  const el = document.createElement("div"); el.className = "shout"; el.style.setProperty("--sc", color);
  el.innerHTML = `<b>${esc(title)}</b><small>${esc(sub)}</small>`; layer().appendChild(el);
  setTimeout(() => el.classList.add("out"), 3800); setTimeout(() => el.remove(), 4500);
}

async function claim(id, el, label) {
  el.classList.add("caught"); el.style.pointerEvents = "none";
  try { const r = await api("/fx/claim", "POST", { id }); blip(880, 0.15, "triangle"); blip(1320, 0.2, "triangle", 0.08, 0.08); toast(`${label} +${r.coins} coins`, "ok"); if (r.coins) state.me.coins = (state.me.coins ?? 0) + r.coins; } catch (e) { el.classList.add("missed"); toast(e.message, true); }
  setTimeout(() => el.remove(), 500);
}

function coinRain() {
  const L = layer(); shout("COIN RAIN", "Coins are falling. They land in your wallet.", "#ffc857"); chord([660, 880, 1100], 0.5);
  for (let i = 0; i < 46; i++) { const c = document.createElement("i"); c.className = "coin"; c.style.cssText = `left:${Math.random() * 100}%;--d:${2.4 + Math.random() * 2.2}s;--w:${Math.random() * 1.6}s;--s:${14 + Math.random() * 16}px`; L.appendChild(c); setTimeout(() => c.remove(), 6500); }
}
function meteors(list) {
  shout("METEOR SHOWER", "Tap the meteors for coins before they burn out!", "#ff8a5b");
  for (const m of list) setTimeout(() => {
    const el = document.createElement("button"); el.type = "button"; el.className = "meteor"; el.style.cssText = `left:${m.x * 100}%;--dur:3.4s`; el.innerHTML = `<i></i><span>+${m.coins}</span>`; layer().appendChild(el);
    el.onclick = () => claim(m.id, el, "Meteor caught"); setTimeout(() => el.remove(), 3500);
  }, m.at * 1000);
}
function confetti() {
  shout("PARTY TIME", "🎉", "#ff5d9e"); chord([523, 659, 784, 1047]); const L = layer(), cols = ["#ffd76a", "#3be8ff", "#ff5d9e", "#7dff6a", "#fff"];
  for (let i = 0; i < 90; i++) { const c = document.createElement("i"); c.className = "coin"; c.style.cssText = `left:${Math.random() * 100}%;--d:${2.2 + Math.random() * 2.5}s;--w:${Math.random() * 1.2}s;--s:${6 + Math.random() * 8}px;border-radius:2px;background:${cols[i % cols.length]};box-shadow:none`; L.appendChild(c); setTimeout(() => c.remove(), 6000); }
}
function treasure(m) {
  shout("TREASURE STAR", "One star is hiding on your screen. First to tap it wins 250 coins!", "#ffd76a");
  const el = document.createElement("button"); el.type = "button"; el.className = "treasure"; el.style.cssText = `left:${m.x * 100}%;top:${m.y * 100}%`; el.textContent = "★"; layer().appendChild(el);
  el.onclick = () => claim(m.id, el, "Treasure found"); setTimeout(() => el.remove(), m.ms);
}
let zeroTimer = 0;
function zeroG(ms) {
  shout("ZERO-G", "Gravity is off for a bit.", "#4cc9f0"); document.body.classList.add("zerog"); clearTimeout(zeroTimer); zeroTimer = setTimeout(() => document.body.classList.remove("zerog"), ms);
}
function onFx(m) {
  switch (m.kind) {
    case "coinrain": coinRain(); break;
    case "meteors": meteors(m.meteors ?? []); break;
    case "treasure": treasure(m); break;
    case "zerog": zeroG(m.ms ?? 20000); break;
    case "packdrop": shout("PACK DROP", "A free Supply Crate landed in your Packs tab!", "#b57bff"); chord([392, 523, 659, 784]); break;
    case "milestone": shout("MILESTONE", `${m.pts} event points · +${m.coins} coins`, "#4cc9f0"); chord([587, 740, 880]); break;
    case "rush": shout("GAME RUSH", `${gameName(m.game)} gives 2× event points for ${Math.round((m.ms ?? 0) / 60000)} minutes!`, "#ff5d9e"); chord([392, 494, 587, 784]); break;
    case "luckyfive": shout("LUCKY FIVE", `${(m.winners ?? []).includes(state.me?.username) ? "YOU WON " + m.coins + " coins!" : "Winners: " + (m.winners ?? []).join(", ")}`, "#3dff7a"); chord([523, 659, 784, 1047]); break;
    case "mysterybox": shout("MYSTERY BOX", `You opened ${m.coins} coins`, "#e879f9"); chord([440, 554, 659]); break;
    case "cosmeticdrop": shout("COSMETIC DROP", `You got ${m.item?.name ?? "something new"}${m.item?.dupe ? " (duplicate, coins refunded)" : "! Check Packs"}`, "#ff5d9e"); chord([523, 659, 784, 1047, 1319], 1); break;
    case "confetti": confetti(); break;
    case "xpgift": shout("XP GIFT", "+100 XP for everyone online.", "#4cc9f0"); chord([523, 784]); break;
    case "jackpot": shout("JACKPOT", `${m.winner === state.me?.username ? "YOU" : m.winner} won ${m.coins} coins!`, "#ffd76a"); chord([523, 659, 784, 1047, 1319], 1); break;
  }
}

/* ---------- the live bar: event + boosts, shown at the top while anything is active ---------- */
let bar, spinT = 0;
function paintBar() {
  if (!state.me) return;
  bar ??= Object.assign(document.createElement("div"), { id: "liveBar" });
  if (!bar.isConnected) document.body.appendChild(bar);
  const ev = state.event, now = Date.now(), boosts = (state.boosts ?? []).filter((b) => b.until > now);
  const wallet = `<span class="lchip wallet" title="Your coins. Spend them in Packs.">◎ <b>${(state.me.coins ?? 0).toLocaleString()}</b>${state.me.freePacks ? ` · ${state.me.freePacks} free` : ""}</span>`;
  clearTimeout(spinT); const ns = state.nextSpin ?? 0;
  if (ns && ns > now) spinT = setTimeout(paintBar, ns - now + 300);
  const spin = ns && ns <= now ? `<button type="button" class="lchip spin" data-go="packs" title="Your hourly wheel spin is ready">🎡 Spin ready</button>` : "";
  const chips = boosts.map((b) => `<span class="lchip boost" data-until="${b.until}">${b.kind === "xp" ? "2× XP" : "2× coins"} <b></b></span>`).join("");
  const evc = ev ? `<button type="button" class="lchip evpill" data-arena="1" style="--ec:${esc(ev.color)}"><i class="ev-dot"></i>${esc(ev.name)} · ${ev.joined ? `${ev.mine} pts · ` : ""}Join the live event</button>` : "";
  bar.innerHTML = evc + spin + chips + wallet; bar.classList.add("on"); tick();
}
function tick() { if (!bar) return; bar.querySelectorAll("[data-until]").forEach((c) => { const s = Math.max(0, Math.round((+c.dataset.until - Date.now()) / 1000)); c.querySelector("b").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; if (!s) setTimeout(paintBar, 200); }); }

/* ---------- reward screen when a live event ends ---------- */
function eventEnd(m) {
  const eff = effectMap.get(m.effect), place = m.place <= 3 ? ["", "1st", "2nd", "3rd"][m.place] : "";
  const letter = esc(state.me.username[0].toUpperCase());
  const o = overlay(`<div class="evend glass" style="--ec:${esc(m.color)}"><small>EVENT COMPLETE</small><h2>${esc(m.name)}</h2>
    <p>${place ? `You finished <b>${place}</b> of ${m.of}.` : `You scored <b>${m.points}</b> points among ${m.of} players.`}</p>
    <div class="ev-rew"><div class="rw"><div class="avatar big fx fx-${esc(m.effect)}" style="background:linear-gradient(135deg,var(--accent),var(--accent2))"><i class="fxa"></i><i class="fxb"></i><span class="av-l">${letter}</span></div><b>${esc(eff?.name ?? m.effect)}</b><small>Limited profile effect</small></div>
    <div class="rw"><div class="tagbig">${titleChip(m.tag)}</div><b>Limited title</b><small>Yours forever</small></div>
    <div class="rw"><div class="coinbig">◎ ${m.coins}</div><b>Coins</b><small>${place ? "Podium bonus included" : "Thanks for playing"}</small></div>
    ${m.crates ? `<div class="rw"><div class="coinbig">✦ ${m.crates}</div><b>Free crate${m.crates > 1 ? "s" : ""}</b><small>Open in Packs</small></div>` : ""}</div>
    ${m.dupe ? `<p class="note" style="color:#ffd166">You already owned this event's limited title and effect, so you got <b>+${m.dupe.toLocaleString()} bonus coins</b> instead (already in the total above).</p>` : `<p class="note">Equip them in <b>Packs → Your collection</b>.</p>`}<button class="btn" data-x>Collect</button></div>`, { center: true });
  chord([523, 659, 784, 1047, 1319], 1.1);
  o.querySelector("[data-x]").onclick = () => o.remove();
}

export function initFx() {
  on("legend", legendBanner); on("chroma", chromaBanner); on("secret", secretBanner); on("ach", achToast); on("fx", onFx); on("eventend", eventEnd);
  on("liveevent", paintBar); on("boost", paintBar); on("self", paintBar);
  on("coins", () => paintBar()); /* the shop, wheel and upgrades say when your coin total changed, so the bar updates without waiting for the server push */
  on("game", (m) => { state.me.coins = m.game.coins; state.me.freePacks = m.game.freePacks; state.nextSpin = m.game.nextSpin; paintBar(); });
  paintBar();
  api("/game").then((r) => { state.nextSpin = r.game.nextSpin; paintBar(); }).catch(() => {});
  on("gift", (m) => toast(m.type === "pack" ? "A pack was added to your account" : `You received a new ${m.type === "tag" ? "title" : m.type === "bg" ? "backdrop" : m.type}!`, "ok"));
  bar && 0; setInterval(tick, 1000);
  document.addEventListener("click", (e) => { const g = e.target.closest("#liveBar [data-go]"); if (g) emit("view", g.dataset.go); if (e.target.closest("[data-arena]")) emit("openarena"); });
}
