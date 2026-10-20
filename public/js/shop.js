/* Packs: loot crates and theme packs, a pack-opening reveal, and your collection (equip effects, titles and themes). */
import { $, $$, api, esc, on, state, titleChip, toast, rarityColor, overlay, promptBox } from "./util.js";
import { UPGRADES, upCost, speedMult, noUps, packOpen, packContents, EFFECTS, TAGS, THEMES, BGS, RARITY, PACKS, WHEEL, WHEEL_MS, DAILY_CAP, effectMap, themeMap, tagMap, bgMap } from "./cosmetics.js";
import { saveSettings } from "./settings.js";
import { playChroma } from "./chroma.js";
import { playSecret } from "./secret.js";
import { emit } from "./util.js";
import { redeemCard, bindRedeem } from "./redeem.js";

let S = null, tab = "effects", busy = false, sect = "packs";
const allTags = () => [...TAGS, ...(state.customTags ?? [])];

/* ---------- sound: tiny synth, only when the person has sounds on ---------- */
let ac;
function blip(freq, dur = 0.18, type = "sine", vol = 0.09, when = 0) {
  if (state.me?.settings?.chatSound === false) return;
  try { ac ??= new (window.AudioContext || window.webkitAudioContext)(); const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.05); } catch { /* silent */ }
}
const REVEAL = { common: [440], rare: [523, 659], epic: [523, 659, 784], legendary: [523, 659, 784, 1047, 1319], limited: [659, 880, 1175], chroma: [523, 659, 784, 1047, 1319, 1568, 2093], secret: [110, 73, 55] };
const sfxReveal = (r) => (REVEAL[r] ?? REVEAL.common).forEach((f, i) => blip(f, 0.4, "triangle", 0.1, i * 0.09));

/* ---------- item preview helpers ---------- */
const prevAvatar = (fx) => `<div class="avatar big fx fx-${fx}" style="background:linear-gradient(135deg,hsl(${state.me.username.length * 37 % 360} 60% 50%),hsl(${(state.me.username.length * 37 + 40) % 360} 55% 38%))"><i class="fxa"></i><i class="fxb"></i><span class="av-l">${esc(state.me.username[0].toUpperCase())}</span></div>`;
const themeSwatch = (t) => `<div class="tsw" style="background:linear-gradient(135deg,${t.c[0]} 40%,${t.c[1]})"></div>`;
function itemVisual(type, id, it) {
  if (type === "effect") return prevAvatar(id);
  if (type === "theme") return themeSwatch(it?.c ? it : themeMap.get(id));
  if (type === "bg") return `<div class="bgprev pbg-${esc(id)}"></div>`;
  const t = allTags().find((x) => x.id === id); return `<div class="tagprev">${titleChip(id) || esc(t?.name ?? id)}</div>`;
}
const itemInfo = (type, id) => (type === "effect" ? effectMap.get(id) : type === "theme" ? themeMap.get(id) : type === "bg" ? bgMap.get(id) : allTags().find((x) => x.id === id));

export function buildShop() {
  $("#view-packs").innerHTML = `<div class="page" id="shopPage"><div class="skel"></div></div>`;
  $("#shopPage").addEventListener("click", onClick);
  on("gift", () => { if (state.view === "packs") load(); });
}
bindRedeem(); on("redeemed", () => { if (S) load(); });
export async function onShopShown() { await load(); }
async function load() { try { S = await api("/shop"); sync(); paint(); } catch (e) { toast(e.message, true); } }
function sync() { if (!S) return; state.nextSpin = S.nextSpin ?? state.nextSpin; Object.assign(state.me, { up: S.up, coins: S.coins, freePacks: S.freePacks, inv: S.inv, equip: S.equip }); document.querySelectorAll(".coinbal").forEach((el) => (el.textContent = S.coins.toLocaleString())); emit("coins"); }

