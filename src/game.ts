/* Crew progression: XP, coins, ranks, daily missions, streaks, arcade scores and live-event scoring. */
import { db, saveDb, type Game, type User } from "./store.js";
import { hasPass, EVENTS, GAMES, DAILY_CAP, COIN_RATES, ACHIEVEMENTS, WHEEL_MS, XP_BASE, WORLDS, worldOf, QUESTS, questGoal, rebirthXp, REBIRTH_COINS, WORLD_ITEMS, RB_SHOP, rbShopMap } from "../public/js/cosmetics.js";

export const RANKS = [
  { name: "Stardust", xp: 0, color: "#8d96bd" },
  { name: "Cadet", xp: 100, color: "#4cc9f0" },
  { name: "Pilot", xp: 300, color: "#3ddc97" },
  { name: "Navigator", xp: 700, color: "#ffc857" },
  { name: "Captain", xp: 1500, color: "#ff8a5b" },
  { name: "Voyager", xp: 3000, color: "#e879f9" },
  { name: "Legend", xp: 6000, color: "#ffd76a" },
  { name: "Nova", xp: 12000, color: "#ff7ab8" },
  { name: "Quasar", xp: 20000, color: "#5ad1ff" },
  { name: "Pulsar", xp: 35000, color: "#9d7bff" },
  { name: "Singularity", xp: 60000, color: "#c9d1ff" },
  { name: "Paradox", xp: 70000, color: "#22e3c9" },
  { name: "Multiverse", xp: 80000, color: "#ff4d6d" },
  { name: "Infinity", xp: 90000, color: "#fff0b8" },
  { name: "Touch Grass", xp: 100000, color: "#58d35a" },
];
const LEGEND = RANKS.length - 1; /* the announcement is only for the top rank, Touch Grass */
export const MISSIONS = [
  { id: "browse", title: "Explore the web", hint: "Open 5 pages in the browser", goal: 5, xp: 40, coins: 15, cap: 25, per: 1 },
  { id: "chat", title: "Radio check", hint: "Send 3 chat messages", goal: 3, xp: 30, coins: 10, cap: 25, per: 2 },
  { id: "play", title: "Run the gauntlet", hint: "Finish one game in the Arcade", goal: 1, xp: 30, coins: 15, cap: 10, per: 0 },
] as const;
export const SWEEP_XP = 60, SWEEP_COINS = 40;
export type MissionId = (typeof MISSIONS)[number]["id"];

export const newGame = (): Game => ({ xp: 0, streak: 0, lastDay: "", day: "", n: { browse: 0, chat: 0, play: 0 }, done: [], best: 0, plays: 0, bests: {}, runCoins: 0, stats: {}, ach: {}, earnDay: "", earned: 0, lastSpin: 0 });
const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
export const rankIndex = (xp: number) => RANKS.reduce((r, k, i) => (xp >= k.xp ? i : r), 0);

export const activeBoosts = () => { const now = Date.now(); db.data.boosts = db.data.boosts.filter((b) => b.until > now); return db.data.boosts; };
const mult = (kind: "xp" | "coins") => (activeBoosts().some((b) => b.kind === kind) ? 2 : 1);

export interface Gain { text: string; xp: number; coins?: number }
type Notifier = (userId: string, data: unknown) => void;
let notify: Notifier = () => {};
export const onGame = (fn: Notifier) => { notify = fn; };
let legendHook: (u: User) => void = () => {};
export const onLegend = (fn: (u: User) => void) => { legendHook = fn; };
let rebirthHook: (u: User, rb: number) => void = () => {};
export const onRebirth = (fn: (u: User, rb: number) => void) => { rebirthHook = fn; };

