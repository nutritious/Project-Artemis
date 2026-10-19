/* Texas Hold'em tables. Friends-only invites. Tables with bots are practice (free chips); tables with only people use real Artemis coins. */
import crypto from "node:crypto";
import type { WebSocket } from "ws";
import { db, saveDb, uid, type User } from "./store.js";
import { areFriends } from "./social.js";
import { newTable, addSeat, canStart, startHand, act, leaveSeat, botMove, view, MAXSEATS, type PTable } from "../public/js/poker-core.js";

interface Ctx { clients: () => Iterable<{ ws: WebSocket; user: User }>; send: (ws: WebSocket, d: unknown) => void }
let X: Ctx;
export const initPoker = (c: Ctx) => { X = c; recover(); };
const rnd = () => crypto.randomInt(0, 1_000_000_000) / 1_000_000_000;
const PRACTICE_STACK = 1000, MIN_BUY = 100, MAX_BUY = 500, TURN_MS = 35_000, NEXT_MS = 6500;

interface Room { t: PTable; buyin: number; invited: Set<string>; timer?: NodeJS.Timeout; next?: NodeJS.Timeout; started: boolean }
const rooms = new Map<string, Room>(), seatOf = new Map<string, string>();
const userById = (id: string) => db.data.users.find((u) => u.id === id && !u.banned);
const toUser = (id: string, d: unknown) => { for (const c of X.clients()) if (c.user.id === id) X.send(c.ws, d); };
const humans = (r: Room) => r.t.seats.filter((s) => !s.bot && !s.left);
const rec = (u: User) => ((u as any).casino ??= { day: "", net: 0 }) as { pk?: number };

/* a restart loses every table, so anyone who was seated at a coin table gets their buy-in back */
function recover() { for (const u of db.data.users) { const c = rec(u); if (c.pk) { u.coins += c.pk; delete c.pk; } } saveDb(); }
const refund = (u: User, amt: number, r: Room) => { if (r.t.practice) return; if (amt > 0) u.coins += amt; const c = rec(u); delete c.pk; saveDb(); if (!seatOf.has(u.id)) toUser(u.id, { t: "pk", table: null, coins: u.coins }); };

function push(r: Room) {
  for (const s of humans(r)) { const u = userById(s.id); toUser(s.id, { t: "pk", table: view(r.t, s.id), coins: u?.coins ?? 0, buyin: r.buyin }); }
}
function clearTimers(r: Room) { clearTimeout(r.timer); clearTimeout(r.next); }
function close(r: Room) { clearTimers(r); rooms.delete(r.t.id); for (const s of r.t.seats) seatOf.delete(s.id); }

function after(r: Room) {
  clearTimeout(r.timer); const t = r.t;
  if (t.phase === "showdown") {
    push(r);
    r.next = setTimeout(() => { if (rooms.get(t.id) === r) begin(r); }, NEXT_MS); return;
  }
  push(r);
  const s = t.seats[t.turn]; if (!s) return;
  if (s.bot) r.timer = setTimeout(() => { if (rooms.get(t.id) !== r || t.seats[t.turn] !== s) return; const [a, am] = botMove(t, s.id, rnd); try { act(t, s.id, a, am); } catch { try { act(t, s.id, "call"); } catch { act(t, s.id, "fold"); } } after(r); }, 800 + rnd() * 1100);
  else r.timer = setTimeout(() => { if (rooms.get(t.id) !== r || t.seats[t.turn] !== s) return; try { act(t, s.id, t.bet > s.bet ? "fold" : "check"); } catch { /* done */ } after(r); }, TURN_MS);
}
function begin(r: Room) {
  clearTimeout(r.next); const t = r.t;
  if (!humans(r).length) return close(r);
  const res = startHand(t, rnd);
  for (const d of res.dropped) if (!d.bot) { const u = userById(d.id); seatOf.delete(d.id); if (u) { refund(u, d.stack, r); toUser(d.id, { t: "pk", table: null, coins: u.coins, busted: d.stack <= 0 && !d.left }); } }
  if (!res.ok) { r.started = false; if (!humans(r).length) return close(r); push(r); return; }
  after(r);
}

