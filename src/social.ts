/* Direct messages, voice channels and private calls (voice, video, screen share).
 * The server only introduces people and relays the WebRTC handshake; the audio and video themselves travel directly between browsers. */
import type { WebSocket } from "ws";
import { allow } from "./auth.js";
import { db, saveDb, uid, type DmMsg, type User } from "./store.js";
import { moderate } from "./bot.js";
import { canSeeChannel, isTrusted } from "./trust.js";

export interface SClient { ws: WebSocket; user: User; cid: string; rooms: Set<string> }
interface Ctx { clients: () => Iterable<SClient>; send: (ws: WebSocket, d: unknown) => void; ban: (id: string) => void }
let X: Ctx;
export const initSocial = (c: Ctx) => { X = c; };

const MAX_DMS = 20000, MAX_ROOM = 8, RING_MS = 45_000;
const keyOf = (a: string, b: string) => [a, b].sort().join(":");
const userById = (id: string) => db.data.users.find((u) => u.id === id && !u.banned);
const toUser = (id: string, d: unknown) => { for (const c of X.clients()) if (c.user.id === id) X.send(c.ws, d); };
const live = (id: string) => { for (const c of X.clients()) if (c.user.id === id) return true; return false; };
const isBlocked = (a: User, b: User) => !!(a.dmBlocked?.includes(b.id) || b.dmBlocked?.includes(a.id));
const peerOf = (c: SClient) => ({ cid: c.cid, id: c.user.id, username: c.user.username });

/* ------------------------------ direct messages ------------------------------ */
function addDm(from: User, to: User, text: string, sys = false): DmMsg {
  const m: DmMsg = { id: uid(), key: keyOf(from.id, to.id), from: from.id, to: to.id, username: from.username, text, ts: Date.now(), ...(sys ? { sys: true } : {}) };
  db.data.dms.push(m);
  if (db.data.dms.length > MAX_DMS) db.data.dms.splice(0, db.data.dms.length - MAX_DMS);
  saveDb();
  toUser(from.id, { t: "dm", msg: m }); toUser(to.id, { t: "dm", msg: m });
  return m;
}
const convList = (u: User) => {
  const last = new Map<string, DmMsg>();
  for (const m of db.data.dms) if (m.from === u.id || m.to === u.id) last.set(m.from === u.id ? m.to : m.from, m);
  return [...last.entries()].map(([id, m]) => ({ id, last: m })).filter((x) => userById(x.id)).sort((a, b) => b.last.ts - a.last.ts).slice(0, 60);
};

/* ------------------------------ rooms ------------------------------ */
const rooms = new Map<string, Set<SClient>>();
interface Call { id: string; from: string; to: string; video: boolean; state: "ringing" | "active"; startedAt: number; timer?: NodeJS.Timeout }
const calls = new Map<string, Call>();
const callOf = (uid: string) => [...calls.values()].find((c) => c.from === uid || c.to === uid);
const voiceState = () => {
  const out: Record<string, { id: string; username: string }[]> = {};
  for (const [r, set] of rooms) if (r.startsWith("vc:")) { const seen = new Map<string, string>(); for (const c of set) seen.set(c.user.id, c.user.username); out[r.slice(3)] = [...seen].map(([id, username]) => ({ id, username })); }
  return out;
};
const broadcastVoice = () => { const raw = { t: "voice", state: voiceState() }; for (const c of X.clients()) X.send(c.ws, raw); };
/* ------------------------------ friends ------------------------------ */
const MAX_FRIENDS = 200;
export const areFriends = (a: User, b: User) => !!a.friends?.includes(b.id) && !!b.friends?.includes(a.id);
const fstate = (u: User) => ({
  friends: (u.friends ?? []).filter((id) => userById(id)),
  incoming: db.data.friendReqs.filter((r) => r.to === u.id && userById(r.from)).map((r) => ({ id: r.from, ts: r.ts })),
  outgoing: db.data.friendReqs.filter((r) => r.from === u.id && userById(r.to)).map((r) => r.to),
});
const pushFriends = (...ids: string[]) => { for (const id of ids) { const u = userById(id); if (u) toUser(id, { t: "friends", ...fstate(u) }); } };
const dropReqs = (a: string, b: string) => { db.data.friendReqs = db.data.friendReqs.filter((r) => !((r.from === a && r.to === b) || (r.from === b && r.to === a))); };
function befriend(a: User, b: User) {
  dropReqs(a.id, b.id);
  for (const [x, y] of [[a, b], [b, a]] as const) { const l = (x.friends ??= []); if (!l.includes(y.id)) l.push(y.id); }
  saveDb(); pushFriends(a.id, b.id);
}
export const socialInit = (u: User) => ({ voice: voiceState(), dms: convList(u), ...fstate(u) });

