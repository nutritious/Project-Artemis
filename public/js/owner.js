/* Owner console: things only the owner can do. */
import { safety, bindSafety } from "./owner-safety.js";
import { codes, bindCodes } from "./owner-codes.js";
import { events, economy, eventsChange, ecoChange, afterPaint, bindOwnerEvents, watch } from "./owner-events.js";
import { isCoOwnerUp, $, $$, api, ago, avatar, byLine, confirmBox, esc, fmtBytes, fmtDur, icon, infoBox, isOwner, myRank, on, overlay, promptBox, rankOf, roleColor, roleName, state, toast, TIER_COLORS } from "./util.js";

let D = null, TAB = "overview";
let MQ = "", MF = "all";
/* sections are grouped so the console reads top to bottom: the server, its people, then safety */
const tabsFor = () => !isCoOwnerUp(state.me) ? [["Server", "overview", "Overview"], ["Server", "events", "Live event"], ["Server", "economy", "Economy"], ["Server", "safety", "ChatBot & trust"]] : [["Server", "overview", "Overview"], ["Server", "events", "Live event"], ["Server", "economy", "Economy"], ["Server", "codes", "Codes"], ["Server", "safety", "ChatBot & trust"], ["Server", "reports", "Reports"], ["People", "hierarchy", "Hierarchy"], ["People", "members", "Members"], ["People", "roles", "Roles"], ["People", "staff", "Staff"], ...(isOwner(state.me) ? [["Safety", "security", "Security"], ["Safety", "danger", "Danger zone"]] : [])];
export function buildOwner() {
  $("#view-owner").innerHTML = `<div class="page" id="ownerPage"><div class="skel"></div></div>`;
  { const t = document.createElement("button"); t.type = "button"; t.className = "to-top"; t.title = "Back to top"; t.setAttribute("aria-label", "Back to top"); t.textContent = "↑"; t.onclick = () => $("#ownerPage").scrollIntoView({ behavior: "smooth", block: "start" }); $("#view-owner").appendChild(t); }
  const p = $("#ownerPage"); bindOwnerEvents(() => { if (D && state.view === "owner") paint(); }); bindSafety(() => { if (D && state.view === "owner") paint(); }); bindCodes(() => { if (D && state.view === "owner") paint(); });
  p.addEventListener("click", onClick);
  p.addEventListener("change", onChange);
  p.addEventListener("input", onInput);
  p.addEventListener("submit", onSubmit);
  on("report", () => { if (state.view === "owner") load(); });
  on("roles", () => { if (D && state.view === "owner") paint(); });
  on("members", () => { if (D && state.view === "owner" && TAB !== "events" && !$("#memSearch:focus")) paint(); });
}
export async function onOwnerShown() { await load(); }
async function load() { try { D = await api("/owner/overview"); if (TAB === "events" || TAB === "economy") await events.load(); if (TAB === "safety") await safety.load(); if (TAB === "codes") await codes.load(); paint(); } catch (e) { toast(e.message, true); } }

const tierList = () => {
  const people = [...state.people.values()];
  const rows = [["owner", "Owner", TIER_COLORS.owner, (p) => p.role === "owner"], ["coowner", "Co-owners", TIER_COLORS.coowner, (p) => p.role === "coowner"], ["admin", "Commanders", TIER_COLORS.admin, (p) => p.role === "admin"],
    ...[...state.roles].sort((a, b) => a.position - b.position).map((r) => ["r:" + r.id, r.name, r.color, (p) => p.role === "member" && p.roleId === r.id]), ["member", "Crew", "#8d96bd", (p) => p.role === "member" && !state.roles.some((r) => r.id === p.roleId)]];
  return rows.map(([key, name, color, test]) => ({ key, name, color, people: people.filter(test).sort((a, b) => a.username.localeCompare(b.username)) }));
};
const hierarchy = () => `<div class="card glass"><h3>Hierarchy</h3><p class="note">Who ranks above whom. Each level can manage everyone below it. Use the Members section to move people between levels.</p>
  <div class="org">${tierList().map((t) => `<div class="tier" style="--tc:${esc(t.color)}"><div class="thead"><i class="rdot" style="background:${esc(t.color)}"></i><b style="color:${esc(t.color)}">${esc(t.name)}</b><span class="tcount">${t.people.length}</span></div><div class="tpeople">${t.people.map((p) => `<button class="pill" data-profile="${esc(p.id)}">${avatar(p.username, false, true)}<span>${esc(p.username)}</span></button>`).join("") || `<span class="faint tnone">nobody yet</span>`}</div></div>`).join("")}</div></div>`;
