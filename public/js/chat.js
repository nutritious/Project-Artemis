/* Chat: channels, replies, reactions, edit/delete, mentions, embeds, typing, unread. */
import { openFullProfile } from "./profile.js";
import { $, $$, api, avatar, can, confirmBox, emit, esc, byLine, hooks, hue, icon, myRank, personByName, promptBox, rankOf, roleById, roleColor, roleTags, state, timeStr, toast, on, ago } from "./util.js";

const EMOJI = ["👍", "❤️", "😂", "🎉", "🚀", "🌕", "👀", "🔥", "😮", "😢", "🙏", "💯", "✅", "🤝", "🛰️", "✨"];
const C = { ws: null, current: "general", msgs: {}, more: {}, unread: {}, online: [], members: [], typing: {}, reply: null, editing: null, loaded: {}, retry: 0, lastTypingSent: 0, mentionSel: 0 };

const me = () => state.me;

/* ------------------------------ socket ------------------------------ */
export function connectChat() {
  const ws = hooks.socket ? hooks.socket() : new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws");
  C.ws = ws;
  ws.onopen = () => { C.retry = 0; setStatus(true); emit("wsopen"); };
  ws.onmessage = (ev) => handle(JSON.parse(ev.data));
  ws.onclose = (ev) => {
    setStatus(false);
    if (ev.code === 4001) { toast("You've been signed out of chat.", true); return; }
    setTimeout(connectChat, Math.min(15000, 1000 * 2 ** C.retry++));
  };
}
function setMembers(list) {
  C.members = list;
  state.people = new Map(list.map((x) => [x.id, x]));
}
function applySelf(self) {
  if (!self) return;
  state.me = { ...state.me, ...self.user }; state.perms = self.perms; state.trusted = !!self.trusted; state.trust = self.trust ?? state.trust;
  const mine = state.people.get(state.me.id); if (mine) Object.assign(mine, { role: self.user.role, roleId: self.user.roleId });
  renderSide(); renderHead(); renderMsgs("keep");
  emit("self");
}
const send = (o) => C.ws?.readyState === 1 && C.ws.send(JSON.stringify(o));
/** Used by the live-event arena chat, which lives in a hidden channel. */
export const chatSend = send;
function setStatus(ok) { $("#chatStatus")?.classList.toggle("bad", !ok); const s = $("#chatStatus"); if (s) s.textContent = ok ? "Live" : "Reconnecting…"; }