/* ---------- rebirth ---------- */
export const rbOf = (u: User) => u.game.rb ?? 0;
const perk = (u: User, id: string) => !!u.game.rbBought?.includes(id);
/** All XP you earn from everyday things is multiplied by this: base boost, +25% per rebirth, passes and perks. */
export const xpMul = (u: User) => XP_BASE * rebirthXp(rbOf(u)) * (hasPass(u.up, "surge") ? 1.15 : 1) * (perk(u, "rb-perk-xp") ? 1.1 : 1);
const capOf = (u: User) => DAILY_CAP + 100 * rbOf(u) + (perk(u, "rb-perk-coins") ? 100 : 0);
const xr = (u: User, n: number) => Math.round(n * xpMul(u));
const rawStat = (u: User, k: string) => (k === "plays" ? u.game.plays : u.game.stats[k] ?? 0);
/** Progress on the four rings of the world you are in right now. */
export function quests(u: User) {
  const rb = rbOf(u), base = u.game.wbase ?? {};
  return QUESTS.map((q) => { const goal = questGoal(q, rb), n = Math.max(0, rawStat(u, q.stat) - (base[q.stat] ?? 0)); return { id: q.id, name: q.name, icon: q.icon, verb: q.verb, goal, n: Math.min(n, goal), done: n >= goal }; });
}
export function rebirthState(u: User) {
  const rb = rbOf(u), q = quests(u), atTop = rankIndex(u.game.xp) >= RANKS.length - 1, ringsDone = q.every((x) => x.done);
  return { rb, rp: u.game.rp ?? 0, world: worldOf(rb), nextWorld: worldOf(rb + 1), quests: q, atTop, ringsDone, can: atTop && ringsDone, mul: Math.round(xpMul(u) * 100) / 100, bought: [...new Set([...(u.game.rbBought ?? []), ...RB_SHOP.filter((x) => x.kind === "item" && u.inv[({ effect: "effects", tag: "tags", theme: "themes", bg: "bgs" } as const)[x.type!]].includes(x.item!)).map((x) => x.id)])] };
}
export function doRebirth(u: User, force = false) {
  const st = rebirthState(u);
  if (!force && !st.can) throw new Error(st.atTop ? "Finish all four rings first" : "Reach Touch Grass first");
  const g = u.game; g.rb = (g.rb ?? 0) + 1; g.rp = (g.rp ?? 0) + 1;
  g.xp = 0; g.wbase = Object.fromEntries(QUESTS.map((x) => [x.stat, rawStat(u, x.stat)]));
  const w = WORLD_ITEMS[g.rb]; if (w) { for (const [t, id] of [["effects", w.effect], ["tags", w.tag], ["bgs", w.bg]] as const) if (!u.inv[t].includes(id)) u.inv[t].push(id); }
  u.coins += REBIRTH_COINS(g.rb); g.stats.rebirths = g.rb;
  checkAch(u); saveDb();
  notify(u.id, { t: "game", game: publicGame(u), gains: [{ text: `Rebirth into ${WORLDS[worldOf(g.rb)].name}`, xp: 0, coins: REBIRTH_COINS(g.rb) }], rankUp: null });
  if (!force) rebirthHook(u, g.rb);
  return g.rb;
}
/** Spend rebirth points in the Rebirth shop. */
export function buyRebirth(u: User, id: string) {
  const def = rbShopMap.get(id); if (!def) throw new Error("No such item");
  const g = u.game; g.rbBought ??= [];
  if (!def.repeat && (g.rbBought.includes(id) || (def.kind === "item" && u.inv[({ effect: "effects", tag: "tags", theme: "themes", bg: "bgs" } as const)[def.type!]].includes(def.item!)))) throw new Error("You already own that");
  if ((g.rp ?? 0) < def.cost) throw new Error("Not enough rebirth points");
  g.rp = (g.rp ?? 0) - def.cost;
  if (def.kind === "item") u.inv[({ effect: "effects", tag: "tags", theme: "themes", bg: "bgs" } as const)[def.type!]].push(def.item!);
  else if (def.kind === "crates") u.freePacks += def.n ?? 5;
  if (!def.repeat) g.rbBought.push(id);
  saveDb(); notify(u.id, { t: "game", game: publicGame(u), gains: [], rankUp: null });
}
export { RB_SHOP };

