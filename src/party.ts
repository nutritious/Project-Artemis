/* The live-event party: timed rounds (trivia, word scramble, reaction race, this-or-that) plus an auto-host that keeps the show going. */
import crypto from "node:crypto";
import { audit, db, type User } from "./store.js";
import { broadcast, onlineUsers, sendToUser } from "./chat.js";
import { addEventPoints, giveCoins, onEventExtra, startRush, stat } from "./game.js";
import { onLiveEnd, pushEventState, quick } from "./economy.js";
import { POLLS, TRIVIA, WORDS } from "./party-data.js";

const rand = () => crypto.randomInt(0, 1_000_000_000) / 1_000_000_000;
const rint = (a: number, b: number) => Math.floor(a + rand() * (b - a + 1));
const shuffle = <T>(a: T[]) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = rint(0, i); [r[i], r[j]] = [r[j], r[i]]; } return r; };
export const ROUND_KINDS = ["trivia", "scramble", "reaction", "poll"] as const;
type Kind = (typeof ROUND_KINDS)[number];
interface Ans { t: number; v: unknown; pts: number; ok?: boolean; ms?: number }
interface Round { id: string; kind: Kind; title: string; prompt: string; options?: string[]; correct?: number; word?: string; startedAt: number; endsAt: number; goAt?: number; armed?: boolean; answers: Map<string, Ans>; endTimer?: NodeJS.Timeout; early?: boolean }

let cur: Round | null = null, auto = false, autoTimer: NodeJS.Timeout | undefined, step = 0;
const usedQ = new Set<number>(), usedW = new Set<number>(), usedP = new Set<number>();
const DUR: Record<Kind, number> = { trivia: 15_000, scramble: 30_000, reaction: 0, poll: 20_000 };
const TITLE: Record<Kind, string> = { trivia: "Trivia", scramble: "Word scramble", reaction: "Reaction race", poll: "This or that" };
/** What the director cycles through. A cycle is about eight minutes. */
const PLAYLIST = ["trivia", "trivia", "trivia", "scramble", "reaction", "poll", "rush", "trivia", "trivia", "scramble", "reaction", "meteors", "trivia", "trivia", "trivia", "poll", "reaction", "luckyfive", "scramble", "mysterybox", "poll", "trivia", "reaction", "treasure", "trivia", "scramble", "cosmeticdrop", "poll"];

const pick = (n: number, used: Set<number>) => { if (used.size >= n) used.clear(); let i; do i = rint(0, n - 1); while (used.has(i)); used.add(i); return i; };
const ev = () => { const e = db.data.event; if (!e) throw new Error("No event is running"); return e; };

function pub(r: Round, u?: User) {
  const a = u ? r.answers.get(u.id) : undefined;
  return { id: r.id, kind: r.kind, title: r.title, prompt: r.prompt, options: r.options, len: r.word?.length, startedAt: r.startedAt, endsAt: r.endsAt, go: !!r.armed, answered: !!a, pts: a?.pts ?? 0, ok: a?.ok };
}
onEventExtra((u) => ({ round: cur ? pub(cur, u) : null, auto }));
onLiveEnd(() => { stopParty(); });

export function startRound(by: string, kind: string) {
  ev();
  if (cur) throw new Error("A round is already running");
  if (!ROUND_KINDS.includes(kind as Kind)) throw new Error("Unknown round");
  const k = kind as Kind, now = Date.now(), r: Round = { id: crypto.randomUUID(), kind: k, title: TITLE[k], prompt: "", startedAt: now, endsAt: now + (DUR[k] || 12_000), answers: new Map() };
  if (k === "trivia") { const [q, ok, ...bad] = TRIVIA[pick(TRIVIA.length, usedQ)]; r.prompt = q; r.options = shuffle([ok, ...bad]); r.correct = r.options.indexOf(ok); }
  if (k === "scramble") { const [w, hint] = WORDS[pick(WORDS.length, usedW)]; r.word = w; let s = w; for (let i = 0; i < 10 && s === w; i++) s = shuffle([...w]).join(""); r.prompt = s; r.options = [hint]; }
  if (k === "poll") { const [a, b] = POLLS[pick(POLLS.length, usedP)]; r.prompt = "Which would you pick?"; r.options = [a, b]; }
  if (k === "reaction") {
    r.prompt = "Wait for green… then tap!"; r.goAt = now + rint(2500, 6000); r.endsAt = r.goAt + 4000;
    setTimeout(() => { if (cur === r) { r.armed = true; r.goAt = Date.now(); broadcast({ t: "roundgo", id: r.id }); } }, r.goAt - now);
  }
  cur = r; r.endTimer = setTimeout(() => endRound(r), r.endsAt - now + 80);
  for (const u of onlineUsers()) sendToUser(u.id, { t: "round", round: pub(r, u) });
  audit(by, "event.round", k);
}

