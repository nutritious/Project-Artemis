/* Admin terminal. Each command checks its own power and the rank rule, and everything it does is audited. */
import crypto from "node:crypto";
import { db, saveDb, uid, type User } from "./store.js";
import { hashPassword } from "./auth.js";
import { can, outranks, PERM_INFO, rank, roleOf, roleRank, roleTag, type Perm } from "./perms.js";
import { broadcast, broadcastAnnouncement, broadcastChannels, broadcastMembers, closeUserSockets, onlineNames, pushSelf } from "./chat.js";
import { snapshot } from "./monitor.js";

export interface CommandResult { lines: string[]; ok: boolean; audit?: string }
const ok = (lines: string | string[], audit?: string): CommandResult => ({ lines: [lines].flat(), ok: true, audit });
const fail = (msg: string): CommandResult => ({ lines: [msg], ok: false });

const tokenize = (s: string) => { const o: string[] = []; s.replace(/"([^"]*)"|(\S+)/g, (_m, q, w) => (o.push(q !== undefined ? q : w), "")); return o; };

const HELP: [string, string, Perm | null][] = [
  ["help", "show this list", null],
  ["stats", "crew, online, messages, traffic and uptime", "view_dashboard"],
  ["who", "who is connected right now", null],
  ["users", "every account with role and status", "manage_users"],
  ["whois <user>", "details about one account", "manage_users"],
  ["channels", "channels with their message counts", null],
  ["roles", "custom roles and what they can do", null],
  ["role <user> <role|none>", "give someone a custom role (or clear it)", "manage_roles"],
  ["announce <text>", "post the announcement banner", "announce"],
  ["clear-announce", "remove the announcement", "announce"],
  ["kick <user>", "disconnect someone from chat (they can reconnect)", "manage_users"],
  ["ban <user> / unban <user>", "suspend or reinstate an account", "manage_users"],
  ["reset <user>", "generate a temporary password", "manage_users"],
  ["invite", "create an invite code", "manage_users"],
  ["block <domain> / unblock <domain>", "manage the blocked-domain list", "manage_blocklist"],
  ["topic <channel> <text>", "set a channel topic", "manage_channels"],
  ["purge <channel> [count]", "delete the last [count] messages (or all)", "delete_messages"],
  ["setrate <n>", "proxy requests per minute per user (commanders)", null],
  ["maintenance on|off [message]", "pause browsing for regular crew (owner)", null],
];