function leaveRoom(c: SClient, room: string) {
  const set = rooms.get(room); if (!set || !set.delete(c)) return;
  c.rooms.delete(room);
  if (!set.size) rooms.delete(room);
  for (const o of set) X.send(o.ws, { t: "room-leave", room, cid: c.cid });
  if (room.startsWith("vc:")) broadcastVoice();
  if (room.startsWith("call:")) { const call = calls.get(room.slice(5)); if (call && call.state === "active" && (rooms.get(room)?.size ?? 0) < 2) endCall(call, "ended"); }
}
function endCall(call: Call, reason: "ended" | "declined" | "missed" | "cancelled") {
  if (!calls.delete(call.id)) return;
  clearTimeout(call.timer);
  const a = userById(call.from), b = userById(call.to);
  const ev = { t: "call", event: "ended", id: call.id, reason };
  toUser(call.from, ev); toUser(call.to, ev);
  const room = "call:" + call.id, set = rooms.get(room);
  if (set) { for (const c of [...set]) { c.rooms.delete(room); } rooms.delete(room); }
  if (a && b) {
    const kind = call.video ? "video" : "voice";
    if (call.state === "active") { const s = Math.max(1, Math.round((Date.now() - call.startedAt) / 1000)); addDm(a, b, `📞 ${kind[0].toUpperCase() + kind.slice(1)} call ended · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`, true); }
    else if (reason === "missed" || reason === "cancelled") addDm(a, b, `📞 Missed ${kind} call from ${a.username}`, true);
    else if (reason === "declined") addDm(a, b, `📞 ${b.username} declined the ${kind} call`, true);
  }
}

