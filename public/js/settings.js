/* Settings: themes, search, cloak, panic key, profile, account. */
import { $, $$, api, ago, avatar, confirmBox, emit, esc, hostOf, on, promptBox, roleName, roleTags, state, toast } from "./util.js";
import { openUrl } from "./browser.js";
import { themeMap } from "./cosmetics.js";

export const CLOAKS = {
  none: { label: "None (Project Artemis)", title: "", svg: "" },
  doc: { label: "Untitled document", title: "Untitled document", svg: "<rect x='6' y='3' width='20' height='26' rx='3' fill='#4c8bf5'/><path d='M10 11h12M10 16h12M10 21h8' stroke='#fff' stroke-width='2'/>" },
  mail: { label: "Inbox", title: "Inbox (3)", svg: "<rect x='3' y='7' width='26' height='18' rx='3' fill='#e8590c'/><path d='m4 9 12 9 12-9' stroke='#fff' stroke-width='2' fill='none'/>" },
  calendar: { label: "Calendar", title: "Calendar", svg: "<rect x='4' y='6' width='24' height='22' rx='3' fill='#37b24d'/><rect x='4' y='6' width='24' height='7' fill='#2f9e44'/><text x='16' y='24' font-size='11' text-anchor='middle' fill='#fff' font-family='sans-serif'>15</text>" },
  notes: { label: "Notes", title: "Notes", svg: "<rect x='6' y='3' width='20' height='26' rx='3' fill='#fab005'/><path d='M10 12h12M10 17h12M10 22h7' stroke='#fff' stroke-width='2'/>" },
};
export const THEMES = [
  ["eclipse", "Eclipse", "linear-gradient(135deg,#05060d,#3b2f9e)"], ["lunar", "Lunar", "linear-gradient(135deg,#f4f5fa,#b9bfdc)"],
  ["orion", "Orion", "linear-gradient(135deg,#0c0605,#c2410c)"], ["aurora", "Aurora", "linear-gradient(135deg,#030c0c,#0d9488)"],
];
const svgUri = (inner) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>${inner}</svg>`);

export function applySettings() {
  const s = state.me.settings;
  document.documentElement.dataset.theme = s.theme;
  const c = CLOAKS[s.cloakIcon] ?? CLOAKS.none;
  document.title = s.cloakTitle || c.title || "Project Artemis";
  const fav = $("#favicon"); if (fav) fav.href = svgUri(c.svg || "<circle cx='16' cy='16' r='14' fill='#e8ecff'/><circle cx='21' cy='13' r='12' fill='#05060d'/>");
  const meta = document.querySelector("meta[name=theme-color]"); if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#05060d";
}
let saveT;
export function saveSettings(patch) {
  Object.assign(state.me.settings, patch);
  applySettings(); emit("settings");
  clearTimeout(saveT);
  saveT = setTimeout(() => api("/settings", "PUT", state.me.settings).catch((e) => toast(e.message, true)), 400);
}

/* panic key: press twice quickly */
let lastPanic = 0;
export function panicCheck(key) {
  const k = state.me?.settings.panicKey;
  if (!k || key !== k) return;
  const t = Date.now();
  if (t - lastPanic < 600) location.replace(state.me.settings.panicUrl || "https://en.wikipedia.org/");
  lastPanic = t;
}

export function buildSettings() {
  const s = state.me.settings;
  $("#view-settings").innerHTML = `<div class="page"><h2>Settings</h2><p class="sub">Signed in as <b>${esc(state.me.username)}</b> · ${roleName(state.me.role)}</p>
  <div class="grid2">
    <div class="card glass" style="grid-column:1/-1"><h3>Profile</h3>
      <div class="prof-edit"><div id="avPrev">${avatar(state.me.username, true, false, true)}</div>
        <div style="display:grid;gap:10px;flex:1;min-width:220px">
          <div style="display:flex;gap:8px;flex-wrap:wrap"><label class="btn" style="cursor:pointer">Upload picture<input type="file" id="avFile" accept="image/*" hidden></label><button class="btn" id="avClear" type="button">Remove</button><span class="note" id="avNote" style="align-self:center"></span></div>
          <div class="inline"><input id="setStatus" maxlength="60" value="${esc(state.me.profile?.status ?? "")}" placeholder="Set a status, for example “Building the lander”"><select id="setPresence" style="max-width:170px">${[["online", "Online"], ["idle", "Idle"], ["dnd", "Do not disturb"]].map(([v, l]) => `<option value="${v}" ${state.me.profile?.presence === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
          <div class="row2" style="margin-top:10px"><label>Pronouns<input id="setPron" maxlength="20" value="${esc(state.me.profile?.pronouns ?? "")}" placeholder="they/them"></label><label>Profile accent<input id="setAccent" type="color" value="${esc(state.me.profile?.accent || "#8b7bff")}"></label></div>
          <label style="display:block;margin-top:10px">About me<textarea id="setBio" maxlength="200" rows="3" placeholder="Tell the crew about yourself (200 characters)">${esc(state.me.profile?.bio ?? "")}</textarea></label>
          <p class="note">Your accent colors your profile card banner. Equip a backdrop in Packs to replace it.</p>
        </div></div></div>
    <div class="card glass"><h3>Theme</h3><div class="themes">${[...THEMES, ...(state.me.inv?.themes ?? []).map((id) => themeMap.get(id)).filter(Boolean).map((t) => [t.id, t.name, `linear-gradient(135deg,${t.c[0]},${t.c[1]})`])].map(([id, n, bg]) => `<button class="theme-card${s.theme === id ? " on" : ""}" data-theme="${id}"><i style="background:${bg}"></i>${n}</button>`).join("")}</div>
      <label class="switch"><span>Chat sounds<small>A soft ping for new messages and mentions.</small></span><input type="checkbox" id="setSound" ${s.chatSound ? "checked" : ""}></label>
      <label class="switch"><span>Bookmarks bar</span><input type="checkbox" id="setBar" ${s.bookmarksBar ? "checked" : ""}></label></div>
    <div class="card glass"><h3>Search</h3><label>Default engine<select id="setEngine">${state.engines.map((e) => `<option value="${e.id}" ${s.engine === e.id ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select></label>
      <p class="note">Searches run on the server, so the engine never sees your IP. If one engine blocks or returns nothing, Artemis automatically tries the next.</p></div>
    <div class="card glass"><h3>Tab cloak</h3><label>Preset<select id="setCloak">${Object.entries(CLOAKS).map(([k, c]) => `<option value="${k}" ${s.cloakIcon === k ? "selected" : ""}>${c.label}</option>`).join("")}</select></label>
      <label>Custom title<input id="setCloakTitle" maxlength="80" value="${esc(s.cloakTitle)}" placeholder="Overrides the preset title"></label>
      <button class="btn" id="blankBtn">Open in an about:blank window</button></div>
    <div class="card glass"><h3>Panic key</h3><label>Key (press twice quickly)<input id="setPanicKey" maxlength="10" value="${esc(s.panicKey)}"></label><label>Jump to<input id="setPanicUrl" value="${esc(s.panicUrl)}"></label></div>
    <div class="card glass"><h3>Account</h3>
      <div class="row" style="padding-top:0"><div class="grow"><div class="ttl" style="cursor:default">${esc(state.me.username)}</div><div class="sub">${esc(roleName(state.me.role))} · joined ${new Date(state.me.createdAt).toLocaleDateString()}</div></div><button class="btn sm" id="renameBtn">Change callsign</button></div>
      <form id="pwForm" style="display:grid;gap:10px;margin-top:12px"><label>Current passcode<input type="password" name="current" autocomplete="current-password" required></label><label>New passcode<input type="password" name="next" autocomplete="new-password" minlength="8" required></label><button class="btn">Change passcode</button></form>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"><button class="btn" id="logoutBtn">Sign out</button><button class="btn danger" id="deleteAcct">Delete account</button></div></div>
    <div class="card glass"><h3>Browsing data</h3><p class="note">Your history only powers address bar suggestions. Bookmarks live in the bar under the address field (star icon to add).</p><button class="btn danger" id="clearHist">Clear browsing history</button></div>
    <div class="card glass"><h3>Shortcuts</h3><div style="display:grid;gap:8px;font-size:13px">${[["Command palette", "Ctrl K"], ["Browse / Chat / Updates", "Alt 1–3"], ["Focus address bar", "Ctrl L"], ["Bookmark page", "Ctrl D"], ["Send chat message", "Enter"], ["Edit last message", "↑ in empty box"]].map(([a, b]) => `<div style="display:flex;justify-content:space-between"><span class="dim">${a}</span><span class="kbd">${b}</span></div>`).join("")}</div></div>
  </div></div>`;
  const v = $("#view-settings");
  v.querySelector(".themes").onclick = (e) => { const b = e.target.closest("[data-theme]"); if (!b) return; saveSettings({ theme: b.dataset.theme }); $$(".theme-card", v).forEach((x) => x.classList.toggle("on", x === b)); };
  /* profile */
  const saveProfile = async (patch) => {
    try {
      const { profile } = await api("/profile", "PUT", patch);
      state.me.profile = profile; const me = state.people.get(state.me.id); if (me) me.profile = profile;
      $("#avPrev").innerHTML = avatar(state.me.username, true, false, true); $("#avNote").textContent = "";
    } catch (err) { toast(err.message, true); }
  };
  $("#avFile").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { await saveProfile({ avatar: await toAvatar(f) }); toast("Picture updated", "ok"); } catch { toast("Couldn't read that image", true); }
    e.target.value = "";
  };
  $("#avClear").onclick = () => saveProfile({ avatar: "" });
  let st; $("#setStatus").oninput = (e) => { clearTimeout(st); st = setTimeout(() => saveProfile({ status: e.target.value }), 500); };
  const dbn = (id, key) => { let t; $(id).oninput = (e) => { clearTimeout(t); t = setTimeout(() => saveProfile({ [key]: e.target.value }), 600); }; };
  dbn("#setPron", "pronouns"); dbn("#setBio", "bio"); dbn("#setAccent", "accent");
  $("#setPresence").onchange = (e) => saveProfile({ presence: e.target.value });
  $("#setSound").onchange = (e) => saveSettings({ chatSound: e.target.checked });
  $("#setBar").onchange = (e) => saveSettings({ bookmarksBar: e.target.checked });
  $("#setEngine").onchange = (e) => saveSettings({ engine: e.target.value });
  $("#setCloak").onchange = (e) => { saveSettings({ cloakIcon: e.target.value, cloakTitle: "" }); $("#setCloakTitle").value = ""; };
  $("#setCloakTitle").oninput = (e) => saveSettings({ cloakTitle: e.target.value });
  $("#setPanicKey").oninput = (e) => saveSettings({ panicKey: e.target.value });
  $("#setPanicUrl").oninput = (e) => saveSettings({ panicUrl: e.target.value });
  $("#blankBtn").onclick = () => {
    const w = window.open("about:blank", "_blank");
    if (!w) return toast("Pop-up blocked — allow pop-ups for this site and try again.", true);
    w.document.write(`<title>${esc(document.title)}</title><body style="margin:0"><iframe src="${esc(location.href)}" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>`);
    w.document.close(); toast("Opened. You can close this tab now.", "ok");
  };
  $("#pwForm").onsubmit = async (e) => {
    e.preventDefault(); const f = new FormData(e.target);
    try { await api("/password", "POST", { current: f.get("current"), next: f.get("next") }); e.target.reset(); toast("Passcode updated", "ok"); } catch (err) { toast(err.message, true); }
  };
  $("#renameBtn").onclick = async () => {
    const name = await promptBox("Change callsign", { label: "New callsign", value: state.me.username, ok: "Next" }); if (!name || name === state.me.username) return;
    const password = await promptBox("Confirm it's you", { label: "Your passcode", type: "password", ok: "Change" }); if (!password) return;
    try { const r = await api("/account/username", "PUT", { username: name, password }); state.me = { ...state.me, ...r.user }; toast("Callsign updated", "ok"); buildSettings(); } catch (err) { toast(err.message, true); }
  };
  $("#deleteAcct").onclick = async () => {
    if (state.me.role === "owner") return void toast("The owner can't delete their account. Transfer ownership first.", true);
    if (!(await confirmBox("Delete your account?", "Your profile, bookmarks and history are removed for good. Your chat messages stay, under your old name.", { ok: "Continue", danger: true }))) return;
    const password = await promptBox("Confirm it's you", { label: "Your passcode", type: "password", ok: "Delete account" }); if (!password) return;
    try { await api("/account", "DELETE", { password }); location.reload(); } catch (err) { toast(err.message, true); }
  };
  $("#clearHist").onclick = async () => { if (await confirmBox("Clear browsing history?", "Address bar suggestions from your history are deleted.", { ok: "Clear", danger: true })) { try { await api("/history", "DELETE"); toast("History cleared", "ok"); } catch (err) { toast(err.message, true); } } };
  $("#logoutBtn").onclick = async () => { await api("/logout", "POST", {}).catch(() => {}); location.reload(); };
}

/* Center-crop to a 128px square JPEG so avatars stay tiny (a few KB). */
function toAvatar(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const n = 128, c = document.createElement("canvas"); c.width = c.height = n;
      const side = Math.min(img.width, img.height), sx = (img.width - side) / 2, sy = (img.height - side) / 2;
      c.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, n, n);
      URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject; img.src = url;
  });
}
