/* Direct messages, voice channels and private calls (voice, video, screen share).
 * Sockets come from chat.js (it re-emits unknown messages on the "ws" bus). Audio and video travel directly between browsers (WebRTC);
 * the server only introduces people and relays the handshake. */
import { $, $$, api, avatar, can, confirmBox, emit, esc, on, overlay, promptBox, state, toast } from "./util.js";
import { chatSend as send, ping, embeds } from "./chat.js";
import { openGifPicker } from "./gif.js";
import { openFullProfile } from "./profile.js";

const ICE = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };
const me = () => state.me;
const nameOf = (id) => state.people?.get(id)?.username ?? "someone";
const isOnline = (id) => (state.onlineIds ?? new Set()).has(id);

/* ============================== state ============================== */
const D = { open: null, convs: new Map(), msgs: new Map(), loaded: new Set(), unread: new Map(), blocked: new Set(), voice: {}, tmp: new Set(), more: new Map() };
const readKey = "artemis.dmread";
const lastRead = () => { try { return JSON.parse(localStorage.getItem(readKey) || "{}"); } catch { return {}; } };
const markRead = (id) => { try { const r = lastRead(); r[id] = Date.now(); localStorage.setItem(readKey, JSON.stringify(r)); } catch { /* storage blocked */ } D.unread.set(id, 0); updateDmBadge(); };
const totalUnread = () => [...D.unread.values()].reduce((a, b) => a + b, 0);
function updateDmBadge() { state.dmUnread = totalUnread(); emit("dmunread"); }

/* friends: who is a friend, who asked me, who I asked */
const F = { friends: new Set(), incoming: [], outgoing: new Set() };
const setFriends = (m) => { F.friends = new Set(m.friends ?? []); F.incoming = m.incoming ?? []; F.outgoing = new Set(m.outgoing ?? []); emit("friends"); };
state.friendRel = (id) => (F.friends.has(id) ? "friends" : F.incoming.some((r) => r.id === id) ? "incoming" : F.outgoing.has(id) ? "outgoing" : "none");
const isFriend = (id) => F.friends.has(id);
function friendAct({ act, id }) {
  const m = { add: { t: "fr-send", to: id }, accept: { t: "fr-accept", from: id }, decline: { t: "fr-decline", from: id }, cancel: { t: "fr-cancel", to: id }, remove: { t: "fr-remove", id }, block: { t: "dm-block", id, on: true } }[act];
  if (m) send(m);
  if (act === "add") toast("Friend request sent", "ok");
}

