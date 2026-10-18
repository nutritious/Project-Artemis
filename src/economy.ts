/* Coins, packs, items, live events and quick events. */
import crypto from "node:crypto";
import { audit, db, saveDb, uid, type User } from "./store.js";
import { cleanSchedule, DEFAULT_CFG, DUPE_COINS, EVENT_PRESETS, QUICK_PRESETS, BASE_THEMES, EVENTS, QUICK_EVENTS, packMap, rollPack, TAGS, EFFECTS, THEMES, BGS, WHEEL, WHEEL_MS } from "../public/js/cosmetics.js";
import { broadcast, onlineUsers, sendToUser } from "./chat.js";
import { activeBoosts, grant, giveCoins, publicEvent, publicGame, startRush, stat } from "./game.js";

const rand = () => crypto.randomInt(0, 1_000_000_000) / 1_000_000_000;
const rint = (a: number, b: number) => Math.floor(a + rand() * (b - a + 1));
export const customTags = () => db.data.customTags;
export const tagExists = (id: string) => TAGS.some((t) => t.id === id) || db.data.customTags.some((t) => t.id === id);
const listFor = (u: User, type: "effect" | "tag" | "theme" | "bg") => (type === "effect" ? u.inv.effects : type === "tag" ? u.inv.tags : type === "bg" ? u.inv.bgs : u.inv.themes);
const validItem = (type: string, id: string) => (type === "effect" ? EFFECTS.some((x) => x.id === id) : type === "tag" ? tagExists(id) : type === "theme" ? THEMES.some((x) => x.id === id) : type === "bg" ? BGS.some((x) => x.id === id) : false);

export type ItemType = "effect" | "tag" | "theme" | "bg";
export function addItem(u: User, type: ItemType, id: string) {
  const l = listFor(u, type); if (l.includes(id)) return false; l.push(id); return true;
}
const push = (u: User) => sendToUser(u.id, { t: "game", game: publicGame(u), gains: [], rankUp: null });

/** Global banner whenever anyone rolls a Chroma item. */
export function announceChroma(u: User, items: { type: string; id: string; name: string; rarity: string }[]) {
  for (const it of items) if (it.rarity === "chroma") broadcast({ t: "chroma", user: u.username, item: { type: it.type, id: it.id, name: it.name } });
}
export function spinWheel(u: User) {
  const g = u.game, now = Date.now();
  if (now < g.lastSpin + WHEEL_MS) throw new Error("The wheel is still recharging");
  const total = WHEEL.reduce((a, b) => a + b.w, 0); let r = rand() * total, idx = 0;
  for (let i = 0; i < WHEEL.length; i++) { r -= WHEEL[i].w; if (r < 0) { idx = i; break; } }
  const seg = WHEEL[idx] as { coins?: number; pack?: number };
  g.lastSpin = now;
  if (seg.coins) u.coins += seg.coins; else u.freePacks += seg.pack ?? 0;
  stat(u, "spins"); push(u);
  return { index: idx, coins: seg.coins ?? 0, crate: seg.pack ?? 0, next: g.lastSpin + WHEEL_MS, balance: u.coins, freePacks: u.freePacks };
}

export function openPack(u: User, packId: string, free: boolean) {
  const pack = packMap.get(packId); if (!pack) throw new Error("No such pack");
  if (free) { if (pack.id !== "crate" || u.freePacks < 1) throw new Error("No free crates left"); u.freePacks--; }
  else { if (u.coins < pack.cost) throw new Error("Not enough coins"); u.coins -= pack.cost; }
  const items = rollPack(pack, u.inv, rand);
  for (const it of items) { if (it.dupe) u.coins += it.refund; else addItem(u, it.type, it.id); }
  u.game.stats.packs = (u.game.stats.packs ?? 0) + 1;
  announceChroma(u, items);
  stat(u, "chroma", items.filter((i) => i.rarity === "chroma").length);
  saveDb(); push(u);
  return { items, coins: u.coins, freePacks: u.freePacks, inv: u.inv };
}

