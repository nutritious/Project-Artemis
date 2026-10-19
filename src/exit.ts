/* The main site's side of the home exit node: settings, health checks, and passes for browsers. */
import { db, saveDb, type User } from "./store.js";
import { makeExitToken } from "./exit-token.js";
import { TOP_TIERS } from "./perms.js";

export const exitKey = () => process.env.EXIT_KEY || db.data.server.exitKey || "";
export const exitConfigured = () => !!(db.data.server.exitUrl && exitKey());
let ok = false, checkedAt = 0, lastErr = "";

/** The address people see, e.g. https://abc.trycloudflare.com. Returns "" when it is not a valid https (or localhost) address. */
export function cleanExitUrl(v: unknown): string {
  let s = String(v ?? "").trim(); if (!s) return "";
  if (!/^[a-z]+:\/\//i.test(s)) s = "https://" + s;
  try { const u = new URL(s); if (u.protocol !== "https:" && !(u.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(u.hostname))) return ""; return u.origin; } catch { return ""; }
}
export async function checkExit(): Promise<boolean> {
  const url = db.data.server.exitUrl; checkedAt = Date.now();
  if (!url) { ok = false; lastErr = ""; return false; }
  try { const r = await fetch(url + "/health", { signal: AbortSignal.timeout(5000) }); const t = await r.text(); ok = r.ok && t.includes("artemis-exit"); lastErr = ok ? "" : "That address answered, but it is not an Artemis exit node."; }
  catch (e: any) { ok = false; lastErr = "Could not reach it. Is the exit node and the tunnel running?"; }
  return ok;
}
setInterval(() => { if (db.data.server.exitUrl) void checkExit(); }, 20_000).unref();
setTimeout(() => void checkExit(), 3000).unref();

export const exitStatus = () => ({ url: db.data.server.exitUrl ?? "", hasKey: !!exitKey(), keyFromEnv: !!process.env.EXIT_KEY, ok, checkedAt, error: lastErr });
export function setExit(url: unknown, key: unknown) {
  const u = cleanExitUrl(url);
  if (String(url ?? "").trim() && !u) throw new Error("Enter the https address your tunnel printed.");
  db.data.server.exitUrl = u;
  if (typeof key === "string" && key.trim()) { if (key.trim().length < 12) throw new Error("The key must be at least 12 characters."); db.data.server.exitKey = key.trim(); }
  saveDb();
}
/** What a signed-in browser needs to use the exit node, or nothing when it is off or down (then the site's own connection is used). */
export function exitInfo(u: User): { exitUrl?: string; exitToken?: string } {
  if (!exitConfigured() || !ok) return {};
  return { exitUrl: db.data.server.exitUrl!.replace(/^http/, "ws"), exitToken: makeExitToken(exitKey(), u.id, undefined, TOP_TIERS.includes(u.role)) };
}
