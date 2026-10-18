/* Owner console: redeem codes. Co-owners and the owner make codes that give coins, crates and items. */
import { api, ago, esc, toast, confirmBox } from "./util.js";
import { EFFECTS, TAGS, THEMES, BGS } from "./cosmetics.js";

let S = null, repaint = () => {};
export const bindCodes = (fn) => { repaint = fn; };
export const codes = { load, html, click, submit };
async function load() { try { S = await api("/owner/codes"); } catch (e) { toast(e.message, true); } return S; }
const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok, "ok"); await load(); repaint(); } catch (e) { toast(e.message, true); } return true; };
const group = (label, type, list) => `<optgroup label="${label}">${list.map((i) => `<option value="${type}:${i.id}">${esc(i.name)} (${esc(i.rarity)})</option>`).join("")}</optgroup>`;

function row(c) {
  const left = c.expiresAt ? c.expiresAt - Date.now() : 0, dead = c.disabled || (c.expiresAt && left < 0) || (c.maxUses && c.used >= c.maxUses);
  const rw = [c.coins ? `◎ ${c.coins.toLocaleString()}` : "", c.crates ? `${c.crates} crate${c.crates > 1 ? "s" : ""}` : "", ...c.items.map((i) => esc(i.name))].filter(Boolean).join(" · ");
  return `<div class="mrow"><div class="grow"><button type="button" class="codechip" data-copy="${esc(c.code)}" title="Click to copy">${esc(c.code)}</button> ${c.disabled ? `<span class="chip warn">off</span>` : dead ? `<span class="chip warn">${c.expiresAt && left < 0 ? "expired" : "used up"}</span>` : `<span class="chip ok">live</span>`}
    <div class="sub">${rw} · used ${c.used}${c.maxUses ? "/" + c.maxUses : ""} · ${c.expiresAt ? (left > 0 ? Math.ceil(left / 36e5) + " h left" : "ended") : "never expires"}${c.note ? " · " + esc(c.note) : ""} · by ${esc(c.by)} ${ago(c.createdAt)}</div></div>
    <div class="inline"><button class="btn sm" data-codetoggle="${esc(c.code)}">${c.disabled ? "Turn on" : "Turn off"}</button><button class="btn sm danger" data-codedel="${esc(c.code)}">Delete</button></div></div>`;
}
function html() {
  if (!S) return `<div class="card glass"><div class="skel"></div></div>`;
  return `<div class="card glass"><h3>Make a code</h3>
    <p class="note">Players type a code in Packs or the Hub and get a reward with a gift-opening animation. Each player can use a code once. Rewards do not count toward the 500 coins a day limit. Leave the code empty to make a random one.</p>
    <form data-codeform class="codeform">
      <label>Code (optional)<input name="code" placeholder="WELCOME" maxlength="32" autocomplete="off"></label>
      <label>Coins<input name="coins" type="number" min="0" max="100000" value="100"></label>
      <label>Free crates<input name="crates" type="number" min="0" max="50" value="0"></label>
      <label>Max players (0 = no limit)<input name="maxUses" type="number" min="0" value="0"></label>
      <label>Expires in hours (0 = never)<input name="hours" type="number" min="0" value="0"></label>
      <label>Item reward (optional)<select name="item"><option value="">No item</option>${group("Profile effects", "effect", EFFECTS.filter((i) => !i.limited))}${group("Titles", "tag", TAGS.filter((i) => !i.limited && !i.hidden))}${group("Themes", "theme", THEMES)}${group("Backdrops", "bg", BGS)}</select></label>
      <label class="wide">Note shown to the player (optional)<input name="note" maxlength="80" placeholder="Thanks for joining the launch!"></label>
      <button class="btn primary wide" type="submit">Create code</button></form></div>
    <div class="card glass"><h3>Codes <span class="chip">${S.codes.length}</span></h3><div class="mlist">${S.codes.map(row).join("") || `<p class="faint">No codes yet.</p>`}</div></div>`;
}
async function click(b) {
  const d = b.dataset;
  if (d.copy) { try { await navigator.clipboard.writeText(d.copy); toast("Copied " + d.copy, "ok"); } catch { toast(d.copy); } return true; }
  if (d.codetoggle) return run(() => api("/owner/codes/" + encodeURIComponent(d.codetoggle), "PUT"), "Updated");
  if (d.codedel) { if (!(await confirmBox(`Delete code ${d.codedel}?`, "Players will no longer be able to redeem it.", { ok: "Delete", danger: true }))) return true; return run(() => api("/owner/codes/" + encodeURIComponent(d.codedel), "DELETE"), "Code deleted"); }
  return false;
}
async function submit(f, v) {
  if (!f.matches("[data-codeform]")) return false;
  const it = String(v.get("item") || ""), [type, id] = it.split(":");
  return run(async () => { const r = await api("/owner/codes", "POST", { code: v.get("code"), coins: v.get("coins"), crates: v.get("crates"), maxUses: v.get("maxUses"), hours: v.get("hours"), note: v.get("note"), items: it ? [{ type, id }] : [] }); toast("Code ready: " + r.code, "ok"); }, "");
}