/* ============================== build ============================== */
export function buildSocial() {
  const chat = $("#chat"); if (!chat || $("#dmMain")) return;
  const side = chat.querySelector(".chan-side");
  const list = document.createElement("div"); list.id = "socialList";
  side.insertBefore(list, $("#userBar"));
  const main = document.createElement("section"); main.className = "main glass dm-main"; main.id = "dmMain";
  main.innerHTML = `<div class="chead dmhead" id="dmHead"></div><div id="dmMsgs" class="dmmsgs" aria-live="polite"></div>
    <div class="cbox dmbox"><textarea id="dmInput" rows="1" maxlength="2000" placeholder="Message…"></textarea><button class="btn gifbtn" id="dmGif" type="button" title="Send a GIF (trusted members)">GIF</button><button class="btn" id="dmSend" type="button">Send</button></div>`;
  chat.querySelector("section.main").after(main);
  const dock = document.createElement("div"); dock.id = "callDock"; dock.className = "calldock glass hidden";
  dock.innerHTML = `<div class="cd-head"><b id="cdTitle"></b><span id="cdSub"></span><button type="button" class="icon-btn" data-cd="smaller" title="Make the call window smaller" aria-label="Smaller">−</button><button type="button" class="icon-btn" data-cd="bigger" title="Make the call window bigger" aria-label="Bigger">+</button><button type="button" class="icon-btn" data-cd="big" title="Fill the middle of the screen" aria-label="Fill the middle">⤢</button></div><div class="cd-resize" title="Drag to resize"></div>
    <div class="cd-grid" id="cdGrid"></div>
    <div class="cd-bar"><button type="button" data-cd="mute" title="Mute microphone">🎤<span>Mute</span></button><button type="button" data-cd="cam" title="Camera">📷<span>Camera</span></button><button type="button" data-cd="screen" title="Share your screen">🖥<span>Share screen</span></button><button type="button" data-cd="leave" class="leave">⏻<span>Leave</span></button></div>`;
  document.body.append(dock);
  const ring = document.createElement("div"); ring.id = "ringBox"; ring.className = "ringbox glass hidden"; document.body.append(ring);

  list.addEventListener("click", onListClick);
  main.addEventListener("click", onDmClick);
  $("#dmSend").onclick = sendDm;
  $("#dmGif").onclick = () => {
    if (!state.trusted) return toast("GIFs unlock when you become a trusted member. See the Hub for your progress.", true);
    if (!D.open) return;
    const to = D.open; openGifPicker((url) => send({ t: "dm-send", to, text: url }));
  };
  $("#dmInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendDm(); } });
  dock.addEventListener("click", onDockClick);
  dock.addEventListener("dblclick", (e) => { const t = e.target.closest(".ctile"); if (t) goFull(t); });
  /* drag the top-left corner to size the call window; the buttons step it smaller and bigger; the size is remembered */
  try { const w = +localStorage.getItem("artemis.cdw"); if (w >= 240) setDockW(w); } catch { /* no storage */ }
  dock.querySelector(".cd-resize").addEventListener("pointerdown", (e) => {
    e.preventDefault(); const x0 = e.clientX, w0 = dock.getBoundingClientRect().width; const h = e.currentTarget; h.setPointerCapture(e.pointerId);
    const mv = (ev) => setDockW(w0 + (x0 - ev.clientX)), up = () => { h.removeEventListener("pointermove", mv); h.removeEventListener("pointerup", up); };
    h.addEventListener("pointermove", mv); h.addEventListener("pointerup", up);
  });
  ring.addEventListener("click", onRingClick);
  /* leaving to a channel closes the DM view */
  chat.addEventListener("click", (e) => { if (e.target.closest("[data-chan]")) closeDm(); }, true);
  on("ws", onWs);
  on("social-init", (m) => { setFriends(m); D.voice = m.voice ?? {}; D.convs = new Map((m.dms ?? []).map((c) => [c.id, c.last])); const lr = lastRead(); D.unread = new Map(); for (const [id, l] of D.convs) if (l.from !== me().id && !l.sys && l.ts > (lr[id] || 0)) D.unread.set(id, 1); updateDmBadge(); renderList(); });
  on("channels", renderList); on("members", renderList); on("self", renderList);
  on("dm-open", (id) => openDm(id)); on("fr-act", friendAct); on("friends", () => { renderList(); if (D.open) renderPane(true); });
  on("call-start", ({ id, video }) => startCall(id, !!video));
  on("wsopen", () => { if (R) { toast("Connection dropped, so your call ended.", true); leaveRoom(false); } });
  on("view", (v) => { if (v === "chat" && D.open) markRead(D.open); });
  addEventListener("beforeunload", () => leaveRoom(true));
  renderList();
}

/* ============================== side list ============================== */
const unreadN = (id) => D.unread.get(id) ?? 0;
function renderList() {
  const el = $("#socialList"); if (!el) return;
  const admin = can("manage_channels");
  const vcs = (state.channels ?? []).filter((c) => c.voice);
  const convs = [...D.convs.entries()].map(([id, last]) => ({ id, last })).concat([...D.tmp].filter((id) => !D.convs.has(id)).map((id) => ({ id, last: null }))).sort((a, b) => (b.last?.ts ?? Infinity) - (a.last?.ts ?? Infinity));
  const reqs = F.incoming.length ? `<h4>Friend requests <span class="u">${F.incoming.length}</span></h4>` + F.incoming.map((r) => `<div class="frrow">${avatar(nameOf(r.id), isOnline(r.id), true)}<b data-frprof="${esc(r.id)}">${esc(nameOf(r.id))}</b><button class="btn sm" data-fra="${esc(r.id)}">Accept</button><button class="btn sm ghost" data-frd="${esc(r.id)}" aria-label="Decline">✕</button></div>`).join("") : "";
  el.innerHTML = reqs + `<h4>Voice ${admin ? `<button class="btn sm" data-newvoice title="New voice channel">+</button>` : ""}</h4>
    ${vcs.map((c) => { const users = D.voice[c.id] ?? [], here = R?.room === "vc:" + c.id; return `<div class="vc${here ? " on" : ""}"><button class="chan vcbtn" data-vc="${esc(c.id)}"><span class="h">🔊</span><span class="cn">${esc(c.name)}</span>${users.length ? `<span class="u vcn">${users.length}</span>` : ""}</button>${admin ? `<button class="x vcdel" data-delvc="${esc(c.id)}" title="Delete" aria-label="Delete ${esc(c.name)}">×</button>` : ""}${users.map((u) => `<div class="vcu">${avatar(u.username, true, true)}<span>${esc(u.username)}</span></div>`).join("")}</div>`; }).join("") || `<p class="note" style="margin:4px 8px">No voice channels yet.</p>`}
    <h4>Direct messages <button class="btn sm" data-newdm title="New message">+</button></h4>
    ${convs.map(({ id, last }) => { const n = unreadN(id); return `<button class="chan dmrow${D.open === id ? " on" : ""}" data-dm="${esc(id)}">${avatar(nameOf(id), isOnline(id), true)}<span class="mt"><span class="n">${esc(nameOf(id))}</span>${last ? `<span class="ms">${last.from === me().id ? "You: " : ""}${esc(last.text.slice(0, 26))}</span>` : ""}</span>${n ? `<span class="u">${n > 9 ? "9+" : n}</span>` : ""}</button>`; }).join("") || `<p class="note" style="margin:4px 8px">Tap + to message someone.</p>`}`;
}
async function onListClick(e) {
  const vc = e.target.closest("[data-vc]");
  if (vc) { const c = state.channels.find((x) => x.id === vc.dataset.vc); if (c) joinVoice(c); return; }
  const del = e.target.closest("[data-delvc]");
  if (del) { if (await confirmBox("Delete this voice channel?", "Everyone in it is disconnected.", { ok: "Delete", danger: true })) try { await api("/channels/" + del.dataset.delvc, "DELETE"); } catch (err) { toast(err.message, true); } return; }
  if (e.target.closest("[data-newvoice]")) { const n = await promptBox("New voice channel", { label: "Name", placeholder: "game-night", ok: "Create" }); if (n) try { await api("/channels", "POST", { name: n, voice: true }); } catch (err) { toast(err.message, true); } return; }
  if (e.target.closest("[data-newdm]")) return void pickPerson();
  const fa = e.target.closest("[data-fra]"); if (fa) return void friendAct({ act: "accept", id: fa.dataset.fra });
  const fd = e.target.closest("[data-frd]"); if (fd) return void friendAct({ act: "decline", id: fd.dataset.frd });
  const fp = e.target.closest("[data-frprof]"); if (fp) return void openFullProfile(nameOf(fp.dataset.frprof));
  const dm = e.target.closest("[data-dm]"); if (dm) openDm(dm.dataset.dm);
}
function pickPerson() {
  const o = overlay(`<div class="modal glass picker-dm" role="dialog" aria-label="New message"><h3>New message</h3><p class="note" style="margin:0">Friends only</p><input id="pdq" type="search" placeholder="Search your friends…" autocomplete="off"><div id="pdl" class="lkr"></div><div class="row end"><button class="btn ghost" data-x>Cancel</button></div></div>`, { center: true });
  const q = o.querySelector("#pdq"), out = o.querySelector("#pdl");
  const paint = () => { const s = q.value.trim().toLowerCase(); const l = [...state.people.values()].filter((p) => isFriend(p.id) && (!s || p.username.toLowerCase().includes(s))).sort((a, b) => (isOnline(b.id) - isOnline(a.id)) || a.username.localeCompare(b.username)).slice(0, 14); out.innerHTML = l.map((p) => `<button type="button" class="lkrow" data-pd="${esc(p.id)}">${avatar(p.username, isOnline(p.id), true)}<b>${esc(p.username)}</b></button>`).join("") || `<p class="note">${F.friends.size ? "No friend by that name." : "You have no friends yet. Open someone's profile and press Add friend. Once they accept, you can message and call each other."}</p>`; };
  q.addEventListener("input", paint); paint(); setTimeout(() => q.focus(), 30);
  o.addEventListener("click", (e) => { if (e.target === o || e.target.closest("[data-x]")) return o.remove(); const b = e.target.closest("[data-pd]"); if (b) { o.remove(); openDm(b.dataset.pd); } });
}

/* ============================== DM pane ============================== */
export function openDm(id) {
  if (!id || id === me().id) return;
  D.open = id; D.tmp.add(id);
  emit("view", "chat");
  $("#chat").classList.add("dm-open");
  if (!D.loaded.has(id)) send({ t: "dm-history", with: id });
  markRead(id); renderList(); renderPane();
  setTimeout(() => $("#dmInput")?.focus(), 60);
}
function closeDm() { if (!D.open) return; D.open = null; $("#chat")?.classList.remove("dm-open"); renderList(); }
const fmtT = (ts) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const link = (s) => esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)"'])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
function renderPane(keep) {
  const id = D.open; if (!id) return;
  const name = nameOf(id), blocked = D.blocked.has(id), onl = isOnline(id), fr = isFriend(id), rel = state.friendRel(id);
  $("#dmHead").innerHTML = `<button class="dmback btn sm ghost" data-dmact="back" aria-label="Back to channels">←</button>${avatar(name, onl, true)}<b data-dmact="profile" style="cursor:pointer">${esc(name)}</b><span class="topic">${onl ? "Online" : "Offline"}</span>
    <span class="dmacts"><button class="btn sm" data-dmact="voice" ${onl && !blocked && fr ? "" : "disabled"} title="Voice call">📞 Call</button><button class="btn sm" data-dmact="video" ${onl && !blocked && fr ? "" : "disabled"} title="Video call">🎥 Video</button><button class="btn sm ghost" data-dmact="block">${blocked ? "Unblock" : "Block"}</button></span>`;
  const box = $("#dmMsgs"), list = D.msgs.get(id) ?? [], atBottom = !keep || box.scrollHeight - box.scrollTop - box.clientHeight < 140;
  box.innerHTML = (D.more.get(id) ? `<button class="btn sm ghost dmmore" data-dmact="older">Load earlier</button>` : "") +
    (list.length ? list.map((m) => m.sys ? `<div class="dmsys">${esc(m.text)} · ${fmtT(m.ts)}</div>` : `<div class="dmb ${m.from === me().id ? "mine" : ""}"><div class="dmt${/^https?:\/\/\S+\.(png|jpe?g|gif|webp|avif)(\?\S*)?$/i.test(m.text.trim()) ? " linkhid" : ""}">${link(m.text)}</div>${embeds(m.text)}<small>${fmtT(m.ts)}</small></div>`).join("") : D.loaded.has(id) ? `<div class="chat-empty"><b>${esc(name)}</b><span>This is the start of your private chat. Only the two of you can see it.</span></div>` : "");
  if (atBottom) box.scrollTop = box.scrollHeight;
  $("#dmInput").disabled = blocked || !fr; $("#dmInput").placeholder = blocked ? "You blocked this person" : !fr ? "Friends only" : `Message ${name}`;
  box.insertAdjacentHTML("beforeend", fr ? "" : `<div class="dmgate"><b>You are not friends with ${esc(name)}</b><span>${rel === "outgoing" ? "Your friend request is waiting for them to accept." : rel === "incoming" ? `${esc(name)} sent you a friend request.` : "Add them as a friend to message and call each other."}</span>${rel === "outgoing" ? "" : `<button class="btn primary" data-dmact="${rel === "incoming" ? "accept" : "addfriend"}">${rel === "incoming" ? "Accept request" : "Add friend"}</button>`}</div>`);
}
function sendDm() {
  const i = $("#dmInput"), t = i.value.trim(); if (!t || !D.open) return;
  send({ t: "dm-send", to: D.open, text: t }); i.value = ""; i.style.height = "";
}
async function onDmClick(e) {
  const a = e.target.closest("[data-dmact]"); if (!a) return;
  const id = D.open, act = a.dataset.dmact;
  if (act === "back") return closeDm();
  if (act === "addfriend") return friendAct({ act: "add", id });
  if (act === "accept") return friendAct({ act: "accept", id });
  if (act === "profile") return openFullProfile(nameOf(id));
  if (act === "voice") return startCall(id, false);
  if (act === "video") return startCall(id, true);
  if (act === "block") { const on_ = !D.blocked.has(id); if (on_ && !(await confirmBox(`Block ${nameOf(id)}?`, "You won't be able to message or call each other until you unblock them.", { ok: "Block", danger: true }))) return; send({ t: "dm-block", id, on: on_ }); return; }
  if (act === "older") { const first = D.msgs.get(id)?.[0]; send({ t: "dm-history", with: id, before: first?.ts }); }
}

