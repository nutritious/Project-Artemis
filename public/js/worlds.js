/* Hub: the Worlds card (solar-system journey, quest rings, Rebirth button) and the Rebirth shop. */
import { WORLDS, worldOf, REBIRTH_XP, REBIRTH_COINS, WORLD_ITEMS, RB_SHOP, effectMap, tagMap, themeMap, bgMap, RARITY } from "./cosmetics.js";
import { api, confirmBox, esc, state, toast } from "./util.js";
import { playRebirth } from "./rebirth.js";

const nm = (it) => { const m = { effect: effectMap, tag: tagMap, theme: themeMap, bg: bgMap }[it.type]; return m?.get(it.item)?.name ?? it.item; };
const ring = (q, col) => {
  const r = 34, c = 2 * Math.PI * r, p = q.goal ? q.n / q.goal : 0;
  return `<div class="wring ${q.done ? "done" : ""}" style="--wc:${col}" title="${esc(q.verb)}"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="${r}" class="wr-bg"/><circle cx="42" cy="42" r="${r}" class="wr-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 42 42)"/></svg><span class="wr-i">${q.done ? "✓" : q.icon}</span><b>${esc(q.name)}</b><small>${q.n.toLocaleString("en-US")} / ${q.goal.toLocaleString("en-US")}</small><em>${esc(q.verb)}</em></div>`;
};
export function worldsHtml(R) {
  if (!R) return "";
  const w = WORLDS[R.world], nxt = WORLDS[R.nextWorld], cyc = R.rb + 1 >= WORLDS.length, items = WORLD_ITEMS[R.rb + 1];
  const strip = WORLDS.map((x, i) => `<div class="wplanet ${i < R.world ? "past" : i === R.world ? "now" : ""}" style="--wc:${x.color};--wc2:${x.color2}" title="${esc(x.name)}"><i>${x.emoji}</i><small>${esc(x.name)}</small></div>`).join('<span class="wlink"></span>');
  const why = !R.atTop ? "Reach Touch Grass first" : !R.ringsDone ? "Close all four rings first" : "";
  const gains = [`Your rank and XP reset to Stardust. You <b>keep</b> your coins, items, packs and passes.`, `Permanent <b>+${Math.round(REBIRTH_XP * 100)}% XP</b>, stacking, and 1 rebirth point.`, `<b>${REBIRTH_COINS(R.rb + 1).toLocaleString("en-US")} ◎</b> coins${items ? " and a new tag, profile effect and backdrop from " + esc(nxt.name) : ""}.`];
  return `<div class="card glass worlds" style="--wc:${w.color};--wc2:${w.color2}">
    <h3>Galaxies <span class="chip" style="color:${w.color}">Rebirth ${R.rb}</span><span class="chip">XP ×${R.mul}</span></h3>
    <div class="wstrip">${strip}</div>
    <div class="wnow"><span class="wemoji">${w.emoji}</span><div><b>${esc(w.name)}</b><small>${esc(w.sub)}</small></div></div>
    <div class="wrings">${R.quests.map((q) => ring(q, w.color)).join("")}</div>
    <div class="wgo ${R.can ? "ready" : ""}">
      <button type="button" class="btn ${R.can ? "primary" : "ghost"} wbtn" data-rebirth ${R.can ? "" : "disabled"}>${R.can ? `🔄 Rebirth into ${esc(cyc ? "another cycle of " + nxt.name : nxt.name)}` : `🔒 Rebirth · ${esc(why)}`}</button>
      <ul class="wgain">${gains.map((x) => `<li>${x}</li>`).join("")}</ul>
    </div>
    ${R.rb ? `<p class="note">Each galaxy has its own look for every level-up scene, so ranking up again feels new every time.</p>` : `<p class="note">Reach Touch Grass and close the four rings to rebirth into the next galaxy. Everyday XP is already doubled for everyone.</p>`}
  </div>
  <div class="card glass rbshop"><h3>Rebirth shop <span class="chip" style="color:#ffd76a">✦ ${R.rp} point${R.rp === 1 ? "" : "s"}</span></h3>
    <p class="note" style="margin:-4px 0 10px">You get 1 point for every rebirth. Everything here is exclusive and cannot be found in packs.</p>
    <div class="rbgrid">${RB_SHOP.map((it) => {
      const own = !it.repeat && (R.bought.includes(it.id)), can = R.rp >= it.cost;
      const it2 = it.kind === "item" ? { effect: "Profile effect", tag: "Title", theme: "Theme", bg: "Backdrop" }[it.type] : it.kind === "perk" ? "Permanent perk" : "Repeatable";
      const icon = it.icon ?? { effect: "✨", tag: "🏷️", theme: "🎨", bg: "🖼️" }[it.type];
      return `<article class="rbitem ${own ? "own" : ""}"><span class="rbi">${icon}</span><div><b>${esc(it.name ?? nm(it))}</b><small>${esc(it2)}${it.desc ? " · " + esc(it.desc) : ""}</small></div>${own ? `<span class="chip ok">Owned</span>` : `<button class="btn sm ${can ? "" : "ghost"}" data-rbbuy="${it.id}" ${can ? "" : "disabled"}>✦ ${it.cost}</button>`}</article>`;
    }).join("")}</div></div>`;
}
export async function loadRebirth() {
  return api("/game/rebirth");
}
/** Click handling for the card; calls back with fresh data. */
export async function onWorldsClick(e, refresh) {
  const b = e.target.closest("[data-rebirth]"), s = e.target.closest("[data-rbbuy]");
  if (b && !b.disabled) {
    const ok = await confirmBox("Rebirth?", "Your rank and XP go back to Stardust. You keep your coins, items, packs and passes, and you gain a permanent XP boost, a rebirth point and new exclusive items.", { ok: "Rebirth" });
    if (!ok) return true;
    try { const r = await api("/game/rebirth", "POST"); playRebirth(r.rb); await refresh(r.state); } catch (er) { toast(er.message, true); }
    return true;
  }
  if (s) {
    try { const r = await api("/game/rebirth/buy", "POST", { id: s.dataset.rbbuy }); toast("Added to your collection", "ok"); if (r.inv) state.me.inv = r.inv; await refresh(r.state); } catch (er) { toast(er.message, true); }
    return true;
  }
  return false;
}
