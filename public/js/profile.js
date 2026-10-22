/* Full profile: big picture and effect, rank, titles, arcade bests, collection. Staff also see coins. Plus the profile lookup. */
import { $, api, avatar, confirmBox, emit, esc, fmtNum, on, overlay, roleTags, state, toast, titleChip, rarityColor } from "./util.js";
import { RARITY, EFFECTS, GAMES, BGS, bgMap, effectMap, THEMES, TAGS } from "./cosmetics.js";

const RANK_COL = ["#8d96bd", "#4cc9f0", "#3ddc97", "#ffc857", "#ff8a5b", "#e879f9", "#ffd76a", "#ff7ab8", "#5ad1ff", "#9d7bff", "#c9d1ff", "#22e3c9", "#ff4d6d", "#fff0b8", "#58d35a"], RANK_NAME = ["Stardust", "Cadet", "Pilot", "Navigator", "Captain", "Voyager", "Legend", "Nova", "Quasar", "Pulsar", "Singularity", "Paradox", "Multiverse", "Infinity", "Touch Grass"];

/* Each profile effect gives the whole card a spinning edge in its own colors. */
const FXC = { "w1-suns": ["#ffd76a", "#ff8a5b"], "w2-tides": ["#3ddc97", "#4cc9f0"], "w3-veil": ["#e879f9", "#9d7bff"], "w4-spiral": ["#5ad1ff", "#b57bff"], "w5-horizon": ["#9d7bff", "#22e3c9"], "rb-comet": ["#4cc9f0", "#ffffff"], "rb-supernova": ["#ffd76a", "#ff7a1a"], "rb-wormhole": ["#22e3c9", "#9d7bff"], reaper: ["#ff7a1a", "#9dff3d"], sovereign: ["#ffcf5a", "#e0662a"], stardust: ["#cfe0ff", "#ffffff"], ringlet: ["#cfe0ff", "#8b7bff"], aurora: ["#3dffb5", "#b57bff"], neon: ["#ff3df0", "#4cc9f0"], orbit: ["#e8ecff", "#4cc9f0"], glitch: ["#ff3b6b", "#3be8ff"], flare: ["#ff7a2b", "#ffd76a"], comet: ["#4cc9f0", "#ffffff"], halo: ["#ff8a5b", "#ffd0a8"], supernova: ["#ffd76a", "#ff8a5b"], crown: ["#ffd76a", "#fff6d0"], pixel: ["#3dff7a", "#ff3df0"], hud: ["#ff3b3b", "#ffffff"], code: ["#33ff33", "#0a8a0a"], scan: ["#3dff7a", "#3be8ff"], prism: ["#ff4df0", "#3be8ff"], holo: ["#ff4df0", "#ffd76a"], "opening-night": ["#ffd76a", "#ff5d9e"], haunted: ["#7dff6a", "#b46bff"], bats: ["#ff8a2b", "#7b2cbf"], jack: ["#ff8a2b", "#ffd76a"], ghostfire: ["#7dff6a", "#b46bff"], cobweb: ["#ffffff", "#9aa4cf"], witchmoon: ["#ffb347", "#ff6a1a"], wraith: ["#4dd2ff", "#ff4de0"], prismjack: ["#ff8a2b", "#a64dff"], "leaf-fall": ["#e8893a", "#ffd76a"], "cider-steam": ["#d9a066", "#f3d7b3"], "harvest-glow": ["#ffb347", "#ff7a1a"], "autumn-wind": ["#e0662a", "#f2b134"], "harvest-moon": ["#ffd76a", "#ffb347"], "prism-leaf": ["#ff8a2b", "#4dd2ff"] };
const PRES = { online: ["Online", "#3ddc97"], idle: ["Idle", "#ffc857"], dnd: ["Do not disturb", "#ff5d6e"], invisible: ["Offline", "#8d96bd"] };
const fmtJoin = (t) => new Date(t).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });

function actionBar(p) {
  const rel = state.friendRel?.(p.id) ?? "none";
  if (p.id === state.me?.id) return `<button type="button" class="btn pc-main" data-pact="edit">Edit my profile</button>`;
  const blk = `<button type="button" class="btn ghost pc-sq" data-pact="block" title="Block ${esc(p.username)}" aria-label="Block">⊘</button>`;
  if (rel === "friends") return `<button type="button" class="btn pc-main" data-pact="dm">✉ Message</button><button type="button" class="btn pc-sq" data-pact="call" title="Voice call">📞</button><button type="button" class="btn pc-sq" data-pact="video" title="Video call">🎥</button><button type="button" class="btn ghost pc-sq" data-pact="remove" title="Remove friend">✓ Friends</button>${blk}`;
  if (rel === "outgoing") return `<button type="button" class="btn pc-main ghost" data-pact="cancel">Request sent · Cancel</button>${blk}`;
  if (rel === "incoming") return `<button type="button" class="btn pc-main" data-pact="accept">Accept friend request</button><button type="button" class="btn ghost" data-pact="decline">Decline</button>${blk}`;
  return `<button type="button" class="btn pc-main" data-pact="add">＋ Add friend</button>${blk}`;
}

export async function openFullProfile(name) {
  let p; try { p = await api("/profile/" + encodeURIComponent(name)); } catch (e) { return toast(e.message, true); }
  const person = state.people.get(p.id) ?? { id: p.id, username: p.username, role: p.role, roleId: p.roleId, profile: p.profile, fx: p.equip.effect, tag: p.equip.tag };
  if (!state.people.has(p.id)) state.people.set(p.id, person);
  person.fx = p.equip.effect; person.tag = p.equip.tag; person.bg = p.equip.bg; /* make sure the avatar shows the freshest effect */
  const rc = RANK_COL[p.rank] ?? "#8d96bd", pic = p.profile?.avatar, eff = effectMap.get(p.equip.effect);
  const [c1, c2] = FXC[p.equip.effect] ?? [rc, rc];
  const bests = GAMES.map((g) => [g.name, p.bests?.[g.id] ?? 0]).filter((x) => x[1] > 0);
  const cnt = {}; for (const [list, ids] of [[EFFECTS, p.inv.effects], [TAGS, p.inv.tags], [THEMES, p.inv.themes], [BGS, p.inv.bgs ?? []]]) for (const it of list) if (ids.includes(it.id)) cnt[it.rarity] = (cnt[it.rarity] ?? 0) + 1;
  const counts = ["omega", "forbidden", "secret", "chroma", "legendary", "epic", "rare", "common", "limited"].filter((r) => cnt[r]).map((r) => `<span class="chip" style="--tc:${rarityColor(r)}">${cnt[r]} ${RARITY[r].name}</span>`).join("");
  const total = p.inv.effects.length + p.inv.tags.length + p.inv.themes.length + (p.inv.bgs?.length ?? 0), ownedBgs = BGS.filter((b) => p.inv.bgs?.includes(b.id)), bgi = bgMap.get(p.equip.bg);
  const online = (state.onlineIds ?? new Set()).has(p.id), pr = PRES[p.profile?.presence] ?? PRES.online, accent = p.profile?.accent;
  const bgStyle = p.equip.bg ? "" : `style="background:linear-gradient(150deg,${esc(accent || rc)},color-mix(in srgb,${esc(accent || rc)} 22%,#05060d) 70%)"`;
  const o = overlay(`<div class="profcard ${eff ? "has-fx" : ""} ${["chroma"].includes(eff?.rarity) ? "rainbow" : ""}" style="--rc:${rc};--c1:${c1};--c2:${c2}" role="dialog" aria-label="${esc(p.username)}'s profile">
    <div class="pc-bg ${p.equip.bg ? "pbg-" + esc(p.equip.bg) : ""}" ${bgStyle}></div><div class="pc-shade"></div>${eff ? `<i class="pc-edge"></i>` : ""}
    <button type="button" class="prof-x" data-x aria-label="Close">×</button>
    <div class="pc-scroll"><div class="pc-top"><button type="button" class="prof-av pc-av" data-zoom title="${pic ? "Click to enlarge the picture" : ""}">${avatar(p.username, false, false, true)}</button></div>
      <h2 class="pc-name">${esc(p.username)}<span class="rchip" style="--rc:${rc}">${RANK_NAME[p.rank] ?? ""}</span></h2>
      <div class="pc-chips">${roleTags(person)}</div>
      <div class="pc-handle">@${esc(p.username.toLowerCase())}${p.profile?.pronouns ? ` · ${esc(p.profile.pronouns)}` : ""}</div>
      <div class="pc-meta"><span>✦ ${fmtNum(p.xp)} XP</span><span>◷ joined ${fmtJoin(p.createdAt)}</span><span>💬 ${fmtNum(p.msgs ?? 0)} messages</span>${p.streak ? `<span>🔥 ${p.streak} day streak</span>` : ""}</div>
      <div class="pc-pres"><span class="pc-pill"><i style="background:${online ? pr[1] : "#8d96bd"}"></i>${online ? pr[0] : "Offline"}</span>${p.profile?.status ? `<span class="pc-status">${esc(p.profile.status)}</span>` : ""}</div>
      ${p.profile?.bio ? `<div class="pc-bio">${esc(p.profile.bio)}</div>` : ""}
      ${eff || bgi ? `<div class="pc-fxline">${eff ? `<span class="chip" style="--tc:${rarityColor(eff.rarity)}">Effect · ${esc(eff.name)}</span>` : ""}${bgi ? `<span class="chip" style="--tc:${rarityColor(bgi.rarity)}">Backdrop · ${esc(bgi.name)}</span>` : ""}</div>` : ""}
      <details class="pc-more"><summary>Collection and stats · ${total} items · ${p.ach ?? 0} achievements${p.coins != null ? ` · ◎ ${fmtNum(p.coins)}` : ""}</summary>
        ${bests.length ? `<h4 class="sec">Arcade bests</h4><div class="prof-bests">${bests.map(([n, v]) => `<span><small>${esc(n)}</small><b>${fmtNum(v)}</b></span>`).join("")}</div>` : ""}
        ${counts ? `<h4 class="sec">Collection</h4><div class="prof-fx rcount">${counts}</div>` : ""}
      </details></div>
    <div class="pc-actions" id="pcActions">${actionBar(p)}</div></div>`, { center: true });
  { const av = o.querySelector(".pc-av .avatar"); if (av && eff) { av.classList.add("fx", "fx-" + eff.id); if (!av.querySelector(".fxa")) av.insertAdjacentHTML("afterbegin", '<i class="fxa"></i><i class="fxb"></i>'); } }
  on("friends", () => { if (!o.isConnected) return; const a = o.querySelector("#pcActions"); if (a) a.innerHTML = actionBar(p); });
  const close = () => { o.remove(); };
  o.addEventListener("click", async (e) => {
    if (e.target === o) return close();
    const b = e.target.closest("[data-pact]"); if (!b) return;
    const a = b.dataset.pact;
    if (a === "edit") { close(); return emit("view", "settings"); }
    if (a === "dm") { close(); return emit("dm-open", p.id); }
    if (a === "call" || a === "video") { close(); emit("dm-open", p.id); return emit("call-start", { id: p.id, video: a === "video" }); }
    if (a === "block") { if (!(await confirmBox(`Block ${p.username}?`, "You will not be able to message or call each other, and any friendship ends.", { ok: "Block", danger: true }))) return; return emit("fr-act", { act: "block", id: p.id }); }
    if (a === "remove" && !(await confirmBox(`Remove ${p.username} as a friend?`, "You will not be able to message or call each other until you are friends again.", { ok: "Remove", danger: true }))) return;
    emit("fr-act", { act: a, id: p.id });
  });
  o.querySelector("[data-x]").onclick = close;
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