/* ============================== socket messages ============================== */
function onWs(m) {
  switch (m.t) {
    case "dm": return onDm(m.msg);
    case "dm-list": D.convs = new Map(m.list.map((c) => [c.id, c.last])); renderList(); return;
    case "dm-history": {
      const cur = D.msgs.get(m.with) ?? [];
      D.msgs.set(m.with, m.older || cur.length ? [...m.messages.filter((x) => !cur.some((c) => c.id === x.id)), ...cur] : m.messages);
      D.more.set(m.with, m.more); D.loaded.add(m.with);
      if (m.blocked) D.blocked.add(m.with); else D.blocked.delete(m.with);
      if (D.open === m.with) renderPane(true); return;
    }
    case "dm-blocked": if (m.on) D.blocked.add(m.id); else D.blocked.delete(m.id); if (D.open === m.id) renderPane(true); toast(m.on ? "Blocked" : "Unblocked", "ok"); return;
    case "friends": setFriends(m); return;
    case "fr-new": toast(`${m.from.username} sent you a friend request`, "ok"); if (me().settings.chatSound) ping(true); return;
    case "fr-ok": toast(`${m.user.username} is now your friend`, "ok"); return;
    case "voice": D.voice = m.state ?? {}; renderList(); return;
    case "presence": renderList(); if (D.open) renderPane(true); return;
    case "call": return onCall(m);
    case "room": return onRoom(m);
    case "room-join": return onPeerJoin(m);
    case "room-leave": return onPeerLeave(m);
    case "room-state": return onPeerState(m);
    case "rtc": return onRtc(m);
  }
}
function onDm(m) {
  const peer = m.from === me().id ? m.to : m.from;
  const list = D.msgs.get(peer) ?? []; if (!list.some((x) => x.id === m.id)) list.push(m); D.msgs.set(peer, list);
  D.convs.set(peer, m); D.tmp.delete(peer);
  const watching = D.open === peer && state.view === "chat" && !document.hidden;
  if (watching) markRead(peer);
  else if (m.from !== me().id && !m.sys) { D.unread.set(peer, unreadN(peer) + 1); updateDmBadge(); if (me().settings.chatSound) ping(true); if (state.view !== "chat" || document.hidden) toast(`${m.username}: ${m.text.slice(0, 60)}`, "ok"); }
  renderList(); if (D.open === peer) renderPane(true);
}

