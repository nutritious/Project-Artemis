/* Texas Hold'em engine shared by the server and the browser demo. No-limit, blinds 5/10. Pure state machine; rand() returns [0,1). */
export const SB = 5, BB = 10, MAXSEATS = 6;
const SUITS = ["♠", "♥", "♦", "♣"];
export const RL = { 11: "J", 12: "Q", 13: "K", 14: "A" };
export const rankLabel = (r) => RL[r] ?? String(r);
export const HANDS = ["High card", "Pair", "Two pair", "Three of a kind", "Straight", "Flush", "Full house", "Four of a kind", "Straight flush"];

/* ---- hand ranking ---- */
function rank5(c) {
  const r = c.map((x) => x.r).sort((a, b) => b - a), flush = c.every((x) => x.u === c[0].u);
  const cnt = {}; for (const v of r) cnt[v] = (cnt[v] ?? 0) + 1;
  const groups = Object.entries(cnt).map(([v, n]) => [n, +v]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  let straight = 0; const u = [...new Set(r)];
  if (u.length === 5) { if (u[0] - u[4] === 4) straight = u[0]; else if (u[0] === 14 && u[1] === 5 && u[4] === 2) straight = 5; }
  let cat, ks;
  if (straight && flush) { cat = 8; ks = [straight]; }
  else if (groups[0][0] === 4) { cat = 7; ks = [groups[0][1], groups[1][1]]; }
  else if (groups[0][0] === 3 && groups[1][0] === 2) { cat = 6; ks = [groups[0][1], groups[1][1]]; }
  else if (flush) { cat = 5; ks = r; }
  else if (straight) { cat = 4; ks = [straight]; }
  else if (groups[0][0] === 3) { cat = 3; ks = groups.map((g) => g[1]); }
  else if (groups[0][0] === 2 && groups[1][0] === 2) { cat = 2; ks = groups.map((g) => g[1]); }
  else if (groups[0][0] === 2) { cat = 1; ks = groups.map((g) => g[1]); }
  else { cat = 0; ks = r; }
  let s = cat; for (let i = 0; i < 5; i++) s = s * 15 + (ks[i] ?? 0); return s;
}
export function best(cards) {
  let top = -1; const n = cards.length;
  for (let a = 0; a < n - 4; a++) for (let b = a + 1; b < n - 3; b++) for (let c = b + 1; c < n - 2; c++) for (let d = c + 1; d < n - 1; d++) for (let e = d + 1; e < n; e++) { const s = rank5([cards[a], cards[b], cards[c], cards[d], cards[e]]); if (s > top) top = s; }
  return top;
}
export const catOf = (score) => Math.floor(score / Math.pow(15, 5));

/* ---- table ---- */
export const newTable = (o) => ({ id: o.id, host: o.host, practice: !!o.practice, seats: [], board: [], deck: [], phase: "wait", dealer: -1, turn: -1, bet: 0, minRaise: BB, pot: 0, handNo: 0, result: null, lastAct: "" });
export function addSeat(t, { id, name, bot, stack }) {
  if (t.seats.length >= MAXSEATS) throw new Error("This table is full");
  if (t.seats.some((s) => s.id === id)) throw new Error("Already seated");
  t.seats.push({ id, name, bot: !!bot, stack, cards: [], bet: 0, total: 0, folded: false, allIn: false, acted: false, left: false, tag: "" });
}
const live = (t) => t.seats.filter((s) => !s.folded);
const needs = (t, s) => !s.folded && !s.allIn && (!s.acted || s.bet < t.bet);
function shuffle(rnd) { const d = []; for (let r = 2; r <= 14; r++) for (const u of SUITS) d.push({ r, u }); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; }
function pay(s, amt, t) { const p = Math.min(amt, s.stack); s.stack -= p; s.bet += p; s.total += p; t.pot += p; if (s.stack === 0) s.allIn = true; return p; }
const nextNeeding = (t, from) => { const n = t.seats.length; for (let k = 1; k <= n; k++) { const i = (from + k) % n; if (needs(t, t.seats[i])) return i; } return -1; };

export function canStart(t) { return t.seats.filter((s) => !s.left && s.stack > 0).length >= 2; }
/** Seats that busted or left are dropped between hands. Returns the dropped seats so the server can settle coins. */
export function startHand(t, rnd) {
  const dropped = t.seats.filter((s) => s.left || s.stack <= 0);
  const dealerId = t.seats[t.dealer]?.id;
  t.seats = t.seats.filter((s) => !s.left && s.stack > 0);
  if (t.seats.length < 2) { t.phase = "wait"; t.turn = -1; return { ok: false, dropped }; }
  const di = t.seats.findIndex((s) => s.id === dealerId);
  t.dealer = di < 0 ? Math.min(Math.max(t.dealer, 0), t.seats.length - 1) % t.seats.length : (di + 1) % t.seats.length;
  t.deck = shuffle(rnd); t.board = []; t.pot = 0; t.result = null; t.handNo++; t.lastAct = "";
  for (const s of t.seats) { s.cards = []; s.bet = 0; s.total = 0; s.folded = false; s.allIn = false; s.acted = false; s.tag = ""; }
  const n = t.seats.length, sb = n === 2 ? t.dealer : (t.dealer + 1) % n, bb = n === 2 ? (t.dealer + 1) % n : (t.dealer + 2) % n;
  pay(t.seats[sb], SB, t); pay(t.seats[bb], BB, t); t.seats[sb].tag = "SB"; t.seats[bb].tag = "BB"; t.seats[t.dealer].tag = t.seats[t.dealer].tag ? t.seats[t.dealer].tag + "·D" : "D";
  for (let k = 0; k < 2; k++) for (const s of t.seats) s.cards.push(t.deck.pop());
  t.phase = "preflop"; t.bet = BB; t.minRaise = BB;
  t.turn = nextNeeding(t, n === 2 ? (t.dealer + n - 1) % n : bb);
  if (t.turn < 0) runout(t);
  return { ok: true, dropped };
}
function awardFold(t) { const w = live(t)[0]; const amt = t.pot; w.stack += amt; t.result = { fold: true, winners: { [w.id]: amt }, text: `${w.name} wins ${amt}`, reveal: [] }; t.phase = "showdown"; t.turn = -1; for (const s of t.seats) s.bet = 0; t.pot = 0; }
function showdown(t) {
  const con = live(t), scores = new Map(con.map((s) => [s.id, best([...s.cards, ...t.board])]));
  const levels = [...new Set(con.map((s) => s.total))].sort((a, b) => a - b); let prev = 0; const winners = {};
  for (const L of levels) {
    const pot = t.seats.reduce((a, s) => a + Math.min(s.total, L) - Math.min(s.total, prev), 0); prev = L;
    const elig = con.filter((s) => s.total >= L); if (!elig.length || !pot) continue;
    const top = Math.max(...elig.map((s) => scores.get(s.id))), ws = elig.filter((s) => scores.get(s.id) === top), share = Math.floor(pot / ws.length);
    ws.forEach((s, i) => { const a = share + (i === 0 ? pot - share * ws.length : 0); s.stack += a; winners[s.id] = (winners[s.id] ?? 0) + a; });
  }
  const names = Object.keys(winners).map((id) => t.seats.find((s) => s.id === id));
  t.result = { fold: false, winners, reveal: con.map((s) => ({ id: s.id, cards: s.cards, hand: HANDS[catOf(scores.get(s.id))] })), text: names.map((s) => `${s.name} wins ${winners[s.id]} with ${HANDS[catOf(scores.get(s.id))]}`).join(" · ") };
  t.phase = "showdown"; t.turn = -1; t.pot = 0; for (const s of t.seats) s.bet = 0;
}
function advance(t) {
  for (const s of t.seats) { s.bet = 0; s.acted = false; } t.bet = 0; t.minRaise = BB;
  const next = { preflop: "flop", flop: "turn", turn: "river", river: "showdown" }[t.phase];
  if (next === "showdown") return showdown(t);
  t.phase = next; const k = next === "flop" ? 3 : 1; t.deck.pop(); for (let i = 0; i < k; i++) t.board.push(t.deck.pop());
  t.turn = nextNeeding(t, t.dealer);
  if (t.turn < 0 || t.seats.filter((s) => needs(t, s)).length < 2 && t.seats.every((s) => !needs(t, s) || false)) runout(t);
  else if (t.seats.filter((s) => !s.folded && !s.allIn).length < 2) runout(t);
}
function runout(t) { while (t.phase !== "showdown") advance(t); }
export function toCall(t, id) { const s = t.seats.find((x) => x.id === id); return s ? Math.max(0, Math.min(t.bet - s.bet, s.stack)) : 0; }
/** action: fold | check | call | raise (amount = total bet to raise TO) | allin */
export function act(t, id, action, amount) {
  const i = t.seats.findIndex((s) => s.id === id); if (i < 0 || i !== t.turn || t.phase === "wait" || t.phase === "showdown") throw new Error("It's not your turn");
  const s = t.seats[i];
  if (action === "fold") { s.folded = true; t.lastAct = `${s.name} folds`; }
  else if (action === "check") { if (s.bet < t.bet) throw new Error("You have to call or fold"); s.acted = true; t.lastAct = `${s.name} checks`; }
  else if (action === "call") { const p = pay(s, t.bet - s.bet, t); s.acted = true; t.lastAct = p ? `${s.name} calls ${p}` : `${s.name} checks`; }
  else if (action === "raise" || action === "allin") {
    const max = s.bet + s.stack; let to = action === "allin" ? max : Math.floor(+amount);
    if (!Number.isFinite(to)) throw new Error("Pick an amount");
    to = Math.min(to, max);
    if (to <= t.bet) { pay(s, t.bet - s.bet, t); s.acted = true; t.lastAct = `${s.name} calls${s.allIn ? " all-in" : ""}`; }
    else {
      if (to < t.bet + t.minRaise && to < max) throw new Error(`Minimum raise is to ${t.bet + t.minRaise}`);
      const size = to - t.bet; if (size >= t.minRaise) t.minRaise = size;
      pay(s, to - s.bet, t); t.bet = to; for (const o of t.seats) if (o !== s && !o.folded && !o.allIn) o.acted = false; s.acted = true;
      t.lastAct = `${s.name} ${s.allIn ? "goes all-in" : "raises"} to ${to}`;
    }
  } else throw new Error("Unknown move");
  if (live(t).length === 1) return awardFold(t);
  const nx = nextNeeding(t, i);
  if (nx < 0) { if (t.seats.filter((x) => !x.folded && !x.allIn).length < 2) runout(t); else advance(t); } else t.turn = nx;
}

/* ---- bots ---- */
function strength(t, s) {
  const [a, b] = s.cards; if (!t.board.length) {
    const hi = Math.max(a.r, b.r), lo = Math.min(a.r, b.r); let v = a.r === b.r ? 0.5 + (a.r - 2) / 24 : (hi + lo) / 40 + (hi === 14 ? 0.12 : 0) + (a.u === b.u ? 0.05 : 0) + (hi - lo <= 2 ? 0.04 : 0);
    return Math.min(0.97, v);
  }
  const sc = best([...s.cards, ...t.board]), cat = catOf(sc), boardCat = t.board.length >= 3 ? catOf(best([...t.board, ...t.board].slice(0, 5).length >= 5 ? t.board : [...t.board, ...t.board])) : 0;
  if (cat > boardCat) return Math.min(0.98, [0.3, 0.55, 0.75, 0.82, 0.88, 0.92, 0.96, 0.98, 0.99][cat]);
  return 0.18 + Math.max(a.r, b.r) / 60;
}
export function botMove(t, id, rnd) {
  const s = t.seats.find((x) => x.id === id), call = toCall(t, id), st = strength(t, s) + (rnd() - 0.5) * 0.14;
  const bluff = rnd() < 0.07, pot = Math.max(t.pot, BB * 2);
  if (st > 0.74 || bluff) { const to = Math.floor(t.bet + Math.max(t.minRaise, pot * (0.4 + rnd() * 0.5))); if (s.stack + s.bet > to && rnd() < 0.85) return ["raise", to]; return call > 0 ? ["call"] : ["check"]; }
  if (st > 0.46) return call > s.stack * 0.35 && st < 0.6 ? ["fold"] : call > 0 ? ["call"] : ["check"];
  if (call === 0) return ["check"];
  if (call <= BB && st > 0.34 && rnd() < 0.6) return ["call"];
  return ["fold"];
}

/** A player leaves mid-hand: they fold and forfeit what they put in. Between hands the seat is just removed by the caller. */
export function leaveSeat(t, id) {
  const i = t.seats.findIndex((s) => s.id === id); if (i < 0) return; const s = t.seats[i]; s.left = true;
  if (t.phase === "wait" || t.phase === "showdown" || s.folded) return;
  if (i === t.turn) return act(t, id, "fold");
  s.folded = true; t.lastAct = `${s.name} left the table`;
  if (live(t).length === 1) return awardFold(t);
  if (t.seats.every((x) => !needs(t, x))) { if (t.seats.filter((x) => !x.folded && !x.allIn).length < 2) runout(t); else advance(t); }
}

/** What a player may see. Other players' cards stay face down until a showdown reveals them. */
export function view(t, forId) {
  const rev = new Set((t.result?.reveal ?? []).map((r) => r.id));
  return { id: t.id, host: t.host, practice: t.practice, phase: t.phase, board: t.board, pot: t.pot, bet: t.bet, minRaise: t.minRaise, handNo: t.handNo, turn: t.seats[t.turn]?.id ?? null, dealer: t.seats[t.dealer]?.id ?? null, lastAct: t.lastAct, result: t.result,
    seats: t.seats.map((s) => ({ id: s.id, name: s.name, bot: s.bot, stack: s.stack, bet: s.bet, folded: s.folded, allIn: s.allIn, left: s.left, tag: s.tag, cards: s.id === forId || (t.phase === "showdown" && rev.has(s.id)) ? s.cards : s.cards.length && !s.folded ? [null, null] : [] })),
    toCall: toCall(t, forId) };
}