const GLYPH = { halloween: "🎃", gamer: "🎮", hacker: "⌨", backdrops: "🖼", chroma: "🌈" };
const packGlyph = (p) => GLYPH[p.id] ?? (p.kind === "theme" ? "◐" : "✦");
const leftText = (t) => { const ms = t - Date.now(); if (ms <= 0) return "Gone"; const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4); return `🎃 Leaves Nov 1 · ${d ? d + "d " : ""}${h}h ${m}m left`; };
function packCard(p) {
  const can = S.coins >= p.cost;
  return `<article class="pack ${p.kind} ${p.id === "chroma" ? "chroma-pack" : ""}" style="--pc:${p.color}">
    <div class="pack-art"><i></i><b>${packGlyph(p)}</b></div>
    <h4>${esc(p.name)}</h4><p>${esc(p.desc)}</p>
    <div class="pack-odds">${p.guarantee ? `Guaranteed ${esc(p.guarantee)}+` : "Mixed rarities"} · ${p.count} items</div>
    <button class="btn sm ghost peekbtn" data-peek="${p.id}">See what's inside</button>
    <button class="btn ${can ? "" : "ghost"}" data-open="${p.id}" ${can ? "" : "disabled"}>◎ ${p.cost}</button>
    ${S.up?.pass.includes("bulk") ? `<button class="btn sm ${S.coins >= p.cost * 5 ? "alt" : "ghost"}" data-open="${p.id}" data-count="5" ${S.coins >= p.cost * 5 ? "" : "disabled"}>Open ×5 · ◎ ${p.cost * 5}</button>` : ""}
    ${p.until ? `<div class="pack-odds hleft">${leftText(p.until)}</div>` : ""}
    ${p.id === "crate" && S.freePacks > 0 ? `<button class="btn alt" data-open="crate" data-free="1">Free crate (${S.freePacks})</button>` : ""}
  </article>`;
}
function grid() {
  const eq = S.equip, inv = S.inv;
  if (tab === "effects") return `<div class="cgrid">${EFFECTS.filter((e) => e.rarity !== "secret" || inv.effects.includes(e.id)).map((e) => { const own = inv.effects.includes(e.id); return cell("effect", e, own, eq.effect === e.id); }).join("")}</div>`;
  if (tab === "titles") return `<div class="cgrid">${allTags().filter((t) => !t.hidden && (t.rarity !== "secret" || inv.tags.includes(t.id))).map((t) => cell("tag", t, inv.tags.includes(t.id), eq.tag === t.id)).join("")}</div>`;
  if (tab === "backgrounds") return `<p class="coll-note">Backgrounds show behind your name on your profile card and full profile.</p><div class="cgrid">${BGS.filter((b) => b.rarity !== "secret" || inv.bgs.includes(b.id)).map((b) => cell("bg", b, inv.bgs.includes(b.id), eq.bg === b.id)).join("")}</div>`;
  const cur = state.me.settings.theme;
  const base = [["eclipse", "Eclipse", ["#05060d", "#3b2f9e"]], ["lunar", "Lunar", ["#f4f5fa", "#b9bfdc"]], ["orion", "Orion", ["#0c0605", "#c2410c"]], ["aurora", "Aurora", ["#030c0c", "#0d9488"]]].map(([id, name, c]) => ({ id, name, c, rarity: "common", base: true }));
  return `<div class="cgrid">${[...base, ...THEMES].map((t) => { const own = t.base || inv.themes.includes(t.id); return cell("theme", t, own, cur === t.id); }).join("")}</div>`;
}
function cell(type, it, own, on) {
  const rc = rarityColor(it.rarity), ltd = it.limited || it.only ? ` <em>limited</em>` : "";
  return `<div class="cell ${own ? "" : "locked"} ${on ? "on" : ""} ${it.rarity === "chroma" ? "chroma" : ""} ${it.rarity === "secret" ? "secret" : ""}" style="--rc:${rc}">
    <div class="cvis">${itemVisual(type, it.id, it)}</div>
    <b>${esc(it.name)}${ltd}</b><small>${esc(RARITY[it.rarity]?.name ?? "")}${it.desc ? " · " + esc(it.desc) : ""}</small>
    ${own ? `<button class="btn ${on ? "ghost" : ""}" data-eq="${type}:${it.id}">${on ? (type === "theme" ? "In use" : "Unequip") : (type === "theme" ? "Use" : "Equip")}</button>` : `<span class="lockbadge">Locked</span>`}
  </div>`;
}
/* ---------- upgrades: bought with coins ---------- */
function upgradesHtml() {
  const up = S.up ?? noUps(), n = (v) => Number(v).toLocaleString("en-US");
  const level = UPGRADES.filter((d) => d.kind === "level").map((d) => {
    const l = up[d.id] ?? 0, maxed = d.max && l >= d.max, cost = upCost(d, l), can = S.coins >= cost;
    return `<article class="upg"><div class="upg-h"><span class="upg-i">${d.icon}</span><div><h4>${esc(d.name)}</h4><span class="upg-lv">Level ${l}${d.max ? ` / ${d.max}` : ""}</span></div></div>
      <p>${esc(d.desc)}</p><div class="upg-fx"><span>Now</span> ${esc(d.effect(l))}</div>${maxed ? `<div class="upg-fx max">Maxed out</div>` : `<div class="upg-fx next"><span>Next</span> ${esc(d.effect(l + 1))}</div>`}
      ${maxed ? "" : `<button class="btn ${can ? "" : "ghost"}" data-upbuy="${d.id}" ${can ? "" : "disabled"}>Upgrade · ◎ ${n(cost)}</button>`}</article>`;
  }).join("");
  const pass = UPGRADES.filter((d) => d.kind === "pass").map((d) => {
    const own = up.pass.includes(d.id), can = S.coins >= d.cost;
    return `<article class="upg pass ${own ? "own" : ""}"><div class="upg-h"><span class="upg-i">${d.icon}</span><div><h4>${esc(d.name)}</h4><span class="upg-lv">${own ? "Owned" : "One-time pass"}</span></div></div><p>${esc(d.desc)}</p>
      <div class="inline">${own ? `<span class="chip ok">Unlocked</span>` : `<button class="btn ${can ? "" : "ghost"}" data-upbuy="${d.id}" ${can ? "" : "disabled"}>Buy · ◎ ${n(d.cost)}</button>`}<button class="btn sm ${can ? "alt" : "ghost"}" data-upgift="${d.id}" ${can ? "" : "disabled"} title="Buy it for someone else">🎁 Gift · ◎ ${n(d.cost)}</button></div></article>`;
  }).join("");
  return `<h3 class="sec">Level upgrades <small>buy them again and again, each level costs more</small></h3><div class="upgs">${level}</div>
    <h3 class="sec">Passes <small>one-time, and you can gift them to your friends</small></h3><div class="upgs">${pass}</div>`;
}
function paint() {
  const owned = S.inv.effects.length + S.inv.tags.length + S.inv.themes.length + S.inv.bgs.length, total = [...EFFECTS, ...allTags(), ...THEMES, ...BGS].filter((i) => i.rarity !== "secret").length + [...EFFECTS.filter((i) => i.rarity === "secret" && S.inv.effects.includes(i.id)), ...allTags().filter((i) => i.rarity === "secret" && S.inv.tags.includes(i.id)), ...BGS.filter((i) => i.rarity === "secret" && S.inv.bgs.includes(i.id))].length;
  $("#shopPage").innerHTML = `
    <div class="shop-head"><div><h2>Packs</h2><p class="sub" style="margin:4px 0 0">Open crates for profile effects, titles and profile backgrounds, or theme packs that restyle the whole app. Spin the wheel every hour. Everyday earning is capped at ${DAILY_CAP} coins a day.</p></div>
      <div class="wallet"><span>◎ <b class="coinbal">${S.coins.toLocaleString()}</b></span>${S.freePacks ? `<span class="fp">${S.freePacks} free crate${S.freePacks > 1 ? "s" : ""}</span>` : ""}</div></div>
    <div class="gtabs" id="shopTabs"><button data-sect="packs" class="${sect === "packs" ? "on" : ""}"><b>Packs</b></button><button data-sect="upgrades" class="${sect === "upgrades" ? "on" : ""}"><b>Upgrades</b></button></div>
    ${sect === "upgrades" ? upgradesHtml() : `${redeemCard()}
    ${wheelHtml()}
    ${PACKS.filter((p) => p.until && packOpen(p)).map((p) => `<h3 class="sec">🎃 Limited: Halloween <small>gone on Nov 1</small></h3><div class="packs">${packCard(p)}</div>`).join("")}
    <h3 class="sec">Loot crates</h3><div class="packs">${PACKS.filter((p) => ["crate", "nova", "vault"].includes(p.id)).map(packCard).join("")}</div>
    <h3 class="sec">Themed crates <small>gamer, hacker and backdrops</small></h3><div class="packs">${PACKS.filter((p) => ["gamer", "hacker", "backdrops"].includes(p.id)).map(packCard).join("")}</div>
    <h3 class="sec">Chroma <small>the rarest tier in the game</small></h3><div class="packs">${PACKS.filter((p) => p.id === "chroma").map(packCard).join("")}</div>
    <h3 class="sec">Theme packs</h3><div class="packs">${PACKS.filter((p) => p.kind === "theme").map(packCard).join("")}</div>
    <h3 class="sec">Your collection <small>${owned} of ${total}</small></h3>
    <div class="gtabs mini" id="colTabs">${[["effects", "Profile effects"], ["titles", "Titles"], ["backgrounds", "Backgrounds"], ["themes", "Themes"]].map(([k, l]) => `<button data-ct="${k}" class="${tab === k ? "on" : ""}"><b>${l}</b></button>`).join("")}</div>
    ${grid()}`}`;
  wheelDraw(); wheelTick();
}

