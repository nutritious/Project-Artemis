/* Time-based one-time codes (RFC 6238) for the extra login step. Works with any authenticator app. */
import crypto from "node:crypto";
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const newSecret = () => { const b = crypto.randomBytes(20); let bits = "", out = ""; for (const x of b) bits += x.toString(2).padStart(8, "0"); for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)]; return out; };
const decode = (s: string) => { let bits = ""; for (const c of s.replace(/=+$/, "").toUpperCase()) { const v = B32.indexOf(c); if (v >= 0) bits += v.toString(2).padStart(5, "0"); } const out: number[] = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); };
const code = (secret: string, step: number) => {
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac("sha1", decode(secret)).update(buf).digest(), o = h[h.length - 1] & 15;
  return String(((h[o] & 0x7f) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1_000_000).padStart(6, "0");
};
/** True when the 6 digits match now, or the step before or after (clock drift). */
export function verify(secret: string, input: string) {
  const c = String(input ?? "").replace(/\s+/g, ""); if (!/^\d{6}$/.test(c)) return false;
  const step = Math.floor(Date.now() / 30000); let ok = false;
  for (const d of [-1, 0, 1]) if (crypto.timingSafeEqual(Buffer.from(code(secret, step + d)), Buffer.from(c))) ok = true;
  return ok;
}
export const otpUri = (secret: string, user: string) => `otpauth://totp/Project%20Artemis:${encodeURIComponent(user)}?secret=${secret}&issuer=Project%20Artemis`;