export type Target = { type: "user" | "all" | "online" | "role"; value?: string };
export function targets(t: Target): User[] {
  const live = db.data.users.filter((u) => !u.banned);
  if (t.type === "all") return live;
  if (t.type === "online") return onlineUsers();
  if (t.type === "user") return live.filter((u) => u.id === t.value);
  if (t.type === "role") return live.filter((u) => (t.value === "member" ? u.role === "member" && !u.roleId : t.value && ["owner", "coowner", "admin"].includes(t.value) ? u.role === t.value : u.roleId === t.value));
  return [];
}
export function giveItems(by: string, type: string, id: string, t: Target) {
  if (!validItem(type, id)) throw new Error("Unknown item");
  let n = 0; const ty = type as ItemType;
  for (const u of targets(t)) { if (addItem(u, ty, id)) { n++; push(u); sendToUser(u.id, { t: "gift", type, id }); } }
  saveDb(); audit(by, "give." + type, `${id} → ${t.type}${t.value ? ":" + t.value : ""} (${n} new)`);
  return n;
}
export function giveCoinsTo(by: string, amount: number, t: Target, reason: string) {
  const list = targets(t); for (const u of list) giveCoins(u, amount, reason || "Gift from the crew");
  audit(by, "give.coins", `${amount} → ${t.type}${t.value ? ":" + t.value : ""} (${list.length})`);
  return list.length;
}

/* ---------- redeem codes ---------- */
const itemMeta = (type: string, id: string) => { const l: any[] = type === "effect" ? EFFECTS : type === "tag" ? [...TAGS, ...db.data.customTags] : type === "theme" ? THEMES : BGS; const f = l.find((x) => x.id === id); return { type, id, name: f?.name ?? id, rarity: f?.rarity ?? "common" }; };
export const normCode = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);
export function codeView(c: import("./store.js").RedeemCode) { return { code: c.code, coins: c.coins, crates: c.crates, items: c.items.map((i) => itemMeta(i.type, i.id)), maxUses: c.maxUses, used: Object.keys(c.uses).length, expiresAt: c.expiresAt, note: c.note, by: c.by, createdAt: c.createdAt, disabled: !!c.disabled }; }
export function makeCode(by: string, b: any) {
  let code = normCode(b.code); if (!code) code = Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[crypto.randomInt(0, 32)]).join("");
  if (code.length < 3) throw new Error("A code needs at least 3 letters or numbers");
  if (db.data.codes.some((c) => c.code === code)) throw new Error("That code already exists");
  const coins = Math.max(0, Math.min(100000, Math.round(Number(b.coins) || 0))), crates = Math.max(0, Math.min(50, Math.round(Number(b.crates) || 0)));
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 8).filter((i: any) => validItem(String(i?.type), String(i?.id))).map((i: any) => ({ type: String(i.type), id: String(i.id) }));
  if (!coins && !crates && !items.length) throw new Error("Add at least one reward: coins, crates or an item");
  const hours = Math.max(0, Number(b.hours) || 0);
  const c = { code, coins, crates, items, maxUses: Math.max(0, Math.min(100000, Math.round(Number(b.maxUses) || 0))), uses: {}, expiresAt: hours ? Date.now() + hours * 36e5 : 0, note: String(b.note ?? "").slice(0, 80), by, createdAt: Date.now() };
  db.data.codes.unshift(c); saveDb(); audit(by, "code.create", code); return c;
}
/** One redemption per player per code. Rewards skip the daily coin cap. */
export function redeem(u: User, raw: unknown) {
  const code = normCode(raw), c = db.data.codes.find((x) => x.code === code);
  if (!c || c.disabled) throw new Error("That code is not valid");
  if (c.expiresAt && c.expiresAt < Date.now()) throw new Error("That code has expired");
  if (c.uses[u.id]) throw new Error("You already used that code");
  if (c.maxUses && Object.keys(c.uses).length >= c.maxUses) throw new Error("That code has been used up");
  c.uses[u.id] = Date.now();
  const got = c.items.map((i) => ({ ...itemMeta(i.type, i.id), isNew: addItem(u, i.type as ItemType, i.id) }));
  u.freePacks += c.crates;
  if (c.coins) giveCoins(u, c.coins, "Code " + c.code); else saveDb();
  push(u); announceChroma(u, got.filter((i) => i.isNew));
  return { code: c.code, note: c.note, coins: c.coins, crates: c.crates, items: got, balance: u.coins, freePacks: u.freePacks };
}