async function onClick(e) {
  if (e.target.closest("#spinBtn")) return void spin();
  const sc = e.target.closest("[data-sect]"); if (sc) { sect = sc.dataset.sect; paint(); return; }
  const ub = e.target.closest("[data-upbuy]"); if (ub) { try { S = await api("/shop/upgrade", "POST", { id: ub.dataset.upbuy }); sync(); emit("coins"); toast("Upgraded!", "ok"); paint(); } catch (err) { toast(err.message, true); } return; }
  const ug = e.target.closest("[data-upgift]"); if (ug) {
    const def = UPGRADES.find((d) => d.id === ug.dataset.upgift), name = await promptBox(`Gift ${def.name}`, { label: "Who gets it? (their username)", placeholder: "username", ok: `Gift for ◎ ${def.cost.toLocaleString("en-US")}`, text: "They keep it forever. You pay the price." });
    if (!name) return;
    try { const r = await api("/shop/gift", "POST", { id: def.id, to: name }); S = r; sync(); emit("coins"); toast(`Gifted ${def.name} to ${r.to}`, "ok"); paint(); } catch (err) { toast(err.message, true); }
    return;
  }
  const pk = e.target.closest("[data-peek]"); if (pk) return void peek(PACKS.find((p) => p.id === pk.dataset.peek));
  const ct = e.target.closest("[data-ct]"); if (ct) { tab = ct.dataset.ct; paint(); return; }
  const op = e.target.closest("[data-open]");
  if (op && !busy) {
    busy = true;
    try { const r = await api("/shop/open", "POST", { pack: op.dataset.open, free: !!op.dataset.free, count: Number(op.dataset.count) || 1 }); S.coins = r.coins; S.freePacks = r.freePacks; S.inv = r.inv; S.up = r.up ?? S.up; sync(); if (r.cashback) toast(`Cashback! ◎ ${r.cashback.toLocaleString("en-US")} back`, "ok"); if (r.doubles) toast(`Double Roll! ${r.doubles} free extra roll${r.doubles > 1 ? "s" : ""}`, "ok"); await (S.up?.pass.includes("instant") ? instant : reveal)(PACKS.find((p) => p.id === op.dataset.open), r.items); } catch (err) { toast(err.message, true); } finally { busy = false; paint(); }
    return;
  }
  const eq = e.target.closest("[data-eq]");
  if (eq) {
    const [type, id] = eq.dataset.eq.split(":");
    try {
      if (type === "theme") { await saveSettings({ theme: id }); toast("Theme changed", "ok"); }
      else { const key = type === "effect" ? "effect" : type === "bg" ? "bg" : "tag"; const cur = S.equip[key]; S = await api("/equip", "PUT", { [key]: cur === id ? "" : id }); sync(); toast(cur === id ? "Unequipped" : "Equipped", "ok"); }
      paint();
    } catch (err) { toast(err.message, true); }
  }
}

