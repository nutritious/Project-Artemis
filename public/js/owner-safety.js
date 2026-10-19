/* Owner console: launch window (OG title), the ArtemisBot chat moderator, and trusted-member controls. */
import { $, api, ago, esc, toast, confirmBox, state } from "./util.js";

let S = null, Q = "", repaint = () => {};
export const bindSafety = (fn) => { repaint = fn; };
export const safety = { load, html, click, submit, change, input };
async function load() { try { S = await api("/owner/safety"); } catch (e) { toast(e.message, true); } return S; }
const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok, "ok"); await load(); repaint(); } catch (e) { toast(e.message, true); } return true; };

function userRows() {
  const q = Q.trim().toLowerCase(), r = S.rules;
  const list = S.users.filter((u) => !q || u.username.toLowerCase().includes(q)).sort((a, b) => (b.trusted - a.trusted) || b.msgs - a.msgs).slice(0, 60);
  const dot = (ok) => `<i class="tdot ${ok ? "ok" : ""}"></i>`;
  return list.map((u) => `<div class="mrow"><div class="grow"><b>${esc(u.username)}</b> ${u.staff ? `<span class="chip trusted">✓ Trusted · ${u.role === "owner" ? "owner" : u.role === "coowner" ? "co-owner" : "staff"}</span>` : u.trusted ? `<span class="chip trusted">✓ Trusted${u.manual === "grant" ? " (by owner)" : ""}</span>` : u.manual === "revoke" ? `<span class="chip warn">Revoked</span>` : ""}
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
  const st = S.storage ?? {}, warn = st.permanent === false;
  const data = `<div class="card glass"><h3>Data &amp; backup <span class="chip ${warn ? "warn" : st.permanent ? "ok" : ""}">${warn ? "no permanent disk" : st.permanent ? "permanent disk" : "local"}</span></h3>
    ${warn ? `<p class="note" style="color:var(--warn)"><b>Heads up:</b> this server has no permanent disk, so every deploy or restart erases accounts, chat and coins. Download a backup before you update, then restore it afterwards. A paid Render disk at <code>/data</code> fixes it for good.</p>` : `<p class="note">Everything (accounts, chat, coins, packs, settings) lives in one data file. Download it now and then, and restore it if the server is ever reset.</p>`}
    <p class="note">The backup holds every player's account data, including their password hashes. Keep the file private. Only the owner can download or restore it.</p>
    <div class="inline"><button class="btn primary" data-backup="download">Download backup</button><label class="btn" style="cursor:pointer">Restore from file<input type="file" accept=".json,application/json" data-restore hidden></label></div></div>`;
  const x = S.exit, exitCard = !x || state.me?.role !== "owner" ? "" : `<div class="card glass"><h3>Home exit node <span class="chip ${x.url ? (x.ok ? "ok" : "warn") : ""}">${x.url ? (x.ok ? "connected" : "not reachable") : "off"}</span></h3>
    <p class="note">Sites like YouTube block this server because it runs in a data center. An exit node is a small program on a computer at home: while it runs, everyone's browsing leaves from your home internet, which YouTube trusts. If it stops, Artemis quietly goes back to this server's own connection.</p>
    <ol class="note" style="margin:6px 0 10px 18px;padding:0"><li>On your Mac: <code>EXIT_KEY="pick-a-long-secret" MAIN_URL="${esc(location.origin)}" npx tsx src/exit-node.ts</code></li><li>In another Terminal tab: <code>./cloudflared tunnel --url http://localhost:8090</code>, then copy the https address it prints.</li><li>Paste that address and the same secret below.</li></ol>
    <form data-exit class="evform"><label>Tunnel address<input name="url" placeholder="https://something.trycloudflare.com" value="${esc(x.url)}" autocomplete="off"></label>
      <label>Secret key ${x.hasKey ? `<span class="chip ok">${x.keyFromEnv ? "set on the server" : "saved"}</span>` : ""}<input name="key" type="password" placeholder="${x.hasKey ? "Leave empty to keep the saved key" : "The same EXIT_KEY you used above"}" autocomplete="new-password"></label>
      ${x.error && x.url ? `<p class="note" style="color:var(--warn)">${esc(x.error)}</p>` : ""}
      <div class="inline"><button class="btn primary">Save and test</button><button class="btn" type="button" data-exittest>Test again</button>${x.url ? `<button class="btn danger" type="button" data-exitoff>Turn off</button>` : ""}</div></form>
    <p class="note">Everything people browse goes through your home connection, so it uses your home bandwidth, and sites see your home address. Keep the member list small. The free tunnel address changes each time you restart the tunnel; paste the new one here.</p></div>`;
  return data + exitCard + launch + bot + trust;
}
async function downloadBackup() {
  const res = await fetch("/api/owner/backup", { credentials: "same-origin" });
  if (!res.ok) { let m = "Download failed"; try { m = (await res.json()).error || m; } catch { /* ignore */ } throw new Error(m); }
  const blob = await res.blob(), a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (/filename="([^"]+)"/.exec(res.headers.get("content-disposition") || "") || [])[1] || "artemis-backup.json";
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function restoreFrom(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { throw new Error("That file is not a valid backup."); }
  const ok = await confirmBox("Restore this backup?", `This replaces ALL current data (${data.users?.length ?? "?"} accounts, ${data.messages?.length ?? "?"} messages) with the file's contents. The server keeps running. A copy of the current data is saved first. You will be signed out, so sign in with the password from the backup.`, { ok: "Restore and restart", danger: true });
  if (!ok) return;
  const r = await api("/owner/restore", "POST", data);
  toast(`Restored ${r.users} accounts. Reloading...`, "ok");
  setTimeout(() => location.reload(), 1200);
}
async function click(b) {
  const d = b.dataset;
  if (d.launch) return run(() => api("/owner/launch", "POST", { action: d.launch }), d.launch === "start" ? "OG window started" : "OG window closed");
  if (b.matches?.("[data-exittest]")) return run(() => api("/owner/exit/test", "POST", {}), "Checked");
  if (b.matches?.("[data-exitoff]")) return run(() => api("/owner/exit", "PUT", { url: "" }), "Exit node turned off");
  if (d.backup) return run(() => downloadBackup(), "Backup downloaded. Keep it private.");
  if (d.trust) { const [mode, id] = d.trust.split(":"); return run(() => api("/owner/trust", "POST", { id, mode }), mode === "grant" ? "They are trusted now" : "Updated"); }
  return false;
}
async function change(el) {
  if (el.matches?.("[data-restore]")) { const f = el.files?.[0]; el.value = ""; if (f) { try { await restoreFrom(f); } catch (e) { toast(e.message, true); } } return true; }
  if (!el.dataset?.botopt) return false;
  const k = el.dataset.botopt, v = el.type === "checkbox" ? el.checked : k === "strikes" ? Number(el.value) : el.value;
  return run(() => api("/owner/bot", "PUT", { [k]: v }), k === "enabled" ? (v ? "ArtemisBot is on" : "ArtemisBot is off") : "Saved");
}
async function submit(f, v) {
  if (f.matches("[data-exit]")) return run(async () => { const r = await api("/owner/exit", "PUT", { url: v.get("url"), key: v.get("key") }); toast(r.ok ? "Connected. Browsing now leaves from your home." : r.error || "Saved, but it is not reachable yet.", r.ok ? "ok" : true); });
  if (f.matches("[data-botwords]")) return run(() => api("/owner/bot", "PUT", { words: String(v.get("words")).split("\n").map((s) => s.trim()).filter(Boolean) }), "Word list saved");
  return false;
}
function input(e) { if (e.target.id === "trustSearch") { Q = e.target.value; $("#trustList").innerHTML = userRows(); return true; } return false; }
