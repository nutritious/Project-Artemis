/* Owner console: launch window (OG title), the ArtemisBot chat moderator, and trusted-member controls. */
import { $, api, ago, esc, toast, confirmBox } from "./util.js";

let S = null, Q = "", repaint = () => {};
export const bindSafety = (fn) => { repaint = fn; };
export const safety = { load, html, click, submit, change, input };
async function load() { try { S = await api("/owner/safety"); } catch (e) { toast(e.message, true); } return S; }
const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok, "ok"); await load(); repaint(); } catch (e) { toast(e.message, true); } return true; };

function userRows() {
  const q = Q.trim().toLowerCase(), r = S.rules;
  const list = S.users.filter((u) => !q || u.username.toLowerCase().includes(q)).sort((a, b) => (b.trusted - a.trusted) || b.msgs - a.msgs).slice(0, 60);
  const dot = (ok) => `<i class="tdot ${ok ? "ok" : ""}"></i>`;
  return list.map((u) => `<div class="mrow"><div class="grow"><b>${esc(u.username)}</b> ${u.staff ? `<span class="chip">staff</span>` : u.trusted ? `<span class="chip trusted">✓ Trusted${u.manual === "grant" ? " (by owner)" : ""}</span>` : u.manual === "revoke" ? `<span class="chip warn">Revoked</span>` : ""}
      <div class="sub">${dot(u.met.msgs)}${u.msgs}/${r.msgs} messages · ${dot(u.met.ban)}${u.banFreeDays == null ? "never banned" : u.banFreeDays + " days since a ban"} · ${dot(u.met.proxy)}${u.proxyHours}/${r.proxyHours} h on the proxy · ${dot(u.met.age)}${u.ageDays}/${r.ageDays} days old</div></div>
      ${u.staff ? "" : `<div class="inline">${u.trusted && u.manual !== "grant" ? "" : u.trusted ? `<button class="btn sm" data-trust="clear:${u.id}">Remove override</button>` : `<button class="btn sm primary" data-trust="grant:${u.id}">Make trusted</button>`}${u.trusted ? `<button class="btn sm danger" data-trust="revoke:${u.id}">Revoke</button>` : u.manual === "revoke" ? `<button class="btn sm" data-trust="clear:${u.id}">Undo revoke</button>` : ""}</div>`}</div>`).join("") || `<p class="faint">No one matches.</p>`;
}
function html() {
  if (!S) return `<div class="card glass"><div class="skel"></div></div>`;
  const b = S.bot, left = S.launchAt ? S.launchAt + 864e5 - Date.now() : 0, open = left > 0;
  const launch = `<div class="card glass"><h3>Launch window <span class="chip ${open ? "ok" : ""}">${open ? `OG open · ${Math.ceil(left / 36e5)} h left` : "closed"}</span></h3>
    <p class="note">When you release the game, press Start. Everyone who creates an account in the next 24 hours gets the limited <b>OG</b> title, and nothing else. Accounts made before or after the window do not.</p>
    <div class="inline">${open ? `<button class="btn danger" data-launch="stop">Close the window now</button>` : `<button class="btn primary" data-launch="start">Start the 24-hour OG window</button>`}</div></div>`;
  const bot = `<div class="card glass"><h3>ArtemisBot <span class="chip ${b.enabled ? "ok" : ""}">${b.enabled ? "watching chat" : "off"}</span></h3>
    <p class="note">A chat moderator. It only watches the crew and custom roles. Commanders, co-owners and the owner are never checked. Bad language is blocked before it posts and the bot says why in the channel.</p>
    <label class="switch-row"><input type="checkbox" data-botopt="enabled" ${b.enabled ? "checked" : ""}> <b>Turn the chatbot on</b></label>
    <div class="row2"><label>When someone crosses the line<select data-botopt="action"><option value="ban" ${b.action === "ban" ? "selected" : ""}>Ban them (after the strikes below)</option><option value="warn" ${b.action === "warn" ? "selected" : ""}>Only block and warn</option></select></label>
    <label>Strikes before a ban<input type="number" min="1" max="10" data-botopt="strikes" value="${b.strikes}"></label></div>
    <p class="note" style="margin-top:10px">Severe language (slurs and threats) counts as every strike at once, so it is an instant ban. Mild swearing is one strike.</p>
    <form data-botwords class="evform"><label>Extra banned words (one per line, counted as severe)<textarea name="words" rows="3" placeholder="one word or phrase per line">${esc(b.words.join("\n"))}</textarea></label><button class="btn" type="submit">Save word list</button></form>
    <h4 class="sec">Recent bot actions</h4>${b.log.length ? b.log.slice(0, 8).map((l) => `<div class="li"><b>${esc(l.user)}</b> ${esc(l.action)} <span class="faint">${esc(l.why)} · ${ago(l.ts)}</span></div>`).join("") : `<p class="faint">Nothing yet.</p>`}</div>`;
  const r = S.rules;
  const trust = `<div class="card glass"><h3>Trusted members</h3>
    <p class="note">Trusted members can post GIFs and chat in <b>#trusted-general</b>. Anyone earns it by reaching ${r.msgs} messages, ${r.proxyHours} hours on the proxy, an account at least ${r.ageDays} days old and no ban in the last ${r.banFreeDays} days. You can give it early here, or take it away.</p>
    <div class="inline"><input id="trustSearch" type="search" placeholder="Search players…" value="${esc(Q)}" autocomplete="off"></div><div class="mlist" id="trustList">${userRows()}</div></div>`;
  return launch + bot + trust;
}
async function click(b) {
  const d = b.dataset;
  if (d.launch) return run(() => api("/owner/launch", "POST", { action: d.launch }), d.launch === "start" ? "OG window started" : "OG window closed");
  if (d.trust) { const [mode, id] = d.trust.split(":"); return run(() => api("/owner/trust", "POST", { id, mode }), mode === "grant" ? "They are trusted now" : "Updated"); }
  return false;
}
async function change(el) {
  if (!el.dataset?.botopt) return false;
  const k = el.dataset.botopt, v = el.type === "checkbox" ? el.checked : k === "strikes" ? Number(el.value) : el.value;
  return run(() => api("/owner/bot", "PUT", { [k]: v }), k === "enabled" ? (v ? "ArtemisBot is on" : "ArtemisBot is off") : "Saved");
}
async function submit(f, v) {
  if (f.matches("[data-botwords]")) return run(() => api("/owner/bot", "PUT", { words: String(v.get("words")).split("\n").map((s) => s.trim()).filter(Boolean) }), "Word list saved");
  return false;
}
function input(e) { if (e.target.id === "trustSearch") { Q = e.target.value; $("#trustList").innerHTML = userRows(); return true; } return false; }
