import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DEFAULT_RATE_LIMIT } from "./config.js";

const DATA_DIR = process.env.ARTEMIS_DATA ?? path.resolve("data");
fs.mkdirSync(DATA_DIR, { recursive: true });

export interface Bookmark { id: string; title: string; url: string }
export interface HistoryItem { url: string; title: string; ts: number }
export interface Settings {
  theme: string;
  engine: "ddg" | "brave" | "mojeek";
  bookmarksBar: boolean;
  chatSound: boolean;
  cloakTitle: string;
  cloakIcon: string;
  panicKey: string;
  panicUrl: string;
}
export interface Profile { status: string; presence: "online" | "idle" | "dnd"; avatar: string; bio?: string; pronouns?: string; accent?: string; links?: string }
export interface Role { id: string; name: string; color: string; position: number; perms: string[] }
export interface User {
  id: string;
  dmBlocked?: string[];
  friends?: string[];
  username: string;
  salt: string;
  hash: string;
  role: "owner" | "coowner" | "admin" | "member";
  createdAt: number;
  lastSeen: number;
  banned: boolean;
  stats: { requests: number; bytes: number };
  trust?: "grant" | "revoke"; lastBanAt?: number; proxyMs?: number; siteMs?: number; lastProxy?: number;
  bookmarks: Bookmark[];
  history: HistoryItem[];
  settings: Settings;
  roleId?: string;
  profile: Profile;
  game: Game;
  coins: number;
  inv: Inventory;
  equip: Equip;
  freePacks: number;
}
export interface Game { xp: number; streak: number; lastDay: string; day: string; n: { browse: number; chat: number; play: number }; done: string[]; best: number; plays: number; bests: Record<string, number>; runCoins: number; stats: Record<string, number>; ach: Record<string, number>; earnDay: string; earned: number; lastSpin: number }
export interface Inventory { effects: string[]; tags: string[]; themes: string[]; bgs: string[] }
export interface Equip { effect: string; tag: string; bg: string }
export interface CustomTag { id: string; name: string; color: string }
export interface Phase { kind: string; mins: number }
export interface LiveEvent { id: string; kind: string; startedAt: number; by: string; points: Record<string, number>; mile?: Record<string, number>; schedule?: Phase[]; phase?: number; phaseStart?: number; phaseEnd?: number; loop?: boolean; cfg?: { bots: number; loot: string; boss: string }; phasePts?: Record<string, Record<string, number>> }
export interface Boost { kind: "xp" | "coins"; until: number }
export const newEconomy = () => ({ coins: 0, inv: { effects: [] as string[], tags: [] as string[], themes: [] as string[], bgs: [] as string[] }, equip: { effect: "", tag: "", bg: "" }, freePacks: 0 });
export interface Report { id: string; userId: string; username: string; kind: string; text: string; page: string; ts: number; status: "open" | "done" }
export interface Invite { code: string; createdBy: string; createdAt: number; usedBy?: string }
export interface Channel { id: string; name: string; topic: string; createdAt: number; trusted?: boolean; hidden?: boolean; voice?: boolean }
export interface FriendReq { id: string; from: string; to: string; ts: number }
export interface DmMsg { id: string; key: string; from: string; to: string; username: string; text: string; ts: number; sys?: boolean }
export interface BotCfg { enabled: boolean; action: "ban" | "warn"; strikes: number; words: string[]; log: { ts: number; user: string; action: string; why: string }[]; strikesBy: Record<string, number> }
export interface Message {
  id: string;
  channel: string;
  userId: string;
  username: string;
  text: string;
  ts: number;
  edited?: number;
  replyTo?: { id: string; username: string; text: string };
  reactions?: Record<string, string[]>;
}
export interface ServerSettings { openRegistration: boolean; rateLimit: number; defaultEngine: Settings["engine"]; maintenance: boolean; maintenanceMessage: string; launchAt?: number; exitUrl?: string; exitKey?: string; bot?: BotCfg; countdown?: { title: string; about: string; at: number; by: string } | null }
export interface Announcement { id: string; text: string; by: string; byTag?: { tier: string; label: string; color: string }; ts: number }
export interface AuditEntry { ts: number; by: string; action: string; detail: string }
export interface UpdateEntry { id: string; title: string; body: string; ts: number; by: string }
export interface RedeemCode { code: string; coins: number; crates: number; items: { type: string; id: string }[]; maxUses: number; uses: Record<string, number>; expiresAt: number; note: string; by: string; createdAt: number; disabled?: boolean }
export interface Db {
  secret: string;
  users: User[];
  invites: Invite[];
  channels: Channel[];
  messages: Message[];
  dms: DmMsg[];
  friendReqs: FriendReq[];
  blocklist: string[];
  server: ServerSettings;
  announcement: Announcement | null;
  audit: AuditEntry[];
  roles: Role[];
  updates: UpdateEntry[];
  seededUpdates?: string[];
  reports: Report[];
  customTags: CustomTag[];
  codes: RedeemCode[];
  event: LiveEvent | null;
  boosts: Boost[];
}

