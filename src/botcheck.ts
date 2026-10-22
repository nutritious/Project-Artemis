/* A bot check that only appears when someone's behaviour looks automated. Real people on a normal connection never see it.
   Signals: a hidden field that only bots fill in, a form sent faster than a person can type, a command-line or headless client,
   and repeated failures, wrong invite codes or sign ups from the same address. */
import crypto from "node:crypto";

const hits = { fail: new Map<string, number[]>(), reg: new Map<string, number[]>() };
const recent = (m: Map<string, number[]>, ip: string, ms: number) => { const now = Date.now(), a = (m.get(ip) ?? []).filter((t) => now - t < ms); m.set(ip, a); return a; };
export const noteFail = (ip: string) => { recent(hits.fail, ip, 15 * 60_000).push(Date.now()); };
export const noteReg = (ip: string) => { recent(hits.reg, ip, 60 * 60_000).push(Date.now()); };
const clean = (m: Map<string, number[]>) => { if (m.size > 5000) m.clear(); };

export function risk(o: { ip: string; ua: string; ft?: number; badInvites?: number }) {
  clean(hits.fail); clean(hits.reg);
  let s = 0;
  if (typeof o.ft !== "number" || o.ft < 1500) s += 3;                                   /* sent faster than a person can type (or not from our page at all) */
  if (!o.ua || /curl|wget|python|httpclient|axios|node-fetch|go-http|java\/|scrapy|headless|phantom|selenium|puppeteer|playwright/i.test(o.ua)) s += 3;
  if (recent(hits.fail, o.ip, 15 * 60_000).length >= 3) s += 3;                          /* a run of failures */
  if (recent(hits.reg, o.ip, 60 * 60_000).length >= 2) s += 3;                           /* several sign ups from one address */
  if ((o.badInvites ?? 0) >= 2) s += 3;
  return s;
}
export const NEEDS_CHECK = 3;

/* ---- the challenge: tap every picture of a kind of thing. One use, two minutes, must take a moment to answer. ---- */
const SETS: { name: string; good: string[] }[] = [
  { name: "animals", good: ["🐶", "🐱", "🐸", "🦊", "🐼", "🐧", "🐢", "🦉"] },
  { name: "foods", good: ["🍕", "🍔", "🍎", "🍌", "🍩", "🍪", "🍇", "🌮"] },
  { name: "vehicles", good: ["🚗", "🚀", "🚲", "✈️", "🚂", "⛵", "🚁", "🛵"] },
  { name: "sports gear", good: ["⚽", "🏀", "🏈", "🎾", "🏐", "🏓", "🥊", "⛳"] },
];
const ALL = SETS.flatMap((s) => s.good);
const open = new Map<string, { answer: number[]; exp: number; at: number }>();
const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function newChallenge() {
  if (open.size > 3000) open.clear();
  const set = SETS[crypto.randomInt(SETS.length)], good = shuffle([...set.good]).slice(0, 3 + crypto.randomInt(2));
  const others = shuffle(ALL.filter((e) => !set.good.includes(e))).slice(0, 9 - good.length);
  const tiles = shuffle([...good, ...others]), answer = tiles.map((t, i) => (good.includes(t) ? i : -1)).filter((i) => i >= 0);
  const id = crypto.randomBytes(12).toString("hex"); open.set(id, { answer, exp: Date.now() + 120_000, at: Date.now() });
  return { id, prompt: `Tap every one of the ${set.name}, then press the button again.`, tiles };
}
export function checkChallenge(id: unknown, picks: unknown) {
  const c = open.get(String(id ?? "")); open.delete(String(id ?? ""));
  if (!c || c.exp < Date.now() || Date.now() - c.at < 1200 || !Array.isArray(picks)) return false;
  const p = [...new Set(picks.map(Number))].sort((a, b) => a - b), a = [...c.answer].sort((x, y) => x - y);
  return p.length === a.length && p.every((v, i) => v === a[i]);
}
