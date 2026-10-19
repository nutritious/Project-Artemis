import type http from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import { allow, userFromRequest } from "./auth.js";
import { db, saveDb, uid, type Message, type User } from "./store.js";
import { can, effectivePerms, publicRoles } from "./perms.js";
import { publicUser } from "./auth.js";
import { canSeeChannel, checkTrust, gifUrl, isTrusted, onTrust, trustInfo } from "./trust.js";
import { moderate, post as botPost } from "./bot.js";
import { initSocial, socialClose, socialInit, socialMessage } from "./social.js";
import { initPoker, pokerClose, pokerMessage } from "./poker.js";
import { activity, grant, onGame, onLegend, progress, publicEvent, activeBoosts, rankIndex } from "./game.js";

interface Client { ws: WebSocket; user: User; adminSub: boolean; cid: string; rooms: Set<string> }
const clients = new Set<Client>();
const MAX_STORED = 8000;
const MAX_LEN = 2000;
const PAGE = 50;

const send = (ws: WebSocket, data: unknown) => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
};
export const broadcast = (data: unknown) => {
  const raw = JSON.stringify(data);
  for (const c of clients) if (c.ws.readyState === WebSocket.OPEN) c.ws.send(raw);
};
export function pushToAdmins(data: unknown) {
  const raw = JSON.stringify(data);
  for (const c of clients) if (c.adminSub && can(c.user, "view_dashboard") && c.ws.readyState === WebSocket.OPEN) c.ws.send(raw);
}
export const hasAdminSubscribers = () => [...clients].some((c) => c.adminSub);

const onlineList = () => {
  const seen = new Map<string, { id: string; username: string; role: string }>();
  for (const c of clients) seen.set(c.user.id, { id: c.user.id, username: c.user.username, role: c.user.role });
  return [...seen.values()];
};
let arenaHook: (u: User, m: any) => void = () => {};
export const onArena = (fn: (u: User, m: any) => void) => { arenaHook = fn; };
export const BUILD = Date.now().toString(36);
const publicChannels = (u?: User) => db.data.channels.filter((c) => !c.hidden && (!u || canSeeChannel(u, c))).map((c) => ({ id: c.id, name: c.name, topic: c.topic, trusted: !!c.trusted, voice: !!c.voice }));
const members = () => db.data.users.filter((u) => !u.banned).map((u) => ({ id: u.id, username: u.username, role: u.role, roleId: u.roleId ?? null, lastSeen: u.lastSeen, createdAt: u.createdAt, profile: u.profile, trusted: isTrusted(u), fx: u.equip.effect, tag: u.equip.tag, bg: u.equip.bg, rank: rankIndex(u.game.xp) }));