const roleOptions = (p) => {
  const owner = isOwner(state.me), cur = p.role === "member" ? (p.roleId && state.roles.some((r) => r.id === p.roleId) ? "role:" + p.roleId : "tier:member") : "tier:" + p.role;
  const opts = [...(owner ? [["tier:coowner", "Co-owner"]] : []), ["tier:admin", "Commander"], ...[...state.roles].sort((a, b) => a.position - b.position).map((r) => ["role:" + r.id, r.name]), ["tier:member", "Crew"]];
  if (!opts.some((o) => o[0] === cur)) opts.unshift([cur, roleName(p.role)]);
  return opts.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`).join("");
};
const memberRows = () => {
  const q = MQ.trim().toLowerCase();
  const list = [...state.people.values()].filter((p) => (!q || p.username.toLowerCase().includes(q)) && (MF === "all" || (MF === "staff" ? p.role !== "member" || p.roleId : MF === "crew" ? p.role === "member" && !p.roleId : true))).sort((a, b) => rankOf(a) - rankOf(b) || a.username.localeCompare(b.username));
  return list.map((p) => { const mine = p.id === state.me.id, can_ = !mine && p.role !== "owner" && rankOf(p) > myRank(); const c = roleColor(p);
    return `<div class="mrow">${avatar(p.username, false, true)}<div class="grow"><b style="${c ? `color:${esc(c)}` : ""}">${esc(p.username)}</b><div class="sub">${esc(p.profile?.status || "") || `seen ${ago(p.lastSeen)}`}</div></div>${can_ ? `<select class="sm-sel" data-assign="${esc(p.id)}" aria-label="Role for ${esc(p.username)}">${roleOptions(p)}</select>` : `<span class="chip">${mine ? "you" : p.role === "owner" ? "owner" : "ranked above you"}</span>`}</div>`; }).join("") || `<p class="note">No one matches.</p>`;
};
const membersTab = () => `<div class="card glass"><h3>Members <span class="chip">${state.people.size}</span></h3>
  <div class="inline"><input id="memSearch" type="search" placeholder="Search members…" value="${esc(MQ)}" autocomplete="off"><select id="memFilter" class="sm-sel" style="width:auto"><option value="all" ${MF === "all" ? "selected" : ""}>Everyone</option><option value="staff" ${MF === "staff" ? "selected" : ""}>Staff and roles</option><option value="crew" ${MF === "crew" ? "selected" : ""}>Plain crew</option></select></div>
  <div class="mlist" id="memList">${memberRows()}</div></div>`;

function paint() {
  const d = D, owner = isOwner(state.me), scroll = $("#oBody")?.scrollTop ?? 0;
  if (!tabsFor().some((t) => t[1] === TAB)) TAB = "overview";
  const kpi = (k, v, s) => `<div class="kpi glass"><span class="k">${k}</span><span class="v">${v}</span><span class="d">${s}</span></div>`;
  const people = [...state.people.values()];
  const rolesCard = `<div class="card glass"><h3>Roles <button class="btn sm primary" data-newrole>+ New role</button></h3>
      <p class="note">Rank runs top to bottom: Owner, Co-owner, Commander, then the roles below (first is highest), then everyone else. Someone can only manage people ranked below them.</p>
      <div class="rolelist">
        <div class="role fixed"><i class="rdot" style="background:#f5b942"></i><span class="rn" style="color:#f5b942">Owner</span><span class="rc">all powers · ${d.counts.owner}</span></div>
        <div class="role fixed"><i class="rdot" style="background:#ff8a5b"></i><span class="rn" style="color:#ff8a5b">Co-owner</span><span class="rc">all powers except wipes and transfer · ${d.counts.coowner}</span></div>
        <div class="role fixed"><i class="rdot" style="background:#8b7bff"></i><span class="rn" style="color:#8b7bff">Commander</span><span class="rc">all everyday powers · ${d.counts.admin}</span></div>
        ${state.roles.map((r, i) => `<div class="role"><i class="rdot" style="background:${esc(r.color)}"></i><div class="rmain"><span class="rn" style="color:${esc(r.color)}">${esc(r.name)}</span><span class="rperms">${r.perms.map((k) => `<span class="pp">${esc(state.permInfo[k]?.title ?? k)}</span>`).join("") || `<span class="pp none">no powers (badge only)</span>`}</span></div><span class="rc">${people.filter((p) => p.roleId === r.id).length} member${people.filter((p) => p.roleId === r.id).length === 1 ? "" : "s"}</span><span class="racts"><button class="btn sm" data-moverole="${esc(r.id)}" data-dir="up" ${i === 0 ? "disabled" : ""} aria-label="Move up">▲</button><button class="btn sm" data-moverole="${esc(r.id)}" data-dir="down" ${i === state.roles.length - 1 ? "disabled" : ""} aria-label="Move down">▼</button><button class="btn sm" data-editrole="${esc(r.id)}">Edit</button><button class="btn sm danger" data-delrole="${esc(r.id)}" data-name="${esc(r.name)}">Delete</button></span></div>`).join("")}
        <div class="role fixed"><i class="rdot" style="background:#8d96bd"></i><span class="rn">Crew</span><span class="rc">everyone else · ${d.counts.member}</span></div>
      </div>
      <p class="note">Give someone a role from their profile card in chat, or the Crew tab in Mission control.</p></div>`;
  const promote = (kind, label) => `<form data-promote="${kind}" class="inline"><select name="id" required><option value="">${label}…</option>${d.members.map((m) => `<option value="${esc(m.id)}">${esc(m.username)}</option>`).join("")}</select><button class="btn primary">Promote</button></form>`;
  const staffList = (list, empty) => `<div class="list">${list.map((c) => `<div class="li"><span class="lt" style="flex:1">${esc(c.username)}</span><span class="ls">seen ${ago(c.lastSeen)}</span><button class="btn sm" data-demote="${esc(c.id)}" data-name="${esc(c.username)}">Demote</button></div>`).join("") || `<p class="note">${empty}</p>`}</div>`;
  const body = {
    overview: `<div class="kpis">
      ${kpi("Crew", d.counts.owner + d.counts.coowner + d.counts.admin + d.counts.member, `${d.counts.coowner} co-owners · ${d.counts.admin} commanders · ${d.counts.banned} suspended`)}
      ${kpi("Messages", d.messages, `${d.channels} channels`)}
      ${kpi("Data file", fmtBytes(d.dataBytes), `${d.history} history · ${d.bookmarks} bookmarks`)}
      ${kpi("Server", d.memoryMb + " MB", `${d.node} · up ${fmtDur(d.uptimeSec)}`)}</div>
      <div class="card glass"><h3>Global announcement ${state.announcement ? `<span class="chip ok">live</span>` : `<span class="chip">none</span>`}</h3>
        <p class="note">Shows to everyone at once: a banner inside the app that pops in word by word, and on the sign-in screen.</p>
        <form data-ann style="display:grid;gap:10px"><label>Message<textarea name="text" rows="2" maxlength="300" placeholder="Launch window opens at 18:00 UTC" required></textarea></label>
        <div class="inline" style="margin:0"><button class="btn primary">Send to everyone</button>${state.announcement ? `<button type="button" class="btn" data-annclear>Clear current</button>` : ""}</div></form></div>
      <div class="card glass"><h3>Maintenance mode ${d.maintenance ? `<span class="chip warn">ON</span>` : `<span class="chip ok">off</span>`}</h3>
        <p class="note">Pauses browsing and search for regular crew. Chat stays open, and staff can still use the proxy.</p>
        <form data-maint style="display:grid;gap:10px"><label>Message shown to crew<input name="message" maxlength="200" value="${esc(d.maintenanceMessage)}" placeholder="Back in 10 minutes"></label>
        <button class="btn ${d.maintenance ? "" : "primary"}" data-on="${d.maintenance ? 0 : 1}">${d.maintenance ? "Resume browsing" : "Dock the proxy"}</button></form></div>`,
    hierarchy: hierarchy(),
    members: membersTab(),
    roles: rolesCard,
    staff: `<div class="grid2">
      ${owner ? `<div class="card glass"><h3>Co-owners <span class="chip coowner">${d.coowners.length}</span></h3><p class="note">Co-owners run the server with you. They hold every power except wipes, backups, signing everyone out and transferring ownership.</p>${staffList(d.coowners, "No co-owners yet.")}${promote("coowner", "Name a co-owner")}</div>` : ""}
      <div class="card glass"><h3>Commanders <span class="chip">${d.commanders.length}</span></h3><p class="note">Commanders can broadcast, manage crew, block domains and read traffic. They can't touch commanders, co-owners or the owner.</p>${staffList(d.commanders, "No commanders yet.")}${promote("admin", "Promote to commander")}</div></div>`,
    security: `<div class="card glass"><h3>Security</h3>
        <p class="note">Rotates the signing key. Everyone else is signed out immediately and every open proxy tab needs a fresh login. Use this if you think an account or token leaked.</p>
        <button class="btn" data-signout>Sign out everyone else</button>
        <p class="note">Download a full JSON backup (accounts, chat, settings, audit log).</p>
        <a class="btn" href="/api/owner/export" download>Download backup</a></div>`,
    danger: `<div class="card glass danger-zone"><h3>Danger zone</h3>
        ${[["chat", "Erase all chat messages", `${d.messages} messages across every channel`], ["history", "Clear everyone's flight log", "Browsing history for all accounts"], ["stats", "Reset usage statistics", "Per-user request and bandwidth counters"], ["audit", "Erase the audit log", `${d.auditEntries} recorded actions`]].map(([k, t, s]) => `<div class="wipe-row"><div><b>${t}</b><small>${s}</small></div><button class="btn sm danger" data-wipe="${k}" data-title="${t}">Erase</button></div>`).join("")}
        <div class="wipe-row"><div><b>Transfer ownership</b><small>You become a commander. This can't be undone by you.</small></div></div>
        <form data-transfer class="inline"><select name="id" required><option value="">Choose the new owner…</option>${[...d.coowners, ...d.commanders, ...d.members].map((m) => `<option value="${esc(m.id)}">${esc(m.username)}</option>`).join("")}</select><button class="btn danger">Transfer</button></form></div>`,
    reports: `<div class="card glass"><h3>Issue reports <span class="chip ${d.reports.some((r) => r.status === "open") ? "warn" : "ok"}">${d.reports.filter((r) => r.status === "open").length} open</span></h3>
        <p class="note">Sent by crew from the Report issue button. Only the owner and co-owners can see these.</p>
        ${d.reports.map((r) => `<div class="rep ${r.status}"><div class="rtop"><b>${esc(r.username)}</b><span class="chip">${esc(r.kind)}</span><span class="faint">${ago(r.ts)}${r.page ? ` · ${esc(r.page)}` : ""}</span><span class="grow"></span><button class="btn sm" data-repdone="${esc(r.id)}" data-st="${r.status === "open" ? "done" : "open"}">${r.status === "open" ? "Mark resolved" : "Reopen"}</button><button class="btn sm danger" data-repdel="${esc(r.id)}">Delete</button></div><p>${esc(r.text)}</p></div>`).join("") || `<p class="note">No reports. All quiet.</p>`}</div>`,
    events: events.html(),
    economy: economy.html(),
    safety: safety.html(),
    codes: codes.html(),
  }[TAB];
  $("#ownerPage").innerHTML = `
    <div class="owner-hero"><div class="crown">${icon("owner")}</div><div><h2 style="margin:0">${owner ? "Owner console" : "Co-owner console"}</h2><p class="sub" style="margin:2px 0 0">${owner ? "You own this server. Co-owners and commanders can run day-to-day ops, only you can do the risky parts." : "You help run this server. The owner keeps wipes, backups and ownership."}</p></div></div>
    <nav class="atabs glass" id="oTabs" aria-label="Owner console sections">${tabsFor().map(([g, k, l], i, a) => `${i === 0 || a[i - 1][0] !== g ? `<span class="ngroup">${g}</span>` : ""}<button data-ot="${k}" class="${k === TAB ? "on" : ""}">${l}</button>`).join("")}</nav>
    <div id="oBody">${body}</div>`;
  if ($("#oBody")) $("#oBody").scrollTop = scroll;
  afterPaint(); watch(TAB === "events" || TAB === "economy");
}

