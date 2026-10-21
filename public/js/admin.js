/* Mission control: overview + live charts, crew management, traffic, broadcast/server settings, audit log. */
import { $, $$, api, avatar, ago, can, confirmBox, emit, esc, fmtBytes, fmtDur, fmtNum, infoBox, isCoOwnerUp, isOwner, isStaff, myRank, on, promptBox, roleById, state, toast } from "./util.js";
import { adminSocketSend } from "./chat.js";

const A = { tab: "overview", data: null, pushes: 0, subscribed: false, filter: "" };
const isStaffRole = () => isStaff(state.me);
const tabs = () => [
  ["overview", "Overview", can("view_dashboard")], ["crew", "Crew", can("manage_users") || can("manage_roles")], ["traffic", "Traffic", can("view_dashboard")],
  ["terminal", "Terminal", can("use_terminal")], ["server", "Broadcast & server", can("announce") || can("manage_blocklist") || isStaffRole()], ["audit", "Audit log", can("view_dashboard")],
].filter((t) => t[2]);
function renderTabs() {
  const t = tabs();
  if (!t.some((x) => x[0] === A.tab)) A.tab = t[0]?.[0] ?? "overview";
  $("#aTabs").innerHTML = t.map(([k, l]) => `<button data-t="${k}" class="${k === A.tab ? "on" : ""}">${l}</button>`).join("");
}

export function buildAdmin() {
  $("#view-admin").innerHTML = `<div class="page">
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><h2 style="margin:0">Mission control</h2><span class="live">LIVE</span></div>
    <div class="atabs glass" id="aTabs"></div>
    <div id="aBody"><div class="skel"></div></div>
  </div>`;
  renderTabs();
  on("self", () => { renderTabs(); if (A.data && $("#view-admin.on")) reload(); });
  $("#aTabs").onclick = (e) => { const b = e.target.closest("[data-t]"); if (!b) return; A.tab = b.dataset.t; $$("#aTabs button").forEach((x) => x.classList.toggle("on", x === b)); paint(); };
  $("#aBody").addEventListener("click", onClick);
  $("#aBody").addEventListener("input", onInput);
  $("#aBody").addEventListener("change", onChange);
  $("#aBody").addEventListener("submit", onSubmit);
  on("ws", (m) => {
    if (!A.data) return;
    if (m.t === "stats") {
      A.data.stats = m.stats; A.data.users = m.users; A.pushes++;
      if (A.tab === "overview" || A.tab === "traffic") paint(true);
      else if (A.tab === "crew" && A.pushes % 5 === 0 && !$(".overlay")) paint(true);
    } else if (m.t === "audit") { A.data.audit.unshift(m.entry); if (A.tab === "audit") paint(); }
  });
  on("wsopen", () => { if (A.subscribed) adminSocketSend({ t: "admin-sub", on: true }); });
}
export async function onAdminShown(shown) {
  if (shown) {
    A.subscribed = true; adminSocketSend({ t: "admin-sub", on: true });
    await reload();
  } else { A.subscribed = false; adminSocketSend({ t: "admin-sub", on: false }); }
}
async function reload() { try { A.data = await api("/admin/overview"); renderTabs(); paint(); } catch (e) { toast(e.message, true); } }