export const selfInfo = (u: User) => ({ user: publicUser(u), perms: effectivePerms(u), trusted: isTrusted(u), trust: trustInfo(u) });
export const broadcastRoles = () => broadcast({ t: "roles", roles: publicRoles() });
export function pushSelf(userId: string) {
  const u = db.data.users.find((x) => x.id === userId); if (!u) return;
  for (const c of clients) if (c.user.id === userId) send(c.ws, { t: "self", ...selfInfo(u) });
}
export const pushSelfAll = () => { for (const c of clients) { const u = db.data.users.find((x) => x.id === c.user.id); if (u) send(c.ws, { t: "self", ...selfInfo(u) }); } };
export function sendToUser(userId: string, data: unknown) { for (const c of clients) if (c.user.id === userId) send(c.ws, data); }
onGame(sendToUser);
/** A new Legend is announced to everyone online, and posted in the first channel. */
onLegend((u) => {
  broadcast({ t: "legend", user: { id: u.id, username: u.username, fx: u.equip.effect, tag: u.equip.tag }, ts: Date.now() });
  // The banner only lasts a few seconds and only reaches people who are online, so it also stays in the chat for everyone.
  const ch = db.data.channels.find((c) => c.id === "general") ?? db.data.channels[0];
  if (ch) { const m = botPost(ch.id, `✦ ${u.username} just reached LEGEND, the top rank in Project Artemis! Say congrats! ✦`); saveDb(); broadcastMsg(m); }
});
/** Start a live event for everyone online. They each earn a little XP for showing up. */
export function broadcastEvent(ev: { kind: string; title: string; sub: string; by: string }) {
  broadcast({ t: "event", ...ev, ts: Date.now() });
  const ids = new Set([...clients].map((c) => c.user.id));
  for (const id of ids) { const u = db.data.users.find((x) => x.id === id); if (u) grant(u, 25, "Live event"); }
  return ids.size;
}
export function notifyOwners(data: unknown) { for (const c of clients) if (c.user.role === "owner" || c.user.role === "coowner") send(c.ws, data); }
export const onlineUsers = (): User[] => { const seen = new Map<string, User>(); for (const c of clients) { const u = db.data.users.find((x) => x.id === c.user.id); if (u && !u.banned) seen.set(u.id, u); } return [...seen.values()]; };
export const onlineNames = () => onlineList().map((o) => o.username);
export const broadcastChannels = () => { for (const c of clients) send(c.ws, { t: "channels", channels: publicChannels(c.user) }); };
/** Send a message only to people allowed to see its channel. */
const broadcastMsg = (m: Message) => { const ch = db.data.channels.find((x) => x.id === m.channel); const raw = JSON.stringify({ t: "msg", msg: m }); for (const c of clients) if (c.ws.readyState === WebSocket.OPEN && (!ch || canSeeChannel(c.user, ch))) c.ws.send(raw); };
onTrust((u, now) => { for (const c of clients) if (c.user.id === u.id) { send(c.ws, { t: "channels", channels: publicChannels(u) }); send(c.ws, { t: "self", ...selfInfo(u) }); send(c.ws, { t: "trusted", trusted: now }); } });
export { checkTrust };
export const broadcastMembers = () => broadcast({ t: "members", members: members() });
export const broadcastCustomTags = () => broadcast({ t: "customtags", customTags: db.data.customTags });
export const broadcastAnnouncement = () => broadcast({ t: "announcement", announcement: db.data.announcement });

export function closeUserSockets(userId: string, reason = "Removed") {
  for (const c of clients) if (c.user.id === userId) c.ws.close(4001, reason);
}

export function deleteMessage(id: string) {
  const i = db.data.messages.findIndex((m) => m.id === id);
  if (i < 0) return false;
  db.data.messages.splice(i, 1);
  saveDb();
  broadcast({ t: "deleted", id });
  return true;
}

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
initSocial({ clients: () => clients, send, ban: (id) => { closeUserSockets(id, "Banned by ArtemisBot"); broadcast({ t: "members", members: members() }); } });
initPoker({ clients: () => clients, send });

export function handleChatUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer, isAppHost: (host: string) => boolean) {
  const url = new URL(req.url ?? "/", "http://x");
  const host = String(req.headers.host ?? "").split(":")[0];
  const origin = req.headers.origin;
  let sameOrigin = false;
  try { sameOrigin = origin ? new URL(origin).host === req.headers.host : false; } catch { /* bad origin */ }
  const user = userFromRequest(req as any);
  if (url.pathname !== "/ws" || !isAppHost(host) || !sameOrigin || !user) {
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, user));
}

