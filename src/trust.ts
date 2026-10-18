/* Trusted members: 300+ messages, no ban in the last 14 days, 3+ hours on the proxy. The owner can grant or revoke by hand. */
import { db, type User } from "./store.js";
import { rank } from "./perms.js";

export const TRUST = { msgs: 300, banFreeDays: 14, proxyHours: 3, ageDays: 10 };
const DAY = 864e5;
export function trustInfo(u: User) {
  const msgs = u.game.stats.msgs ?? 0, proxyHours = (u.proxyMs ?? 0) / 36e5;
  const sinceBan = u.lastBanAt ? (Date.now() - u.lastBanAt) / DAY : Infinity;
  const ageDays = Math.floor((Date.now() - u.createdAt) / DAY);
  const met = { msgs: msgs >= TRUST.msgs, ban: sinceBan >= TRUST.banFreeDays, proxy: proxyHours >= TRUST.proxyHours, age: ageDays >= TRUST.ageDays };
  const earned = met.msgs && met.ban && met.proxy && met.age;
  const staff = rank(u) < 100;
  return { msgs, ageDays, proxyHours: Math.round(proxyHours * 10) / 10, banFreeDays: sinceBan === Infinity ? null : Math.floor(sinceBan), met, earned, manual: u.trust ?? null, staff, trusted: staff || u.trust === "grant" || (u.trust !== "revoke" && earned), need: TRUST };
}
export const isTrusted = (u: User) => trustInfo(u).trusted;

/** Proxy time: each proxied request counts the gap since the last one, up to 2 minutes. */
export function accrueProxy(u: User) {
  const now = Date.now(), gap = u.lastProxy ? Math.min(now - u.lastProxy, 120_000) : 0;
  u.proxyMs = (u.proxyMs ?? 0) + gap; u.lastProxy = now;
}
const last = new Map<string, boolean>();
let hook: (u: User, now: boolean) => void = () => {};
export const onTrust = (fn: (u: User, now: boolean) => void) => { hook = fn; };
/** Call after anything that could change trust. Fires the hook when the state flips. */
export function checkTrust(u: User) {
  const t = isTrusted(u), was = last.get(u.id);
  last.set(u.id, t);
  if (was !== undefined && was !== t) hook(u, t);
}
export const canSeeChannel = (u: User, c: { trusted?: boolean }) => !c.trusted || isTrusted(u);
export const gifUrl = /https?:\/\/\S*(\.gif(\?\S*)?(\s|$)|giphy\.com|tenor\.com)/i;
void db;