function handle(m) {
  switch (m.t) {
    case "init":
      state.channels = m.channels; C.online = m.online; state.onlineIds = new Set(m.online.map((o) => o.id)); setMembers(m.members); state.roles = m.roles ?? []; applySelf(m.self); setAnnouncement(m.announcement);
      if (state.build && m.build && state.build !== m.build) emit("updatelive"); state.build = m.build ?? state.build; state.countdown = m.countdown ?? null; emit("countdown");
      state.customTags = m.customTags ?? []; state.event = m.event ?? null; state.boosts = m.boosts ?? []; emit("liveevent"); emit("boost");
      if (!state.channels.some((c) => c.id === C.current && !c.voice)) C.current = state.channels.find((c) => !c.voice)?.id ?? "general";
      emit("social-init", m);
      renderSide(); renderHead(); C.loaded = {}; loadHistory(C.current);
      break;
    case "presence": C.online = m.online; state.onlineIds = new Set(m.online.map((o) => o.id)); renderMembers(); emit("ws", m); break;
    case "members": setMembers(m.members); renderMembers(); renderMsgs("keep"); emit("members"); break;
    case "roles": state.roles = m.roles; renderMembers(); renderMsgs("keep"); emit("roles"); break;
    case "self": applySelf(m); break;
    case "report": toast(`New issue report from ${m.username}`, "ok"); emit("report"); break;
    case "game": emit("game", m); break;
    case "event": emit("event", m); break;
    case "legend": emit("legend", m); break;
    case "trusted": toast(m.trusted ? "You are now a trusted member! GIFs and #trusted-general are unlocked." : "Your trusted status was removed.", m.trusted ? "ok" : true); break;
    case "chroma": emit("chroma", m); break;
    case "ach": emit("ach", m); break;
    case "liveevent": state.event = m.event; renderHead(); emit("liveevent"); break;
    case "arena": emit("arena", m); break;
    case "phase": emit("phase", m); break;
    case "countdown": state.countdown = m.countdown; emit("countdown"); break;
    case "updatelive": emit("updatelive"); break;
    case "boost": state.boosts = m.boosts; emit("boost"); break;
    case "fx": emit("fx", m); break;
    case "round": emit("round", m); break;
    case "roundgo": emit("roundgo", m); break;
    case "roundend": emit("roundend", m); break;
    case "roundstop": emit("roundstop", m); break;
    case "eventend": emit("eventend", m); break;
    case "gift": emit("gift", m); break;
    case "customtags": state.customTags = m.customTags; renderMembers(); renderMsgs("keep"); emit("customtags"); break;
    case "channels":
      state.channels = m.channels;
      if (!state.channels.some((c) => c.id === C.current && !c.voice)) { C.current = state.channels.find((c) => !c.voice)?.id; loadHistory(C.current); }
      renderSide(); renderHead(); emit("channels");
      break;
    case "announcement": setAnnouncement(m.announcement, true); break;
    case "history": {
      if (m.channel === "live-event") { emit("livechat", { history: m.messages }); break; }
      const list = C.msgs[m.channel] ?? [];
      if (m.older) { C.msgs[m.channel] = [...m.messages, ...list]; }
      else C.msgs[m.channel] = m.messages;
      C.more[m.channel] = m.more; C.loaded[m.channel] = true;
      if (m.channel === C.current) renderMsgs(m.older ? "keep" : "bottom");
      break;
    }
    case "msg": {
      if (m.msg.channel === "live-event") { emit("livechat", { msg: m.msg }); break; }
      const list = (C.msgs[m.msg.channel] ??= []);
      list.push(m.msg);
      const mine = m.msg.userId === me().id;
      const here = m.msg.channel === C.current && state.view === "chat" && !document.hidden;
      if (m.msg.channel === C.current) {
        const box = $("#msgs"); const atBottom = !box || box.scrollHeight - box.scrollTop - box.clientHeight < 120;
        renderMsgs(atBottom || mine ? "bottom" : "keep");
      }
      if (!mine && !here) {
        C.unread[m.msg.channel] = (C.unread[m.msg.channel] ?? 0) + 1; updateBadge(); renderSide();
        if (me().settings.chatSound) ping(isMention(m.msg.text));
      }
      delete C.typing[m.msg.username]; renderTyping();
      break;
    }
    case "edited": for (const l of Object.values(C.msgs)) { const x = l.find((q) => q.id === m.id); if (x) { x.text = m.text; x.edited = m.edited; } } renderMsgs("keep"); break;
    case "deleted": for (const k of Object.keys(C.msgs)) C.msgs[k] = C.msgs[k].filter((q) => q.id !== m.id); renderMsgs("keep"); break;
    case "reactions": for (const l of Object.values(C.msgs)) { const x = l.find((q) => q.id === m.id); if (x) x.reactions = m.reactions; } renderMsgs("keep"); break;
    case "typing":
      if (m.channel === C.current) { C.typing[m.user] = Date.now(); renderTyping(); setTimeout(renderTyping, 3100); }
      break;
    case "error": toast(m.message, true); break;
    default: emit("ws", m);
  }
}
export const adminSocketSend = send;
export const onWs = (f) => on("ws", f);

function loadHistory(ch, before) { if (ch) send({ t: "history", channel: ch, before }); }

/* ------------------------------ announcement ------------------------------ */
function setAnnouncement(a, live) {
  state.announcement = a;
  const dismissed = (() => { try { return localStorage.getItem("artemis-ann"); } catch { return null; } })();
  /* the old always-on top bar is gone; a new announcement now shows once as the pop-up */
  $("#app").classList.add("no-announce");
  if (a && live && dismissed !== a.id) popBanner(a);
}
function popBanner(a) {
  $("#popBanner")?.remove();
  const el = document.createElement("div"); el.id = "popBanner"; el.className = "pop-banner glass"; el.setAttribute("role", "status");
  const words = a.text.split(/\s+/).filter(Boolean).slice(0, 60);
  const step = Math.max(35, Math.min(95, 1800 / Math.max(1, words.length)));
  el.style.setProperty("--step", step + "ms");
  el.innerHTML = `<i class="ring"></i><i class="ring r2"></i><div class="pb-head"><span class="a-tag">ANNOUNCEMENT</span><button type="button" aria-label="Dismiss">×</button></div><div class="pb-words">${words.map((w, i) => `<span class="w" style="--i:${i}">${esc(w)}</span>`).join(" ")}</div><div class="pb-by" style="--n:${words.length}">— ${a.by ? byLine(a) : "Mission control"}</div>`;
  document.body.append(el);
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 500); };
  el.querySelector("button").onclick = close;
  setTimeout(close, 9000 + words.length * 120);
  if (me().settings.chatSound) ping(true);
}
export function initAnnouncementUi() {
  setAnnouncement(state.announcement);
}