/** Everyday coin income goes through here and is clamped to DAILY_CAP per UTC day. Returns what was actually paid. */
export function earn(u: User, amount: number) {
  const g = u.game, t = dayKey();
  if (g.earnDay !== t) { g.earnDay = t; g.earned = 0; }
  amount *= (hasPass(u.up, "magnet") ? 1.2 : 1) * (perk(u, "rb-perk-coins") ? 1.15 : 1);
  const got = Math.max(0, Math.min(Math.floor(amount), capOf(u) - g.earned));
  u.coins += got; g.earned += got; g.stats.earned = (g.stats.earned ?? 0) + got;
  return got;
}
export const earnedToday = (u: User) => (u.game.earnDay === dayKey() ? u.game.earned : 0);
export const wheelMs = (u: User) => (hasPass(u.up, "overdrive") ? WHEEL_MS / 4 : hasPass(u.up, "wheel") ? WHEEL_MS / 2 : WHEEL_MS);
export const nextSpin = (u: User) => u.game.lastSpin + wheelMs(u);

const statVal = (u: User, k: string) => {
  const g = u.game;
  if (k === "rank") return rankIndex(g.xp);
  if (k === "items") return u.inv.effects.length + u.inv.tags.length + u.inv.themes.length + u.inv.bgs.length;
  if (k === "plays") return g.plays;
  return g.stats[k] ?? 0;
};
/** Awards any newly completed lifetime achievements (coins are exempt from the daily cap). */
export function checkAch(u: User) {
  const g = u.game; let any = false;
  for (const a of ACHIEVEMENTS) {
    if (g.ach[a.id] || statVal(u, a.stat) < a.goal) continue;
    g.ach[a.id] = Date.now(); u.coins += a.coins; any = true;
    notify(u.id, { t: "ach", id: a.id, name: a.name, coins: a.coins, icon: a.icon });
  }
  if (any) { saveDb(); notify(u.id, { t: "game", game: publicGame(u), gains: [], rankUp: null }); }
}
/** Bump a lifetime stat and re-check achievements. */
export function stat(u: User, k: string, n = 1) {
  u.game.stats[k] = (u.game.stats[k] ?? 0) + n;
  if (k === "streakmax") u.game.stats[k] = n;
  checkAch(u); saveDb();
}
const lastAct = new Map<string, number>();
/** Chat / search / browse activity: lifetime stat plus a small, rate-limited coin reward. */
export function activity(u: User, kind: "chat" | "search" | "browse") {
  const key = { chat: "msgs", search: "searches", browse: "pages" }[kind], rate = COIN_RATES[kind], now = Date.now(), k = u.id + kind;
  let got = 0;
  if (now - (lastAct.get(k) ?? 0) >= rate.gap) { lastAct.set(k, now); got = earn(u, rate.coins * mult("coins")); }
  u.game.stats[key] = (u.game.stats[key] ?? 0) + 1;
  checkAch(u); saveDb();
  if (got) notify(u.id, { t: "game", game: publicGame(u), gains: [], rankUp: null });
  return got;
}

function roll(u: User, gains: Gain[]) {
  const g = u.game, today = dayKey();
  if (g.day === today) return;
  g.streak = g.lastDay === dayKey(Date.now() - 864e5) ? g.streak + 1 : 1;
  g.lastDay = g.day = today;
  g.n = { browse: 0, chat: 0, play: 0 }; g.done = [];
  const bonus = Math.min(g.streak, 7) * 5, bxp = xr(u, bonus);
  g.xp += bxp; const paid = earn(u, bonus); g.stats.streakmax = Math.max(g.stats.streakmax ?? 0, g.streak);
  gains.push({ text: g.streak > 1 ? `${g.streak}-day streak` : "Daily check-in", xp: bxp, coins: paid });
}
function finish(u: User, before: number, gains: Gain[]) {
  const rank = rankIndex(u.game.xp);
  if (rank > before) { const c = 50 * (rank - before); u.coins += c; gains.push({ text: `Rank up: ${RANKS[rank].name}`, xp: 0, coins: c }); }
  checkAch(u); saveDb();
  if (rank >= LEGEND && before < LEGEND) legendHook(u);
  notify(u.id, { t: "game", game: publicGame(u), gains, rankUp: rank > before ? RANKS[rank] : null });
}

