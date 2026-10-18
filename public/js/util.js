/* Shared helpers: DOM, API, modals, toasts, shared state. */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const b64u = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

import { effectMap, tagMap, RARITY } from "./cosmetics.js";

/** Demo/preview builds replace these two; the real app leaves them empty. */
export const hooks = { api: null, socket: null, frame: null };

export async function api(path, method = "GET", body) {
  if (hooks.api) return hooks.api(path, method, body);
  const res = await fetch("/api" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && state.me && !path.startsWith("/login")) { location.reload(); }
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const isStaff = (u) => u?.role === "owner" || u?.role === "coowner" || u?.role === "admin";
export const isOwner = (u) => u?.role === "owner";
export const isCoOwnerUp = (u) => u?.role === "owner" || u?.role === "coowner";
export const hasOwnerPanel = (u) => isCoOwnerUp(u) || state.perms.includes("use_owner_panel");
export const roleName = (r) => (r === "owner" ? "Owner" : r === "coowner" ? "Co-owner" : r === "admin" ? "Commander" : "Crew");
export const TIER_COLORS = { owner: "#f5b942", coowner: "#ff8a5b", admin: "#8b7bff" };
/** Display color for someone's name: built-in tier color, else their custom role color, else none. */
export const roleColor = (p) => (!p ? "" : TIER_COLORS[p.role] ?? (p.roleId ? state.roles.find((r) => r.id === p.roleId)?.color : "") ?? "");

export const state = {
  perms: [], roles: [], permInfo: {}, people: new Map(), me: null, proxyOrigin: "", sjOrigin: "", proxyToken: "", bookmarks: [], engines: [], channels: [], announcement: null,
  view: "browse", customTags: [], event: null, boosts: [],
};

/* tiny event bus so modules stay decoupled */
const bus = new EventTarget();
export const on = (n, f) => bus.addEventListener(n, (e) => f(e.detail));
export const emit = (n, d) => bus.dispatchEvent(new CustomEvent(n, { detail: d }));

export function toast(msg, kind = "") {
  const t = document.createElement("div");
  t.className = "toast " + (kind === true ? "err" : kind);
  t.textContent = msg;
  $("#toasts").append(t);
  setTimeout(() => t.remove(), 3800);
}

export const can = (p) => state.perms.includes(p);
export const hasDash = () => state.perms.length > 0;
export const personByName = (name) => { for (const p of state.people.values()) if (p.username === name) return p; return null; };
export const rankOf = (p) => (!p ? 100 : p.role === "owner" ? 0 : p.role === "coowner" ? 1 : p.role === "admin" ? 2 : (state.roles.find((r) => r.id === p.roleId)?.position ?? 99) + 1);
export const myRank = () => rankOf(state.me);
export const roleById = (id) => state.roles.find((r) => r.id === id);
/** Tag chips for a person: OWNER / CMD / custom role (colored). */
export const titleInfo = (id) => (id ? tagMap.get(id) ?? state.customTags.find((t) => t.id === id) ?? null : null);
export const titleChip = (id) => { const t = titleInfo(id); return t ? `<span class="chip title ${t.limited ? "ltd" : ""} ${t.rarity === "chroma" ? "chroma" : ""}" style="--tc:${esc(t.color)}" title="${esc(t.name)}${t.limited ? " (limited)" : ""}">${esc(t.name)}</span>` : ""; };
export const rarityColor = (r) => RARITY[r]?.color ?? "#9aa4cf";
const roleChips = (p) => !p ? "" : p.role === "owner" ? `<span class="chip owner" title="Owner">OWNER</span>` : p.role === "coowner" ? `<span class="chip coowner" title="Co-owner">CO-OWNER</span>` : p.role === "admin" ? `<span class="chip" title="Commander">CMD</span>` : (() => { const r = roleById(p.roleId); return r ? `<span class="chip role" style="--rc:${esc(r.color)}" title="${esc(r.name)}">${esc(r.name)}</span>` : ""; })();
export const roleTags = (p) => roleChips(p) + titleChip(p?.tag);
/** Badge for a stored tag ({tier,label,color}), e.g. on an announcement. Falls back to the live role of the named person. */
export const tagChip = (t) => !t ? "" : t.tier === "owner" ? `<span class="chip owner">${esc(t.label)}</span>` : t.tier === "coowner" ? `<span class="chip coowner">${esc(t.label)}</span>` : t.tier === "admin" ? `<span class="chip">${esc(t.label)}</span>` : `<span class="chip role" style="--rc:${esc(t.color)}">${esc(t.label)}</span>`;
export const byLine = (a) => !a?.by ? "" : `${esc(a.by)} ${a.byTag ? tagChip(a.byTag) : roleTags(personByName(a.by))}`;
export const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
export const avatar = (name, on, sm, big) => {
  const p = personByName(name), img = p?.profile?.avatar, pres = p?.profile?.presence ?? "online";
  const fx = p?.fx && effectMap.has(p.fx) ? p.fx : "", deco = fx ? `<i class="fxa"></i><i class="fxb"></i>` : "";
  const cls = `avatar${sm ? " sm" : ""}${big ? " big" : ""}${on ? " on " + pres : ""}${fx ? " fx fx-" + fx : ""}`;
  return img ? `<div class="${cls}">${deco}<img src="${esc(img)}" alt=""></div>` : `<div class="${cls}" style="background:linear-gradient(135deg,hsl(${hue(name)} 60% 50%),hsl(${(hue(name) + 40) % 360} 55% 38%))">${deco}<span class="av-l">${esc(String(name)[0]?.toUpperCase() ?? "?")}</span></div>`;
};
export const fmtBytes = (n) => (n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : n < 1073741824 ? (n / 1048576).toFixed(1) + " MB" : (n / 1073741824).toFixed(2) + " GB");
export const fmtNum = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e4 ? (n / 1e3).toFixed(1) + "k" : String(n));
export const fmtDur = (s) => (s >= 86400 ? `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`);
export const timeStr = (ts) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
export const ago = (ts) => {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return Math.round(s / 60) + "m ago";
  if (s < 86400) return Math.round(s / 3600) + "h ago";
  return Math.round(s / 86400) + "d ago";
};
export const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

