/* Short signed passes that let a browser use a home "exit node". Shared by the main server (which hands them out) and the exit node (which checks them). */
import crypto from "node:crypto";

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const mac = (key: string, body: string) => crypto.createHmac("sha256", key).update("exit:" + body).digest("base64url");
export function makeExitToken(key: string, userId: string, ttlMs = 8 * 3600_000) {
  const body = b64(JSON.stringify({ u: userId, exp: Date.now() + ttlMs }));
  return `${body}.${mac(key, body)}`;
}
export function checkExitToken(key: string, token: string): { u: string; exp: number } | null {
  const [body, sig] = String(token).split(".");
  if (!body || !sig || !key) return null;
  const want = mac(key, body);
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); return typeof p.u === "string" && p.exp > Date.now() ? p : null; } catch { return null; }
}