/* ============================== calls ============================== */
const C = { ring: null, timer: 0 };
async function startCall(id, video) {
  /* calls go straight between the two browsers, which can show each person's IP address to the other */
  let warned = false; try { warned = localStorage.getItem("artemis.callwarn") === "1"; } catch { /* storage off */ }
  if (!warned) {
    if (!(await confirmBox("Call this friend?", "Calls connect your devices directly, so the other person's device can see your IP address. Only call people you trust.", { ok: "Call" }))) return;
    try { localStorage.setItem("artemis.callwarn", "1"); } catch { /* storage off */ }
  }
  if (!navigator.mediaDevices?.getUserMedia) return toast("Calls need a secure page (https or localhost).", true);
  if (!isFriend(id)) return toast("You need to be friends to call each other.", true);
  if (R) return toast("Leave your current call first.", true);
  if (C.ring) return toast("You already have a call in progress.", true);
  send({ t: "call-invite", to: id, video: !!video });
}
function onCall(m) {
  if (m.event === "ring") {
    if (R || C.ring) { send({ t: "call-answer", id: m.id, accept: false }); return; }
    C.ring = { id: m.id, dir: "in", video: m.video, name: m.from.username, peer: m.from.id }; showRing(); startRingtone();
    if (document.hidden) try { new Notification(`${m.from.username} is calling`); } catch { /* no notifications */ }
  } else if (m.event === "calling") {
    C.ring = { id: m.id, dir: "out", video: m.video, name: m.to.username, peer: m.to.id }; showRing(); startRingtone(true);
  } else if (m.event === "accepted") {
    if (!C.ring || C.ring.id !== m.id) { if (!R) hideRing(); return; }
    const r = C.ring; C.ring = null; hideRing(); stopRingtone();
    joinRoom("call:" + r.id, `Call with ${r.name}`, "call", { video: r.video, callId: r.id }).then((ok) => { if (!ok) send({ t: "call-end", id: r.id }); });
  } else if (m.event === "ended") {
    if (C.ring?.id === m.id) { const r = C.ring; C.ring = null; hideRing(); stopRingtone(); toast(m.reason === "declined" ? `${r.name} declined the call` : m.reason === "missed" ? (r.dir === "out" ? `${r.name} didn't answer` : "Missed call") : "Call ended"); }
    if (R?.callId === m.id) { toast("Call ended"); leaveRoom(false); }
  }
}
function showRing() {
  const r = C.ring, el = $("#ringBox"); if (!r) return;
  el.classList.remove("hidden");
  el.innerHTML = r.dir === "in"
    ? `<div class="rg-av">${avatar(r.name, true, false, true)}</div><b>${esc(r.name)}</b><span>is ${r.video ? "video " : ""}calling you…</span><div class="rg-b"><button class="btn danger" data-rg="decline">Decline</button><button class="btn primary" data-rg="accept">${r.video ? "Accept video" : "Accept"}</button></div>`
    : `<div class="rg-av">${avatar(r.name, true, false, true)}</div><b>Calling ${esc(r.name)}…</b><span>${r.video ? "Video call" : "Voice call"} · waiting for an answer</span><div class="rg-b"><button class="btn danger" data-rg="cancel">Cancel</button></div>`;
}
function hideRing() { $("#ringBox")?.classList.add("hidden"); }
function onRingClick(e) {
  const b = e.target.closest("[data-rg]"); if (!b || !C.ring) return;
  const r = C.ring;
  if (b.dataset.rg === "accept") { stopRingtone(); send({ t: "call-answer", id: r.id, accept: true }); }
  else { send(b.dataset.rg === "cancel" ? { t: "call-end", id: r.id } : { t: "call-answer", id: r.id, accept: false }); C.ring = null; hideRing(); stopRingtone(); }
}
let actx;
function startRingtone(soft) {
  stopRingtone();
  const beat = () => { try { actx ??= new (window.AudioContext || window.webkitAudioContext)(); [[soft ? 420 : 520, 0], [soft ? 420 : 660, .22]].forEach(([f, w]) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = "sine"; o.frequency.value = f; const t = actx.currentTime + w; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(soft ? .05 : .12, t + .03); g.gain.exponentialRampToValueAtTime(0.0001, t + .32); o.connect(g).connect(actx.destination); o.start(t); o.stop(t + .35); }); } catch { /* audio blocked */ } };
  beat(); C.timer = setInterval(beat, 2200);
}
function stopRingtone() { clearInterval(C.timer); C.timer = 0; }