const T = (h: number, m: number) => Date.UTC(2026, 9, 15, h + 7, m);
/** The update log starts with the history of this build. Only the owner can add to or edit it. */
export const SEED_UPDATES: UpdateEntry[] = [
  { id: "u27", ts: Date.UTC(2026, 9, 19, 10, 0), by: "Artemis", title: "Friends and a new profile", body: "- Profiles have a new look: your equipped backdrop fills the whole card, your effect spins around its edge, and your title, role, rank, join date and bio sit on top. Click anyone's name or picture to open it.\n- Friends: press Add friend on a profile. They get a notification and a request in Chat, and choose to accept or decline. You can only message and call friends. Blocking someone also ends the friendship.\n- The owner and co-owners can add a whole pack to their own collection from the Owner console (Economy), with no animation.\n- Only the owner can give the OG title. Co-owners cannot give it directly or through a redeem code." },
  { id: "u28", ts: Date.UTC(2026, 9, 19, 12, 0), by: "Artemis", title: "Halloween Chroma", body: "- The Halloween Pack now has a real shot at Chroma (rainbow) items, only here until Nov 1: Spectral Wraith and Prismatic Jack effects, the NIGHTMARE title, the Witchfire theme and the Spectral Carnival backdrop. Each has its own Chroma reveal.\n- ArtemisBot now leaves private messages alone except for the n-word. Admins, Co-owners and the Owner are still never checked." },
  { id: "u29", ts: Date.UTC(2026, 9, 19, 14, 0), by: "Artemis", title: "Casino in Games", body: "- Games now has an Arcade tab and a Casino tab. The Casino has Slots, Blackjack, Roulette and Coin Flip, played with your Artemis coins (the same coins you spend on packs). No real money anywhere.\n- Bets are 10 to 500 coins with no daily limit.\n- New: Poker (Texas Hold'em) in the Casino tab. Make a table, invite your friends, and play with real Artemis coins, or practice against bots with free chips.\n- Titles now use their rarity colour.\n- Quick events can now be sent to everyone online, one person, or a whole role. Boosts and the rush still go to everyone.\n- Five new ranks above Legend: Nova (12,000 XP), Quasar (20,000), Pulsar (35,000), Singularity (60,000) and the final rank, Touch Grass (100,000). Each has its own level-up cutscene and sound. Touch Grass sends you to a sunny meadow, because you should probably go outside.\n- New: Cloud Browser (the ☁ button in Browse). Pick Chrome, Firefox or Edge and it runs on the host computer and streams to you. 30 minutes per session; admins and above are unlimited.\n- Chroma reveals got bigger: light pillar, fireworks, orbiting comets, rising embers and a punchier sound.\n- Touch Grass is now a troll rank: its cutscene counts up how many hours you have spent on the website, with a roast to match.\n- Restoring a backup no longer restarts the server. The data loads live and everyone is reconnected, so there is no 502 while it reboots.\n- The Cloud Browser now runs on the site itself. No home computer needed. (If a home exit node is connected, it is used instead.)" },
  { id: "u26", ts: Date.UTC(2026, 9, 19, 9, 0), by: "Artemis", title: "Home exit node for YouTube", body: "- The owner can connect a home computer as an exit node (Owner console, Safety). While it runs, everyone's browsing leaves from the owner's home internet, which sites like YouTube trust, so the YouTube bot check goes away even though the site itself stays on Render.\n- If the exit node stops, the site checks every 20 seconds and goes back to its own connection by itself.\n- Bans and the blocklist still apply on the exit node." },
  { id: "u25", ts: Date.UTC(2026, 9, 19, 8, 0), by: "Artemis", title: "Direct messages, voice and video calls, and Halloween", body: "- Direct messages: open anyone's profile and tap Message, or use + under Direct messages in Chat. Only the two of you can read them. You can block someone, and bad language is filtered like in channels.\n- Private calls: tap Call or Video in a DM. The other person gets a ringing pop-up and can accept or decline. In a call you can mute, turn your camera on or off, and share your screen. Call lengths and missed calls show up in the DM.\n- Voice channels: the new Voice Lounge is under Voice in Chat. Click it to join, talk, turn on your camera or share your screen with up to 8 people. Staff can add and delete voice channels with the + button.\n- The Halloween Pack is here until Nov 1: 16 limited effects, titles, backdrops and themes you cannot get anywhere else. After Nov 1 it leaves the shop for good, but what you own stays yours.\n- The whole app gets a Halloween look (orange glow, floating bats and pumpkins) until Nov 1. You can turn it off in Settings.\n- The Gulper arena no longer has computer players: it is only real people (and the boss worm during boss hunts).\n- The owner can now remove a title, effect, backdrop or theme from one person, a role or everyone (Owner console, Economy)." },
  { id: "u24", ts: Date.UTC(2026, 9, 19, 6, 0), by: "Artemis", title: "Download and restore your data", body: "- Owner console, Safety tab: a new Data & backup card. The owner can download every account, chat message, coin and setting as one file, and restore it later. Only the owner can do either.\n- If the server is on Render without a permanent disk, the card (and a warning when you sign in) tells you that updates erase data, so you know to download a backup first.\n- Restoring saves a copy of the current data first, then restarts the server on the backup." },
  { id: "u23", ts: Date.UTC(2026, 9, 19, 5, 0), by: "Artemis", title: "Scramjet proxy and a light, easy-to-read browser", body: "- The proxy now runs on Scramjet, a newer engine that handles far more sites (video, logins, heavy web apps). It works in your browser, so pages open faster and Back, Forward and reload feel normal.\n- If your browser cannot run Scramjet (for example on plain http), that tab quietly falls back to the classic proxy, so nothing breaks. The same happens if a page has not started loading after 25 seconds.\n- The browser view now has a bright, light background in every theme: the new tab page, the search results, the tab bar and the address bar are all much easier to read.\n- The owner's blocklist, bans, maintenance mode and the private-network protection still apply to Scramjet traffic.\n- Pages start faster: the engine warms up in the background while you browse the home page, and its big files are now compressed and cached.\n- Reaching Legend now also posts a permanent message from ArtemisBot in #general, and the gold banner stays up for 12 seconds, so nobody misses it." },
  { id: "u22", ts: Date.UTC(2026, 9, 19, 2, 0), by: "Artemis", title: "Event timelines, shared Gulper arena and boss hunt", body: "- Live events now run on a timeline the owner builds: Gulper arena, Loot drop storm, Boss worm hunt and Trivia and word games, each with its own minutes, plus presets and settings (bots, loot rate, boss strength, loop). Everyone sees a phase timer and a leaderboard for the current phase and overall.\n- The Gulper arena is now one shared world: everyone in the event is in the same arena. New power-ups (magnet, shield, speed, double points), a minimap, kill streaks and a kill feed, themed music with a mute button, and a boss worm everyone hunts together by touching its head.\n- Loot drop storm: coins and loot crates drop around the map, with a ping on the minimap.\n- Trivia, scrambles, reaction races and polls now appear only inside the live event instead of popping up over the app.\n- If you already own an event's limited title and effect when it runs again, you get 2,500 bonus coins instead." },
  { id: "u21", ts: Date.UTC(2026, 9, 18, 23, 0), by: "Artemis", title: "Live event arena, redeem codes and Chroma cutscenes", body: "- Redeem codes: the owner and co-owners make codes in the owner console (coins, free crates and an item, with a use limit and an optional expiry). Players enter them in Packs or the Hub and get a gift-opening animation. One use per player, and rewards skip the daily coin limit.\n- Packs: tap See what's inside on any crate to see every item it can drop, the odds, and which ones you own. Every pack can drop Chroma items.\n- Each Chroma item now has its own cutscene (prism, holo burst, lightning, ribbons, iris wipe, banner, holo foil). Replay any from the pack preview.\n- Events: only the owner can start or end live events and run rounds. Co-owners can fire quick events. Commanders keep Mission control but cannot start events.\n- Live events are now a full-screen arena: when the owner starts one everyone drops into it after the opening scene. Later you can join from the top bar or the chat. It is a worm arena (Void Worms) with a theme per event (Halloween has its own look), a live leaderboard and a movable event chat. Your score feeds the event points.\n- The owner and co-owners can show a countdown banner at the top of everyone's screen with a date, time and what it is about.\n- After an update, a green banner tells you to click and restart. Updates never reset accounts, chat or progress, and the server now keeps automatic backups of its data." },
  { id: "u20", ts: Date.UTC(2026, 9, 18, 20, 0), by: "Artemis", title: "Trusted members, ArtemisBot, OG title and richer profiles", body: "- Launch week: when the owner opens the 24-hour OG window, every new account created in it gets the limited OG title. Nothing else.\n- Trusted members: 300 chat messages, 3 hours on the proxy, an account at least 10 days old and no bans for 14 days. Trusted members can post GIFs and use the new #trusted-general channel. The Hub shows your progress. The owner can grant or revoke trust by hand.\n- ArtemisBot: an optional chat moderator the owner can switch on in the owner console. It blocks bad language and bans after strikes (severe language is an instant ban). It never checks commanders, co-owners or the owner.\n- New role power: Open the owner console, so a custom role can run events, the economy, ChatBot and trust without being a co-owner.\n- Profiles: add pronouns, an About me, and an accent color that tints your profile card banner.\n- The owner console scrolls more easily, with a sticky section menu and a back-to-top button." },
  { id: "u19", ts: Date.UTC(2026, 9, 18, 12, 0), by: "Artemis", title: "Chroma rarity, new crates, profile backgrounds, hourly wheel and achievements", body: "- New top rarity: Chroma, a rainbow tier above Legendary. Chroma items are shown with an animated rainbow border and title. Whenever anyone pulls one, the whole server gets a rainbow announcement.\n- New crates: Gamer Crate, Hacker Crate, Backdrop Pack and the Chroma Vault, with new gamer and hacker effects, titles and themes (Terminal, Arcade, Prism).\n- Profile backgrounds: 16 animated backdrops you can pull from crates. They show behind your name when someone clicks your profile in chat, and on your full profile.\n- Earn coins by chatting (1), searching (2) and browsing (1), on top of games and missions. Everyday earning is capped at 500 coins per day and resets at 00:00 UTC. Prizes, wheel spins and achievements do not count toward the cap.\n- Hourly wheel: one free spin every hour for coins or a free crate.\n- 33 lifetime achievements that pay coins when you complete them, shown in the Hub." },
  { id: "u18", ts: T(24, 30), by: "Artemis", title: "Live event parties, Legend announcements and Economy tab", body: "- Live events are now full parties: after the opening cinematic the owner (or auto-host) runs trivia, word scrambles, reaction races, this-or-that votes, 2x game rushes, meteor showers, jackpots and drops. Points from every round feed one leaderboard.\n- When an event ends everyone who joined gets the limited title and profile effect, coins and free crates. Top three get bigger prizes. Milestone coins pay out as you score.\n- Reaching Legend now announces it to the whole server.\n- The always-on announcement bar is gone; new announcements show as the animated pop-up only.\n- Owner console: new Economy tab (everyone's coins, give coins, titles, effects, themes and crates to one person, a role or everyone) and an Events tab with 14 quick events and a cutscene library, including the update cutscene." },
  { id: "u17", ts: T(23, 0), by: "Artemis", title: "Coins, packs, profile effects and live events", body: "- Earn coins from games, missions and events, then open Supply Crates and Theme Packs for profile effects, titles and new app themes.\n- Profile effects around your picture and titles next to your name. Look up anyone in the Hub to see their profile.\n- Five arcade games: Eclipse Run, Asteroid Blaster, Moon Lander, Star Memory and Comet Snake, each with a leaderboard.\n- Live events run by the owner: the Opening Event and Halloween Night, with games, limited titles and limited profile effects for everyone who plays.\n- Quick events: coin rain, meteor shower, double XP, jackpots, treasure hunts and more.\n- The update and every cutscene can now be started from the Owner console." },
  { id: "u16", ts: T(22, 0), by: "Artemis", title: "Level-up cutscenes", body: "- Every new rank plays its own full-screen scene: liftoff, hyperjump, constellation, eclipse, wormhole and supernova.\n- Click any rank you have reached on the Hub ladder to replay its scene. Click or press Esc to skip." },
  { id: "u15", ts: T(21, 30), by: "Artemis", title: "Skip button fixed and issue reports", body: "- The Skip button on the launch animation now works.\n- New Report issue button in the sidebar. Reports go to the owner and co-owners, who can see and resolve them in the Owner console." },
  { id: "u14", ts: T(21, 0), by: "Artemis", title: "Hub, ranks, Arcade and live events", body: "- New Hub page: earn XP by browsing, chatting and playing, climb from Stardust to Legend, and keep your daily streak going.\n- Three daily missions with a full sweep bonus, plus a crew leaderboard.\n- New Arcade with Eclipse Run, a quick dodge-the-asteroids game with its own top pilots list.\n- The owner can start a live event: a countdown cutscene that plays for everyone online at once." },
  { id: "u13", ts: T(19, 30), by: "Artemis", title: "Faster sign-in", body: "- The launch animation on sign-in is now a short cut of about 7 seconds, and the app loads behind it so it is ready the moment it ends.\n- The full animation with sound still plays on your first visit." },
  { id: "u12", ts: T(19, 20), by: "Artemis", title: "Announcement box cleaned up", body: "- The global announcement section no longer repeats the current message above the text box." },
  { id: "u11", ts: T(19, 15), by: "Artemis", title: "Fixed panels overlapping in small windows", body: "- The owner console and Mission control no longer overlap their menus in narrow windows.\n- The sidebar starts collapsed in small windows." },
  { id: "u10", ts: T(19, 10), by: "Artemis", title: "Role badges and a roomier owner panel", body: "- Your role badge now shows next to your name in announcements, chat, the member list and your user panel.\n- Owner console and Mission control have more spacing so they are easier to read." },
  { id: "u9", ts: T(19, 5), by: "Artemis", title: "Update log and global announcements", body: "- New Updates page that lists every change. Only the owner can edit it.\n- Global announcements now also show on the sign-in screen, and the owner console has a quick announcement box.\n- Smoother animations across the whole app." },
  { id: "u8", ts: T(19, 0), by: "Artemis", title: "Owner console reorganised", body: "- Sections are grouped into Server, People and Safety.\n- New Hierarchy view shows who ranks above whom.\n- New Members section with search and a role picker for each person." },
  { id: "u7", ts: T(18, 55), by: "Artemis", title: "Launch animation on every sign-in", body: "- The launch sequence now plays each time you sign in. Press Skip any time.\n- On phones the sidebar stays on the left as a slim icon rail." },
  { id: "u6", ts: T(18, 50), by: "Artemis", title: "Resizable sidebar", body: "- All navigation lives in one sidebar. Drag its edge to resize, double-click to collapse to icons. Your width is remembered." },
  { id: "u5", ts: T(18, 45), by: "Artemis", title: "Warmaster is the owner", body: "- The owner is whoever registers the username Warmaster.\n- Set OWNER_PASSWORD on the server to create the account at startup." },
  { id: "u4", ts: T(18, 40), by: "Artemis", title: "Co-owner, Manager and Moderator roles", body: "- New Co-owner tier with every power except wipes, backups, signing everyone out and ownership transfer.\n- Manager and Moderator come pre-made.\n- Discord-style chat: grouped member list with colored role names and a user panel." },
  { id: "u3", ts: T(18, 35), by: "Artemis", title: "Open sign-up and account page", body: "- Anyone can create an account (the owner can switch invite-only back on).\n- Keep me signed in for 30 days.\n- Change your callsign or passcode, or delete your account, from Settings." },
  { id: "u2", ts: T(18, 0), by: "Artemis", title: "Profiles, custom roles, terminal and word-pop banners", body: "- Avatars, status and presence.\n- Custom roles with permissions.\n- Admin terminal with audited commands.\n- Announcements pop in word by word." },
  { id: "u1", ts: T(17, 0), by: "Artemis", title: "Project Artemis v2", body: "- Rebuilt proxy with native search, 3D launch intro with sound, Mission control with live charts and an audit log, and the Owner console." },
];