export function answer(u: User, id: string, v: unknown) {
  const r = cur, now = Date.now();
  if (!r || r.id !== id || now > r.endsAt + 150) throw new Error("That round is over");
  const e = ev(); e.points[u.id] ??= 0;
  let a = r.answers.get(u.id);
  if (r.kind === "trivia") {
    if (a) throw new Error("Already answered");
    const ok = v === r.correct, pts = ok ? 100 + Math.round((100 * (r.endsAt - now)) / (r.endsAt - r.startedAt)) : 0;
    r.answers.set(u.id, { t: now, v, pts, ok }); if (ok) stat(u, "trivia"); if (pts) addEventPoints(u, pts); maybeEarly(r);
    return { ok, pts, correct: r.correct };
  }
  if (r.kind === "scramble") {
    if (a?.ok) throw new Error("You already got it");
    if (String(v ?? "").trim().toUpperCase() !== r.word) return { ok: false, pts: 0 };
    const rank = [...r.answers.values()].filter((x) => x.ok).length, pts = Math.max(50, 200 - 25 * rank);
    r.answers.set(u.id, { t: now, v, pts, ok: true }); addEventPoints(u, pts); maybeEarly(r);
    return { ok: true, pts };
  }
  if (r.kind === "reaction") {
    if (a) throw new Error("One tap per round");
    if (!r.armed || now < (r.goAt ?? 0)) { r.answers.set(u.id, { t: now, v, pts: 0, ok: false }); return { ok: false, falseStart: true }; }
    const ms = now - (r.goAt ?? now); r.answers.set(u.id, { t: now, v, pts: 0, ok: true, ms }); maybeEarly(r);
    return { ok: true, ms };
  }
  if (a) throw new Error("Already voted");
  const side = v === 1 ? 1 : 0; r.answers.set(u.id, { t: now, v: side, pts: 25, ok: true }); addEventPoints(u, 25); maybeEarly(r);
  return { ok: true, pts: 25 };
}
/** When everyone online has answered, wrap the round up a moment later instead of waiting for the clock. */
function maybeEarly(r: Round) {
  if (r.early || r.kind === "scramble" || r.kind === "reaction" && !r.armed) return;
  const online = onlineUsers().length;
  if (online > 0 && r.answers.size >= online) { r.early = true; clearTimeout(r.endTimer); r.endTimer = setTimeout(() => endRound(r), 1400); }
}