/* ============================== rooms (WebRTC) ============================== */
let R = null; /* { room, label, kind, you, peers:Map, local, cam, screen, muted, callId } */
const tiles = new Map();

async function getMic() {
  if (!navigator.mediaDevices?.getUserMedia) { toast("Voice and video need a secure page (https or localhost).", true); return null; }
  try { return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }); }
  catch (e) { toast(e?.name === "NotAllowedError" ? "Allow microphone access in your browser to join." : "No microphone found.", true); return null; }
}
async function getCam() {
  try { const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } }); return s.getVideoTracks()[0]; }
  catch { toast("Couldn't open your camera.", true); return null; }
}
async function joinRoom(room, label, kind, opts = {}) {
  if (R) leaveRoom(true);
  const local = await getMic(); if (!local) return false;
  R = { room, label, kind, you: "", peers: new Map(), local, cam: null, screen: null, muted: false, callId: opts.callId, big: false };
  showDock(); send({ t: "room-join", room });
  if (opts.video) { const t = await getCam(); if (t && R) { R.cam = t; addSelfVideo(); setVideoTrack(t); } }
  renderList(); return true;
}
function joinVoice(c) {
  if (R?.room === "vc:" + c.id) return void showDock();
  joinRoom("vc:" + c.id, c.name, "voice");
}
function leaveRoom(notify) {
  if (!R) return;
  const r = R; R = null;
  if (notify) { send({ t: "room-leave", room: r.room }); if (r.kind === "call" && r.callId) send({ t: "call-end", id: r.callId }); }
  for (const p of r.peers.values()) try { p.pc.close(); } catch { /* closed */ }
  r.local.getTracks().forEach((t) => t.stop()); r.cam?.stop(); r.screen?.stop();
  tiles.clear(); $("#cdGrid") && ($("#cdGrid").innerHTML = ""); $("#callDock")?.classList.add("hidden"); $("#callDock")?.classList.remove("big");
  renderList();
}
function onRoom(m) {
  if (!R || R.room !== m.room) return;
  R.you = m.you;
  for (const p of m.peers) makePeer(p);
  paintDock(); sendState();
}
function onPeerJoin(m) { if (!R || R.room !== m.room) return; makePeer(m.peer); paintDock(); sendState(); }
function onPeerLeave(m) {
  if (!R || R.room !== m.room) return;
  const p = R.peers.get(m.cid); if (!p) return;
  try { p.pc.close(); } catch { /* closed */ } R.peers.delete(m.cid); tiles.get(m.cid)?.el.remove(); tiles.delete(m.cid); paintDock();
}
function onPeerState(m) { if (!R || R.room !== m.room) return; const p = R.peers.get(m.cid); if (!p) return; Object.assign(p.rs, { muted: m.muted, video: m.video, screen: m.screen }); paintTile(p); }
function sendState() { if (!R) return; send({ t: "room-state", room: R.room, muted: R.muted, video: !!(R.cam || R.screen), screen: !!R.screen }); }