/* ------------------------------ sound ------------------------------ */
let actx;
export function ping(mention) {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(mention ? 880 : 620, actx.currentTime); o.frequency.exponentialRampToValueAtTime(mention ? 1320 : 880, actx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.12, actx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.3);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.32);
  } catch { /* audio blocked */ }
}
const isMention = (t) => new RegExp(`(^|\\s)@${me().username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(t) || /(^|\s)@(everyone|here)\b/i.test(t);

/* ------------------------------ build ------------------------------ */
export function buildChat() {
  $("#view-chat").innerHTML = `<div id="chat">
    <aside class="side glass chan-side"><div class="srv-head"><i class="moon sm"></i><b>Project Artemis</b><span class="srv-tag" id="srvTag"></span></div><div id="chanList"></div>
      <div class="userbar" id="userBar"></div></aside>
    <section class="main glass">
      <div class="chat-tabs" id="chatTabs"></div>
      <div class="chead"><b id="chName"></b><span class="topic" id="chTopic"></span><span class="live" id="chatStatus">Live</span></div>
      <div id="msgs" aria-live="polite"></div>
      <div id="composer">
        <div id="typing"></div>
        <div id="replybar" class="hidden"><span></span><button type="button" aria-label="Cancel reply">×</button></div>
        <div class="cbox"><textarea id="chatInput" rows="1" maxlength="2000" placeholder="Message… (Enter to send, Shift+Enter for a new line)"></textarea><button class="btn gifbtn" id="chatGif" type="button" title="Post a GIF (trusted members)">GIF</button><button class="btn primary" id="chatSend" type="button">Send</button></div>
        <div id="mentionList" class="hidden"></div>
      </div>
    </section>
    <aside class="side glass members"><div id="memberList"></div></aside>
  </div>`;
  const input = $("#chatInput");
  input.addEventListener("keydown", onKey);
  input.addEventListener("input", () => { autosize(); mentionCheck(); if (Date.now() - C.lastTypingSent > 2500 && input.value) { C.lastTypingSent = Date.now(); send({ t: "typing", channel: C.current }); } });
  $("#chatSend").onclick = submit;
  $("#chatGif").onclick = async () => {
    if (!state.trusted) return toast("GIFs unlock when you become a trusted member: 300 messages, 3 hours on the proxy, a 10-day-old account and no bans for 14 days. See the Hub for your progress.", true);
    const url = await promptBox("Post a GIF", { label: "GIF link", placeholder: "https://media.giphy.com/…/giphy.gif", ok: "Post" });
    if (url && /^https?:\/\//i.test(url.trim())) send({ t: "send", channel: C.current, text: url.trim() });
  };
  $("#replybar button").onclick = () => setReply(null);
  $("#msgs").addEventListener("click", onMsgClick);
  $("#msgs").addEventListener("scroll", () => { const b = $("#msgs"); if (b.scrollTop < 60 && C.more[C.current] && !C.loadingOlder) { C.loadingOlder = true; const first = C.msgs[C.current]?.[0]; loadHistory(C.current, first?.ts); setTimeout(() => (C.loadingOlder = false), 600); } });
  $("#chanList").addEventListener("click", onChanClick);
  $("#userBar").addEventListener("click", (e) => { if (e.target.closest("[data-gosettings]")) emit("view", "settings"); });
  $("#chatTabs").addEventListener("click", onChanClick);
  document.addEventListener("click", (e) => { if (!e.target.closest(".picker, [data-act=react]")) $$(".picker").forEach((p) => p.remove()); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && state.view === "chat") { C.unread[C.current] = 0; updateBadge(); renderSide(); } });
  on("dmunread", updateBadge);
  renderSide(); renderHead();
  setInterval(renderTyping, 1500);
}
const autosize = () => { const i = $("#chatInput"); i.style.height = "auto"; i.style.height = Math.min(i.scrollHeight, 140) + "px"; };

export function onChatShown() {
  C.unread[C.current] = 0; updateBadge(); renderSide();
  if (!C.loaded[C.current]) loadHistory(C.current);
  renderMsgs("bottom");
  setTimeout(() => $("#chatInput")?.focus(), 40);
}
function updateBadge() {
  const n = Object.values(C.unread).reduce((a, b) => a + b, 0) + (state.dmUnread ?? 0);
  const b = $("#chatBadge"); b.textContent = n > 99 ? "99+" : n; b.classList.toggle("hidden", !n);
}

/* ------------------------------ side + header ------------------------------ */
function onChanClick(e) {
  const del = e.target.closest("[data-delchan]");
  if (del) { confirmBox(`Delete #${del.dataset.delchan}?`, "All of its messages will be removed for everyone.", { ok: "Delete", danger: true }).then(async (ok) => { if (ok) try { await api("/channels/" + del.dataset.delchan, "DELETE"); } catch (err) { toast(err.message, true); } }); return; }
  if (e.target.closest("[data-newchan]")) { promptBox("New channel", { label: "Channel name", placeholder: "launch-pad", ok: "Create" }).then(async (n) => { if (n) try { await api("/channels", "POST", { name: n }); } catch (err) { toast(err.message, true); } }); return; }
  const b = e.target.closest("[data-chan]"); if (!b) return;
  switchChannel(b.dataset.chan);
}
function switchChannel(id) {
  C.current = id; C.unread[id] = 0; C.typing = {}; setReply(null); updateBadge(); renderSide(); renderHead();
  if (!C.loaded[id]) loadHistory(id);
  renderMsgs("bottom"); $("#chatInput").focus();
}
export function openChannel(id) { emit("view", "chat"); if (state.channels.some((c) => c.id === id)) switchChannel(id); }
export const channelNames = () => state.channels.map((c) => c.id);

