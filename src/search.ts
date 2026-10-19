import * as cheerio from "cheerio";
import { fetch } from "undici";
import { HOST_OVERRIDES, USER_AGENT } from "./config.js";
import { plainDispatcher } from "./net.js";

export type EngineId = "ddg" | "brave" | "mojeek" | "google";
export const ENGINES: Record<EngineId, { name: string; home: string; webUrl: (q: string) => string }> = {
  ddg: { name: "DuckDuckGo", home: "https://duckduckgo.com/", webUrl: (q) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}` },
  brave: { name: "Brave Search", home: "https://search.brave.com/", webUrl: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}` },
  google: { name: "Google", home: "https://www.google.com/", webUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=en` },
  mojeek: { name: "Mojeek", home: "https://www.mojeek.com/", webUrl: (q) => `https://www.mojeek.com/search?q=${encodeURIComponent(q)}` },
};

export interface SearchResult { title: string; url: string; snippet: string; host: string }
export interface SearchResponse {
  q: string;
  engine: EngineId;
  results: SearchResult[];
  next?: string;
  /** Raw engine results page, openable through the proxy when native parsing finds nothing. */
  fallbackUrl: string;
  tried: { engine: EngineId; ok: boolean; reason?: string }[];
}

const HEADERS = {
  "user-agent": USER_AGENT,
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

function over(u: string): string {
  try {
    const url = new URL(u);
    const o = HOST_OVERRIDES[url.hostname];
    if (!o) return u;
    const base = new URL(o);
    url.protocol = base.protocol;
    url.host = base.host;
    return url.href;
  } catch {
    return u;
  }
}

async function get(url: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}) {
  const res = await fetch(over(url), {
    method: init.method ?? "GET",
    headers: { ...HEADERS, ...init.headers },
    body: init.body,
    redirect: "follow",
    dispatcher: plainDispatcher,
    signal: AbortSignal.timeout(14_000),
  });
  return { status: res.status, html: await res.text() };
}

const hostOf = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
};
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const isHttp = (u: string) => /^https?:\/\//i.test(u);

/* ------------------------------ DuckDuckGo ------------------------------ */
function unwrapDdg(href: string): string {
  try {
    const u = new URL(href.startsWith("//") ? "https:" + href : href, "https://duckduckgo.com/");
    const real = u.searchParams.get("uddg");
    if (real) return real;
    return u.href;
  } catch {
    return href;
  }
}

async function ddg(q: string, next?: string): Promise<{ results: SearchResult[]; next?: string; reason?: string }> {
  const r = next
    ? await get("https://html.duckduckgo.com/html/", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", referer: "https://html.duckduckgo.com/", origin: "https://html.duckduckgo.com" },
        body: new URLSearchParams(JSON.parse(Buffer.from(next, "base64url").toString())).toString(),
      })
    : await get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`);
  const $ = cheerio.load(r.html);
  const results: SearchResult[] = [];
  $(".result, .web-result").each((_, el) => {
    const box = $(el);
    if (box.hasClass("result--ad") || box.find(".badge--ad").length) return;
    const a = box.find("a.result__a").first();
    const href = a.attr("href");
    if (!href) return;
    const url = unwrapDdg(href);
    if (!isHttp(url) || /duckduckgo\.com\/y\.js/.test(url)) return;
    results.push({ title: clean(a.text()), url, snippet: clean(box.find(".result__snippet").first().text()), host: hostOf(url) });
  });
  let nextToken: string | undefined;
  $("form").each((_, f) => {
    const form = $(f);
    const submit = form.find('input[type="submit"]').attr("value") ?? "";
    if (!/next/i.test(submit)) return;
    const inputs: Record<string, string> = {};
    form.find('input[type="hidden"]').each((__, i) => {
      const n = $(i).attr("name");
      if (n) inputs[n] = $(i).attr("value") ?? "";
    });
    if (inputs.q) nextToken = Buffer.from(JSON.stringify(inputs)).toString("base64url");
  });
  const blocked = !results.length && /anomaly|bots use duckduckgo|unusual traffic|captcha/i.test(r.html);
  return { results, next: nextToken, reason: blocked ? "blocked by the engine (automated-traffic check)" : results.length ? undefined : `no results parsed (HTTP ${r.status})` };
}

/* ------------------------------- Brave ------------------------------- */
async function brave(q: string, next?: string): Promise<{ results: SearchResult[]; next?: string; reason?: string }> {
  const page = next ? Number(next) || 0 : 0;
  const r = await get(`https://search.brave.com/search?q=${encodeURIComponent(q)}&source=web${page ? "&offset=" + page : ""}`);
  const $ = cheerio.load(r.html);
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  $('#results .snippet[data-type="web"], .snippet[data-type="web"], #results > .snippet').each((_, el) => {
    const box = $(el);
    const a = box.find("a[href^='http']").first();
    const url = a.attr("href") ?? "";
    if (!isHttp(url) || seen.has(url) || /search\.brave\.com/.test(url)) return;
    seen.add(url);
    const title = clean(box.find(".title, .snippet-title, [class*='title']").first().text()) || clean(a.text());
    const snippet = clean(box.find(".snippet-description, .content, [class*='description']").first().text());
    if (title) results.push({ title, url, snippet, host: hostOf(url) });
  });
  const blocked = !results.length && (r.status === 429 || /captcha|too many requests|rate limit/i.test(r.html));
  return { results, next: results.length ? String(page + 1) : undefined, reason: blocked ? "rate limited by the engine" : results.length ? undefined : `no results parsed (HTTP ${r.status})` };
}