function makePeer(p) {
  if (R.peers.has(p.cid)) return R.peers.get(p.cid);
  const pc = new RTCPeerConnection(ICE);
  const peer = { cid: p.cid, id: p.id, name: p.username, pc, stream: null, making: false, ignore: false, polite: R.you < p.cid, vsender: null, q: Promise.resolve(), rs: { muted: false, video: false, screen: false } };
  R.peers.set(p.cid, peer);
  for (const t of R.local.getAudioTracks()) pc.addTrack(t, R.local);
  const vt = R.screen ?? R.cam; if (vt) peer.vsender = pc.addTrack(vt, R.local);
  pc.ontrack = (e) => { peer.stream = e.streams[0] ?? peer.stream ?? new MediaStream(); if (!e.streams[0]) peer.stream.addTrack(e.track); const t = tiles.get(peer.cid); if (t) { t.video.srcObject = peer.stream; t.video.play?.().catch(() => {}); } };
  pc.onicecandidate = (e) => { if (e.candidate && R) send({ t: "rtc", room: R.room, to: peer.cid, data: { candidate: e.candidate } }); };
  pc.onnegotiationneeded = async () => {
    try { peer.making = true; await pc.setLocalDescription(); if (R) send({ t: "rtc", room: R.room, to: peer.cid, data: { description: pc.localDescription } }); }
    catch (e) { console.warn("[artemis] negotiation", e); } finally { peer.making = false; }
  };
  pc.oniceconnectionstatechange = () => { if (pc.iceConnectionState === "failed") try { pc.restartIce(); } catch { /* old browser */ } paintTile(peer); };
  addTile(peer);
  return peer;
}
function onRtc(m) {
  if (!R || R.room !== m.room) return;
  const peer = R.peers.get(m.from) ?? makePeer({ cid: m.from, id: "", username: m.user ?? "someone" });
  peer.q = peer.q.then(async () => {
    const pc = peer.pc, { description, candidate } = m.data ?? {};
    try {
      if (description) {
        const collision = description.type === "offer" && (peer.making || pc.signalingState !== "stable");
        peer.ignore = !peer.polite && collision; if (peer.ignore) return;
        await pc.setRemoteDescription(description);
        if (description.type === "offer") { await pc.setLocalDescription(); if (R) send({ t: "rtc", room: R.room, to: peer.cid, data: { description: pc.localDescription } }); }
      } else if (candidate) { try { await pc.addIceCandidate(candidate); } catch (e) { if (!peer.ignore) console.warn("[artemis] ice", e); } }
    } catch (e) { console.warn("[artemis] rtc", e); }
  });
}
/** Swap what everyone sees: the camera, the screen, or nothing. */
function setVideoTrack(track) {
  if (!R) return;
  for (const p of R.peers.values()) {
    if (p.vsender) p.vsender.replaceTrack(track).catch(() => {});
    else if (track) p.vsender = p.pc.addTrack(track, R.local);
  }
  addSelfVideo(); sendState(); paintDock();
}
async function toggleCam() {
  if (!R) return;
  if (R.cam) { R.cam.stop(); R.cam = null; if (!R.screen) setVideoTrack(null); else paintDock(); return; }
  const t = await getCam(); if (!t || !R) return;
  R.cam = t; t.onended = () => { if (R?.cam === t) { R.cam = null; if (!R.screen) setVideoTrack(null); } };
  if (!R.screen) setVideoTrack(t); else paintDock();
}
async function toggleScreen() {
  if (!R) return;
  if (R.screen) return stopScreen();
  if (!navigator.mediaDevices?.getDisplayMedia) return toast("Your browser can't share the screen.", true);
  try {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: false });
    const t = s.getVideoTracks()[0]; t.onended = stopScreen; R.screen = t; setVideoTrack(t);
  } catch (e) { if (e?.name !== "NotAllowedError") toast("Couldn't start screen sharing.", true); }
}
function stopScreen() { if (!R?.screen) return; R.screen.stop(); R.screen = null; setVideoTrack(R.cam ?? null); }

