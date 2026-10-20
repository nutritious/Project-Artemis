import crypto from "node:crypto";
import { promisify } from "node:util";
import type { Request } from "express";
import { db, type User } from "./store.js";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

export async function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = (await scrypt(password, salt, 64)).toString("hex");
  return { salt, hash };
}

export async function checkPassword(user: User, password: string) {
  const { hash } = await hashPassword(password, user.salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(user.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface TokenPayload { k: "s" | "p"; u: string; exp: number }

export function sign(payload: TokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", db.data.secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verify(token: string, kind: "s" | "p"): TokenPayload | null {
  const [body, mac] = String(token).split(".");
  if (!body || !mac) return null;
  const expected = crypto.createHmac("sha256", db.data.secret).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    if (p.k !== kind || p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export const SESSION_COOKIE = "artemis_session";

export function userFromRequest(req: { headers: { cookie?: string } }): User | null {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const p = verify(token, "s");
  if (!p) return null;
  const user = db.data.users.find((u) => u.id === p.u);
  if (!user || user.banned) return null;
  return user;
}

export function publicUser(u: User) {
  return { id: u.id, username: u.username, role: u.role, roleId: u.roleId ?? null, createdAt: u.createdAt, settings: u.settings, profile: u.profile, coins: u.coins, inv: u.inv, equip: u.equip, freePacks: u.freePacks };
}

const hits = new Map<string, number[]>();
/** Sliding-window limiter. Returns true when the call is allowed. */
let ownerIds = new Set<string>(), ownerAt = 0;
/** The owner is never rate limited: every key ends in the user id, so a match on the owner's id lets the call through. */
const isOwnerKey = (key: string) => { const t = Date.now(); if (t - ownerAt > 15_000) { ownerIds = new Set(db.data.users.filter((u) => u.role === "owner").map((u) => u.id)); ownerAt = t; } return ownerIds.has(key.slice(key.lastIndexOf(":") + 1)); };
export function allow(key: string, limit: number, windowMs: number): boolean {
  if (isOwnerKey(key)) return true;
  const t = Date.now();
  const arr = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return false;
  }
  arr.push(t);
  hits.set(key, arr);
  return true;
}
setInterval(() => {
  const t = Date.now();
  for (const [k, v] of hits) if (!v.some((x) => t - x < 120_000)) hits.delete(k);
}, 60_000).unref();

export const clientIp = (req: Request) => req.ip ?? req.socket.remoteAddress ?? "?";
