/* Keeps the data safe on Render's free plan: the disk there is wiped on every sleep or redeploy, so the data is
   copied to a private GitHub repo and copied back on start. Needs GITHUB_TOKEN (and optionally BACKUP_REPO). */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";

const TOKEN = process.env.GITHUB_TOKEN ?? "";
const REPO = process.env.BACKUP_REPO ?? "nutritious/artemis-data";
const FILE = "artemis.json.gz";
const DIR = process.env.ARTEMIS_DATA ?? path.resolve("data");
const LOCAL = path.join(DIR, "artemis.json");
const API = `${process.env.GITHUB_API ?? "https://api.github.com"}/repos/${REPO}/contents/${FILE}`;
const H = (extra: Record<string, string> = {}) => ({ authorization: `Bearer ${TOKEN}`, "user-agent": "artemis", "x-github-api-version": "2022-11-28", ...extra });

export const cloudEnabled = () => !!TOKEN;
export const cloudState = { enabled: !!TOKEN, repo: REPO, lastOk: 0, lastErr: "", restored: false };

/** Before the store loads: if this disk is empty (fresh deploy), bring the data back. */
export async function restoreIfEmpty() {
  if (!TOKEN) return;
  try {
    if (fs.existsSync(LOCAL) && fs.statSync(LOCAL).size > 2) return;
    const r = await fetch(API, { headers: H({ accept: "application/vnd.github.raw+json" }), signal: AbortSignal.timeout(30000) });
    if (r.status === 404) { console.log("  ☁ Cloud save: nothing saved yet, starting fresh."); return; }
    if (!r.ok) throw new Error("GitHub said " + r.status);
    const json = zlib.gunzipSync(Buffer.from(await r.arrayBuffer()));
    JSON.parse(json.toString("utf8")); /* make sure it is real before using it */
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(LOCAL, json);
    cloudState.restored = true; console.log("  ☁ restored users:", (JSON.parse(json.toString("utf8")).users ?? []).length);
    console.log(`  ☁ Cloud save: restored ${Math.round(json.length / 1024)} KB of data.`);
  } catch (e) { cloudState.lastErr = String((e as Error).message); console.warn("  ⚠ Cloud save restore failed:", cloudState.lastErr); }
}

let lastHash = "", sha = "", busy = false;
async function remoteSha() {
  const r = await fetch(API, { headers: H(), signal: AbortSignal.timeout(30000) });
  if (r.status === 404) return ""; if (!r.ok) throw new Error("GitHub said " + r.status);
  return String(((await r.json()) as { sha?: string }).sha ?? "");
}
/** Upload when the data changed. Never uploads an empty server over a good copy. */
export async function pushNow(force = false) {
  if (!TOKEN || busy) return; busy = true;
  try {
    if (!fs.existsSync(LOCAL)) return;
    const raw = fs.readFileSync(LOCAL);
    const parsed = JSON.parse(raw.toString("utf8")) as { users?: unknown[] };
    if (!parsed.users?.length) return;
    const h = crypto.createHash("sha1").update(raw).digest("hex");
    if (!force && h === lastHash) return;
    const body = JSON.stringify({ message: "data " + new Date().toISOString(), content: zlib.gzipSync(raw, { level: 9 }).toString("base64"), ...(sha ? { sha } : {}) });
    const put = () => fetch(API, { method: "PUT", headers: H({ "content-type": "application/json" }), body, signal: AbortSignal.timeout(60000) });
    let r = await put();
    if (r.status === 409 || r.status === 422) { sha = await remoteSha(); r = await fetch(API, { method: "PUT", headers: H({ "content-type": "application/json" }), body: JSON.stringify({ ...JSON.parse(body), ...(sha ? { sha } : {}) }), signal: AbortSignal.timeout(60000) }); }
    if (!r.ok) throw new Error(`GitHub said ${r.status} ${(await r.text()).slice(0, 120)}`);
    console.log("  ☁ pushed", parsed.users?.length, "users");
    sha = String(((await r.json()) as { content?: { sha?: string } }).content?.sha ?? "");
    lastHash = h; cloudState.lastOk = Date.now(); cloudState.lastErr = "";
  } catch (e) { cloudState.lastErr = String((e as Error).message); console.warn("  ⚠ Cloud save failed:", cloudState.lastErr); }
  finally { busy = false; }
}

/** Save every 2 minutes, and ping our own public address so Render does not put the app to sleep. */
export function startCloud(flush: () => void) {
  const url = process.env.RENDER_EXTERNAL_URL;
  if (url) setInterval(() => { fetch(url + "/healthz", { signal: AbortSignal.timeout(15000) }).catch(() => {}); }, 4 * 60 * 1000).unref();
  if (!TOKEN) { if (process.env.RENDER) console.warn("  ⚠ GITHUB_TOKEN is not set: data is lost when Render restarts."); return; }
  setTimeout(() => { flush(); void pushNow(true); }, 20000).unref();
  setInterval(() => { flush(); void pushNow(); }, 2 * 60 * 1000).unref();
  /* when Render stops the app for an update or restart, save one last time before exiting */
  (globalThis as any).__artemisFinal = async () => { flush(); await pushNow(true); };
}