export async function runCommand(actor: User, line: string): Promise<CommandResult> {
  const [cmdRaw, ...args] = tokenize(line.trim());
  if (!cmdRaw) return ok([]);
  const cmd = cmdRaw.toLowerCase().replace(/^\//, "");
  const rest = line.trim().slice(cmdRaw.length).trim();
  const find = (n?: string) => db.data.users.find((u) => u.username.toLowerCase() === String(n ?? "").toLowerCase());
  const need = (p: Perm) => (can(actor, p) ? null : fail(`You don't have the "${PERM_INFO[p].title}" power.`));
  const target = (n?: string): User | CommandResult => {
    const t = find(n);
    if (!n) return fail("Missing a username.");
    if (!t) return fail(`No account named "${n}".`);
    if (t.id === actor.id) return fail("You can't do that to yourself.");
    if (t.role === "owner") return fail("The owner can't be changed.");
    if (!outranks(actor, t)) return fail("You can only do that to people ranked below you.");
    return t;
  };
  const isUser = (x: User | CommandResult): x is User => "username" in x;
  let e: CommandResult | null;

  switch (cmd) {
    case "help": return ok(["Commands. Quote names that contain spaces.", ...HELP.filter(([, , p]) => !p || can(actor, p)).map(([c, d]) => `  ${c.padEnd(34)} ${d}`)]);
    case "stats": {
      if ((e = need("view_dashboard"))) return e;
      const s = snapshot(false);
      return ok([`crew       ${db.data.users.length} (${db.data.users.filter((u) => u.banned).length} suspended)`, `online     ${onlineNames().length}`, `channels   ${db.data.channels.length}`, `messages   ${db.data.messages.length}`, `proxied    ${s.totalRequests} requests, ${(s.totalBytes / 1048576).toFixed(1)} MB`, `req/min    ${s.perMinuteNow}`, `uptime     ${Math.floor(s.uptimeSec / 3600)}h ${Math.floor((s.uptimeSec % 3600) / 60)}m`]);
    }
    case "who": { const n = onlineNames(); return ok(n.length ? n : ["Nobody is connected."]); }
    case "users": {
      if ((e = need("manage_users"))) return e;
      return ok(db.data.users.map((u) => `${u.username.padEnd(24)} ${(u.role === "member" ? roleOf(u)?.name ?? "crew" : u.role).padEnd(14)}${u.banned ? " suspended" : ""}`));
    }
    case "whois": {
      if ((e = need("manage_users"))) return e;
      const t = find(args[0]); if (!t) return fail(`No account named "${args[0] ?? ""}".`);
      return ok([`${t.username} · ${t.role}${roleOf(t) ? ` · ${roleOf(t)!.name}` : ""}${t.banned ? " · SUSPENDED" : ""}`, `joined    ${new Date(t.createdAt).toISOString().slice(0, 10)}`, `last seen ${new Date(t.lastSeen).toISOString().replace("T", " ").slice(0, 16)} UTC`, `usage     ${t.stats.requests} requests, ${(t.stats.bytes / 1048576).toFixed(1)} MB`, `status    ${t.profile.status || "(none)"}`]);
    }
    case "channels": return ok(db.data.channels.map((c) => `#${c.name.padEnd(24)} ${db.data.messages.filter((m) => m.channel === c.id).length} messages`));
    case "roles": return ok(db.data.roles.length ? [...db.data.roles].sort((a, b) => a.position - b.position).map((r) => `${r.name.padEnd(20)} ${r.perms.join(", ") || "(no powers)"}`) : ["No custom roles yet. The owner creates them in the Owner console."]);
    case "role": {
      if ((e = need("manage_roles"))) return e;
      const t = target(args[0]); if (!isUser(t)) return t;
      if (t.role === "admin" || t.role === "coowner") return fail("Commanders and co-owners don't use custom roles.");
      const name = args.slice(1).join(" ").toLowerCase();
      if (!name) return fail("Usage: role <user> <role|none>");
      if (name === "none") { delete t.roleId; saveDb(); broadcastMembers(); pushSelf(t.id); return ok(`${t.username} now has no custom role.`, `role ${t.username} none`); }
      const r = db.data.roles.find((x) => x.name.toLowerCase() === name || x.id === name);
      if (!r) return fail(`No role named "${args.slice(1).join(" ")}". Type roles to list them.`);
      if (actor.role !== "owner" && roleRank(r) <= rank(actor)) return fail("You can only hand out roles ranked below your own.");
      t.roleId = r.id; saveDb(); broadcastMembers(); pushSelf(t.id);
      return ok(`${t.username} is now ${r.name}.`, `role ${t.username} ${r.name}`);
    }
    case "announce": {
      if ((e = need("announce"))) return e;
      const text = rest.slice(0, 300); if (!text) return fail("Usage: announce <text>");
      db.data.announcement = { id: uid(), text, by: actor.username, byTag: roleTag(actor), ts: Date.now() }; saveDb(); broadcastAnnouncement();
      return ok(`Sent to ${onlineNames().length} people online.`, `announce ${text.slice(0, 80)}`);
    }
    case "clear-announce": {
      if ((e = need("announce"))) return e;
      db.data.announcement = null; saveDb(); broadcastAnnouncement(); return ok("Announcement cleared.", "clear-announce");
    }
    case "kick": {
      if ((e = need("manage_users"))) return e;
      const t = target(args[0]); if (!isUser(t)) return t;
      closeUserSockets(t.id, "Disconnected"); return ok(`${t.username} was disconnected from chat.`, `kick ${t.username}`);
    }
    case "ban": case "unban": {
      if ((e = need("manage_users"))) return e;
      const t = target(args[0]); if (!isUser(t)) return t;
      t.banned = cmd === "ban"; saveDb(); if (t.banned) closeUserSockets(t.id, "Suspended"); broadcastMembers();
      return ok(`${t.username} is ${t.banned ? "suspended" : "reinstated"}.`, `${cmd} ${t.username}`);
    }
    case "reset": {
      if ((e = need("manage_users"))) return e;
      const t = target(args[0]); if (!isUser(t)) return t;
      const temp = crypto.randomBytes(6).toString("base64url");
      Object.assign(t, await hashPassword(temp)); saveDb();
      return ok([`Temporary password for ${t.username}: ${temp}`, "Share it privately. It isn't shown again."], `reset ${t.username}`);
    }
    case "invite": {
      if ((e = need("manage_users"))) return e;
      const code = "ARTEMIS-" + crypto.randomBytes(4).toString("hex").toUpperCase();
      db.data.invites.push({ code, createdBy: actor.username, createdAt: Date.now() }); saveDb(); return ok(code, `invite ${code}`);
    }
    case "block": case "unblock": {
      if ((e = need("manage_blocklist"))) return e;
      const host = String(args[0] ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!/^[a-z0-9.-]+\.[a-z]+$/.test(host)) return fail("Usage: block <domain>, for example block example.com");
      if (cmd === "block") { if (!db.data.blocklist.includes(host)) db.data.blocklist.push(host); }
      else db.data.blocklist = db.data.blocklist.filter((h) => h !== host);
      saveDb(); return ok(`${host} ${cmd === "block" ? "blocked" : "unblocked"}.`, `${cmd} ${host}`);
    }
    case "topic": {
      if ((e = need("manage_channels"))) return e;
      const c = db.data.channels.find((x) => x.id === String(args[0] ?? "").replace(/^#/, "").toLowerCase()); if (!c) return fail("Usage: topic <channel> <text>");
      c.topic = args.slice(1).join(" ").slice(0, 120); saveDb(); broadcastChannels(); return ok(`#${c.name} topic updated.`, `topic #${c.name}`);
    }
    case "purge": {
      if ((e = need("delete_messages"))) return e;
      const c = db.data.channels.find((x) => x.id === String(args[0] ?? "").replace(/^#/, "").toLowerCase()); if (!c) return fail("Usage: purge <channel> [count]");
      const inChan = db.data.messages.filter((m) => m.channel === c.id);
      const n = args[1] ? Math.max(1, parseInt(args[1], 10) || 0) : inChan.length;
      const gone = inChan.slice(-n); const ids = new Set(gone.map((m) => m.id));
      db.data.messages = db.data.messages.filter((m) => !ids.has(m.id)); saveDb();
      for (const id of ids) broadcast({ t: "deleted", id });
      return ok(`Deleted ${gone.length} messages from #${c.name}.`, `purge #${c.name} ${gone.length}`);
    }
    case "setrate": {
      if (actor.role === "member") return fail("Commanders only.");
      const n = Math.round(Number(args[0]));
      if (!Number.isFinite(n) || n < 30 || n > 20000) return fail("Usage: setrate <30–20000>");
      db.data.server.rateLimit = n; saveDb(); return ok(`Rate limit is now ${n} requests per minute.`, `setrate ${n}`);
    }
    case "maintenance": {
      if (actor.role !== "owner" && actor.role !== "coowner") return fail("Owner or co-owner only.");
      const on = args[0]?.toLowerCase();
      if (on !== "on" && on !== "off") return fail("Usage: maintenance on|off [message]");
      db.data.server.maintenance = on === "on"; db.data.server.maintenanceMessage = args.slice(1).join(" ").slice(0, 200); saveDb();
      return ok(`Maintenance mode ${on}.`, `maintenance ${on}`);
    }
    default: return fail(`Unknown command "${cmdRaw}". Type help to see what you can run.`);
  }
}