/* ---------- Instant Open pass: no ceremony, just the results ---------- */
async function instant(pack, items) {
  for (const it of items) { const info = itemInfo(it.type, it.id) ?? { name: it.name }; if (it.rarity === "chroma") await playChroma({ name: info.name, type: it.type, id: it.id }); if (it.rarity === "secret") await playSecret({ name: info.name, type: it.type, id: it.id }); }
  const best = ["secret", "chroma", "limited", "legendary", "epic", "rare", "common"].find((r) => items.some((i) => i.rarity === r)) ?? "common"; sfxReveal(best);
  return new Promise((resolve) => {
    const o = overlay(`<div class="inst glass" style="--pc:${pack.color}"><h3>${esc(pack.name)} · ${items.length} item${items.length === 1 ? "" : "s"}</h3>
      <div class="inst-grid">${items.map((it) => { const info = itemInfo(it.type, it.id) ?? { name: it.name }; return `<div class="inst-it ${it.rarity}" style="--rc:${rarityColor(it.rarity)}"><b>${esc(info.name)}</b><small>${esc(RARITY[it.rarity]?.name ?? "")}</small>${it.dupe ? `<em class="dupe">+${it.refund}</em>` : `<em class="new">NEW</em>`}${it.bonus ? `<i title="Double Roll">🎲</i>` : ""}</div>`; }).join("")}</div>
      <button class="btn" data-x>Collect</button></div>`, { center: true });
    const end = () => { o.remove(); resolve(); }; o.querySelector("[data-x]").onclick = end; o.addEventListener("click", (e) => { if (e.target === o) end(); });
  });
}