function endRound(r: Round) {
  if (cur !== r) return;
  clearTimeout(r.endTimer); cur = null;
  const name = (id: string) => db.data.users.find((x) => x.id === id)?.username ?? "?";
  let board: { username: string; pts: number; note?: string }[] = [], answerText = "", counts: number[] | undefined;
  const coinsFor = new Map<string, number>();
  if (r.kind === "trivia") { answerText = r.options![r.correct!]; board = [...r.answers].filter(([, a]) => a.ok).sort((x, y) => x[1].t - y[1].t).slice(0, 5).map(([id, a]) => ({ username: name(id), pts: a.pts })); for (const [id, a] of r.answers) if (a.ok) coinsFor.set(id, 5); }
  if (r.kind === "scramble") { answerText = r.word!; board = [...r.answers].filter(([, a]) => a.ok).sort((x, y) => x[1].t - y[1].t).slice(0, 5).map(([id, a]) => ({ username: name(id), pts: a.pts })); }
  if (r.kind === "reaction") {
    const fast = [...r.answers].filter(([, a]) => a.ok && a.ms != null).sort((x, y) => x[1].ms! - y[1].ms!);
    fast.forEach(([id, a], i) => { a.pts = [200, 150, 100, 75, 50][i] ?? 25; const u = db.data.users.find((x) => x.id === id); if (u) addEventPoints(u, a.pts); });
    board = fast.slice(0, 5).map(([id, a]) => ({ username: name(id), pts: a.pts, note: `${a.ms} ms` })); answerText = fast[0] ? `${name(fast[0][0])} · ${fast[0][1].ms} ms` : "Nobody tapped in time";
  }
  if (r.kind === "poll") { counts = [0, 0]; for (const a of r.answers.values()) counts[a.v === 1 ? 1 : 0]++; answerText = counts[0] === counts[1] ? "It's a tie!" : `${r.options![counts[0] > counts[1] ? 0 : 1]} wins`; }
  if (r.kind !== "poll") board.slice(0, 3).forEach((b, i) => { const u = db.data.users.find((x) => x.username === b.username); if (u) coinsFor.set(u.id, (coinsFor.get(u.id) ?? 0) + [30, 20, 10][i]); });
  for (const [id, c] of coinsFor) { const u = db.data.users.find((x) => x.id === id); if (u) giveCoins(u, c, r.title); }
  for (const u of onlineUsers()) {
    const a = r.answers.get(u.id), place = board.findIndex((b) => b.username === u.username);
    sendToUser(u.id, { t: "roundend", id: r.id, kind: r.kind, title: r.title, answer: answerText, board, counts, options: r.kind === "poll" ? r.options : undefined, mine: { answered: !!a, ok: !!a?.ok, pts: a?.pts ?? 0, place: place < 0 ? 0 : place + 1, coins: coinsFor.get(u.id) ?? 0, vote: r.kind === "poll" ? a?.v : undefined } });
  }
  pushEventState();
  if (auto) scheduleNext(9000);
}
export function skipRound(by: string) { if (!cur) throw new Error("No round is running"); audit(by, "event.round.skip", cur.kind); endRound(cur); }

/* ---------- auto-host ---------- */
function scheduleNext(ms: number) { clearTimeout(autoTimer); autoTimer = setTimeout(runNext, ms); }
function runNext() {
  if (!auto || !db.data.event) return;
  if (cur) return void scheduleNext(3000);
  const k = PLAYLIST[step++ % PLAYLIST.length];
  try {
    if (k === "rush") { const g = ["run", "blaster", "lander", "snake"][rint(0, 3)]; startRush(g, 3 * 60_000); broadcast({ t: "fx", kind: "rush", game: g, ms: 180_000 }); pushEventState(); scheduleNext(5000); return; }
    if (["meteors", "jackpot", "xpgift", "luckyfive", "mysterybox", "cosmeticdrop", "treasure"].includes(k)) { quick("auto-host", k); scheduleNext(12_000); return; }
    startRound("auto-host", k);
  } catch { scheduleNext(8000); }
}
export function setAuto(by: string, on: boolean, delay = 4000) {
  ev(); auto = on; clearTimeout(autoTimer); audit(by, "event.auto", on ? "on" : "off");
  if (on && !cur) scheduleNext(delay);
  pushEventState();
}
export function startRushNow(by: string, game: string) { ev(); startRush(game, 3 * 60_000); broadcast({ t: "fx", kind: "rush", game, ms: 180_000 }); pushEventState(); audit(by, "event.rush", game); }
export function stopParty() { auto = false; clearTimeout(autoTimer); if (cur) { clearTimeout(cur.endTimer); cur = null; } step = 0; broadcast({ t: "roundstop" }); }
export const partyState = () => ({ auto, round: cur ? { kind: cur.kind, title: cur.title, endsAt: cur.endsAt } : null });