function renderSide() {
  if (!$("#chanList")) return;
  const admin = can("manage_channels");
  $("#chanList").innerHTML = `<h4>Channels ${admin ? `<button class="btn sm" data-newchan title="New channel">+</button>` : ""}</h4>` + state.channels.filter((c) => !c.voice).map((c) => `<button class="chan${c.id === C.current ? " on" : ""}" data-chan="${esc(c.id)}"><span class="h">${c.trusted ? "🔒" : "#"}</span>${esc(c.name)}${C.unread[c.id] ? `<span class="u">${C.unread[c.id]}</span>` : ""}</button>`).join("");
  $("#chatTabs").innerHTML = state.channels.filter((c) => !c.voice).map((c) => `<button class="chan${c.id === C.current ? " on" : ""}" data-chan="${esc(c.id)}">${c.trusted ? "🔒" : "#"} ${esc(c.name)}${C.unread[c.id] ? ` <span class="u">${C.unread[c.id]}</span>` : ""}</button>`).join("");
  renderMembers();
}
function renderHead() {
  const c = state.channels.find((x) => x.id === C.current); if (!c || !$("#chName")) return;
  $("#chName").textContent = "# " + c.name;
  { const h = $("#chName").parentElement; h.querySelector("#chLive")?.remove(); if (state.event) h.insertAdjacentHTML("beforeend", `<button type="button" id="chLive" class="lchip evpill" data-arena="1" style="--ec:${esc(state.event.color)};margin-left:auto"><i class="ev-dot"></i>Join the live event</button>`); }
  const admin = can("manage_channels");
  $("#chTopic").innerHTML = esc(c.topic || "No topic set") + (admin && c.id !== "general" ? ` <button class="btn sm" data-delchan="${esc(c.id)}" style="margin-left:8px">Delete channel</button>` : "");
  $("#chTopic").title = c.topic;
  $("#chName").parentElement.onclick = async (e) => { if (admin && e.target.closest("#chName")) { const t = await promptBox("Channel topic", { value: c.topic, label: "Topic", ok: "Set" }); if (t !== null) try { await api(`/channels/${c.id}/topic`, "PUT", { topic: t }); } catch (err) { toast(err.message, true); } } };
  $("#chatInput").placeholder = `Message #${c.name}`;
}
function renderMembers() {
  const el = $("#memberList"); if (!el) return;
  const online = new Set(C.online.map((o) => o.id));
  const byName = (a, b) => a.username.localeCompare(b.username);
  const row = (m) => `<button class="member${online.has(m.id) ? "" : " off"}" data-profile="${esc(m.id)}">${avatar(m.username, online.has(m.id), true)}<span class="mt"><span class="n" style="${nameColor(m)}">${esc(m.username)}</span>${m.profile?.status ? `<span class="ms">${esc(m.profile.status)}</span>` : ""}</span>${roleTags(m)}</button>`;
  /* Discord-style: online staff are grouped under their role, then plain Online, then Offline. */
  const groups = [["owner", "Owner"], ["coowner", "Co-owner"], ["admin", "Commanders"], ...[...state.roles].sort((a, b) => a.position - b.position).map((r) => ["r:" + r.id, r.name])];
  const groupOf = (m) => (m.role !== "member" ? m.role : m.roleId && state.roles.some((r) => r.id === m.roleId) ? "r:" + m.roleId : "");
  const live = [...C.members].filter((m) => online.has(m.id)).sort(byName), off = [...C.members].filter((m) => !online.has(m.id)).sort(byName);
  let html = "";
  for (const [key, label] of groups) { const g = live.filter((m) => groupOf(m) === key); if (g.length) html += `<h4>${esc(label)} — ${g.length}</h4>${g.map(row).join("")}`; }
  const plain = live.filter((m) => !groupOf(m));
  if (plain.length) html += `<h4>Online — ${plain.length}</h4>${plain.map(row).join("")}`;
  if (off.length) html += `<h4>Offline — ${off.length}</h4>${off.map(row).join("")}`;
  el.innerHTML = html;
  renderUserBar();
}
function renderUserBar() {
  const el = $("#userBar"); if (!el) return;
  const m = me(), p = state.people.get(m.id) ?? m, pres = p.profile?.presence ?? "online";
  el.innerHTML = `<button class="ub-who" data-profile="${esc(m.id)}">${avatar(m.username, true, true)}<span class="mt"><span class="n" style="${nameColor(p)}">${esc(m.username)} ${roleTags(p)}</span><span class="ms">${esc(p.profile?.status || ({ online: "Online", idle: "Idle", dnd: "Do not disturb" }[pres] ?? "Online"))}</span></span></button><button class="icon-btn" data-gosettings title="Settings" aria-label="Settings">${icon("settings")}</button>`;
  const t = $("#srvTag"); if (t) t.innerHTML = state.me?.role === "owner" ? icon("owner") : "";
}
const nameColor = (p) => { const c = roleColor(p); return c ? `color:${c}` : ""; };
function renderTyping() {
  const el = $("#typing"); if (!el) return;
  const names = Object.entries(C.typing).filter(([, t]) => Date.now() - t < 3000).map(([n]) => n);
  el.textContent = !names.length ? "" : names.length === 1 ? `${names[0]} is typing…` : names.length === 2 ? `${names[0]} and ${names[1]} are typing…` : "Several people are typing…";
}

