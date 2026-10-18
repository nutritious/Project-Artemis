export const PORT = Number(process.env.PORT ?? 8080);
export const HOST = process.env.HOST ?? "0.0.0.0";
/** Optional separate origin for proxied sites (strongly recommended in production). */
export const PROXY_ORIGIN = (process.env.PROXY_ORIGIN ?? "").replace(/\/$/, "");
export const PROXY_HOSTNAME = PROXY_ORIGIN ? new URL(PROXY_ORIGIN).hostname : "";
/** Allow the proxy to reach private/loopback addresses (off by default; SSRF protection). */
export const ALLOW_PRIVATE = process.env.ARTEMIS_ALLOW_PRIVATE === "1";
/** Send all outbound traffic through another HTTP proxy (useful for locked-down hosts). */
export const UPSTREAM_PROXY = process.env.ARTEMIS_UPSTREAM_PROXY ?? "";
export const TRUST_PROXY = process.env.TRUST_PROXY === "1";
export const DEFAULT_RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MIN ?? 900);
export const PROXY_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const USER_AGENT =
  process.env.ARTEMIS_UA ??
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
/** Test hook: map hostnames to local URLs, e.g. "html.duckduckgo.com=http://127.0.0.1:9200". */
export const HOST_OVERRIDES: Record<string, string> = Object.fromEntries(
  (process.env.ARTEMIS_HOST_OVERRIDES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.split("=") as [string, string]),
);
/** The owner is whoever registers this username (or the account seeded from OWNER_PASSWORD). */
export const OWNER_USERNAME = process.env.OWNER_USERNAME ?? "Warmaster";
/** Optional: create the owner account at startup so the password never has to travel through the sign-up form. Set it in .env, never in code. */
export const OWNER_PASSWORD = process.env.OWNER_PASSWORD ?? "";
