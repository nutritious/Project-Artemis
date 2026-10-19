/* Casino rules shared by the server and the browser demo. Artemis coins only, no real money. Every function takes a rand() returning [0,1). */
export const CAS = { MIN: 10, MAX: 500, GAP: 700 };

/* ---- coin flip: 1.96x ---- */
export function flip(bet, side, rnd) {
  const out = rnd() < 0.5 ? "heads" : "tails", win = out === side;
  return { out, win, payout: win ? Math.floor(bet * 1.96) : 0 };
}

/* ---- slots: 3 reels ---- */
export const SYMS = [
  { s: "🍒", w: 30, x3: 5 }, { s: "🍋", w: 24, x3: 8 }, { s: "🔔", w: 18, x3: 14 },
  { s: "⭐", w: 12, x3: 25 }, { s: "💎", w: 6, x3: 50 }, { s: "7️⃣", w: 2.2, x3: 120 },
];
const TOTAL_W = SYMS.reduce((a, b) => a + b.w, 0);
const pickSym = (rnd) => { let r = rnd() * TOTAL_W; for (const y of SYMS) { r -= y.w; if (r < 0) return y; } return SYMS[0]; };
export function slotsMult(r) {
  if (r[0].s === r[1].s && r[1].s === r[2].s) return r[0].x3;
  const ch = r.filter((y) => y.s === "🍒").length;
  return ch === 2 ? 1.2 : ch === 1 ? 0.5 : 0;
}
export function slots(bet, rnd) {
  const r = [pickSym(rnd), pickSym(rnd), pickSym(rnd)], mult = slotsMult(r);
  return { reels: r.map((y) => y.s), mult, win: mult > 0, payout: Math.floor(bet * mult) };
}

/* ---- roulette: single zero ---- */
export const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = (n) => (n === 0 ? "green" : REDS.has(n) ? "red" : "black");
export function roulette(bet, kind, num, rnd) {
  const n = Math.floor(rnd() * 37), col = colorOf(n);
  let win = false, mult = 2;
  if (kind === "red" || kind === "black") win = col === kind;
  else if (kind === "odd") win = n > 0 && n % 2 === 1;
  else if (kind === "even") win = n > 0 && n % 2 === 0;
  else if (kind === "low") win = n >= 1 && n <= 18;
  else if (kind === "high") win = n >= 19;
  else if (kind === "number") { win = n === num; mult = 36; }
  return { n, color: col, win, payout: win ? bet * mult : 0 };
}
export const rouletteKindOk = (kind, num) => ["red", "black", "odd", "even", "low", "high"].includes(kind) || (kind === "number" && Number.isInteger(num) && num >= 0 && num <= 36);

/* ---- blackjack: dealer stands on 17, blackjack pays 3:2, infinite shoe ---- */
const SUITS = ["♠", "♥", "♦", "♣"];
const card = (rnd) => ({ r: 1 + Math.floor(rnd() * 13), u: SUITS[Math.floor(rnd() * 4)] });
export const cval = (c) => (c.r === 1 ? 11 : Math.min(10, c.r));
export function total(hand) { let t = hand.reduce((a, c) => a + cval(c), 0), aces = hand.filter((c) => c.r === 1).length; while (t > 21 && aces-- > 0) t -= 10; return t; }
const isBj = (h) => h.length === 2 && total(h) === 21;
function settle(st) {
  const p = total(st.player); let d = total(st.dealer);
  if (p > 21) { st.result = "bust"; st.payout = 0; }
  else if (st.natural) { st.result = "blackjack"; st.payout = Math.floor(st.bet * 2.5); }
  else if (d > 21) { st.result = "win"; st.payout = st.bet * 2; }
  else if (p > d) { st.result = "win"; st.payout = st.bet * 2; }
  else if (p === d) { st.result = "push"; st.payout = st.bet; }
  else { st.result = "lose"; st.payout = 0; }
  st.done = true; return st;
}
function dealerPlay(st, rnd) { while (total(st.dealer) < 17) st.dealer.push(card(rnd)); return settle(st); }
export function bjDeal(bet, rnd) {
  const st = { bet, player: [card(rnd), card(rnd)], dealer: [card(rnd), card(rnd)], done: false, doubled: false, natural: false };
  const pb = isBj(st.player), db = isBj(st.dealer);
  if (pb || db) { st.natural = pb && !db; if (pb && db) { st.result = "push"; st.payout = st.bet; st.done = true; return st; } if (db) { st.result = "lose"; st.payout = 0; st.done = true; return st; } return settle(st); }
  return st;
}
export function bjHit(st, rnd) { st.player.push(card(rnd)); if (total(st.player) > 21) return settle(st); if (total(st.player) === 21) return dealerPlay(st, rnd); return st; }
export const bjStand = (st, rnd) => dealerPlay(st, rnd);
export function bjDouble(st, rnd) { st.bet *= 2; st.doubled = true; st.player.push(card(rnd)); return total(st.player) > 21 ? settle(st) : dealerPlay(st, rnd); }
/** What the player may see: the dealer's second card stays hidden until the hand ends. */
export const bjView = (st) => ({ bet: st.bet, player: st.player, dealer: st.done ? st.dealer : [st.dealer[0]], hidden: !st.done, done: st.done, result: st.result, payout: st.payout ?? 0, doubled: !!st.doubled, pt: total(st.player), dt: st.done ? total(st.dealer) : cval(st.dealer[0]) });