/* ------------------------------ charts ------------------------------ */
function areaChart(series, { color = "var(--accent)", color2, series2, label = "" } = {}) {
  const W = 600, H = 190, P = 6;
  const max = Math.max(4, ...series, ...(series2 ?? []));
  const nice = Math.ceil(max / 4) * 4;
  const pts = (arr) => arr.map((v, i) => [P + (i / (arr.length - 1)) * (W - 2 * P), H - 22 - (v / nice) * (H - 40)]);
  const line = (p) => p.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" ");
  const p1 = pts(series);
  const grid = [0, 1, 2, 3, 4].map((i) => { const y = H - 22 - (i / 4) * (H - 40); return `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-dasharray="3 5"/><text x="${W - 4}" y="${y - 4}" text-anchor="end" fill="var(--faint)" font-size="10" font-family="monospace">${fmtNum(Math.round((i / 4) * nice))}</text>`; }).join("");
  const id = "g" + Math.random().toString(36).slice(2, 7);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <path d="${line(p1)} L${p1.at(-1)[0]} ${H - 22} L${p1[0][0]} ${H - 22} Z" fill="url(#${id})"/>
    <path d="${line(p1)}" fill="none" stroke="${color}" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    ${series2 ? `<path d="${line(pts(series2))}" fill="none" stroke="${color2}" stroke-width="1.8" vector-effect="non-scaling-stroke"/>` : ""}
    <text x="4" y="${H - 6}" fill="var(--faint)" font-size="10" font-family="monospace">−60 min</text><text x="${W - 4}" y="${H - 6}" text-anchor="end" fill="var(--faint)" font-size="10" font-family="monospace">now</text>
  </svg>`;
}
function statusBar(st) {
  const total = Object.values(st).reduce((a, b) => a + b, 0) || 1;
  const col = { "2xx": "var(--ok)", "3xx": "var(--accent2)", "4xx": "var(--warn)", "5xx": "var(--bad)" };
  return `<div style="display:flex;height:12px;border-radius:99px;overflow:hidden;background:var(--line)">${Object.entries(st).map(([k, v]) => `<i style="width:${(v / total) * 100}%;background:${col[k]}" title="${k}: ${v}"></i>`).join("")}</div>
  <div class="chart-legend">${Object.entries(st).map(([k, v]) => `<span><i style="background:${col[k]}"></i>${k} <b>${fmtNum(v)}</b></span>`).join("")}</div>`;
}

/* ------------------------------ painting ------------------------------ */
function paint(live) {
  const d = A.data, box = $("#aBody"); if (!d || !box) return;
  const fn = { overview, crew, traffic, server, audit, terminal }[A.tab];
  if (A.tab === "terminal" && live) return;
  if (!d.stats && ["overview", "traffic", "audit"].includes(A.tab)) { box.innerHTML = `<p class="note">You don't have access to this section.</p>`; return; }
  if (live && A.tab === "overview") { const scroll = box.parentElement.scrollTop; box.innerHTML = overview(d); box.parentElement.scrollTop = scroll; return; }
  if (live && A.tab === "traffic") { const l = $("#logBox"); if (l) { l.innerHTML = logRows(d.stats.logs); $("#aKpi").innerHTML = kpis(d); return; } }
  const scroll = box.parentElement.scrollTop;
  box.innerHTML = fn(d);
  box.parentElement.scrollTop = scroll;
}
const kpis = (d) => {
  const s = d.stats;
  return [
    ["Requests / min", fmtNum(s.perMinuteNow), `${fmtNum(s.totalRequests)} total`],
    ["Active crew", s.activeUsers, `${d.users.length} registered`],
    ["Data proxied", fmtBytes(s.totalBytes), "since last restart"],
    ["Error rate", (s.errorRate * 100).toFixed(1) + "%", "last 5 minutes"],
    ["Uptime", fmtDur(s.uptimeSec), d.proxyIsolated ? "origin isolation on" : "single origin"],
  ].map(([k, v, sub]) => `<div class="kpi glass"><span class="k">${k}</span><span class="v">${v}</span><span class="d">${sub}</span></div>`).join("");
};
function overview(d) {
  const s = d.stats, top = d.stats.topHosts, maxN = Math.max(1, ...top.map((t) => t.n));
  const topUsers = [...d.users].sort((a, b) => b.requests - a.requests).slice(0, 5), maxU = Math.max(1, ...topUsers.map((u) => u.requests));
  return `<div style="display:grid;gap:16px">
    <div class="kpis" id="aKpi">${kpis(d)}</div>
    <div class="grid2">
      <div class="card glass"><h3>Requests per minute <span class="chip ok">${s.perMinuteNow}/min</span></h3>${areaChart(s.series.req, { color: "var(--accent)", series2: s.series.err, color2: "var(--bad)", label: "Requests per minute" })}<div class="chart-legend"><span><i style="background:var(--accent)"></i>Requests</span><span><i style="background:var(--bad)"></i>Errors</span></div></div>
      <div class="card glass"><h3>Bandwidth per minute</h3>${areaChart(s.series.bytes.map((b) => b / 1024), { color: "var(--accent2)", label: "Kilobytes per minute" })}<div class="chart-legend"><span><i style="background:var(--accent2)"></i>KB / min</span></div></div>
    </div>
    <div class="grid2">
      <div class="card glass"><h3>Top destinations</h3><div class="bars">${top.length ? top.map((t) => `<div class="barrow"><span class="bn" title="${esc(t.host)}">${esc(t.host)}</span><span class="bt"><i style="width:${(t.n / maxN) * 100}%"></i></span><span class="bv">${fmtNum(t.n)}</span></div>`).join("") : `<p class="note">No proxied traffic yet. Browse something to see it here.</p>`}</div></div>
      <div class="card glass"><h3>Most active crew</h3><div class="bars">${topUsers.map((u) => `<div class="barrow"><span class="bn">${esc(u.username)}</span><span class="bt"><i style="width:${(u.requests / maxU) * 100}%"></i></span><span class="bv">${fmtNum(u.requests)}</span></div>`).join("")}</div><h3 style="margin-top:6px">Response codes</h3>${statusBar(s.status)}</div>
    </div></div>`;
}