export function pokerClose(userId: string) { if (![...X.clients()].some((c) => c.user.id === userId)) leave(userId); }
function leave(userId: string) {
  const id = seatOf.get(userId); const r = id && rooms.get(id); if (!r) return;
  const u = userById(userId), t = r.t, s = t.seats.find((x) => x.id === userId);
  if (s) {
    if (t.phase === "wait" || t.phase === "showdown") { t.seats = t.seats.filter((x) => x.id !== userId); if (u) refund(u, s.stack, r); }
    else { leaveSeat(t, userId); if (u) { const c = rec(u); delete c.pk; } /* mid-hand: the stack that is left is refunded when the hand ends */ r.invited.delete(userId); }
  }
  if (t.phase === "wait" || t.phase === "showdown" || !s || s.left) seatOf.delete(userId);
  if (u) toUser(userId, { t: "pk", table: null, coins: u.coins });
  if (!humans(r).length) { for (const x of t.seats) if (x.left && !x.bot) { const o = userById(x.id); if (o) refund(o, x.stack, r); } return close(r); }
  if (t.host === userId) { const h = humans(r)[0]; if (h) t.host = h.id; }
  after(r);
}

export function pokerMessage(client: { ws: WebSocket; user: User }, me: User, msg: any): boolean {
  const type = String(msg?.t ?? ""); if (!type.startsWith("pk-")) return false;
  const err = (m: string) => X.send(client.ws, { t: "error", message: m });
  try {
    switch (type) {
      case "pk-state": { const r = rooms.get(seatOf.get(me.id) ?? ""); X.send(client.ws, { t: "pk", table: r ? view(r.t, me.id) : null, coins: me.coins, buyin: r?.buyin }); break; }
      case "pk-create": {
        if (seatOf.has(me.id)) throw new Error("You're already at a table");
        const practice = !!msg.practice, buy = Math.floor(Number(msg.buyin));
        if (!practice && !(buy >= MIN_BUY && buy <= MAX_BUY)) throw new Error(`Buy-in is ${MIN_BUY} to ${MAX_BUY} coins`);
        if (!practice && me.coins < buy) throw new Error("Not enough coins");
        const id = uid(), r: Room = { t: newTable({ id, host: me.id, practice }), buyin: practice ? PRACTICE_STACK : buy, invited: new Set(), started: false };
        if (!practice) { me.coins -= buy; rec(me).pk = buy; saveDb(); }
        addSeat(r.t, { id: me.id, name: me.username, stack: r.buyin }); seatOf.set(me.id, id); rooms.set(id, r);
        if (practice) { const names = ["Nova", "Comet", "Rocket", "Pixel", "Orbit"]; const n = Math.max(0, Math.min(4, Math.floor(Number(msg.bots ?? 3)))); for (let i = 0; i < n; i++) addSeat(r.t, { id: "bot-" + id + i, name: names[i] + " (bot)", bot: true, stack: PRACTICE_STACK }); }
        push(r); break;
      }
      case "pk-invite": {
        const r = rooms.get(seatOf.get(me.id) ?? ""); if (!r) throw new Error("Make a table first");
        if (r.t.practice) throw new Error("Practice tables are solo, with bots");
        const f = userById(String(msg.friend)); if (!f || !areFriends(me, f)) throw new Error("You can only invite friends");
        if (seatOf.has(f.id)) throw new Error(`${f.username} is already at a table`);
        if (r.t.seats.length >= MAXSEATS) throw new Error("The table is full");
        r.invited.add(f.id); toUser(f.id, { t: "pk-invite", table: r.t.id, from: me.username, buyin: r.buyin }); X.send(client.ws, { t: "pk-note", message: `Invited ${f.username}` }); break;
      }
      case "pk-join": {
        const r = rooms.get(String(msg.table)); if (!r) throw new Error("That table is gone");
        if (seatOf.has(me.id)) throw new Error("You're already at a table");
        if (!r.invited.has(me.id)) throw new Error("You need an invite from a friend");
        if (r.t.phase !== "wait" && r.t.phase !== "showdown") throw new Error("A hand is in progress. Join when it ends.");
        if (me.coins < r.buyin) throw new Error(`You need ${r.buyin} coins to sit down`);
        me.coins -= r.buyin; rec(me).pk = r.buyin; saveDb(); r.invited.delete(me.id);
        addSeat(r.t, { id: me.id, name: me.username, stack: r.buyin }); seatOf.set(me.id, r.t.id); push(r); break;
      }
      case "pk-start": {
        const r = rooms.get(seatOf.get(me.id) ?? ""); if (!r) throw new Error("No table");
        if (r.t.host !== me.id) throw new Error("Only the host can deal");
        if (r.t.phase !== "wait" && r.t.phase !== "showdown") break;
        if (!canStart(r.t)) throw new Error("Need at least 2 players"); r.started = true; begin(r); break;
      }
      case "pk-act": {
        const r = rooms.get(seatOf.get(me.id) ?? ""); if (!r) throw new Error("No table");
        act(r.t, me.id, String(msg.action), Number(msg.amount)); after(r); break;
      }
      case "pk-leave": leave(me.id); break;
      default: return false;
    }
  } catch (e: any) { err(e.message); }
  return true;
}