/* ---------- the opening ceremony ---------- */
function reveal(pack, items) {
  return new Promise((resolve) => {
    const o = overlay(`<div class="pack-stage" style="--pc:${pack.color}"><div class="ps-glow"></div><div class="ps-box"><i></i><b>${packGlyph(pack)}</b></div><p class="ps-hint">Tap to open</p><div class="ps-cards"></div><button class="btn ps-done hidden">Collect</button>${S?.up?.pass.includes("skip") ? `<button class="btn ghost ps-skip">Skip ⏭</button>` : ""}</div>`, { center: true });
    const stage = o.querySelector(".pack-stage"), box = o.querySelector(".ps-box"), cards = o.querySelector(".ps-cards"), done = o.querySelector(".ps-done"), hint = o.querySelector(".ps-hint");
    let opened = false, shown = 0, skipping = false;
    const sp = speedMult(S?.up?.speed ?? 0), wait = (ms) => Math.max(60, Math.round(ms * sp)), canSkip = !!S?.up?.pass.includes("skip");
    const end = () => { o.remove(); resolve(); };
    done.onclick = end;
    const skip = o.querySelector(".ps-skip"); if (skip) skip.onclick = (ev) => { ev.stopPropagation(); skipping = true; skip.remove(); if (!opened) open(); };
    const showNext = async () => {
      if (shown >= items.length) { done.classList.remove("hidden"); hint.textContent = "Added to your collection"; return; }
      const it = items[shown++], info = itemInfo(it.type, it.id) ?? { name: it.name, rarity: it.rarity };
      if (it.rarity === "chroma" && !skipping) await playChroma({ name: info.name, type: it.type, id: it.id });
      if (it.rarity === "secret" && !skipping) await playSecret({ name: info.name, type: it.type, id: it.id });
      const el = document.createElement("div"); el.className = `rc ${it.rarity}`; el.style.setProperty("--rc", rarityColor(it.rarity));
      el.innerHTML = `<div class="rc-in"><div class="rc-front">?</div><div class="rc-back"><small>${esc(it.type === "tag" ? "Title" : it.type === "effect" ? "Profile effect" : it.type === "bg" ? "Backdrop" : "Theme")}</small><div class="cvis">${itemVisual(it.type, it.id)}</div><b>${esc(info.name)}</b><span class="rar">${esc(RARITY[it.rarity]?.name ?? "")}</span>${it.dupe ? `<em class="dupe">Duplicate · +${it.refund} coins</em>` : `<em class="new">NEW</em>`}</div></div>`;
      cards.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add("flip"); sfxReveal(it.rarity); if (["epic", "legendary", "limited"].includes(it.rarity)) stage.classList.add("flash"), setTimeout(() => stage.classList.remove("flash"), 500); if (it.rarity === "chroma") { stage.classList.add("chromaflash"); setTimeout(() => stage.classList.remove("chromaflash"), 1200); } }));
      setTimeout(showNext, skipping ? 0 : wait(it.rarity === "secret" ? 3000 : it.rarity === "chroma" ? 2200 : it.rarity === "legendary" ? 1500 : 800));
    };
    const open = () => { if (opened) return; opened = true; hint.textContent = ""; box.classList.add("pop"); [180, 240, 300].forEach((f, i) => blip(f, 0.12, "square", 0.05, i * 0.07)); blip(120, 0.5, "sawtooth", 0.06, 0.25); setTimeout(() => { box.classList.add("gone"); showNext(); }, 650); };
    stage.addEventListener("click", (ev) => { if (!ev.target.closest(".ps-done")) open(); });
    box.classList.add("shake");
  });
}