/* ------------------------------ messages ------------------------------ */
function fmtText(raw) {
  let s = esc(raw);
  const blocks = [];
  s = s.replace(/```([\s\S]*?)```/g, (_, c) => { blocks.push(`<pre>${c.replace(/^\n/, "")}</pre>`); return `\u0000${blocks.length - 1}\u0000`; });
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?]|$)/g, "$1<i>$2</i>").replace(/~~([^~\n]+)~~/g, "<s>$1</s>");
  s = s.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)"'])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  s = s.replace(/(^|[\s(])@([a-zA-Z0-9_.-]{2,24}|everyone|here)\b/g, (_, p, n) => `${p}<span class="at${n.toLowerCase() === me().username.toLowerCase() || /^(everyone|here)$/i.test(n) ? " me" : ""}">@${n}</span>`);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[+i]);
}
function embeds(raw) {
  const urls = [...new Set(raw.match(/https?:\/\/[^\s<]+/g) ?? [])].slice(0, 2);
  return urls.map((u) => {
    if (/\.(png|jpe?g|gif|webp|avif)(\?[^\s]*)?$/i.test(u)) return `<div class="embed"><img src="/api/img?u=${encodeURIComponent(u)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-hide></div>`;
    return "";
  }).join("");
}
const dayKey = (ts) => new Date(ts).toDateString();
const dayLabel = (ts) => { const d = new Date(ts), t = new Date(); if (d.toDateString() === t.toDateString()) return "Today"; t.setDate(t.getDate() - 1); if (d.toDateString() === t.toDateString()) return "Yesterday"; return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }); };