export function progress(u: User, id: MissionId, count = 1) {
  const g = u.game, gains: Gain[] = [], before = rankIndex(g.xp), xm = mult("xp"), cm = mult("coins");
  roll(u, gains);
  const m = MISSIONS.find((x) => x.id === id)!;
  for (let i = 0; i < count; i++) {
    if (g.n[id] >= m.cap) break;
    g.n[id]++;
    if (m.per) g.xp += xr(u, m.per * xm);
    if (g.n[id] >= m.goal && !g.done.includes(id)) {
      g.done.push(id); g.xp += xr(u, m.xp * xm); const pc = earn(u, m.coins * cm); gains.push({ text: `Mission: ${m.title}`, xp: xr(u, m.xp * xm), coins: pc });
      if (MISSIONS.every((x) => g.done.includes(x.id))) { g.xp += xr(u, SWEEP_XP * xm); const ps = earn(u, SWEEP_COINS * cm); gains.push({ text: "Full sweep", xp: xr(u, SWEEP_XP * xm), coins: ps }); }
    }
  }
  finish(u, before, gains);
}
/** Direct XP (events, gifts). Not multiplied. */
export function grant(u: User, xp: number, text: string) {
  const gains: Gain[] = [], before = rankIndex(u.game.xp);
  roll(u, gains);
  u.game.xp += xp; gains.push({ text, xp });
  finish(u, before, gains);
}
/** Direct coins (events, gifts, refunds). Can be negative for the owner to take coins back. */
export function giveCoins(u: User, n: number, text: string) {
  u.coins = Math.max(0, u.coins + Math.round(n));
  saveDb();
  notify(u.id, { t: "game", game: publicGame(u), gains: n > 0 ? [{ text, xp: 0, coins: Math.round(n) }] : [], rankUp: null });
}

/** A finished arcade run. Returns false when the numbers are not plausible. */
/* ---------- live-event points, milestones and game rush ---------- */
let rush: { game: string; until: number } | null = null;
export const startRush = (game: string, ms: number) => { rush = { game, until: Date.now() + ms }; };
export const getRush = () => { if (rush && rush.until < Date.now()) rush = null; return rush; };
const MILESTONES: [number, number][] = [[300, 25], [1000, 60], [2500, 120], [5000, 250], [10000, 500]];
let extra: (u?: User) => object = () => ({});
export const onEventExtra = (fn: (u?: User) => object) => { extra = fn; };
/** Adds points to the running live event. Crossing a milestone pays coins right away. */
export function addEventPoints(u: User, n: number) {
  const ev = db.data.event; if (!ev || !(n > 0)) return 0;
  const was = ev.points[u.id] ?? 0, now = was + Math.floor(n);
  { const pp = ((ev.phasePts ??= {})[String(ev.phase ?? 0)] ??= {}); pp[u.id] = (pp[u.id] ?? 0) + Math.floor(n); }
  ev.points[u.id] = now; ev.mile ??= {};
  for (const [at, coins] of MILESTONES) if (was < at && now >= at && (ev.mile[u.id] ?? 0) < at) { ev.mile[u.id] = at; u.coins += coins; notify(u.id, { t: "fx", kind: "milestone", pts: at, coins }); notify(u.id, { t: "game", game: publicGame(u), gains: [], rankUp: null }); }
  return Math.floor(n);
}
export function submitRun(u: User, gameId: string, score: number, secs: number) {
  const def = GAMES.find((x) => x.id === gameId);
  if (!def || !Number.isFinite(score) || !Number.isFinite(secs) || score < 0 || secs < 3 || secs > 3600 || score > secs * def.per + def.add) return false;
  const g = u.game, gains: Gain[] = [], before = rankIndex(g.xp), s = Math.floor(score);
  roll(u, gains);
  g.plays++;
  if (s > (g.bests[gameId] ?? 0)) { g.bests[gameId] = s; if (gameId === "run") g.best = s; gains.push({ text: `New best in ${def.name}`, xp: 0 }); }
  if (g.n.play < 10) {
    const xp = xr(u, Math.min(30, Math.floor(s / (def.coinDiv * 0.7))) * mult("xp")); g.xp += xp;
    const coins = Math.min(60, Math.floor(s / def.coinDiv)) * mult("coins"), got = earn(u, coins);
    if (xp || got) gains.push({ text: def.name, xp, coins: got });
  }
  const rh = getRush();
  addEventPoints(u, s * (rh && (!rh.game || rh.game === gameId) ? 2 : 1));
  finish(u, before, gains);
  progress(u, "play");
  return true;
}