const ICONS = {
  browse: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
  admin: '<path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
  owner: '<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z"/>',
  updates: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  hub: '<path d="M12 3c3 2.5 4.5 6 4.5 9.5L12 21l-4.5-8.5C7.5 9 9 5.500 12 3Z"/><circle cx="12" cy="10" r="1.600"/><path d="m7.500 14-3 3 3.500-.5M16.500 14l3 3-3.500-.5"/>',
  arcade: '<rect x="3" y="8" width="18" height="10" rx="5"/><path d="M8 11v4M6 13h4"/><circle cx="15.500" cy="12" r=".8"/><circle cx="17.500" cy="14" r=".8"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>',
  packs: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  back: '<path d="m15 18-6-6 6-6"/>', fwd: '<path d="m9 18 6-6-6-6"/>',
  reload: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
export const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] ?? ""}</svg>`;

/* ---------- modals (no native dialogs) ---------- */
function overlay(html, { center = true } = {}) {
  const o = document.createElement("div");
  o.className = "overlay" + (center ? " center" : "");
  o.innerHTML = html;
  document.body.append(o);
  return o;
}
export function confirmBox(title, text, { ok = "Confirm", danger = false } = {}) {
  return new Promise((resolve) => {
    const o = overlay(`<div class="modal glass" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><p>${esc(text)}</p><div class="row"><button class="btn" data-r="0">Cancel</button><button class="btn ${danger ? "danger" : "primary"}" data-r="1">${esc(ok)}</button></div></div>`);
    const done = (v) => { o.remove(); removeEventListener("keydown", key, true); resolve(v); };
    const key = (e) => { if (e.key === "Escape") done(false); };
    addEventListener("keydown", key, true);
    o.addEventListener("click", (e) => { if (e.target === o) done(false); const b = e.target.closest("[data-r]"); if (b) done(b.dataset.r === "1"); });
    o.querySelector("[data-r='1']").focus();
  });
}
export function promptBox(title, { label = "", value = "", placeholder = "", ok = "Save", text = "", type = "text" } = {}) {
  return new Promise((resolve) => {
    const o = overlay(`<form class="modal glass"><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ""}<label>${esc(label)}<input name="v" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off"></label><div class="row"><button type="button" class="btn" data-r="0">Cancel</button><button class="btn primary">${esc(ok)}</button></div></form>`);
    const done = (v) => { o.remove(); removeEventListener("keydown", key, true); resolve(v); };
    const key = (e) => { if (e.key === "Escape") done(null); };
    addEventListener("keydown", key, true);
    o.addEventListener("click", (e) => { if (e.target === o || e.target.dataset.r === "0") done(null); });
    o.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); done(new FormData(e.target).get("v")); });
    o.querySelector("input").focus();
    o.querySelector("input").select();
  });
}
export function infoBox(title, text, secret) {
  return new Promise((resolve) => {
    const o = overlay(`<div class="modal glass"><h3>${esc(title)}</h3><p>${esc(text)}</p>${secret ? `<div class="secret">${esc(secret)}</div>` : ""}<div class="row"><button class="btn primary">Done</button></div></div>`);
    o.addEventListener("click", (e) => { if (e.target === o || e.target.closest("button")) { o.remove(); resolve(); } });
  });
}
export { overlay };