/* ------------------------------- Mojeek ------------------------------- */
async function mojeek(q: string, next?: string): Promise<{ results: SearchResult[]; next?: string; reason?: string }> {
  const start = next ? Number(next) || 1 : 1;
  const r = await get(`https://www.mojeek.com/search?q=${encodeURIComponent(q)}${start > 1 ? "&s=" + start : ""}`);
  const $ = cheerio.load(r.html);
  const results: SearchResult[] = [];
  $("ul.results-standard > li, ul.results > li").each((_, el) => {
    const box = $(el);
    const a = box.find("a.title, h2 a").first();
    const url = a.attr("href") ?? "";
    if (!isHttp(url)) return;
    results.push({ title: clean(a.text()), url, snippet: clean(box.find("p.s, p").first().text()), host: hostOf(url) });
  });
  return { results, next: results.length ? String(start + results.length) : undefined, reason: results.length ? undefined : `no results parsed (HTTP ${r.status})` };
}

/* Google refuses server-side reading, so it is opened as a real page in the proxy (the browser does that); the server only parses these three. */
const IMPL = { ddg, brave, mojeek } as const;
type Native = keyof typeof IMPL;
const cache = new Map<string, { at: number; value: SearchResponse }>();
const TTL = 5 * 60_000;

export async function search(q: string, preferred: EngineId, next?: string, nextEngine?: EngineId): Promise<SearchResponse> {
  q = q.trim().slice(0, 300);
  const first: Native = preferred === "google" ? "ddg" : preferred;
  const order: Native[] = nextEngine && nextEngine !== "google" ? [nextEngine] : [first, ...(["ddg", "brave", "mojeek"] as Native[]).filter((e) => e !== first)];
  const key = `${order[0]}|${q}|${next ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const tried: SearchResponse["tried"] = [];
  for (const engine of order) {
    try {
      const r = await IMPL[engine](q, next);
      tried.push({ engine, ok: r.results.length > 0, reason: r.reason });
      if (r.results.length) {
        const value: SearchResponse = { q, engine, results: r.results, next: r.next, fallbackUrl: ENGINES[engine].webUrl(q), tried };
        cache.set(key, { at: Date.now(), value });
        if (cache.size > 300) cache.delete(cache.keys().next().value as string);
        return value;
      }
    } catch (e: any) {
      tried.push({ engine, ok: false, reason: e?.cause?.code ?? e?.name ?? "request failed" });
    }
  }
  return { q, engine: order[0], results: [], fallbackUrl: ENGINES[order[0]].webUrl(q), tried };
}

/* ----------------------------- suggestions ----------------------------- */
const sugCache = new Map<string, { at: number; value: string[] }>();
export async function suggest(q: string): Promise<string[]> {
  q = q.trim().slice(0, 100);
  if (!q) return [];
  const hit = sugCache.get(q);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  let out: string[] = [];
  try {
    const r = await get(`https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&kl=wt-wt`, { headers: { accept: "application/json" } });
    const data = JSON.parse(r.html) as { phrase?: string }[];
    out = data.map((d) => d.phrase ?? "").filter(Boolean).slice(0, 8);
  } catch { /* try the next source */ }
  if (!out.length) {
    try {
      const r = await get(`https://search.brave.com/api/suggest?q=${encodeURIComponent(q)}`, { headers: { accept: "application/json" } });
      const data = JSON.parse(r.html) as [string, string[]];
      out = (data[1] ?? []).slice(0, 8);
    } catch { /* no suggestions */ }
  }
  sugCache.set(q, { at: Date.now(), value: out });
  if (sugCache.size > 500) sugCache.delete(sugCache.keys().next().value as string);
  return out;
}