export function publicGame(u: User) {
  const g = u.game, i = rankIndex(g.xp), next = RANKS[i + 1], fresh = g.day === dayKey();
  return {
    xp: g.xp, rank: i, streak: fresh || g.lastDay === dayKey(Date.now() - 864e5) ? g.streak : 0, best: g.best, bests: g.bests, plays: g.plays, coins: u.coins, freePacks: u.freePacks,
    next: next ? { name: next.name, xp: next.xp } : null,
    missions: MISSIONS.map((m) => ({ id: m.id, title: m.title, hint: m.hint, goal: m.goal, xp: m.xp, coins: m.coins, n: fresh ? Math.min(g.n[m.id], m.goal) : 0, done: fresh && g.done.includes(m.id) })),
    sweep: SWEEP_XP, boosts: activeBoosts(), earnedToday: earnedToday(u), cap: capOf(u), rb: rbOf(u), rp: g.rp ?? 0, mul: Math.round(xpMul(u) * 100) / 100, nextSpin: nextSpin(u), ach: Object.keys(g.ach).length, hours: Math.max(u.siteMs ?? 0, u.proxyMs ?? 0) / 36e5,
  };
}
const row = (u: User) => ({ rb: rbOf(u), id: u.id, username: u.username, role: u.role, roleId: u.roleId ?? null, xp: u.game.xp, rank: rankIndex(u.game.xp), streak: u.game.streak, best: u.game.best, fx: u.equip.effect, tag: u.equip.tag });
export function boards() {
  const live = db.data.users.filter((u) => !u.banned);
  const arcade: Record<string, unknown[]> = {};
  for (const gm of GAMES) arcade[gm.id] = live.filter((u) => (u.game.bests[gm.id] ?? 0) > 0).sort((a, b) => (b.game.bests[gm.id] ?? 0) - (a.game.bests[gm.id] ?? 0)).slice(0, 10).map((u) => ({ ...row(u), best: u.game.bests[gm.id] }));
  return { ranks: RANKS, xp: live.filter((u) => u.game.xp > 0 || rbOf(u) > 0).sort((a, b) => rbOf(b) - rbOf(a) || b.game.xp - a.game.xp).slice(0, 10).map(row), arcade };
}
export function publicEvent(u?: User) {
  const ev = db.data.event; if (!ev) return null;
  const def = EVENTS[ev.kind as keyof typeof EVENTS];
  const top = Object.entries(ev.points).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, points]) => ({ username: db.data.users.find((x) => x.id === id)?.username ?? "?", points }));
  const ph = ev.schedule?.[ev.phase ?? 0], pt = Object.entries(ev.phasePts?.[String(ev.phase ?? 0)] ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, points]) => ({ username: db.data.users.find((x) => x.id === id)?.username ?? "?", points }));
  const phase = ph ? { idx: ev.phase ?? 0, of: ev.schedule!.length, kind: ph.kind, mins: ph.mins, startsAt: ev.phaseStart, endsAt: ev.phaseEnd, next: ev.schedule![(ev.phase ?? 0) + 1]?.kind ?? (ev.loop ? ev.schedule![0].kind : null), schedule: ev.schedule, loop: !!ev.loop, cfg: ev.cfg, top: pt, mine: u ? ev.phasePts?.[String(ev.phase ?? 0)]?.[u.id] ?? 0 : 0 } : null;
  return { phase, id: ev.id, kind: ev.kind, name: def?.name ?? ev.kind, color: def?.color ?? "#8b7bff", blurb: def?.blurb ?? "", startedAt: ev.startedAt, by: ev.by, games: GAMES.map((x) => x.id), joined: !!u && u.id in ev.points, mine: u ? ev.points[u.id] ?? 0 : 0, count: Object.keys(ev.points).length, top, rush: getRush(), ...extra(u) };
}
