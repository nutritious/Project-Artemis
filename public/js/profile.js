/* Full profile: big picture and effect, rank, titles, arcade bests, collection. Staff also see coins. Plus the profile lookup. */
import { $, api, avatar, esc, fmtNum, overlay, roleTags, state, toast, titleChip, rarityColor, isCoOwnerUp } from "./util.js";
import { EFFECTS, GAMES, BGS, bgMap, effectMap, THEMES, TAGS } from "./cosmetics.js";

const RANK_COL = ["#8d96bd", "#4cc9f0", "#3ddc97", "#ffc857", "#ff8a5b", "#e879f9", "#ffd76a"], RANK_NAME = ["Stardust", "Cadet", "Pilot", "Navigator", "Captain", "Voyager", "Legend"];

export async function openFullProfile(name) {
  let p; try { p = await api("/profile/" + encodeURIComponent(name)); } catch (e) { return toast(e.message, true); }
  const person = state.people.get(p.id) ?? { id: p.id, username: p.username, role: p.role, roleId: p.roleId, profile: p.profile, fx: p.equip.effect, tag: p.equip.tag };
  if (!state.people.has(p.id)) state.people.set(p.id, person);
  person.fx = p.equip.effect; person.tag = p.equip.tag; person.bg = p.equip.bg; /* make sure the avatar shows the freshest effect */
  const rc = RANK_COL[p.rank] ?? "#8d96bd", pic = p.profile?.avatar, eff = effectMap.get(p.equip.effect);
  const bests = GAMES.map((g) => [g.name, p.bests?.[g.id] ?? 0]).filter((x) => x[1] > 0);
  const owned = EFFECTS.filter((e) => p.inv.effects.includes(e.id));
  const total = p.inv.effects.length + p.inv.tags.length + p.inv.themes.length + (p.inv.bgs?.length ?? 0), ownedBgs = BGS.filter((b) => p.inv.bgs?.includes(b.id)), bgi = bgMap.get(p.equip.bg);
  const o = overlay(`<div class="prof glass" style="--rc:${rc}" role="dialog" aria-label="${esc(p.username)}'s profile">
    <div class="prof-banner ${p.equip.bg ? "pbg-" + esc(p.equip.bg) : ""}" ${p.profile?.accent && !p.equip.bg ? `style="background:linear-gradient(135deg,${esc(p.profile.accent)},color-mix(in srgb,${esc(p.profile.accent)} 25%,#000))"` : ""}></div>
    <button type="button" class="prof-x" data-x aria-label="Close">×</button>
    <div class="prof-top"><button type="button" class="prof-av" data-zoom title="${pic ? "Click to enlarge the picture" : ""}">${avatar(p.username, false, false, true)}</button>
      <div><h2>${esc(p.username)}</h2><div class="prof-tags">${roleTags(person)}<span class="rchip" style="--rc:${rc}">${RANK_NAME[p.rank] ?? ""}</span></div>
      ${p.profile?.pronouns ? `<small class="faint">${esc(p.profile.pronouns)}</small>` : ""}
      ${p.profile?.status ? `<p class="dim">${esc(p.profile.status)}</p>` : ""}</div></div>
    <div class="prof-stats"><div><b>${fmtNum(p.xp)}</b><small>XP</small></div><div><b>${p.streak}</b><small>day streak</small></div><div><b>${p.plays}</b><small>arcade plays</small></div><div><b>${total}</b><small>collected</small></div><div><b>${p.ach ?? 0}</b><small>achievements</small></div>${p.coins != null ? `<div class="staff"><b>◎ ${p.coins.toLocaleString()}</b><small>coins (staff only)</small></div>` : ""}</div>
    ${p.profile?.bio ? `<p class="prof-bio">${esc(p.profile.bio)}</p>` : ""}
    ${eff ? `<p class="prof-eff"><span class="chip" style="--tc:${rarityColor(eff.rarity)}">Effect · ${esc(eff.name)}</span></p>` : ""}
    ${bests.length ? `<h4 class="sec">Arcade bests</h4><div class="prof-bests">${bests.map(([n, v]) => `<span><small>${esc(n)}</small><b>${fmtNum(v)}</b></span>`).join("")}</div>` : ""}
    ${owned.length ? `<h4 class="sec">Profile effects</h4><div class="prof-fx">${owned.map((e) => `<span class="chip" style="--tc:${rarityColor(e.rarity)}" title="${esc(e.desc)}">${esc(e.name)}</span>`).join("")}</div>` : ""}
    ${bgi ? `<p class="prof-eff"><span class="chip" style="--tc:${rarityColor(bgi.rarity)}">Backdrop · ${esc(bgi.name)}</span></p>` : ""}
    ${ownedBgs.length ? `<h4 class="sec">Backdrops</h4><div class="prof-bgs">${ownedBgs.map((b) => `<span class="bgp" title="${esc(b.name)}"><i class="bgprev pbg-${esc(b.id)}"></i><small>${esc(b.name)}</small></span>`).join("")}</div>` : ""}
    ${p.inv.tags.length ? `<h4 class="sec">Titles</h4><div class="prof-fx">${p.inv.tags.map((t) => titleChip(t)).join("")}</div>` : ""}
    <p class="faint" style="margin:14px 0 0">Member since ${new Date(p.createdAt).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" })}</p></div>`, { center: true });
  const close = () => o.remove();
  o.querySelector("[data-x]").onclick = close; o.addEventListener("click", (e) => { if (e.target === o) close(); });
  o.querySelector("[data-zoom]").onclick = () => {
    if (!pic) return toast("They haven't set a profile picture", "");
    const z = overlay(`<div class="zoom"><img src="${esc(pic)}" alt="${esc(p.username)}'s profile picture"><small>${esc(p.username)}</small></div>`, { center: true }); z.addEventListener("click", () => z.remove());
  };
}

/** Profile lookup: type part of a callsign, tap a result. Used on the Hub. */
export function lookupHtml() {
  return `<div class="card glass" id="lookup"><h3>Look up a profile</h3><input id="lkq" type="search" placeholder="Search a callsign…" autocomplete="off"><div id="lkr" class="lkr"></div></div>`;
}
export function wireLookup(root) {
  const q = root.querySelector("#lkq"), out = root.querySelector("#lkr"); if (!q) return;
  const paint = () => {
    const s = q.value.trim().toLowerCase();
    const list = [...state.people.values()].filter((p) => !s || p.username.toLowerCase().includes(s)).sort((a, b) => a.username.localeCompare(b.username)).slice(0, s ? 12 : 6);
    out.innerHTML = list.map((p) => `<button type="button" class="lkrow" data-lk="${esc(p.username)}">${avatar(p.username, false, true)}<b>${esc(p.username)}</b>${roleTags(p)}</button>`).join("") || `<p class="note">No one by that name.</p>`;
  };
  q.addEventListener("input", paint); out.addEventListener("click", (e) => { const b = e.target.closest("[data-lk]"); if (b) openFullProfile(b.dataset.lk); }); paint();
}
