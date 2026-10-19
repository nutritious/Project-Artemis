/* Hub: your rank and XP, daily missions with a streak, and the crew leaderboards. */
import { playLevelUp } from "./levelup.js";
import { lookupHtml, wireLookup, openFullProfile } from "./profile.js";
import { GAMES, ACHIEVEMENTS, DAILY_CAP } from "./cosmetics.js";
import { redeemCard, bindRedeem } from "./redeem.js";
bindRedeem();
import { $, api, isCoOwnerUp, avatar, esc, fmtNum, on, personByName, roleColor, state, toast } from "./util.js";

let T = null, A = null, G = null, B = { ranks: [], xp: [], arcade: {} }, tab = "xp";
const rk = (i) => B.ranks[i] ?? { name: "Stardust", color: "#8d96bd", xp: 0 };
export const rankChip = (i) => `<span class="rchip" style="--rc:${esc(rk(i).color)}">${esc(rk(i).name)}</span>`;

export function buildHub() {
  $("#view-hub").innerHTML = `<div class="page" id="hubPage"><div class="skel"></div></div>`;
  $("#hubPage").addEventListener("click", (e) => {
    const b = e.target.closest("[data-lb]"); if (b) { tab = b.dataset.lb; paint(); }
    const row = e.target.closest("[data-prof]"); if (row) return openFullProfile(row.dataset.prof);
    const r = e.target.closest("[data-rk]"); if (r) playLevelUp(+r.dataset.rk, rk(+r.dataset.rk)); /* replay a rank you have reached */
  });
  on("game", (m) => {
    G = m.game; state.me.coins = G.coins; state.me.freePacks = G.freePacks;
    for (const g of m.gains ?? []) toast(g.xp ? `+${g.xp} XP · ${g.text}` : g.text, "ok");
    if (m.rankUp) playLevelUp(m.game.rank, m.rankUp);
    if (state.view === "hub" && B.ranks.length) paint();
  });
  on("ach", async () => { if (state.view === "hub") { A = await api("/achievements").catch(() => A); paint(); } });
}
export async function onHubShown() {
  try { const r = await api("/game"); G = r.game; state.me.coins = G.coins; state.me.freePacks = G.freePacks; B = { ranks: r.ranks, xp: r.xp, arcade: r.arcade }; A = await api("/achievements").catch(() => A); T = await api("/trust").catch(() => T); paint(); } catch (e) { toast(e.message, true); }
}
export function setBoards(r) { G = r.game; B = { ranks: r.ranks, xp: r.xp, arcade: r.arcade }; }

function paint() {
  const g = G, me = state.me, cur = rk(g.rank), nxt = g.next, base = cur.xp;
  const pct = nxt ? Math.min(100, ((g.xp - base) / (nxt.xp - base)) * 100) : 100;
  const gname = GAMES.find((x) => x.id === tab)?.name ?? "Eclipse Run";
  const board = (tab === "xp" ? B.xp : B.arcade[tab] ?? []).map((r, i) => {
    const p = personByName(r.username), c = roleColor(p ?? r);
    return `<div class="lbrow ${r.id === me.id ? "me" : ""}" data-prof="${esc(r.username)}" role="button" tabindex="0"><span class="pos">${i + 1}</span>${avatar(r.username, false, true)}<b style="${c ? `color:${esc(c)}` : ""}">${esc(r.username)}</b>${tab === "xp" ? rankChip(r.rank) : ""}<span class="grow"></span><span class="mono lbv">${tab === "xp" ? fmtNum(r.xp) + " XP" : fmtNum(r.best)}</span></div>`;
  }).join("") || `<p class="note">Nobody on the board yet. ${tab === "xp" ? "Browse or chat to earn XP." : `Play ${esc(gname)} in the Arcade.`}</p>`;
  $("#hubPage").innerHTML = `
    <div><h2>Hub</h2><p class="sub" style="margin:4px 0 0">Earn XP by browsing, chatting and playing. Climb the ranks (each one has its own level-up scene) and keep your streak alive.</p></div>
    ${redeemCard()}
    <div class="grid2">
      <div class="card glass idcard" style="--rc:${esc(cur.color)}">
        <div class="idtop">${avatar(me.username, false, false, true)}<div class="idname"><b>${esc(me.username)}</b><span class="rank-big">${esc(cur.name)}</span></div></div>
        <div class="xpbar" role="progressbar" aria-valuenow="${g.xp}" aria-valuemin="${base}" aria-valuemax="${nxt?.xp ?? g.xp}"><i style="width:${pct}%"></i></div>
        <div class="xpline"><span class="mono">${fmtNum(g.xp)} XP</span><span class="dim">${nxt ? `${nxt.xp - g.xp} to ${esc(nxt.name)}` : "Max rank reached"}</span></div>
        <div class="chips"><span class="chip warn">Streak ${g.streak} day${g.streak === 1 ? "" : "s"}</span><span class="chip">Best run ${fmtNum(g.best)}</span><span class="chip">${g.plays} run${g.plays === 1 ? "" : "s"}</span><span class="chip" style="color:#ffc857">◎ ${(state.me.coins ?? 0).toLocaleString()}</span>${state.me.freePacks ? `<span class="chip ok">${state.me.freePacks} free crate${state.me.freePacks > 1 ? "s" : ""}</span>` : ""}</div>
        <div class="ladder">${B.ranks.map((r, i) => { const open = i > 0 && (i <= g.rank || isCoOwnerUp(state.me)); return `<${open ? "button" : "span"} class="step ${i < g.rank ? "past" : i === g.rank ? "now" : ""}" ${open ? `data-rk="${i}"` : ""} style="--rc:${esc(r.color)}" title="${esc(r.name)} · ${r.xp} XP${open ? " · click to replay the level-up" : ""}"><i></i><small>${esc(r.name)}</small></${open ? "button" : "span"}>`; }).join("")}</div>
      </div>
      <div class="card glass"><h3>Daily missions <span class="chip">resets at 00:00 UTC</span></h3>
        ${g.missions.map((m) => `<div class="mission ${m.done ? "done" : ""}"><div class="mtop"><b>${esc(m.title)}</b><span class="mono">${m.done ? "Complete" : `${m.n}/${m.goal}`} · +${m.xp} XP</span></div><div class="xpbar sm"><i style="width:${(m.n / m.goal) * 100}%"></i></div><small class="dim">${esc(m.hint)}</small></div>`).join("")}
        <p class="note">Finish all three for a full sweep bonus of +${g.sweep} XP. Come back every day for a bigger streak bonus.</p>
      </div>
    </div>
    <div class="card glass cap-meter"><h3>Coins today <span class="chip">${g.earnedToday ?? 0} / ${g.cap ?? DAILY_CAP}</span></h3>
      <div class="xpbar" role="progressbar" aria-valuenow="${g.earnedToday ?? 0}" aria-valuemin="0" aria-valuemax="${g.cap ?? DAILY_CAP}"><i style="width:${Math.min(100, ((g.earnedToday ?? 0) / (g.cap ?? DAILY_CAP)) * 100)}%"></i></div>
      <small>You earn coins by chatting (1), searching (2), browsing (1) and playing games, up to ${g.cap ?? DAILY_CAP} a day. Resets at 00:00 UTC. Wheel spins, achievements and event prizes do not count.</small></div>
    ${trustHtml()}
    ${achHtml()}
    ${lookupHtml()}
    <div class="card glass"><h3>Leaderboard <span class="seg2"><button data-lb="xp" class="${tab === "xp" ? "on" : ""}">Top crew</button>${GAMES.map((x) => `<button data-lb="${x.id}" class="${tab === x.id ? "on" : ""}">${esc(x.name)}</button>`).join("")}</span></h3>${board}</div>`;
  wireLookup($("#hubPage"));
}

