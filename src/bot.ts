/* ArtemisBot: optional chat moderator. Only watches crew and custom roles, never Commanders, Co-owners or the Owner. */
import { db, saveDb, uid, type Message, type User } from "./store.js";
import { TOP_TIERS } from "./perms.js";

/* default word lists are stored lightly encoded so this file is not a wall of slurs */
const d = (s: string) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
const SEVERE = ['phag', 'avtt', 'sntt', 'ergneq', 'xvyy lbhefrys'].map(d);
const MILD = ['shpx', 'fuvg', 'ovgpu', 'nffubyr', 'qvpxurnq'].map(d);
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };
const norm = (t: string) => t.toLowerCase().replace(/[01345 7@$!]/g, (c) => LEET[c] ?? c).replace(/\b(?:[a-z][\s.\-_*]+){2,}[a-z]\b/g, (m) => m.replace(/[^a-z]/g, "")).replace(/[^a-z\s]/g, "").replace(/(.)\1{2,}/g, "$1$1");
const squash = (t: string) => norm(t).replace(/\s+/g, "");
const hit = (text: string, list: string[], deep = false) => { const n = norm(text), sq = squash(text); return list.find((w) => { const x = w.toLowerCase().replace(/[^a-z\s]/g, ""); return x && (x.includes(" ") ? n.includes(x) : new RegExp(`(^|\\s)${x}`).test(n) || (deep && x.length >= 4 && !x.includes(" ") && sq.includes(x))); }); };

const cfg = () => db.data.server.bot!;
export const watched = (u: User) => !TOP_TIERS.includes(u.role);
const say = (channel: string, text: string): Message => {
  const m: Message = { id: uid(), channel, userId: "bot", username: "ArtemisBot", text, ts: Date.now() };
  db.data.messages.push(m); return m;
};
/** A permanent bot post in a channel (used for server-wide news like a new Legend). */
export const post = (channel: string, text: string): Message => say(channel, text);
const log = (user: string, action: string, why: string) => { const c = cfg(); c.log.unshift({ ts: Date.now(), user, action, why }); c.log.length = Math.min(c.log.length, 40); };

export interface Verdict { block: boolean; reply?: Message; ban?: boolean }
/** Checks a message before it posts. */
export function moderate(u: User, text: string, channel: string): Verdict {
  const c = cfg(); if (!c.enabled || !watched(u)) return { block: false };
  const custom = c.words.map((w) => w.toLowerCase());
  const severe = hit(text, [...SEVERE, ...custom], true), mild = !severe && hit(text, MILD);
  if (!severe && !mild) return { block: false };
  const bad = !!severe;
  const strikes = (c.strikesBy[u.id] = (c.strikesBy[u.id] ?? 0) + (bad ? c.strikes : 1));
  if (c.action === "ban" && strikes >= c.strikes) {
    u.banned = true; u.lastBanAt = Date.now(); delete c.strikesBy[u.id];
    log(u.username, "banned", bad ? "severe language" : `${c.strikes} language strikes`); saveDb();
    return { block: true, ban: true, reply: say(channel, `${u.username} was banned for inappropriate language.`) };
  }
  log(u.username, "warned", bad ? "severe language" : "language"); saveDb();
  return { block: true, reply: say(channel, `${u.username}, keep it clean. Strike ${Math.min(strikes, c.strikes)} of ${c.strikes}.`) };
}