/* ---------- hourly wheel ---------- */
let rot = 0, spinning = false, wtimer = 0;
const fmtLeft = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
function wheelHtml() {
  return `<div class="wheel-card"><div class="wheel-box"><i class="pin"></i><canvas id="wheelC" width="440" height="440"></canvas><span class="hub">◎</span></div>
    <div class="wheel-info"><h3>Hourly spin</h3><p>One free spin every hour. Win up to 400 coins or a free crate. Wheel prizes do not count toward your daily limit.</p>
    <button class="btn" id="spinBtn">Spin</button><div class="wheel-res" id="wheelRes"></div></div></div>`;
}
function wheelDraw() {
  const c = $("#wheelC"); if (!c) return; const x = c.getContext("2d"), n = WHEEL.length, a = (Math.PI * 2) / n, R = 220;
  x.clearRect(0, 0, 440, 440);
  WHEEL.forEach((s, i) => {
    x.beginPath(); x.moveTo(R, R); x.arc(R, R, R - 2, -Math.PI / 2 + i * a, -Math.PI / 2 + (i + 1) * a); x.closePath(); x.fillStyle = s.color; x.fill(); x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 2; x.stroke();
    x.save(); x.translate(R, R); x.rotate(-Math.PI / 2 + (i + 0.5) * a); x.textAlign = "right"; x.fillStyle = "#fff"; x.shadowColor = "rgba(0,0,0,.6)"; x.shadowBlur = 4; x.font = "bold 30px Inter, system-ui, sans-serif"; x.fillText(s.pack ? "CRATE" : s.label, R - 26, 10); x.restore();
  });
  c.style.transition = "none"; c.style.transform = `rotate(${rot}deg)`; void c.offsetWidth; c.style.transition = "";
}
function wheelTick() {
  clearTimeout(wtimer); const b = $("#spinBtn"); if (!b) return;
  const left = (S?.nextSpin ?? 0) - Date.now();
  if (spinning) return;
  b.disabled = left > 0; b.textContent = left > 0 ? `Next spin in ${fmtLeft(left)}` : "Spin the wheel";
  if (left > 0) wtimer = setTimeout(wheelTick, 500);
}
async function spin() {
  if (spinning) return; const b = $("#spinBtn"), res = $("#wheelRes"); spinning = true; b.disabled = true; res.textContent = "";
  let r; try { r = await api("/wheel/spin", "POST"); } catch (e) { spinning = false; toast(e.message, true); if (/recharg/.test(e.message)) { await load(); } return wheelTick(); }
  const per = 360 / WHEEL.length, target = 360 * (Math.floor(rot / 360) + 7) + (360 - (r.index * per + per / 2)) + (Math.random() - 0.5) * per * 0.7;
  const c = $("#wheelC"); rot = target; c.style.transform = `rotate(${rot}deg)`;
  for (let i = 0; i < 26; i++) blip(300 + (i % 5) * 40, 0.05, "square", 0.025, i * 0.19 * (1 + i / 40));
  await new Promise((ok) => setTimeout(ok, 5300));
  S.coins = r.balance; S.freePacks = r.freePacks; S.nextSpin = r.next; sync(); spinning = false; emit("coins");
  const msg = r.crate ? "You won a free crate!" : `You won ${r.coins} coins!`;
  [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.35, "triangle", 0.1, i * 0.09)); toast(msg, "ok");
  paint(); const rr = $("#wheelRes"); if (rr) rr.textContent = msg;
}