/* ---------- live events ---------- */
export function pushEventState() { for (const u of onlineUsers()) sendToUser(u.id, { t: "liveevent", event: publicEvent(u) }); }
let startHook: (ev: NonNullable<typeof db.data.event>) => void = () => {};
export const onLiveStart = (fn: (ev: NonNullable<typeof db.data.event>) => void) => { startHook = fn; };
export function startLive(by: string, kind: string, opts: { schedule?: unknown; loop?: boolean; cfg?: any } = {}) {
  const def = EVENTS[kind as keyof typeof EVENTS]; if (!def) throw new Error("Unknown event");
  if (db.data.event) throw new Error("An event is already running. End it first.");
  const sched = cleanSchedule(opts.schedule), schedule = sched.length ? sched : cleanSchedule(EVENT_PRESETS[kind] ?? QUICK_PRESETS[0].sched), c = opts.cfg ?? {};
  const cfg = { bots: Math.max(0, Math.min(30, Math.round(Number(c.bots ?? DEFAULT_CFG.bots)))), loot: ["low", "med", "high"].includes(c.loot) ? c.loot : "med", boss: ["easy", "med", "hard"].includes(c.boss) ? c.boss : "med" };
  const t0 = Date.now() + 16_000; /* the opening cutscene plays first */
  db.data.event = { id: uid(), kind, startedAt: Date.now(), by, points: {}, schedule, phase: 0, phaseStart: t0, phaseEnd: t0 + schedule[0].mins * 60_000, loop: !!opts.loop, cfg, phasePts: {} };
  saveDb(); audit(by, "event.live.start", `${kind} (${schedule.map((p) => p.kind + " " + p.mins + "m").join(", ")})`); startHook(db.data.event);
  broadcast({ t: "event", kind, title: def.name.toUpperCase(), sub: def.blurb, by, live: true });
  setTimeout(pushEventState, 600);
}
let endHook: () => void = () => {};
export const onLiveEnd = (fn: () => void) => { endHook = fn; };
export function endLive(by: string) {
  const ev = db.data.event; if (!ev) throw new Error("No event is running");
  const def = EVENTS[ev.kind as keyof typeof EVENTS], ranked = Object.entries(ev.points).sort((a, b) => b[1] - a[1]);
  let n = 0;
  ranked.forEach(([id, points], place) => {
    const u = db.data.users.find((x) => x.id === id); if (!u || u.banned) return; n++;
    const had = u.inv.tags.includes(def.tag) && u.inv.effects.includes(def.effect); addItem(u, "tag", def.tag); addItem(u, "effect", def.effect);
    const bonus = place === 0 ? 400 : place === 1 ? 250 : place === 2 ? 150 : 0, coins = 100 + Math.min(300, Math.floor(points / 4)) + bonus;
    const crates = 1 + (place === 0 ? 2 : place < 3 ? 1 : 0); u.freePacks += crates;
    const dupe = had ? DUPE_COINS : 0; u.coins += coins + dupe; saveDb(); push(u);
    sendToUser(u.id, { t: "eventend", name: def.name, color: def.color, tag: def.tag, effect: def.effect, coins: coins + dupe, dupe, crates, place: place + 1, points, of: ranked.length });
  });
  endHook(); db.data.event = null; saveDb(); audit(by, "event.live.end", `${ev.kind} (${n} rewarded)`);
  broadcast({ t: "liveevent", event: null });
  return n;
}
/** Called when someone presses Join on the event banner. */
export function joinLive(u: User) { const ev = db.data.event; if (!ev) throw new Error("No event is running"); if (!(u.id in ev.points)) { ev.points[u.id] = 0; stat(u, "events"); } saveDb(); pushEventState(); }