function achHtml() {
  const done = A?.list ? A.list.filter((a) => a.done).length : 0, stats = A?.stats ?? {};
  const list = ACHIEVEMENTS.map((a) => { const d = A?.list?.find((x) => x.id === a.id)?.done, v = Math.min(a.goal, stats[a.stat] ?? 0); return { ...a, d, v }; });
  list.sort((x, y) => (!!x.d - !!y.d) || (y.v / y.goal - x.v / x.goal));
  return `<div class="card glass"><h3>Achievements <span class="chip">${done} / ${ACHIEVEMENTS.length}</span></h3><p class="note" style="margin:-4px 0 10px">Lifetime goals. Each one pays coins once, on top of your daily limit.</p>
    <div class="ach-grid">${list.map((a) => `<div class="ach ${a.d ? "done" : ""}" title="${esc(a.desc)}"><span class="ai">${esc(a.icon)}</span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small><div class="xpbar sm"><i style="width:${(a.v / a.goal) * 100}%"></i></div><div class="am"><span>${a.d ? "Complete" : `${fmtNum(a.v)} / ${fmtNum(a.goal)}`}</span><span>+${a.coins} ◎</span></div></div>`).join("")}</div></div>`;
}

function trustHtml() {
  if (!T) return "";
  const n = T.need, row = (label, v, goal, ok, txt) => `<div class="mission ${ok ? "done" : ""}"><div class="mtop"><b>${label}</b><span class="mono">${txt}</span></div><div class="xpbar sm"><i style="width:${Math.min(100, (v / goal) * 100)}%"></i></div></div>`;
  return `<div class="card glass"><h3>Trusted member <span class="chip ${T.trusted ? "ok" : ""}">${T.trusted ? (state.me.role === "owner" ? "trusted · owner" : state.me.role === "coowner" ? "trusted · co-owner" : T.staff ? "trusted · staff" : "trusted") : "not yet"}</span></h3>
    <p class="note" style="margin:-4px 0 10px">${T.trusted ? "You can post GIFs and chat in #trusted-general." : "Reach all four goals to unlock GIFs and the #trusted-general channel."}</p>
    ${row("Chat messages", T.msgs, n.msgs, T.met.msgs, `${Math.min(T.msgs, n.msgs)} / ${n.msgs}`)}
    ${row("Time on the proxy", T.proxyHours, n.proxyHours, T.met.proxy, `${Math.min(T.proxyHours, n.proxyHours)} / ${n.proxyHours} h`)}
    ${row("Account age", Math.min(T.ageDays, n.ageDays), n.ageDays, T.met.age, T.met.age ? "old enough" : `${T.ageDays} / ${n.ageDays} days`)}
    ${row("No bans", T.banFreeDays == null ? n.banFreeDays : Math.min(T.banFreeDays, n.banFreeDays), n.banFreeDays, T.met.ban, T.met.ban ? "clean" : `${T.banFreeDays} / ${n.banFreeDays} days`)}</div>`;
}