function renderMsgs(scroll = "keep") {
  const box = $("#msgs"); if (!box) return;
  const list = C.msgs[C.current] ?? [];
  const prevH = box.scrollHeight, prevTop = box.scrollTop;
  if (!list.length && C.loaded[C.current]) {
    const c = state.channels.find((x) => x.id === C.current);
    box.innerHTML = `<div class="chat-empty"><b>Welcome to #${esc(c?.name ?? "")}</b><span>This is the start of the channel. Say something to the crew.</span></div>`;
    return;
  }
  let html = C.more[C.current] ? `<div class="daysep">Scroll up for older messages</div>` : "";
  let last = null;
  for (const m of list) {
    if (!last || dayKey(last.ts) !== dayKey(m.ts)) html += `<div class="daysep">${esc(dayLabel(m.ts))}</div>`;
    const first = !last || last.userId !== m.userId || m.ts - last.ts > 5 * 60_000 || dayKey(last.ts) !== dayKey(m.ts) || !!m.replyTo;
    const mine = m.userId === me().id;
    const reacts = Object.entries(m.reactions ?? {}).map(([e, ids]) => `<button class="react${ids.includes(me().id) ? " mine" : ""}" data-act="toggle" data-emoji="${esc(e)}">${esc(e)}<b>${ids.length}</b></button>`).join("");
    html += `<div class="msg${first ? " first" : ""}${isMention(m.text) && !mine ? " mention" : ""}" data-id="${esc(m.id)}">
      ${first ? `<button class="avbtn" data-profile="${esc(m.userId)}" aria-label="Profile of ${esc(m.username)}">${avatar(m.username)}</button>` : `<div class="gut">${timeStr(m.ts).replace(/ ?[AP]M/, "")}</div>`}
      <div class="body">
        ${m.replyTo ? `<div class="reply-ref" data-jump="${esc(m.replyTo.id)}">↪ <b>${esc(m.replyTo.username)}</b> ${esc(m.replyTo.text)}</div>` : ""}
        ${first ? `<div class="meta"><button class="who" data-profile="${esc(m.userId)}" style="${nameColor(state.people.get(m.userId)) || `color:hsl(${hue(m.username)} 70% 72%)`}">${esc(m.username)}</button>${m.userId === "bot" ? `<span class="chip bot">BOT</span>` : roleTags(state.people.get(m.userId))}${state.people.get(m.userId)?.trusted && !roleTags(state.people.get(m.userId)).includes("OWNER") ? `<span class="chip trusted" title="Trusted member">✓</span>` : ""}<span class="when">${timeStr(m.ts)}</span></div>` : ""}
        <div class="txt">${fmtText(m.text)}${m.edited ? ` <span class="edited">(edited)</span>` : ""}</div>
        ${embeds(m.text)}
        ${reacts ? `<div class="reacts">${reacts}</div>` : ""}
      </div>
      <div class="actions"><button data-act="react" title="React">☺</button><button data-act="reply" title="Reply">↩</button>${mine ? `<button data-act="edit" title="Edit">✎</button>` : ""}${mine || can("delete_messages") ? `<button data-act="del" title="Delete">🗑</button>` : ""}</div>
    </div>`;
    last = m;
  }
  box.innerHTML = html;
  if (scroll === "bottom") box.scrollTop = box.scrollHeight;
  else if (scroll === "keep" && prevTop < 60 && C.loadingOlder) box.scrollTop = box.scrollHeight - prevH + prevTop;
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-profile]");
  if (t) { e.stopPropagation(); const who = state.people.get(t.dataset.profile); if (who) openFullProfile(who.username); }
  else if (!e.target.closest(".pcard")) $$(".pcard").forEach((x) => x.remove());
}, true);
export function openProfile(id, anchor) {
  $$(".pcard").forEach((x) => x.remove());
  const p = state.people.get(id); if (!p) return;
  const r = roleById(p.roleId), mine = p.id === state.me.id;
  const online = C.online.some((o) => o.id === id);
  const accent = p.profile?.accent || (p.role === "owner" ? "#f5b83d" : r?.color) || `hsl(${hue(p.username)} 60% 50%)`;
  const assignable = can("manage_roles") && !mine && p.role !== "owner" && p.role !== "admin" && rankOf(p) > myRank();
  const roleOpts = state.roles.filter((x) => state.me.role === "owner" || x.position > myRank());
  const card = document.createElement("div"); card.className = "pcard glass";
  card.innerHTML = `<div class="pbanner ${p.bg ? "pbg-" + esc(p.bg) : ""}" style="background:linear-gradient(135deg,${esc(accent)},color-mix(in srgb,${esc(accent)} 30%,#000))"></div>
    <div class="pbody">${avatar(p.username, online, false, true)}
      <div class="pname">${esc(p.username)} ${roleTags(p)}${p.trusted ? `<span class="chip trusted" title="Trusted member">✓ Trusted</span>` : ""}</div>
      ${p.profile?.pronouns ? `<div class="psub">${esc(p.profile.pronouns)}</div>` : ""}
      <div class="psub">${online ? (p.profile?.presence === "dnd" ? "Do not disturb" : p.profile?.presence === "idle" ? "Idle" : "Online") : "Last seen " + ago(p.lastSeen)}</div>
      ${p.profile?.status ? `<div class="psec"><h6>Status</h6>${esc(p.profile.status)}</div>` : ""}
      ${p.profile?.bio ? `<div class="psec"><h6>About</h6>${esc(p.profile.bio)}</div>` : ""}
      <div class="psec"><h6>Member since</h6>${new Date(p.createdAt).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" })}</div>
      ${assignable ? `<div class="psec"><h6>Role</h6><select data-setrole><option value="">No role</option>${roleOpts.map((x) => `<option value="${esc(x.id)}" ${x.id === p.roleId ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>` : ""}
      <div class="inline" style="margin-top:8px"><button class="btn sm" data-fullprofile>Full profile</button>${mine ? `<button class="btn sm" data-editprofile>Edit profile</button>` : ""}</div>
    </div>`;
  document.body.append(card);
  const r2 = anchor.getBoundingClientRect(), w = 290, h = card.offsetHeight;
  let x = r2.left - w - 10; if (x < 8) x = Math.min(innerWidth - w - 8, r2.right + 10);
  card.style.left = Math.max(8, x) + "px"; card.style.top = Math.max(8, Math.min(r2.top, innerHeight - h - 8)) + "px";
  card.querySelector("[data-fullprofile]")?.addEventListener("click", () => { card.remove(); openFullProfile(p.username); });
  card.querySelector("[data-editprofile]")?.addEventListener("click", () => { card.remove(); emit("view", "settings"); });
  card.querySelector("[data-setrole]")?.addEventListener("change", async (ev) => { try { await api(`/admin/users/${p.id}/custom-role`, "PUT", { roleId: ev.target.value || null }); toast("Role updated", "ok"); } catch (err) { toast(err.message, true); } });
}
async function onMsgClick(e) {
  const jump = e.target.closest("[data-jump]");
  if (jump) { const t = $(`.msg[data-id="${jump.dataset.jump}"]`); t?.scrollIntoView({ block: "center", behavior: "smooth" }); t?.animate([{ background: "color-mix(in srgb, var(--accent) 35%, transparent)" }, { background: "transparent" }], 1400); return; }
  const btn = e.target.closest("[data-act]");
  if (!btn) { const row = e.target.closest(".msg"); if (row && matchMedia("(max-width:760px)").matches && !e.target.closest("a, textarea, button")) { const was = row.classList.contains("tap"); $$(".msg.tap").forEach((x) => x.classList.remove("tap")); if (!was) row.classList.add("tap"); } return; }
  const row = btn.closest(".msg"); const id = row?.dataset.id; if (!id) return;
  const m = C.msgs[C.current]?.find((x) => x.id === id); if (!m) return;
  const act = btn.dataset.act;
  if (act === "toggle") send({ t: "react", id, emoji: btn.dataset.emoji });
  else if (act === "reply") setReply(m);
  else if (act === "edit") startEdit(m, row);
  else if (act === "del") { if (await confirmBox("Delete this message?", m.text.slice(0, 120), { ok: "Delete", danger: true })) send({ t: "delete", id }); }
  else if (act === "react") {
    $$(".picker").forEach((p) => p.remove());
    const p = document.createElement("div"); p.className = "picker";
    p.innerHTML = EMOJI.map((x) => `<button data-e="${x}">${x}</button>`).join("");
    row.append(p);
    const r = btn.getBoundingClientRect(), mr = $("#msgs").getBoundingClientRect();
    p.style.right = "12px"; p.style.top = (r.top - row.getBoundingClientRect().top + 28) + "px";
    if (r.bottom + 180 > mr.bottom) { p.style.top = "auto"; p.style.bottom = "34px"; }
    p.onclick = (ev) => { const b = ev.target.closest("[data-e]"); if (b) { send({ t: "react", id, emoji: b.dataset.e }); p.remove(); } };
  }
}
function startEdit(m, row) {
  const txt = row.querySelector(".txt");
  txt.innerHTML = `<textarea style="min-height:60px">${esc(m.text)}</textarea><div style="display:flex;gap:8px;margin-top:6px;font-size:12px;color:var(--dim);align-items:center"><button class="btn sm primary" data-s>Save</button><button class="btn sm" data-c>Cancel</button><span>Esc to cancel · Enter to save</span></div>`;
  const ta = txt.querySelector("textarea"); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  const save = () => { const v = ta.value.trim(); if (v && v !== m.text) send({ t: "edit", id: m.id, text: v }); renderMsgs("keep"); };
  txt.querySelector("[data-s]").onclick = save; txt.querySelector("[data-c]").onclick = () => renderMsgs("keep");
  ta.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === "Escape") renderMsgs("keep"); };
}
function setReply(m) {
  C.reply = m;
  const bar = $("#replybar");
  bar.classList.toggle("hidden", !m);
  if (m) { bar.querySelector("span").textContent = `Replying to ${m.username}: ${m.text.slice(0, 80)}`; $("#chatInput").focus(); }
}

/* ------------------------------ composer ------------------------------ */
function submit() {
  const input = $("#chatInput"); const text = input.value.trim();
  if (!text) return;
  send({ t: "send", channel: C.current, text, replyTo: C.reply?.id });
  input.value = ""; autosize(); setReply(null); hideMention();
}
function onKey(e) {
  const ml = $("#mentionList");
  if (!ml.classList.contains("hidden")) {
    const btns = $$("button", ml);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); C.mentionSel = (C.mentionSel + (e.key === "ArrowDown" ? 1 : -1) + btns.length) % btns.length; btns.forEach((b, i) => b.classList.toggle("sel", i === C.mentionSel)); return; }
    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); btns[C.mentionSel]?.click(); return; }
    if (e.key === "Escape") { hideMention(); return; }
  }
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  else if (e.key === "ArrowUp" && !e.target.value) { const mine = [...(C.msgs[C.current] ?? [])].reverse().find((m) => m.userId === me().id); const row = mine && $(`.msg[data-id="${mine.id}"]`); if (row) { e.preventDefault(); startEdit(mine, row); } }
}
const hideMention = () => $("#mentionList").classList.add("hidden");
function mentionCheck() {
  const i = $("#chatInput"); const before = i.value.slice(0, i.selectionStart);
  const m = before.match(/(?:^|\s)@([a-zA-Z0-9_.-]*)$/);
  if (!m) return hideMention();
  const q = m[1].toLowerCase();
  const names = [...C.members.map((x) => x.username), "everyone"].filter((n) => n.toLowerCase().startsWith(q) && n !== me().username).slice(0, 6);
  if (!names.length) return hideMention();
  C.mentionSel = 0;
  const ml = $("#mentionList");
  ml.classList.remove("hidden");
  ml.innerHTML = names.map((n, k) => `<button type="button" class="${k === 0 ? "sel" : ""}" data-n="${esc(n)}">${n === "everyone" ? "📣" : avatar(n, false, true)}<span>@${esc(n)}</span></button>`).join("");
  ml.onmousedown = (e) => e.preventDefault();
  ml.onclick = (e) => { const b = e.target.closest("[data-n]"); if (!b) return; const pos = i.selectionStart - m[1].length; i.setRangeText(b.dataset.n + " ", pos, i.selectionStart, "end"); hideMention(); i.focus(); };
}
export { icon };