/* ---------- quick events ---------- */
const fx = new Map<string, { kind: string; coins: number; until: number; by: Set<string>; single: boolean }>();
export function quick(by: string, kind: string) {
  if (!QUICK_EVENTS.some((q) => q.id === kind)) throw new Error("Unknown event");
  const online = onlineUsers(), now = Date.now(); let note = "";
  for (const [k, v] of fx) if (v.until < now) fx.delete(k);
  switch (kind) {
    case "coinrain": for (const u of online) giveCoins(u, rint(20, 80), "Coin rain"); broadcast({ t: "fx", kind }); note = `${online.length} players`; break;
    case "meteors": {
      const list = Array.from({ length: 24 }, () => ({ id: uid(), at: rand() * 28, x: 0.05 + rand() * 0.9, coins: rint(5, 15) })).sort((a, b) => a.at - b.at);
      for (const m of list) fx.set(m.id, { kind, coins: m.coins, until: now + 50_000, by: new Set(), single: false });
      broadcast({ t: "fx", kind, meteors: list }); break;
    }
    case "doublexp": case "doublecoins": {
      const k = kind === "doublexp" ? "xp" : "coins"; db.data.boosts = db.data.boosts.filter((b) => b.kind !== k); db.data.boosts.push({ kind: k, until: now + 15 * 60_000 }); saveDb(); broadcast({ t: "boost", boosts: activeBoosts() }); break;
    }
    case "packdrop": for (const u of online) { u.freePacks++; push(u); } saveDb(); broadcast({ t: "fx", kind }); note = `${online.length} players`; break;
    case "jackpot": { if (!online.length) throw new Error("Nobody is online"); const w = online[rint(0, online.length - 1)]; giveCoins(w, 500, "Jackpot!"); broadcast({ t: "fx", kind, winner: w.username, coins: 500 }); note = w.username; break; }
    case "treasure": { const id = uid(); fx.set(id, { kind, coins: 250, until: now + 30_000, by: new Set(), single: true }); broadcast({ t: "fx", kind, id, x: 0.1 + rand() * 0.8, y: 0.15 + rand() * 0.7, ms: 30_000 }); break; }
    case "xpgift": for (const u of online) grant(u, 100, "XP gift"); broadcast({ t: "fx", kind }); note = `${online.length} players`; break;
    case "luckyfive": { if (!online.length) throw new Error("Nobody is online"); const w = [...online].sort(() => rand() - 0.5).slice(0, 5); for (const u of w) giveCoins(u, 150, "Lucky five"); broadcast({ t: "fx", kind, winners: w.map((u) => u.username), coins: 150 }); note = w.map((u) => u.username).join(", "); break; }
    case "mysterybox": for (const u of online) { const c = rint(10, 200); giveCoins(u, c, "Mystery box"); sendToUser(u.id, { t: "fx", kind, coins: c }); } note = `${online.length} players`; break;
    case "cosmeticdrop": for (const u of online) { const it = rollPack({ ...packMap.get("crate")!, count: 1 }, u.inv, rand)[0]; if (!it) continue; if (it.dupe) u.coins += it.refund; else addItem(u, it.type as ItemType, it.id); announceChroma(u, [it]); saveDb(); push(u); sendToUser(u.id, { t: "fx", kind, item: it }); } note = `${online.length} players`; break;
    case "rushall": if (!db.data.event) throw new Error("Start a live event first"); startRush("", 3 * 60_000); broadcast({ t: "fx", kind: "rush", game: "", ms: 180_000 }); pushEventState(); break;
    case "confetti": broadcast({ t: "fx", kind }); break;
    case "zerog": broadcast({ t: "fx", kind, ms: 20_000 }); break;
  }
  audit(by, "event.quick", `${kind} ${note}`.trim());
  return note;
}
export function claim(u: User, id: string) {
  const f = fx.get(id); if (!f || f.until < Date.now()) throw new Error("Too late");
  if (f.by.has(u.id) || (f.single && f.by.size)) throw new Error(f.single ? "Someone was faster" : "Already caught");
  f.by.add(u.id); giveCoins(u, f.coins, f.kind === "treasure" ? "Treasure found" : "Meteor caught");
  return f.coins;
}
export { THEMES, BASE_THEMES };
