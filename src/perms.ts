import { db, type Role, type User } from "./store.js";

export const PERMS = ["view_dashboard", "announce", "manage_users", "manage_channels", "delete_messages", "manage_blocklist", "manage_roles", "use_terminal", "use_owner_panel"] as const;
export type Perm = (typeof PERMS)[number];
export const PERM_INFO: Record<Perm, { title: string; desc: string }> = {
  view_dashboard: { title: "View mission control", desc: "See live stats, traffic and the audit log" },
  announce: { title: "Post announcements", desc: "Broadcast the banner to everyone" },
  manage_users: { title: "Manage crew", desc: "Suspend, reinstate, reset passwords, remove and invite people ranked below" },
  manage_channels: { title: "Manage channels", desc: "Create and delete channels, set topics" },
  delete_messages: { title: "Delete messages", desc: "Remove anyone's chat messages" },
  manage_blocklist: { title: "Manage blocked domains", desc: "Block and unblock websites for the whole server" },
  manage_roles: { title: "Assign roles", desc: "Give people ranked below you a role ranked below yours" },
  use_owner_panel: { title: "Open the owner console", desc: "Live events, economy, ChatBot and trust. Not roles, security or the danger zone" },
  use_terminal: { title: "Use the admin terminal", desc: "Run console commands (each command still needs its own power)" },
};

export const roleOf = (u: User): Role | undefined => (u.roleId ? db.data.roles.find((r) => r.id === u.roleId) : undefined);

export const TOP_TIERS = ["owner", "coowner", "admin"];
/** Owner, Co-owner and Commander hold every power; everyone else gets what their custom role grants. */
export function can(u: User | undefined | null, perm: Perm): boolean {
  if (!u || u.banned) return false;
  if (perm === "use_owner_panel") return u.role === "owner" || u.role === "coowner" || !!roleOf(u)?.perms.includes(perm);
  if (TOP_TIERS.includes(u.role)) return true;
  return !!roleOf(u)?.perms.includes(perm);
}
export const effectivePerms = (u: User): Perm[] => PERMS.filter((p) => can(u, p));
export const hasDashboard = (u: User | undefined | null) => PERMS.some((p) => can(u, p));

/** Lower number = higher rank. Owner 0, Co-owner 1, Commander 2, custom roles 3.., plain crew 100. */
export const roleRank = (r: Role) => r.position + 1;
export const rank = (u: User): number => (u.role === "owner" ? 0 : u.role === "coowner" ? 1 : u.role === "admin" ? 2 : roleOf(u) ? roleRank(roleOf(u)!) : 100);
export const outranks = (a: User, b: User) => rank(a) < rank(b);
export const publicRoles = () => [...db.data.roles].sort((a, b) => a.position - b.position).map((r) => ({ id: r.id, name: r.name, color: r.color, position: r.position, perms: r.perms }));

/** The badge shown next to someone's name: tier or custom role, captured when they post something public. */
export const roleTag = (u: User): { tier: string; label: string; color: string } | undefined =>
  u.role === "owner" ? { tier: "owner", label: "OWNER", color: "#f5b942" }
  : u.role === "coowner" ? { tier: "coowner", label: "CO-OWNER", color: "#ff8a5b" }
  : u.role === "admin" ? { tier: "admin", label: "CMD", color: "#8b7bff" }
  : roleOf(u) ? { tier: "role", label: roleOf(u)!.name, color: roleOf(u)!.color } : undefined;