/* ------------------------------ message router ------------------------------ */
export function socialMessage(c: SClient, me: User, msg: any): boolean {
  const ws = c.ws;
  switch (msg.t) {
    case "fr-send": {
      const to = userById(String(msg.to)); if (!to || to.id === me.id) return true;
      if (isBlocked(me, to)) return X.send(ws, { t: "error", message: "You can't send this person a request." }), true;
      if (areFriends(me, to)) return true;
      if (!allow(`fr:${me.id}`, 10, 60_000)) return X.send(ws, { t: "error", message: "Slow down a little with friend requests." }), true;
      if ((me.friends?.length ?? 0) >= MAX_FRIENDS || (to.friends?.length ?? 0) >= MAX_FRIENDS) return X.send(ws, { t: "error", message: "A friends list is full." }), true;
      if (db.data.friendReqs.some((r) => r.from === to.id && r.to === me.id)) { befriend(me, to); toUser(to.id, { t: "fr-ok", user: { id: me.id, username: me.username } }); return true; }
      if (db.data.friendReqs.some((r) => r.from === me.id && r.to === to.id)) return true;
      if (db.data.friendReqs.filter((r) => r.from === me.id).length >= 50) return X.send(ws, { t: "error", message: "You have too many pending requests." }), true;
      db.data.friendReqs.push({ id: uid(), from: me.id, to: to.id, ts: Date.now() }); saveDb();
      pushFriends(me.id, to.id); toUser(to.id, { t: "fr-new", from: { id: me.id, username: me.username } });
      return true;
    }
    case "fr-accept": {
      const from = userById(String(msg.from)); if (!from || !db.data.friendReqs.some((r) => r.from === from.id && r.to === me.id)) return true;
      befriend(me, from); toUser(from.id, { t: "fr-ok", user: { id: me.id, username: me.username } }); return true;
    }
    case "fr-decline": case "fr-cancel": {
      const other = String(msg.t === "fr-decline" ? msg.from : msg.to);
      db.data.friendReqs = db.data.friendReqs.filter((r) => !((msg.t === "fr-decline" && r.from === other && r.to === me.id) || (msg.t === "fr-cancel" && r.from === me.id && r.to === other)));
      saveDb(); pushFriends(me.id, other); return true;
    }
    case "fr-remove": {
      const other = userById(String(msg.id)); if (!other) return true;
      for (const [x, y] of [[me, other], [other, me]] as const) x.friends = (x.friends ?? []).filter((f) => f !== y.id);
      saveDb(); pushFriends(me.id, other.id); return true;
    }
    case "dm-list": X.send(ws, { t: "dm-list", list: convList(me) }); return true;
    case "dm-history": {
      const peer = userById(String(msg.with)); if (!peer) return true;
      const key = keyOf(me.id, peer.id);
      const all = db.data.dms.filter((m) => m.key === key && m.ts < (Number(msg.before) || Infinity));
      X.send(ws, { t: "dm-history", with: peer.id, messages: all.slice(-60), more: all.length > 60, blocked: !!me.dmBlocked?.includes(peer.id) });
      return true;
    }
    case "dm-send": {
      const to = userById(String(msg.to)); const text = String(msg.text ?? "").trim().slice(0, 2000);
      if (!to || to.id === me.id || !text) return true;
      if (isBlocked(me, to)) return X.send(ws, { t: "error", message: "You can't message this person." }), true;
      if (!areFriends(me, to)) return X.send(ws, { t: "error", message: "You need to be friends to message each other." }), true;
      if (/(https?:\/\/|www\.)\S/i.test(text) && !isTrusted(me)) return X.send(ws, { t: "error", message: "New members can't send links yet. Keep using the site to earn Trusted." }), true;
      if (!allow(`dm:${me.id}`, 8, 8000)) return X.send(ws, { t: "error", message: "You're sending messages too fast." }), true;
      const v = moderate(me, text, null);
      if (v.block) { if (v.ban) { saveDb(); X.ban(me.id); } return X.send(ws, { t: "error", message: v.ban ? "You were banned for inappropriate language." : "Message blocked: keep it clean." }), true; }
      addDm(me, to, text);
      return true;
    }
    case "dm-block": {
      const peer = userById(String(msg.id)); if (!peer || peer.id === me.id) return true;
      const l = (me.dmBlocked ??= []); const i = l.indexOf(peer.id);
      if (msg.on && i < 0) { l.push(peer.id); for (const [x, y] of [[me, peer], [peer, me]] as const) x.friends = (x.friends ?? []).filter((f) => f !== y.id); dropReqs(me.id, peer.id); pushFriends(me.id, peer.id); } else if (!msg.on && i >= 0) l.splice(i, 1);
      saveDb(); toUser(me.id, { t: "dm-blocked", id: peer.id, on: !!msg.on });
      return true;
    }
    case "call-invite": {
      const to = userById(String(msg.to)); if (!to || to.id === me.id) return true;
      if (isBlocked(me, to)) return X.send(ws, { t: "error", message: "You can't call this person." }), true;
      if (!areFriends(me, to)) return X.send(ws, { t: "error", message: "You need to be friends to call each other." }), true;
      if (!live(to.id)) return X.send(ws, { t: "error", message: `${to.username} is offline right now.` }), true;
      if (callOf(me.id)) return X.send(ws, { t: "error", message: "You're already in a call." }), true;
      if (callOf(to.id)) return X.send(ws, { t: "error", message: `${to.username} is already on a call.` }), true;
      if (!allow(`call:${me.id}`, 6, 60_000)) return X.send(ws, { t: "error", message: "Slow down a little before calling again." }), true;
      const call: Call = { id: uid(), from: me.id, to: to.id, video: !!msg.video, state: "ringing", startedAt: Date.now() };
      call.timer = setTimeout(() => endCall(call, "missed"), RING_MS);
      calls.set(call.id, call);
      toUser(to.id, { t: "call", event: "ring", id: call.id, video: call.video, from: { id: me.id, username: me.username } });
      toUser(me.id, { t: "call", event: "calling", id: call.id, video: call.video, to: { id: to.id, username: to.username } });
      return true;
    }
    case "call-answer": {
      const call = calls.get(String(msg.id)); if (!call || call.to !== me.id || call.state !== "ringing") return true;
      if (!msg.accept) { endCall(call, "declined"); return true; }
      call.state = "active"; call.startedAt = Date.now(); clearTimeout(call.timer);
      toUser(call.from, { t: "call", event: "accepted", id: call.id, video: call.video, by: me.id });
      toUser(call.to, { t: "call", event: "accepted", id: call.id, video: call.video, by: me.id });
      return true;
    }
    case "call-end": {
      const call = calls.get(String(msg.id)); if (!call || (call.from !== me.id && call.to !== me.id)) return true;
      endCall(call, call.state === "ringing" ? (call.from === me.id ? "cancelled" : "declined") : "ended");
      return true;
    }
    case "room-join": {
      const room = String(msg.room ?? "");
      if (room.startsWith("vc:")) {
        const ch = db.data.channels.find((x) => x.id === room.slice(3));
        if (!ch || !ch.voice || !canSeeChannel(me, ch)) return true;
      } else if (room.startsWith("call:")) {
        const call = calls.get(room.slice(5));
        if (!call || call.state !== "active" || (call.from !== me.id && call.to !== me.id)) return true;
      } else return true;
      let set = rooms.get(room); if (!set) rooms.set(room, (set = new Set()));
      if (set.has(c)) return true;
      if (set.size >= MAX_ROOM) return X.send(ws, { t: "error", message: "That voice channel is full (8 people)." }), true;
      /* leave other voice channels first: one voice channel at a time */
      if (room.startsWith("vc:")) for (const r of [...c.rooms]) if (r.startsWith("vc:")) leaveRoom(c, r);
      const peers = [...set].map(peerOf);
      set.add(c); c.rooms.add(room);
      X.send(ws, { t: "room", room, you: c.cid, peers });
      for (const o of set) if (o !== c) X.send(o.ws, { t: "room-join", room, peer: peerOf(c) });
      if (room.startsWith("vc:")) broadcastVoice();
      return true;
    }
    case "room-leave": leaveRoom(c, String(msg.room ?? "")); return true;
    case "room-state": {
      const room = String(msg.room ?? ""), set = rooms.get(room); if (!set?.has(c)) return true;
      for (const o of set) if (o !== c) X.send(o.ws, { t: "room-state", room, cid: c.cid, muted: !!msg.muted, video: !!msg.video, screen: !!msg.screen });
      return true;
    }
    case "rtc": {
      const room = String(msg.room ?? ""), set = rooms.get(room); if (!set?.has(c)) return true;
      if (!allow(`rtc:${me.id}`, 600, 10_000)) return true;
      for (const o of set) if (o.cid === String(msg.to)) X.send(o.ws, { t: "rtc", room, from: c.cid, user: me.username, data: msg.data });
      return true;
    }
  }
  return false;
}

export function socialClose(c: SClient) {
  for (const r of [...c.rooms]) leaveRoom(c, r);
  /* if this was the person's last connection, ring-state calls end too */
  if (!live2(c)) { const call = callOf(c.user.id); if (call) endCall(call, call.state === "ringing" ? (call.from === c.user.id ? "cancelled" : "declined") : "ended"); }
}
const live2 = (gone: SClient) => { for (const c of X.clients()) if (c !== gone && c.user.id === gone.user.id) return true; return false; };
