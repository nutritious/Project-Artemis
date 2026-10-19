/* Casino: coin flip, slots, roulette and blackjack. Artemis coins only (no real money), with a bet cap and a daily loss limit. */
import crypto from "node:crypto";
import { saveDb, type User } from "./store.js";
import { sendToUser } from "./chat.js";
import { CAS, flip, slots, roulette, rouletteKindOk, bjDeal, bjHit, bjStand, bjDouble, bjView, type BjState } from "../public/js/casino-core.js";

const rnd = () => crypto.randomInt(0, 1_000_000_000) / 1_000_000_000;
const day = () => new Date().toISOString().slice(0, 10);
const last = new Map<string, number>();
type Cas = { day: string; net: number; bj?: BjState };
const rec = (u: User): Cas => { const c = ((u as any).casino ??= { day: day(), net: 0 }) as Cas; if (c.day !== day()) { c.day = day(); c.net = 0; } return c; };
const sync = (u: User) => sendToUser(u.id, { t: "coins", coins: u.coins });
const fail = (m: string) => { throw new Error(m); };

function stake(u: User, raw: unknown) {
  const bet = Math.floor(Number(raw));
  if (!Number.isFinite(bet) || bet < CAS.MIN || bet > CAS.MAX) fail(`Bets are ${CAS.MIN} to ${CAS.MAX} coins`);
  if (u.coins < bet) fail("Not enough coins");
  const now = Date.now(); if (now - (last.get(u.id) ?? 0) < CAS.GAP) fail("Slow down a little");
  last.set(u.id, now); return bet;
}
function pay(u: User, bet: number, payout: number) { u.coins += payout - bet; rec(u).net += payout - bet; saveDb(); sync(u); }

export const casinoState = (u: User) => ({ min: CAS.MIN, max: CAS.MAX, coins: u.coins, bj: rec(u).bj ? bjView(rec(u).bj!) : null });

export function casinoPlay(u: User, game: string, b: any) {
  const c = rec(u);
  if (game === "flip") { if (c.bj) fail("Finish your blackjack hand first"); const bet = stake(u, b.bet), side = b.side === "tails" ? "tails" : "heads"; const r = flip(bet, side, rnd); pay(u, bet, r.payout); return { ...r, coins: u.coins }; }
  if (game === "slots") { if (c.bj) fail("Finish your blackjack hand first"); const bet = stake(u, b.bet); const r = slots(bet, rnd); pay(u, bet, r.payout); return { ...r, coins: u.coins }; }
  if (game === "roulette") { if (c.bj) fail("Finish your blackjack hand first"); const num = Math.floor(Number(b.num)), kind = String(b.kind ?? ""); if (!rouletteKindOk(kind, num)) fail("Pick a bet"); const bet = stake(u, b.bet); const r = roulette(bet, kind, num, rnd); pay(u, bet, r.payout); return { ...r, coins: u.coins }; }
  if (game === "bj") {
    const act = String(b.act ?? "");
    if (act === "deal") {
      if (c.bj) fail("You already have a hand going");
      const bet = stake(u, b.bet); u.coins -= bet; c.net -= bet; const st = bjDeal(bet, rnd);
      if (st.done) { u.coins += st.payout ?? 0; c.net += st.payout ?? 0; } else c.bj = st;
      saveDb(); sync(u); return { bj: bjView(st), coins: u.coins };
    }
    const st = c.bj; if (!st) fail("No hand in play");
    let s = st!;
    if (act === "hit") s = bjHit(s, rnd);
    else if (act === "stand") s = bjStand(s, rnd);
    else if (act === "double") { if (s.player.length !== 2) fail("You can only double on your first move"); if (u.coins < s.bet) fail("Not enough coins to double"); const extra = s.bet; u.coins -= extra; c.net -= extra; s = bjDouble(s, rnd); }
    else fail("Unknown move");
    if (s.done) { u.coins += s.payout ?? 0; c.net += s.payout ?? 0; delete c.bj; } else c.bj = s;
    saveDb(); sync(u); return { bj: bjView(s), coins: u.coins };
  }
  return fail("Unknown game");
}