/* ---------- see what is inside a pack ---------- */
function peek(pack) {
  const { items, odds, chromaPack } = packContents(pack, S?.up?.luck ?? 0), inv = S?.inv ?? { effects: [], tags: [], themes: [], bgs: [] };
  const own = (it) => (it.type === "effect" ? inv.effects : it.type === "tag" ? inv.tags : it.type === "bg" ? inv.bgs : inv.themes).includes(it.id) || (it.type === "theme" && it.base);
  const pct = (v) => (v >= 0.1 ? Math.round(v * 100) : v >= 0.01 ? (v * 100).toFixed(1) : (v * 100).toFixed(2)) + "%";
  const order = ["chroma", "legendary", "epic", "rare", "common"], KIND = { effect: "Effect", tag: "Title", bg: "Backdrop", theme: "Theme" };
  const chromaCount = items.filter((i) => i.rarity === "chroma").length;
  const sections = order.map((r) => { const list = items.filter((i) => i.rarity === r); if (!list.length) return "";
    return `<h4 class="pk-r ${r}" style="--rc:${rarityColor(r)}"><span>${esc(RARITY[r].name)}</span><small>${pct(odds[r])} per item</small></h4>
      <div class="pk-grid">${list.map((it) => `<div class="pk-it ${r} ${own(it) ? "own" : ""}" style="--rc:${rarityColor(r)}"><div class="cvis">${itemVisual(it.type, it.id, it)}</div><b>${esc(it.name)}</b><small>${KIND[it.type]}${own(it) ? " · owned" : ""}</small>${r === "chroma" ? `<button class="btn sm" data-scene="${it.type}:${it.id}">▶ Animation</button>` : ""}</div>`).join("")}</div>`; }).join("");
  const o = overlay(`<div class="peek glass" style="--pc:${pack.color}"><button class="prof-x" data-x aria-label="Close">×</button>
    <h3>${esc(pack.name)}</h3><p class="dim">${esc(pack.desc)} · ${pack.count} items · ◎ ${pack.cost}</p>
    <div class="pk-chroma"><b>🌈 Chroma in this pack</b><span>${chromaCount} Chroma item${chromaCount === 1 ? "" : "s"} can drop. About ${pct(odds.chroma)} per item, ${pct(chromaPack)} that a pack has one.${pack.chromaBoost ? " This vault is built for Chroma hunting." : ""}${pack.guarantee ? ` Guaranteed ${esc(pack.guarantee)} or better in one slot.` : ""}</span></div>
    <div class="pk-body">${sections}</div></div>`, { center: true });
  const close = () => o.remove();
  o.querySelector("[data-x]").onclick = close; o.addEventListener("click", async (e) => {
    if (e.target === o) return close();
    const sc = e.target.closest("[data-scene]"); if (sc) { const [type, id] = sc.dataset.scene.split(":"); const it = items.find((i) => i.type === type && i.id === id); await playChroma({ name: it.name, type, id }); }
  });
}