const askPw = (title, text) => promptBox(title, { label: "Your password", type: "password", ok: "Confirm", text });
async function run(fn, ok) { try { await fn(); if (ok) toast(ok, "ok"); await load(); } catch (e) { toast(e.message, true); } }

function roleModal(role) {
  const info = state.permInfo, all = Object.keys(info);
  const o = overlay(`<form class="modal glass" style="width:min(520px,100%)"><h3>${role ? "Edit role" : "New role"}</h3>
    <div class="inline"><label style="flex:1">Name<input name="name" maxlength="24" required value="${esc(role?.name ?? "")}" placeholder="Moderator"></label><label>Color<input name="color" type="color" value="${esc(role?.color ?? "#8b7bff")}" style="padding:2px;height:40px;width:64px"></label></div>
    <div style="display:grid;gap:4px;max-height:45vh;overflow:auto">${all.map((k) => `<label class="switch" style="padding:6px 0"><span>${esc(info[k].title)}<small>${esc(info[k].desc)}</small></span><input type="checkbox" name="perm" value="${k}" ${role?.perms.includes(k) ? "checked" : ""}></label>`).join("")}</div>
    <div class="row"><button type="button" class="btn" data-x>Cancel</button><button class="btn primary">${role ? "Save" : "Create role"}</button></div></form>`);
  o.addEventListener("click", (e) => { if (e.target === o || e.target.matches("[data-x]")) o.remove(); });
  o.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = new FormData(e.target);
    const body = { name: f.get("name"), color: f.get("color"), perms: f.getAll("perm") };
    try { await (role ? api("/owner/roles/" + role.id, "PUT", body) : api("/owner/roles", "POST", body)); o.remove(); toast(role ? "Role saved" : "Role created", "ok"); } catch (err) { toast(err.message, true); }
  });
  o.querySelector("input[name=name]").focus();
}
async function onClick(e) {
  const b = e.target.closest("button"); if (!b) return;
  const ds = b.dataset;
  if (ds.ot) { TAB = ds.ot; if (TAB === "events" || TAB === "economy") await events.load(); if (TAB === "safety") await safety.load(); if (TAB === "codes") await codes.load(); return paint(); }
  if (await safety.click(b) || await codes.click(b)) return; if (await events.click(b)) return; if (await economy.click(b)) return;
  if (b.matches("[data-annclear]")) { try { await api("/admin/announcement", "DELETE"); state.announcement = null; toast("Announcement cleared", "ok"); paint(); } catch (err) { toast(err.message, true); } return; }
  if (ds.repdone) return run(() => api("/owner/reports/" + ds.repdone, "PUT", { status: ds.st }));
  if (ds.repdel) return run(() => api("/owner/reports/" + ds.repdel, "DELETE"));
  if (b.matches("[data-newrole]")) return roleModal(null);
  if (ds.editrole) return roleModal(state.roles.find((r) => r.id === ds.editrole));
  if (ds.moverole) return run(() => api(`/owner/roles/${ds.moverole}/move`, "POST", { dir: ds.dir }));
  if (ds.delrole) { if (await confirmBox(`Delete the ${ds.name} role?`, "Everyone holding it goes back to plain crew.", { ok: "Delete", danger: true })) run(() => api("/owner/roles/" + ds.delrole, "DELETE"), "Role deleted"); return; }
  if (ds.demote) { if (await confirmBox(`Demote ${ds.name}?`, "They go back to regular crew.", { ok: "Demote" })) run(() => api(`/admin/users/${ds.demote}/role`, "PUT", { role: "member" }), "Demoted"); }
  else if (b.matches("[data-signout]")) { const pw = await askPw("Sign out everyone?", "All other sessions end now."); if (pw) run(() => api("/owner/signout-all", "POST", { password: pw }), "Everyone else was signed out"); }
  else if (ds.wipe) {
    if (!(await confirmBox(`${ds.title}?`, "This can't be undone. Consider downloading a backup first.", { ok: "Continue", danger: true }))) return;
    const pw = await askPw("Confirm with your password", ds.title); if (pw) run(() => api("/owner/wipe", "POST", { what: ds.wipe, password: pw }), "Done");
  }
}
async function onChange(e) {
  const t = e.target;
  if (await eventsChange(t) || ecoChange(t) || await safety.change(t)) return;
  if (t.id === "memFilter") { MF = t.value; $("#memList").innerHTML = memberRows(); return; }
  if (!t.dataset.assign) return;
  const id = t.dataset.assign, [kind, val] = t.value.split(":"), p = state.people.get(id); if (!p) return;
  try {
    if (kind === "tier") { await api(`/admin/users/${id}/role`, "PUT", { role: val }); if (val === "member") await api(`/admin/users/${id}/custom-role`, "PUT", { roleId: null }).catch(() => {}); }
    else { if (p.role !== "member") await api(`/admin/users/${id}/role`, "PUT", { role: "member" }); await api(`/admin/users/${id}/custom-role`, "PUT", { roleId: val }); }
    toast("Role updated", "ok");
  } catch (err) { toast(err.message, true); }
  await load();
}
function onInput(e) { if (safety.input(e) || economy.input(e)) return; if (e.target.id === "memSearch") { MQ = e.target.value; $("#memList").innerHTML = memberRows(); } }
async function onSubmit(e) {
  e.preventDefault();
  const f = e.target, v = new FormData(f);
  if (await safety.submit(f, v) || await codes.submit(f, v)) return; if (await events.submit(f, v)) return; if (await economy.submit(f, v)) return;
  if (f.matches("[data-ann]")) { try { const r = await api("/admin/announcement", "POST", { text: v.get("text") }); state.announcement = r.announcement; toast("Announced to everyone", "ok"); paint(); } catch (err) { toast(err.message, true); } return; }
  if (f.matches("[data-promote]")) { const kind = f.dataset.promote; if (v.get("id")) run(() => api(`/admin/users/${v.get("id")}/role`, "PUT", { role: kind }), kind === "coowner" ? "Named co-owner" : "Promoted to commander"); }
  else if (f.matches("[data-maint]")) { const on = e.submitter?.dataset.on === "1"; run(() => api("/owner/maintenance", "PUT", { on, message: v.get("message") }), on ? "Proxy docked" : "Browsing resumed"); }
  else if (f.matches("[data-transfer]")) {
    const id = v.get("id"); if (!id) return;
    const name = f.querySelector(`option[value="${id}"]`).textContent;
    if (!(await confirmBox(`Make ${name} the owner?`, "You'll become a commander and lose these controls.", { ok: "Transfer", danger: true }))) return;
    const pw = await askPw("Confirm with your password", `Transfer ownership to ${name}`); if (!pw) return;
    try { await api("/owner/transfer", "POST", { userId: id, password: pw }); await infoBox("Ownership transferred", `${name} is now the owner.`); (window.onbeforeunload = null, location.reload()); } catch (err) { toast(err.message, true); }
  }
}