export const defaultSettings = (engine: Settings["engine"] = "ddg"): Settings => ({
  theme: "eclipse",
  engine,
  bookmarksBar: true,
  chatSound: true,
  cloakTitle: "",
  cloakIcon: "none",
  panicKey: "`",
  panicUrl: "https://en.wikipedia.org/",
});

class JsonStore<T extends object> {
  data: T;
  private file: string;
  private timer: NodeJS.Timeout | null = null;
  private frozen = false;
  private defaults: T;
  get path() { return this.file; }
  /** After a restore the file on disk is the truth: never write memory over it. */
  /** Swap in restored data without restarting; the caller runs migrate() next. */
  replace(next: T) { if (this.timer) { clearTimeout(this.timer); this.timer = null; } this.data = { ...structuredClone(this.defaults), ...next }; }
  freeze() { this.frozen = true; if (this.timer) { clearTimeout(this.timer); this.timer = null; } }
  constructor(name: string, defaults: T) {
    this.file = path.join(DATA_DIR, name);
    this.data = defaults; this.defaults = structuredClone(defaults);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    /* Never start from empty over a file that exists: try the main file, then the newest backup, and keep a copy of anything unreadable. */
    const bdir = path.join(path.dirname(this.file), "backups"), base = path.basename(this.file, ".json");
    const backups = () => { try { return fs.readdirSync(bdir).filter((f) => f.startsWith(base + "-") && f.endsWith(".json")).sort().reverse(); } catch { return []; } };
    const candidates = [this.file, ...backups().map((f) => path.join(bdir, f))];
    for (const f of candidates) {
      if (!fs.existsSync(f)) continue;
      try { this.data = { ...defaults, ...JSON.parse(fs.readFileSync(f, "utf8")) }; if (f !== this.file) console.warn(`  ⚠ ${path.basename(this.file)} was unreadable. Restored from backup ${path.basename(f)}.`); break; }
      catch { try { fs.copyFileSync(f, f + ".corrupt-" + Date.now()); } catch { /* ignore */ } }
    }
    /* a dated backup on every start and then every 3 hours; the newest 12 are kept */
    const backup = () => { try { if (!fs.existsSync(this.file)) return; fs.mkdirSync(bdir, { recursive: true }); this.flush(); fs.copyFileSync(this.file, path.join(bdir, `${base}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)); for (const old of backups().slice(12)) fs.rmSync(path.join(bdir, old), { force: true }); } catch { /* ignore */ } };
    backup(); setInterval(backup, 3 * 36e5).unref();
    const bye = () => { try { this.flush(); } catch { /* ignore */ } };
    process.on("SIGTERM", () => { bye(); process.exit(0); }); process.on("SIGINT", () => { bye(); process.exit(0); }); process.on("beforeExit", bye);
  }
  save() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 250);
  }
  flush() {
    if (this.frozen) return;
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
  }
}

const now = Date.now();
export const db = new JsonStore<Db>("artemis.json", {
  secret: "",
  users: [],
  invites: [],
  channels: [
    { id: "general", name: "general", topic: "Everything and anything", createdAt: now },
    { id: "random", name: "random", topic: "Off-topic transmissions", createdAt: now },
    { id: "mission-control", name: "mission-control", topic: "Announcements and ops", createdAt: now },
    { id: "trusted-general", name: "trusted-general", topic: "Trusted members only", createdAt: now, trusted: true },
  ],
  messages: [],
  dms: [],
  friendReqs: [],
  blocklist: [],
  server: { openRegistration: true, rateLimit: DEFAULT_RATE_LIMIT, defaultEngine: "ddg", maintenance: false, maintenanceMessage: "" },
  announcement: null,
  audit: [],
  updates: SEED_UPDATES,
  reports: [],
  customTags: [],
  codes: [],
  event: null,
  boosts: [],
  roles: [
    { id: "r-manager", name: "Manager", color: "#34d399", position: 2, perms: ["view_dashboard", "announce", "manage_users", "manage_channels", "delete_messages", "manage_roles"] },
    { id: "r-moderator", name: "Moderator", color: "#38bdf8", position: 3, perms: ["view_dashboard", "delete_messages", "manage_users"] },
  ],
});

/* ---- migrate data written by earlier versions ---- */
export function migrate() {
const d = db.data;
  d.server = Object.assign({ openRegistration: true, rateLimit: DEFAULT_RATE_LIMIT, defaultEngine: "ddg" as const, maintenance: false, maintenanceMessage: "" }, d.server);
  /* exactly one owner: the earliest commander if none exists yet */
  if (d.users.length && !d.users.some((u) => u.role === "owner")) {
    const first = [...d.users].sort((a, b) => a.createdAt - b.createdAt).find((u) => u.role === "admin") ?? [...d.users].sort((a, b) => a.createdAt - b.createdAt)[0];
    first.role = "owner";
  }
  for (const c of d.channels) c.topic ??= "";
  if (!d.channels.some((c) => c.id === "trusted-general")) d.channels.push({ id: "trusted-general", name: "trusted-general", topic: "Trusted members only", createdAt: Date.now(), trusted: true });
  if (!d.channels.some((c) => c.id === "live-event")) d.channels.push({ id: "live-event", name: "live-event", topic: "Chat inside live events", createdAt: Date.now(), hidden: true });
  d.dms ??= [];
  d.friendReqs ??= [];
  if (!d.channels.some((c) => c.voice)) d.channels.push({ id: "voice-lounge", name: "Voice Lounge", topic: "Hang out, talk, share your screen", createdAt: Date.now(), voice: true });
  d.server.bot = Object.assign({ enabled: false, action: "ban" as const, strikes: 3, words: [], log: [], strikesBy: {} }, d.server.bot);
  d.roles ??= [];
  d.updates ??= SEED_UPDATES;
  /* entries added to the built-in log in newer builds are appended once, so an entry the owner deleted never comes back */
  { const seen = new Set(d.seededUpdates ?? [...d.updates.map((x) => x.id), ...SEED_UPDATES.filter((x) => !["u17", "u18"].includes(x.id)).map((x) => x.id)]); for (const e of SEED_UPDATES) if (!seen.has(e.id)) d.updates.push(e); d.seededUpdates = SEED_UPDATES.map((x) => x.id); }
  d.reports ??= [];
  d.customTags ??= [];
  d.codes ??= [];
  d.event ??= null;
  d.boosts ??= [];
  for (const u of d.users) {
    u.profile = Object.assign({ status: "", presence: "online" as const, avatar: "" }, u.profile);
    if (u.roleId && !d.roles.some((r) => r.id === u.roleId)) delete u.roleId;
    u.game = Object.assign({ xp: 0, streak: 0, lastDay: "", day: "", best: 0, plays: 0, done: [], bests: {}, runCoins: 0, stats: {}, ach: {}, earnDay: "", earned: 0, lastSpin: 0 }, u.game);
    u.game.bests ??= {};
    Object.assign(u, { ...newEconomy(), ...Object.fromEntries(Object.entries(u).filter(([k]) => ["coins", "inv", "equip", "freePacks"].includes(k))) });
    u.inv = Object.assign({ effects: [], tags: [], themes: [], bgs: [] }, u.inv);
    u.equip = Object.assign({ effect: "", tag: "", bg: "" }, u.equip);
    u.equip = Object.assign({ effect: "", tag: "" }, u.equip);
    u.game.n = Object.assign({ browse: 0, chat: 0, play: 0 }, u.game.n);
    u.lastSeen ??= u.createdAt;
    u.banned ??= false;
    u.stats ??= { requests: 0, bytes: 0 };
    u.settings = { ...defaultSettings(), ...u.settings };
    if (!["ddg", "brave", "mojeek"].includes(u.settings.engine)) u.settings.engine = "ddg";
  }
  if (!d.secret) d.secret = crypto.randomBytes(32).toString("hex");
}
migrate();
db.flush();

/** Is the data folder on a permanent disk? On Render a missing disk means every deploy erases accounts and chat. */
export function storageInfo() {
  const dir = path.dirname(db.path);
  let permanent: boolean | null = null;
  try {
    const sameAsRoot = fs.statSync(dir).dev === fs.statSync("/").dev;
    if (process.env.RENDER || process.env.ARTEMIS_WARN_EPHEMERAL === "1") permanent = !sameAsRoot;
  } catch { /* unknown */ }
  return { permanent, dir, onRender: !!process.env.RENDER };
}

export const isStaff = (u: { role: string } | undefined | null) => u?.role === "owner" || u?.role === "coowner" || u?.role === "admin";
export const uid = () => crypto.randomBytes(8).toString("hex");
export const saveDb = () => db.save();

export function audit(by: string, action: string, detail = "") {
  const entry: AuditEntry = { ts: Date.now(), by, action, detail };
  db.data.audit.push(entry);
  if (db.data.audit.length > 300) db.data.audit.splice(0, db.data.audit.length - 300);
  saveDb();
  return entry;
}

process.on("exit", () => db.flush());
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    db.flush();
    process.exit(0);
  });
}
