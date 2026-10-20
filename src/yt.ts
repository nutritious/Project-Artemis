/* Artemis Tube: a YouTube front page that asks public Invidious servers for the video lists, so the main server never has to talk to YouTube itself. */
import { request } from "undici";
import { safeDispatcher } from "./net.js";

const DEFAULTS = ["https://inv.nadeko.net", "https://yewtu.be", "https://invidious.nerdvpn.de", "https://invidious.privacyredirect.com", "https://inv.tux.pizza", "https://iv.nboeck.de", "https://invidious.fdn.fr", "https://invidious.materialio.us"];
const fromEnv = (process.env.ARTEMIS_INVIDIOUS ?? "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter((s) => /^https:\/\/[\w.-]+(:\d+)?$/.test(s));
export const INSTANCES = fromEnv.length ? fromEnv : DEFAULTS;
export const VIDEO_ID = /^[\w-]{11}$/;

type Health = { ok: boolean | null; ms: number; at: number };
const health = new Map<string, Health>(INSTANCES.map((i) => [i, { ok: null, ms: 0, at: 0 }])); /* is the website itself up? */
const apiOk = new Map<string, boolean | null>(INSTANCES.map((i) => [i, null])); /* does its JSON API answer? (many servers switch it off) */

async function get(base: string, path: string, ms = 7000): Promise<any> {
  const t0 = Date.now();
  try {
    const r = await request(base + path, { method: "GET", dispatcher: safeDispatcher, headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36", accept: "application/json" }, signal: AbortSignal.timeout(ms), maxRedirections: 2 } as any);
    const text = await r.body.text();
    if (r.statusCode !== 200 || text.length > 4_000_000) throw new Error("status " + r.statusCode);
    const j = JSON.parse(text);
    apiOk.set(base, true);
    return j;
  } catch (e) {
    apiOk.set(base, false);
    throw e;
  }
}

/** Ask the chosen server first (if any), then the rest, healthiest first. First good answer wins. */
export async function ask(path: string, prefer = -1): Promise<{ data: any; from: number }> {
  const order = INSTANCES.map((_, i) => i).sort((a, b) => {
    if (a === prefer) return -1; if (b === prefer) return 1;
    const ba = INSTANCES[a], bb = INSTANCES[b], ha = health.get(ba)!, hb = health.get(bb)!;
    return (apiOk.get(ba) === false ? 1 : 0) - (apiOk.get(bb) === false ? 1 : 0) || (ha.ok === false ? 1 : 0) - (hb.ok === false ? 1 : 0) || ha.ms - hb.ms;
  });
  for (let k = 0; k < Math.min(order.length, 6); k += 2) { /* two servers at a time, so a dead one costs seconds, not a minute */
    try { return await Promise.any(order.slice(k, k + 2).map(async (i) => ({ data: await get(INSTANCES[i], path, 6000), from: i }))); } catch { /* next pair */ }
  }
  throw new Error("No video server answered. Try again, or pick another backend.");
}

const clean = (s: unknown, n = 200) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").slice(0, n);
export function card(v: any) {
  if (!v || !VIDEO_ID.test(String(v.videoId ?? ""))) return null;
  return { id: String(v.videoId), title: clean(v.title), author: clean(v.author, 80), views: Number(v.viewCount) || 0, published: clean(v.publishedText, 40), seconds: Number(v.lengthSeconds) || 0, live: !!v.liveNow };
}
export const cards = (arr: any) => (Array.isArray(arr) ? arr : []).filter((x) => !x?.type || x.type === "video").map(card).filter(Boolean).slice(0, 48);

/** Is the website itself reachable? This is what Full site mode needs, so it decides the green and red dots. */
async function checkSite(base: string) {
  const t0 = Date.now();
  try {
    const r = await request(base + "/", { method: "GET", dispatcher: safeDispatcher, headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36", accept: "text/html" }, headersTimeout: 7000, bodyTimeout: 7000, signal: AbortSignal.timeout(8000) } as any);
    const text = (await r.body.text()).slice(0, 200_000);
    const ok = r.statusCode === 200 && text.length > 800 && /<html/i.test(text) && !/just a moment|attention required|checking your browser/i.test(text);
    health.set(base, { ok, ms: Date.now() - t0, at: Date.now() });
  } catch { health.set(base, { ok: false, ms: Date.now() - t0, at: Date.now() }); }
}
export async function checkAll() {
  await Promise.allSettled(INSTANCES.flatMap((b) => [checkSite(b), get(b, "/api/v1/stats", 5000)]));
  return status();
}
export const status = () => INSTANCES.map((b, i) => ({ i, name: "B" + (i + 1), host: b.replace(/^https:\/\//, ""), base: b, ok: health.get(b)!.ok, api: apiOk.get(b) ?? null, ms: health.get(b)!.ms }));

/** Open a video stream. Artemis asks the Invidious server for the file (the server fetches it from YouTube with its own address) and hands it on, range requests included,
 *  so the browser plays it with a plain <video> tag and no proxy engine in the middle. */
export async function openStream(id: string, range: string | undefined, prefer: number, itag: string) {
  const order = INSTANCES.map((_, i) => i).sort((a, b) => {
    if (a === prefer) return -1; if (b === prefer) return 1;
    const ba = INSTANCES[a], bb = INSTANCES[b], ha = health.get(ba)!, hb = health.get(bb)!;
    return (ha.ok === false ? 1 : 0) - (hb.ok === false ? 1 : 0) || ha.ms - hb.ms;
  });
  for (const i of order.slice(0, 4)) {
    try {
      const r = await request(`${INSTANCES[i]}/latest_version?id=${id}&itag=${itag}&local=true`, { method: "GET", dispatcher: safeDispatcher, maxRedirections: 4, headersTimeout: 8000, bodyTimeout: 60000,
        headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36", cookie: 'PREFS={"local":true}', ...(range && /^bytes=\d*-\d*$/.test(range) ? { range } : {}) } });
      const type = String(r.headers["content-type"] ?? "");
      if ((r.statusCode === 200 || r.statusCode === 206) && /^(video|audio)\//.test(type)) return { status: r.statusCode, headers: r.headers, body: r.body, from: i };
      await r.body.dump().catch(() => {});
    } catch { /* next server */ }
  }
  return null;
}