/* ============================== call dock ============================== */
function showDock() { $("#callDock").classList.remove("hidden"); paintDock(); }
function addSelfVideo() { paintDock(); }
function addTile(peer) {
  const el = document.createElement("div"); el.className = "ctile"; el.dataset.cid = peer.cid;
  el.innerHTML = `<video autoplay playsinline></video><div class="ct-av">${avatar(peer.name, true, false, true)}</div><span class="ct-n">${esc(peer.name)}</span><i class="ct-m" title="Muted">🔇</i><button type="button" class="ct-fs" data-fs title="Full screen (or double-click)" aria-label="Full screen">⛶</button>`;
  $("#cdGrid").append(el); tiles.set(peer.cid, { el, video: el.querySelector("video") });
  if (peer.stream) tiles.get(peer.cid).video.srcObject = peer.stream;
  paintTile(peer);
}
function paintTile(peer) {
  const t = tiles.get(peer.cid); if (!t) return;
  t.el.classList.toggle("has-video", !!peer.rs.video); t.el.classList.toggle("screen", !!peer.rs.screen); t.el.classList.toggle("muted", !!peer.rs.muted);
  t.el.classList.toggle("shaky", ["disconnected", "failed"].includes(peer.pc.iceConnectionState));
}
function paintDock() {
  if (!R) return;
  const dock = $("#callDock"); $("#cdTitle").textContent = (R.kind === "voice" ? "🔊 " : "📞 ") + R.label;
  $("#cdSub").textContent = R.peers.size ? `${R.peers.size + 1} here` : R.kind === "call" ? "Connecting…" : "You're the first one here";
  /* my own tile */
  let me_ = tiles.get("me");
  if (!me_) { const el = document.createElement("div"); el.className = "ctile self"; el.innerHTML = `<video autoplay playsinline muted></video><div class="ct-av">${avatar(me().username, true, false, true)}</div><span class="ct-n">You</span><i class="ct-m" title="Muted">🔇</i><button type="button" class="ct-fs" data-fs title="Full screen (or double-click)" aria-label="Full screen">⛶</button>`; $("#cdGrid").prepend(el); tiles.set("me", (me_ = { el, video: el.querySelector("video") })); }
  const track = R.screen ?? R.cam;
  if (track) { const cur = me_.video.srcObject; if (!cur || cur.getVideoTracks()[0] !== track) me_.video.srcObject = new MediaStream([track]); } else me_.video.srcObject = null;
  me_.el.classList.toggle("has-video", !!track); me_.el.classList.toggle("screen", !!R.screen); me_.el.classList.toggle("muted", R.muted);
  const n = R.peers.size + 1; dock.dataset.n = String(Math.min(n, 6));
  const set = (k, on_, label) => { const b = dock.querySelector(`[data-cd="${k}"]`); b.classList.toggle("on", on_); if (label) b.querySelector("span").textContent = label; };
  set("mute", R.muted, R.muted ? "Unmute" : "Mute"); set("cam", !!R.cam, R.cam ? "Camera off" : "Camera"); set("screen", !!R.screen, R.screen ? "Stop sharing" : "Share screen");
  dock.classList.toggle("big", R.big);
}
function setDockW(w) {
  const dock = $("#callDock"); if (!dock) return; w = Math.round(Math.max(240, Math.min(innerWidth - 24, w)));
  dock.style.width = w + "px"; dock.classList.remove("big"); if (R) R.big = false;
  try { localStorage.setItem("artemis.cdw", String(w)); } catch { /* no storage */ }
}
function goFull(tile) { try { if (document.fullscreenElement) document.exitFullscreen(); else (tile.requestFullscreen?.() ?? Promise.reject()).catch?.(() => toast("Your browser would not go full screen.", true)); } catch { toast("Your browser would not go full screen.", true); } }
function onDockClick(e) {
  const fs = e.target.closest("[data-fs]"); if (fs) return goFull(fs.closest(".ctile"));
  const b = e.target.closest("[data-cd]"); if (!b) return;
  const a = b.dataset.cd;
  if (a === "smaller" || a === "bigger") return setDockW($("#callDock").getBoundingClientRect().width * (a === "bigger" ? 1.25 : 0.8));
  if (!R) return;
  if (a === "mute") { R.muted = !R.muted; R.local.getAudioTracks().forEach((t) => (t.enabled = !R.muted)); sendState(); paintDock(); }
  else if (a === "cam") toggleCam();
  else if (a === "screen") toggleScreen();
  else if (a === "big") { R.big = !R.big; if (R.big) $("#callDock").style.width = ""; paintDock(); }
  else if (a === "leave") leaveRoom(true);
}
export const inCall = () => !!R;
