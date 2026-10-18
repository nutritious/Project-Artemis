/* Update log: everyone can read it, only the owner can add, edit or remove entries. */
import { $, api, confirmBox, esc, isOwner, overlay, state, toast } from "./util.js";

let list = [];
const SEEN = "artemis-updates-seen";
const lastSeen = () => { try { return Number(localStorage.getItem(SEEN)) || 0; } catch { return 0; } };
const markSeen = () => { try { localStorage.setItem(SEEN, String(Math.max(0, ...list.map((u) => u.ts)))); } catch { /* ignore */ } $("#updDot")?.classList.add("hidden"); };

const body = (t) => {
  const out = []; let ul = null;
  for (const line of String(t).split("\n")) {
    const m = line.match(/^\s*[-*]\s+(.*)$/);
    if (m) { (ul ??= []).push(`<li>${esc(m[1])}</li>`); } else { if (ul) { out.push(`<ul>${ul.join("")}</ul>`); ul = null; } if (line.trim()) out.push(`<p>${esc(line)}</p>`); }
  }
  if (ul) out.push(`<ul>${ul.join("")}</ul>`);
  return out.join("");
};
const fmt = (ts) => new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

export function buildUpdates() {
  $("#view-updates").innerHTML = `<div class="page"><div class="upd-head"><div><h2 style="margin:0">Update log</h2><p class="sub" style="margin:4px 0 0">Everything that has changed in Project Artemis, newest first.</p></div><button class="btn primary hidden" id="updNew">+ New entry</button></div><div id="updList" class="upd-list"><div class="skel"></div></div></div>`;
  $("#view-updates").addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.id === "updNew") return editor(null);
    if (b.dataset.edit) return editor(list.find((u) => u.id === b.dataset.edit));
    if (b.dataset.del && (await confirmBox("Delete this entry?", "It disappears from the log for everyone.", { ok: "Delete", danger: true }))) { try { await api("/updates/" + b.dataset.del, "DELETE"); await load(); } catch (err) { toast(err.message, true); } }
  });
}
export async function onUpdatesShown() { await load(); markSeen(); }
export async function checkUpdatesDot() {
  try { list = (await api("/updates")).updates; const n = Math.max(0, ...list.map((u) => u.ts)); $("#updDot")?.classList.toggle("hidden", n <= lastSeen()); if (!lastSeen()) { /* first visit: show the dot once */ } } catch { /* offline */ }
}
async function load() {
  try { list = (await api("/updates")).updates; } catch (e) { toast(e.message, true); return; }
  $("#updNew").classList.toggle("hidden", !isOwner(state.me));
  const owner = isOwner(state.me);
  $("#updList").innerHTML = list.map((u, i) => `<article class="upd glass"><header><span class="upd-date">${fmt(u.ts)}</span>${i === 0 ? `<span class="chip ok">latest</span>` : ""}${owner ? `<span class="upd-acts"><button class="btn sm" data-edit="${esc(u.id)}">Edit</button><button class="btn sm danger" data-del="${esc(u.id)}">Delete</button></span>` : ""}</header><h3>${esc(u.title)}</h3><div class="upd-body">${body(u.body)}</div></article>`).join("") || `<p class="note">No updates yet.</p>`;
}
function editor(entry) {
  const o = overlay(`<form class="modal glass" style="width:min(560px,100%)"><h3>${entry ? "Edit entry" : "New update entry"}</h3>
    <label>Title<input name="title" maxlength="120" required value="${esc(entry?.title ?? "")}" placeholder="What changed?"></label>
    <label>Details<textarea name="body" rows="7" maxlength="4000" placeholder="- One change per line, starting with a dash">${esc(entry?.body ?? "")}</textarea></label>
    <div class="row"><button type="button" class="btn" data-x>Cancel</button><button class="btn primary">${entry ? "Save" : "Publish"}</button></div></form>`);
  o.addEventListener("click", (e) => { if (e.target === o || e.target.matches("[data-x]")) o.remove(); });
  o.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = new FormData(e.target), b = { title: f.get("title"), body: f.get("body") };
    try { await (entry ? api("/updates/" + entry.id, "PUT", b) : api("/updates", "POST", b)); o.remove(); toast("Saved", "ok"); await load(); } catch (err) { toast(err.message, true); }
  });
  o.querySelector("input").focus();
}