const roleChip = (u) => (u.banned ? `<span class="chip bad">suspended</span>` : u.role === "owner" ? `<span class="chip owner">owner</span>` : u.role === "coowner" ? `<span class="chip coowner">co-owner</span>` : u.role === "admin" ? `<span class="chip">commander</span>` : roleById(u.roleId) ? `<span class="chip role" style="--rc:${esc(roleById(u.roleId).color)}">${esc(roleById(u.roleId).name)}</span>` : `<span class="chip ok">crew</span>`);
function crew(d) {
  const q = A.filter.toLowerCase();
  const users = d.users.filter((u) => u.username.toLowerCase().includes(q));
  const open = d.invites.filter((i) => !i.usedBy);
  return `<div style="display:grid;gap:16px">
    ${["owner", "coowner", "admin"].includes(state.me.role) ? `<div class="card glass"><h3>Give coins</h3><form data-givecoins class="evform"><div class="row2"><label>Callsign<input name="username" required maxlength="24" placeholder="Player name"></label><label>Amount (any number, negative takes coins back)<input name="amount" type="number" value="1000" required></label></div><label>Reason (they see it)<input name="reason" maxlength="60" placeholder="Event prize"></label><div class="inline"><button class="btn primary">Give coins</button></div></form></div>` : ""}
    <div class="card glass"><h3>Crew roster <input data-filter placeholder="Filter by callsign" value="${esc(A.filter)}" style="max-width:220px"></h3>
      <div class="tablewrap"><table><thead><tr><th>Callsign</th><th>Status</th><th>Requests</th><th>Data</th><th>Last seen</th><th></th></tr></thead><tbody>
      ${users.map((u) => { const self = u.id === state.me.id; return `<tr><td class="u">${avatar(u.username, Date.now() - u.lastSeen < 120000, true)}<b>${esc(u.username)}</b>${self ? ` <span class="faint">(you)</span>` : ""}</td><td>${roleChip(u)}</td><td class="mono">${fmtNum(u.requests)}</td><td class="mono">${fmtBytes(u.bytes)}</td><td class="dim">${Date.now() - u.lastSeen < 120000 ? '<span class="live">ONLINE</span>' : ago(u.lastSeen)}</td>
      <td>${(() => { const canAct = !self && u.role !== "owner" && u.rank > myRank(); if (!canAct) return `<span class="faint" style="float:right">${u.role === "owner" ? "protected" : self ? "" : "ranked above you"}</span>`;
        return `<div class="acts">${isCoOwnerUp(state.me) ? `<button class="btn sm" data-role="${u.id}" data-to="${u.role === "admin" || u.role === "coowner" ? "member" : "admin"}">${u.role === "admin" || u.role === "coowner" ? "Demote" : "Make commander"}</button>` : ""}${can("manage_roles") && u.role !== "coowner" && u.role === "member" ? `<select class="sm-sel" data-crole="${u.id}"><option value="">No role</option>${state.roles.filter((r) => isOwner(state.me) || r.position > myRank()).map((r) => `<option value="${esc(r.id)}" ${r.id === u.roleId ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select>` : ""}${can("manage_users") ? `<button class="btn sm" data-reset="${u.id}" data-name="${esc(u.username)}">Reset password</button><button class="btn sm ${u.banned ? "" : "danger"}" data-ban="${u.id}" data-name="${esc(u.username)}" data-to="${u.banned ? 0 : 1}">${u.banned ? "Reinstate" : "Suspend"}</button><button class="btn sm danger" data-rm="${u.id}" data-name="${esc(u.username)}">Remove</button>` : ""}</div>`; })()}</td></tr>`; }).join("") || `<tr><td colspan="6" class="dim">No crew matches.</td></tr>`}
      </tbody></table></div></div>
    ${can("manage_users") ? `<div class="card glass"><h3>Invite codes <button class="btn sm primary" data-newinvite>+ New code</button></h3>
      ${open.length ? `<div class="list">${open.map((i) => `<div class="li"><span class="mono lt" style="flex:1">${esc(i.code)}</span><span class="ls">by ${esc(i.createdBy)} · ${ago(i.createdAt)}</span><button class="btn sm" data-copy="${esc(i.code)}">Copy</button><button class="x" data-revoke="${esc(i.code)}" title="Revoke">×</button></div>`).join("")}</div>` : `<p class="note">No unused invites. ${d.server.openRegistration ? "Registration is open, so anyone can join." : "Create a code and share it with someone you trust."}</p>`}
      ${d.invites.filter((i) => i.usedBy).length ? `<p class="note">Redeemed: ${d.invites.filter((i) => i.usedBy).map((i) => esc(i.usedBy)).join(", ")}</p>` : ""}</div>` : ""}</div>`;
}
const TERM = { lines: [{ k: "info", t: "Admin terminal. Type help to see what you can run." }], hist: [], hi: 0 };
function terminal() {
  return `<div class="card glass"><h3>Terminal <span class="faint">every command is audited</span></h3>
    <div class="chips-row">${["help", "stats", "who", "users", "channels", "roles"].map((c) => `<button class="btn sm" data-tcmd="${c}">${c}</button>`).join("")}</div>
    <div class="term" id="termOut">${termHtml()}</div>
    <form class="term-form" data-term><span class="prompt">❯</span><input id="termIn" autocomplete="off" spellcheck="false" placeholder="announce Launch at 18:00 UTC" aria-label="Command"><button class="btn sm primary">Run</button></form></div>`;
}
const termHtml = () => TERM.lines.map((l) => `<div class="tl ${l.k}">${esc(l.t)}</div>`).join("");
async function runTerm(line) {
  line = line.trim(); if (!line) return;
  if (line === "clear") { TERM.lines = []; paintTerm(); return; }
  TERM.hist.push(line); TERM.hi = TERM.hist.length;
  TERM.lines.push({ k: "cmd", t: "❯ " + line }); paintTerm();
  try {
    const r = await api("/admin/command", "POST", { line });
    for (const t of r.output) TERM.lines.push({ k: r.ok ? "out" : "err", t });
  } catch (e) { TERM.lines.push({ k: "err", t: e.message }); }
  if (TERM.lines.length > 400) TERM.lines.splice(0, TERM.lines.length - 400);
  paintTerm();
  if (A.data) api("/admin/overview").then((d) => { A.data = d; }).catch(() => {});
}
function paintTerm() { const o = $("#termOut"); if (o) { o.innerHTML = termHtml(); o.scrollTop = o.scrollHeight; } }
const logRows = (logs) => logs.length ? logs.map((l) => `<div class="l"><span class="faint">${new Date(l.ts).toLocaleTimeString([], { hour12: false })}</span><span>${esc(l.method)}</span><span class="s${String(l.status)[0]}">${l.status}</span><span title="${esc(l.host + l.path)}"><b>${esc(l.user)}</b> → ${esc(l.host)}${esc(l.path)}</span><span class="faint">${l.ms}ms</span></div>`).join("") : `<p class="note">Nothing yet. Open a site through the browser.</p>`;
function traffic(d) {
  return `<div style="display:grid;gap:16px"><div class="kpis" id="aKpi">${kpis(d)}</div><div class="card glass"><h3>Live request log <span class="live">STREAMING</span></h3><div class="logs" id="logBox">${logRows(d.stats.logs)}</div></div></div>`;
}
function server(d) {
  const s = d.server, a = d.announcement;
  return `<div class="grid2">
    ${can("announce") ? `<div class="card glass"><h3>Announcement banner</h3>
      <p class="note">Shown at the top of the app for everyone, instantly.</p>
      ${a ? `<div class="chip ok" style="justify-self:start">LIVE</div><p style="margin:0">“${esc(a.text)}” <span class="faint">— ${esc(a.by)}, ${ago(a.ts)}</span></p>` : ""}
      <form data-announce class="inline"><input name="text" maxlength="300" placeholder="Launch window opens at 18:00 UTC" required><button class="btn primary">Broadcast</button></form>
      ${a ? `<button class="btn sm danger" data-clear-ann style="justify-self:start">Clear announcement</button>` : ""}</div>` : ""}
    ${isStaffRole() ? `<div class="card glass"><h3>Server settings</h3>
      <label class="switch"><span>Open registration<small>Anyone can create an account without an invite.</small></span><input type="checkbox" data-open ${s.openRegistration ? "checked" : ""}></label>
      <label>Proxy rate limit per user (requests / min)<div class="inline"><input type="number" min="30" max="20000" value="${s.rateLimit}" data-rate><button class="btn" data-saverate>Apply</button></div></label>
      <label>Rules new accounts must agree to<textarea data-rules rows="9" maxlength="8000" spellcheck="true" style="font:12px var(--mono)">${esc(s.rules ?? "")}</textarea></label>
      <div class="inline"><button class="btn" data-saverules>Save rules</button><span class="note">Use "## Heading" for sections and "- Title — text" for each rule. Leave it empty to turn the rules checkbox off.</span></div>
      <label>Default search engine for new accounts<select data-engine>${state.engines.map((e) => `<option value="${e.id}" ${s.defaultEngine === e.id ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select></label>
      <p class="note">Private network access: <b>${d.privateAllowed ? "allowed (testing mode)" : "blocked"}</b> · Upstream proxy: <b>${d.upstreamProxy ? "on" : "off"}</b> · Origin isolation: <b>${d.proxyIsolated ? "on" : "off"}</b></p></div>` : ""}
    ${can("manage_blocklist") ? `<div class="card glass" style="grid-column:1/-1"><h3>Blocked domains</h3>
      <form data-block class="inline"><input name="host" placeholder="example.com (also blocks subdomains)" required><button class="btn">Block</button></form>
      <div class="tags">${d.blocklist.length ? d.blocklist.map((h) => `<span class="tag">${esc(h)}<button data-unblock="${esc(h)}" aria-label="Unblock ${esc(h)}">×</button></span>`).join("") : `<span class="note">Nothing blocked.</span>`}</div></div>` : ""}
  </div>`;
}
function audit(d) {
  return `<div class="card glass"><h3>Audit log <span class="faint">${d.audit.length} recent actions</span></h3><div class="audit">${d.audit.length ? d.audit.map((a) => `<div class="a"><span class="t">${new Date(a.ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span><b>${esc(a.by)}</b><code>${esc(a.action)}</code><span class="dim">${esc(a.detail)}</span></div>`).join("") : `<p class="note">No admin actions recorded yet.</p>`}</div></div>`;
}

/* ------------------------------ actions ------------------------------ */
const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok, "ok"); await reload(); } catch (e) { toast(e.message, true); } };
async function onClick(e) {
  const t = e.target.closest("button"); if (!t) return;
  const ds = t.dataset;
  if (ds.tcmd) { runTerm(ds.tcmd); return; }
  if (ds.role) return run(() => api(`/admin/users/${ds.role}/role`, "PUT", { role: ds.to }), "Role updated");
  if (ds.ban !== undefined) {
    const ban = ds.to === "1";
    if (ban && !(await confirmBox(`Suspend ${ds.name}?`, "They will be signed out of chat and blocked from signing in.", { ok: "Suspend", danger: true }))) return;
    return run(() => api(`/admin/users/${ds.ban}/ban`, "POST", { banned: ban }), ban ? "Suspended" : "Reinstated");
  }
  if (ds.reset) {
    if (!(await confirmBox(`Reset ${ds.name}'s password?`, "A temporary password will be generated. Their old one stops working.", { ok: "Reset" }))) return;
    try { const r = await api(`/admin/users/${ds.reset}/reset-password`, "POST", {}); await infoBox("Temporary password", `Give this to ${ds.name} — it won't be shown again.`, r.password); reload(); } catch (err) { toast(err.message, true); }
    return;
  }
  if (ds.rm) { if (await confirmBox(`Remove ${ds.name}?`, "Their account, bookmarks and history are deleted permanently.", { ok: "Remove", danger: true })) run(() => api(`/admin/users/${ds.rm}`, "DELETE"), "Removed"); return; }
  if (t.matches("[data-newinvite]")) return run(async () => { const r = await api("/admin/invites", "POST", {}); try { await navigator.clipboard.writeText(r.code); } catch { /* clipboard blocked */ } toast(`Created ${r.code} (copied)`, "ok"); });
  if (ds.revoke) return run(() => api("/admin/invites/" + ds.revoke, "DELETE"));
  if (ds.copy) { try { await navigator.clipboard.writeText(ds.copy); toast("Copied", "ok"); } catch { toast(ds.copy); } return; }
  if (t.matches("[data-clear-ann]")) return run(() => api("/admin/announcement", "DELETE"), "Announcement cleared");
  if (ds.unblock) return run(() => api("/admin/blocklist/" + encodeURIComponent(ds.unblock), "DELETE"));
  if (t.matches("[data-saverules]")) return run(() => api("/admin/settings", "PUT", { rules: $("[data-rules]").value }), "Rules saved");
  if (t.matches("[data-saverate]")) return run(() => api("/admin/settings", "PUT", { rateLimit: $("[data-rate]").value }), "Rate limit applied");
}
function onChange(e) {
  if (e.target.matches("[data-crole]")) { run(() => api(`/admin/users/${e.target.dataset.crole}/custom-role`, "PUT", { roleId: e.target.value || null }), "Role updated"); return; }
  if (e.target.matches("[data-open]")) run(() => api("/admin/settings", "PUT", { openRegistration: e.target.checked }), e.target.checked ? "Registration opened" : "Registration closed");
  if (e.target.matches("[data-engine]")) run(() => api("/admin/settings", "PUT", { defaultEngine: e.target.value }), "Default engine updated");
}
function onInput(e) { if (e.target.matches("[data-filter]")) { A.filter = e.target.value; const pos = e.target.selectionStart; paint(); const f = $("[data-filter]"); f.focus(); f.setSelectionRange(pos, pos); } }
function onSubmit(e) {
  e.preventDefault();
  if (e.target.matches("[data-term]")) { const i = $("#termIn"); const v = i.value; i.value = ""; runTerm(v); return; }
  const f = e.target, v = new FormData(f);
  if (f.matches("[data-announce]")) run(() => api("/admin/announcement", "POST", { text: v.get("text") }), "Broadcast sent");
  if (f.matches("[data-givecoins]")) run(async () => { const r = await api("/admin/coins", "POST", { username: v.get("username"), amount: Number(v.get("amount")), reason: v.get("reason") }); toast(`Gave coins to ${r.username}`, "ok"); });
  if (f.matches("[data-block]")) run(() => api("/admin/blocklist", "POST", { host: v.get("host") }), "Domain blocked");
}

document.addEventListener("keydown", (e) => {
  if (e.target?.id !== "termIn") return;
  if (e.key === "ArrowUp") { e.preventDefault(); TERM.hi = Math.max(0, TERM.hi - 1); e.target.value = TERM.hist[TERM.hi] ?? ""; }
  else if (e.key === "ArrowDown") { e.preventDefault(); TERM.hi = Math.min(TERM.hist.length, TERM.hi + 1); e.target.value = TERM.hist[TERM.hi] ?? ""; }
});