wss.on("connection", (ws: WebSocket, user: User) => {
  const client: Client = { ws, user, adminSub: false, cid: uid(), rooms: new Set() };
  clients.add(client);
  user.lastSeen = Date.now();
  send(ws, { t: "init", channels: publicChannels(user), online: onlineList(), members: members(), announcement: db.data.announcement, roles: publicRoles(), self: selfInfo(user), customTags: db.data.customTags, event: publicEvent(user), boosts: activeBoosts(), build: BUILD, countdown: db.data.server.countdown ?? null, ...socialInit(user) });
  broadcast({ t: "presence", online: onlineList() });

  ws.on("message", (raw) => {
    let msg: any;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    const fresh = db.data.users.find((u) => u.id === user.id);
    if (!fresh || fresh.banned) return ws.close(4001, "Removed");
    fresh.lastSeen = Date.now();

    if (socialMessage(client, fresh, msg)) return;
    if (pokerMessage(client, fresh, msg)) return;
    switch (msg.t) {
      case "arena": arenaHook(fresh, msg); break;
      case "history": {
        const channel = String(msg.channel);
        const chh = db.data.channels.find((c) => c.id === channel); if (!chh || !canSeeChannel(fresh, chh)) return;
        const before = Number(msg.before) || Infinity;
        const all = db.data.messages.filter((m) => m.channel === channel && m.ts < before);
        const slice = all.slice(-PAGE);
        send(ws, { t: "history", channel, messages: slice, more: all.length > slice.length, older: !!msg.before });
        break;
      }
      case "send": {
        const channel = String(msg.channel);
        const text = String(msg.text ?? "").trim().slice(0, MAX_LEN);
        const chs = db.data.channels.find((c) => c.id === channel);
        if (!text || !chs || chs.voice || !canSeeChannel(fresh, chs)) return;
        if (!allow(`chat:${user.id}`, 6, 5000)) return send(ws, { t: "error", message: "You're sending messages too fast." });
        if (gifUrl.test(text) && !isTrusted(fresh)) return send(ws, { t: "error", message: "GIFs are for trusted members only. Check your progress in the Hub." });
        const v = moderate(fresh, text, channel);
        if (v.block) {
          if (v.reply) broadcastMsg(v.reply);
          if (v.ban) { saveDb(); closeUserSockets(fresh.id, "Banned by ArtemisBot"); broadcast({ t: "members", members: members() }); }
          return send(ws, { t: "error", message: v.ban ? "You were banned for inappropriate language." : "Message blocked: keep it clean." });
        }
        const m: Message = { id: uid(), channel, userId: user.id, username: fresh.username, text, ts: Date.now() };
        if (msg.replyTo) {
          const orig = db.data.messages.find((x) => x.id === String(msg.replyTo) && x.channel === channel);
          if (orig) m.replyTo = { id: orig.id, username: orig.username, text: orig.text.slice(0, 140) };
        }
        db.data.messages.push(m);
        if (db.data.messages.length > MAX_STORED) db.data.messages.splice(0, db.data.messages.length - MAX_STORED);
        saveDb();
        broadcastMsg(m);
        progress(fresh, "chat"); activity(fresh, "chat"); checkTrust(fresh);
        break;
      }
      case "edit": {
        const m = db.data.messages.find((x) => x.id === String(msg.id));
        const text = String(msg.text ?? "").trim().slice(0, MAX_LEN);
        if (!m || m.userId !== user.id || !text) return;
        m.text = text;
        m.edited = Date.now();
        saveDb();
        broadcast({ t: "edited", id: m.id, text: m.text, edited: m.edited });
        break;
      }
      case "delete": {
        const m = db.data.messages.find((x) => x.id === String(msg.id));
        if (m && (m.userId === user.id || can(fresh, "delete_messages"))) deleteMessage(m.id);
        break;
      }
      case "react": {
        const m = db.data.messages.find((x) => x.id === String(msg.id));
        const emoji = String(msg.emoji ?? "").slice(0, 8);
        if (!m || !emoji) return;
        m.reactions ??= {};
        const list = (m.reactions[emoji] ??= []);
        const i = list.indexOf(user.id);
        if (i >= 0) list.splice(i, 1);
        else if (Object.keys(m.reactions).length <= 12) list.push(user.id);
        if (!list.length) delete m.reactions[emoji];
        saveDb();
        broadcast({ t: "reactions", id: m.id, reactions: m.reactions });
        break;
      }
      case "typing": {
        const channel = String(msg.channel);
        for (const c of clients) if (c !== client) send(c.ws, { t: "typing", channel, user: fresh.username });
        break;
      }
      case "admin-sub":
        client.adminSub = can(fresh, "view_dashboard") && !!msg.on;
        break;
    }
  });

  ws.on("close", () => {
    clients.delete(client);
    socialClose(client); pokerClose(client.user.id);
    user.lastSeen = Date.now();
    saveDb();
    broadcast({ t: "presence", online: onlineList() });
  });
});

setInterval(() => {
  for (const c of clients) if (c.ws.readyState === WebSocket.OPEN) c.ws.ping();
}, 30_000).unref();
