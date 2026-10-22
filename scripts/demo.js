/* Preview-only: an in-memory fake server so the UI can be explored without a backend. Not shipped in the real app. */
import { hooks, state } from "../public/js/util.js";
import { DEFAULT_RULES } from "../public/js/cosmetics.js";

const now = Date.now(), min = 60000;
const uid = () => Math.random().toString(16).slice(2, 10);
const PERM_INFO = { view_dashboard: { title: "View mission control", desc: "See live stats, traffic and the audit log" }, announce: { title: "Post announcements", desc: "Broadcast the banner to everyone" }, manage_users: { title: "Manage crew", desc: "Suspend, reinstate, reset passwords, remove and invite people ranked below" }, manage_channels: { title: "Manage channels", desc: "Create and delete channels, set topics" }, delete_messages: { title: "Delete messages", desc: "Remove anyone's chat messages" }, manage_blocklist: { title: "Manage blocked domains", desc: "Block and unblock websites for the whole server" }, manage_roles: { title: "Assign roles", desc: "Give people ranked below you a role ranked below yours" }, use_owner_panel: { title: "Open the owner console", desc: "Live events, economy, ChatBot and trust. Not roles, security or the danger zone" }, use_terminal: { title: "Use the admin terminal", desc: "Run console commands (each command still needs its own power)" } };
const roles = [{ id: "r-manager", name: "Manager", color: "#34d399", position: 2, perms: ["view_dashboard", "announce", "manage_users", "manage_channels", "delete_messages", "manage_roles"] }, { id: "r-mod", name: "Moderator", color: "#38bdf8", position: 3, perms: ["delete_messages", "manage_users", "view_dashboard"] }, { id: "r-vip", name: "VIP", color: "#e879f9", position: 4, perms: [] }, { id: "r-beta", name: "Beta Tester", color: "#ec4899", position: 4, perms: [] }];
const me = { id: "u-neil", username: "Warmaster", role: "owner", roleId: null, profile: { status: "Commanding from the Moon", presence: "online", avatar: "" }, createdAt: now - 9 * 864e5, settings: { tourSeen: false, theme: "eclipse", engine: "ddg", bookmarksBar: true, chatSound: false, cloakTitle: "", cloakIcon: "none", panicKey: "`", panicUrl: "https://en.wikipedia.org/" } };
const users = [
  { id: me.id, username: "Warmaster", role: "owner", profile: me.profile, createdAt: me.createdAt, lastSeen: now, banned: false, requests: 1842, bytes: 96e6 },
];
const OWNER = JSON.parse(JSON.stringify(me));
const accounts = {};            // preview-only sign-ups, kept in memory
let signedIn = null;
try { signedIn = sessionStorage.getItem("artemis-demo-user"); } catch { /* storage unavailable */ }
const remember = (n) => { signedIn = n; try { n ? sessionStorage.setItem("artemis-demo-user", n) : sessionStorage.removeItem("artemis-demo-user"); } catch { /* ignore */ } };
function become(name) {
  if (name.toLowerCase() === "warmaster") { Object.assign(me, JSON.parse(JSON.stringify(OWNER))); return; }
  let u = users.find((x) => x.username.toLowerCase() === name.toLowerCase());
  if (!u) { u = { id: "u-" + uid(), username: name, role: "member", profile: { status: "", presence: "online", avatar: "" }, createdAt: Date.now(), lastSeen: Date.now(), banned: false, requests: 0, bytes: 0 }; users.push(u); }
  Object.assign(me, { id: u.id, username: u.username, role: u.role, roleId: u.roleId ?? null, profile: u.profile, createdAt: u.createdAt });
}
if (signedIn) become(signedIn);
const myPerms = () => (me.role === "owner" || me.role === "coowner" || me.role === "admin" ? Object.keys(PERM_INFO).filter((k) => k !== "use_owner_panel" || me.role !== "admin") : (roles.find((r) => r.id === me.roleId)?.perms ?? []));
const visCh = () => D.channels.filter((c) => !c.trusted || X.isTrusted?.());
const selfMsg = () => ({ user: me, perms: myPerms(), trusted: X.isTrusted?.(), trust: X.trust?.() });
const D = {
  channels: [{ id: "general", name: "general", topic: "Everything and anything" }, { id: "random", name: "random", topic: "Off-topic transmissions" }, { id: "mission-control", name: "mission-control", topic: "Announcements and ops" }, { id: "trusted-general", name: "trusted-general", topic: "Trusted members only", trusted: true }],
  messages: [],
  bookmarks: [{ id: "b1", title: "NASA", url: "https://www.nasa.gov/" }, { id: "b2", title: "Wikipedia", url: "https://en.wikipedia.org/" }],
  history: [{ url: "https://www.nasa.gov/", title: "NASA", ts: now - 20 * min }],
  invites: [{ code: "ARTEMIS-3F9A12CC", createdBy: "Warmaster", createdAt: now - 864e5 }],
  blocklist: ["ads.example.net"],
  server: { openRegistration: false, rateLimit: 900, defaultEngine: "ddg", maintenance: false, maintenanceMessage: "" },
  announcement: null,
  reports: [],
  audit: [{ ts: now - 40 * min, by: "Warmaster", action: "invite.create", detail: "ARTEMIS-3F9A12CC" }],
};
D.updates = [
  { id: "u22", ts: Date.UTC(2026, 9, 19, 2, 0), by: "Artemis", title: "Event timelines, shared Gulper arena and boss hunt", body: "- Live events now run on a timeline the owner builds: Gulper arena, Loot drop storm, Boss worm hunt and Trivia and word games, each with its own minutes, plus presets and settings (bots, loot rate, boss strength, loop). Everyone sees a phase timer and a leaderboard for the current phase and overall.\n- The Gulper arena is now one shared world: everyone in the event is in the same arena. New power-ups (magnet, shield, speed, double points), a minimap, kill streaks and a kill feed, themed music with a mute button, and a boss worm everyone hunts together by touching its head.\n- Loot drop storm: coins and loot crates drop around the map, with a ping on the minimap.\n- Trivia, scrambles, reaction races and polls now appear only inside the live event instead of popping up over the app.\n- If you already own an event's limited title and effect when it runs again, you get 2,500 bonus coins instead." },
  { id: "u21", ts: Date.UTC(2026, 9, 18, 23, 0), by: "Artemis", title: "Live event arena, redeem codes and Chroma cutscenes", body: "- Redeem codes: the owner and co-owners make codes in the owner console (coins, free crates and an item, with a use limit and an optional expiry). Players enter them in Packs or the Hub and get a gift-opening animation. One use per player, and rewards skip the daily coin limit.\n- Packs: tap See what's inside on any crate to see every item it can drop, the odds, and which ones you own. Every pack can drop Chroma items.\n- Each Chroma item now has its own cutscene (prism, holo burst, lightning, ribbons, iris wipe, banner, holo foil). Replay any from the pack preview.\n- Events: only the owner can start or end live events and run rounds. Co-owners can fire quick events. Commanders keep Mission control but cannot start events.\n- Live events are now a full-screen arena: when the owner starts one everyone drops into it after the opening scene. Later you can join from the top bar or the chat. It is a worm arena (Void Worms) with a theme per event (Halloween has its own look), a live leaderboard and a movable event chat. Your score feeds the event points.\n- The owner and co-owners can show a countdown banner at the top of everyone's screen with a date, time and what it is about.\n- After an update, a green banner tells you to click and restart. Updates never reset accounts, chat or progress, and the server now keeps automatic backups of its data." },
  { id: "u20", ts: Date.UTC(2026, 9, 18, 20, 0), by: "Artemis", title: "Trusted members, ArtemisBot, OG title and richer profiles", body: "- Launch week: when the owner opens the 24-hour OG window, every new account created in it gets the limited OG title. Nothing else.\n- Trusted members: 300 chat messages, 3 hours on the proxy, an account at least 10 days old and no bans for 14 days. Trusted members can post GIFs and use the new #trusted-general channel. The Hub shows your progress. The owner can grant or revoke trust by hand.\n- ArtemisBot: an optional chat moderator the owner can switch on in the owner console. It blocks bad language and bans after strikes (severe language is an instant ban). It never checks commanders, co-owners or the owner.\n- New role power: Open the owner console, so a custom role can run events, the economy, ChatBot and trust without being a co-owner.\n- Profiles: add pronouns, an About me, and an accent color that tints your profile card banner.\n- The owner console scrolls more easily, with a sticky section menu and a back-to-top button." },
  { id: "u19", ts: Date.UTC(2026, 9, 18, 12, 0), by: "Artemis", title: "Chroma rarity, new crates, profile backgrounds, hourly wheel and achievements", body: "- New top rarity: Chroma, a rainbow tier above Legendary. Chroma items are shown with an animated rainbow border and title. Whenever anyone pulls one, the whole server gets a rainbow announcement.\n- New crates: Gamer Crate, Hacker Crate, Backdrop Pack and the Chroma Vault, with new gamer and hacker effects, titles and themes (Terminal, Arcade, Prism).\n- Profile backgrounds: 16 animated backdrops you can pull from crates. They show behind your name when someone clicks your profile in chat, and on your full profile.\n- Earn coins by chatting (1), searching (2) and browsing (1), on top of games and missions. Everyday earning is capped at 500 coins per day and resets at 00:00 UTC. Prizes, wheel spins and achievements do not count toward the cap.\n- Hourly wheel: one free spin every hour for coins or a free crate.\n- 33 lifetime achievements that pay coins when you complete them, shown in the Hub." },
  { id: "u18", ts: Date.UTC(2026, 9, 15, 31, 30), by: "Artemis", title: "Live event parties, Legend announcements and Economy tab", body: "- Live events are now full parties: after the opening cinematic the owner (or auto-host) runs trivia, word scrambles, reaction races, this-or-that votes, 2x game rushes, meteor showers, jackpots and drops. Points from every round feed one leaderboard.\n- When an event ends everyone who joined gets the limited title and profile effect, coins and free crates. Top three get bigger prizes. Milestone coins pay out as you score.\n- Reaching Legend now announces it to the whole server.\n- The always-on announcement bar is gone; new announcements show as the animated pop-up only.\n- Owner console: new Economy tab (everyone's coins, give coins, titles, effects, themes and crates to one person, a role or everyone) and an Events tab with 14 quick events and a cutscene library, including the update cutscene." },
  { id: "u17", ts: Date.UTC(2026, 9, 15, 30, 0), by: "Artemis", title: "Coins, packs, profile effects and live events", body: "- Earn coins from games, missions and events, then open Supply Crates and Theme Packs for profile effects, titles and new app themes.\n- Profile effects around your picture and titles next to your name. Look up anyone in the Hub to see their profile.\n- Five arcade games: Eclipse Run, Asteroid Blaster, Moon Lander, Star Memory and Comet Snake, each with a leaderboard.\n- Live events run by the owner: the Opening Event and Halloween Night, with games, limited titles and limited profile effects for everyone who plays.\n- Quick events: coin rain, meteor shower, double XP, jackpots, treasure hunts and more.\n- The update and every cutscene can now be started from the Owner console." },
  { id: "u16", ts: Date.UTC(2026, 9, 15, 29, 0), by: "Artemis", title: "Level-up cutscenes", body: "- Every new rank plays its own full-screen scene: liftoff, hyperjump, constellation, eclipse, wormhole and supernova.\n- Click any rank you have reached on the Hub ladder to replay its scene. Click or press Esc to skip." },
  { id: "u15", ts: Date.UTC(2026, 9, 15, 28, 30), by: "Artemis", title: "Skip button fixed and issue reports", body: "- The Skip button on the launch animation now works.\n- New Report issue button in the sidebar. Reports go to the owner and co-owners, who can see and resolve them in the Owner console." },
  { id: "u14", ts: Date.UTC(2026, 9, 15, 28, 0), by: "Artemis", title: "Hub, ranks, Arcade and live events", body: "- New Hub page: earn XP by browsing, chatting and playing, climb from Stardust to Legend, and keep your daily streak going.\n- Three daily missions with a full sweep bonus, plus a crew leaderboard.\n- New Arcade with Eclipse Run, a quick dodge-the-asteroids game with its own top pilots list.\n- The owner can start a live event: a countdown cutscene that plays for everyone online at once." },
  { id: "u13", ts: Date.UTC(2026, 9, 15, 26, 30), by: "Artemis", title: "Faster sign-in", body: "- The launch animation on sign-in is now a short cut of about 7 seconds, and the app loads behind it so it is ready the moment it ends.\n- The full animation with sound still plays on your first visit." },
  { id: "u12", ts: Date.UTC(2026, 9, 15, 26, 20), by: "Artemis", title: "Announcement box cleaned up", body: "- The global announcement section no longer repeats the current message above the text box." },
  { id: "u11", ts: Date.UTC(2026, 9, 15, 26, 15), by: "Artemis", title: "Fixed panels overlapping in small windows", body: "- The owner console and Mission control no longer overlap their menus in narrow windows.\n- The sidebar starts collapsed in small windows." },
  { id: "u10", ts: Date.UTC(2026, 9, 15, 26, 10), by: "Artemis", title: "Role badges and a roomier owner panel", body: "- Your role badge now shows next to your name in announcements, chat, the member list and your user panel.\n- Owner console and Mission control have more spacing so they are easier to read." },
  { id: "u9", ts: Date.UTC(2026, 9, 15, 26), by: "Artemis", title: "Update log and global announcements", body: "- New Updates page that lists every change. Only the owner can edit it.\n- Global announcements also show on the sign-in screen, and the owner console has a quick announcement box.\n- Smoother animations across the whole app." },
  { id: "u8", ts: Date.UTC(2026, 9, 15, 25), by: "Artemis", title: "Owner console reorganised", body: "- Sections are grouped into Server, People and Safety.\n- New Hierarchy view shows who ranks above whom.\n- New Members section with search and a role picker for each person." },
  { id: "u7", ts: Date.UTC(2026, 9, 15, 24), by: "Artemis", title: "Launch animation on every sign-in", body: "- The launch sequence plays each time you sign in. Press Skip any time.\n- On phones the sidebar stays on the left as a slim icon rail." },
  { id: "u6", ts: Date.UTC(2026, 9, 15, 23), by: "Artemis", title: "Resizable sidebar", body: "- All navigation lives in one sidebar. Drag its edge to resize, double-click to collapse to icons." },
  { id: "u5", ts: Date.UTC(2026, 9, 15, 22), by: "Artemis", title: "Warmaster is the owner", body: "- The owner is whoever registers the username Warmaster." },
  { id: "u4", ts: Date.UTC(2026, 9, 15, 21), by: "Artemis", title: "Co-owner, Manager and Moderator roles", body: "- New Co-owner tier.\n- Manager and Moderator come pre-made.\n- Discord-style chat with a grouped member list." },
  { id: "u1", ts: Date.UTC(2026, 9, 15, 19), by: "Artemis", title: "Project Artemis v2", body: "- Rebuilt proxy with native search, 3D launch intro, Mission control and the Owner console." },
];

const X = { init: () => ({}), ex: () => null };
const members = () => users.filter((u) => !u.banned).map((u) => { const e = X.ex(u); return { id: u.id, username: u.username, role: u.role, roleId: u.roleId ?? null, lastSeen: u.lastSeen, createdAt: u.createdAt, profile: u.profile, fx: e?.equip?.effect ?? "", tag: e?.equip?.tag ?? "", bg: e?.equip?.bg ?? "", trusted: X.isTrusted ? X.isTrusted(u) : false }; });
const engines = [{ id: "ddg", name: "DuckDuckGo", home: "https://duckduckgo.com/" }, { id: "brave", name: "Brave Search", home: "https://search.brave.com/" }, { id: "mojeek", name: "Mojeek", home: "https://www.mojeek.com/" }, { id: "google", name: "Google", home: "https://www.google.com/" }];
const series = (base, jitter) => Array.from({ length: 60 }, (_, i) => Math.max(0, Math.round(base + Math.sin(i / 5) * base * 0.5 + Math.random() * jitter)));
function stats() {
  const req = series(14, 8), err = req.map((v) => Math.round(v * 0.04 * Math.random()));
  const hosts = [["en.wikipedia.org", 640], ["www.youtube.com", 512], ["github.com", 301], ["www.nasa.gov", 188], ["news.ycombinator.com", 120]];
  const paths = ["/wiki/Artemis_program", "/watch?v=demo", "/anthropics", "/missions/artemis", "/item?id=1"];
  return {
    now: Date.now(), uptimeSec: 86400 * 2 + 3600, totalRequests: 3213, totalBytes: 155e6, activeUsers: 2, perMinuteNow: req[59], errorRate: 0.03,
    series: { req, bytes: series(3e5, 2e5), err }, status: { "2xx": 2890, "3xx": 214, "4xx": 87, "5xx": 22 },
    topHosts: hosts.map(([host, n]) => ({ host, n, bytes: n * 40000 })),
    logs: Array.from({ length: 30 }, (_, i) => { const k = i % 5; return { ts: Date.now() - i * 4000, user: "Warmaster", method: "GET", host: hosts[k][0], path: paths[k], status: i % 11 === 0 ? 404 : 200, bytes: 5000, ms: 40 + ((i * 37) % 300) }; }),
  };
}
const log = (action, detail = "") => { const e = { ts: Date.now(), by: me.username, action, detail }; D.audit.unshift(e); push({ t: "audit", entry: e }); };

/* ---------------- crew hub (fake) ---------------- */
const RANKS = [["Stardust", 0, "#8d96bd"], ["Cadet", 100, "#4cc9f0"], ["Pilot", 300, "#3ddc97"], ["Navigator", 700, "#ffc857"], ["Captain", 1500, "#ff8a5b"], ["Voyager", 3000, "#e879f9"], ["Legend", 6000, "#ffd76a"], ["Nova", 12000, "#ff7ab8"], ["Quasar", 20000, "#5ad1ff"], ["Pulsar", 35000, "#9d7bff"], ["Singularity", 60000, "#c9d1ff"], ["Paradox", 70000, "#22e3c9"], ["Multiverse", 80000, "#ff4d6d"], ["Infinity", 90000, "#fff0b8"], ["Touch Grass", 100000, "#58d35a"]].map(([name, xp, color]) => ({ name, xp, color }));
const MIS = [{ id: "browse", title: "Explore the web", hint: "Open 5 pages in the browser", goal: 5, xp: 40 }, { id: "chat", title: "Radio check", hint: "Send 3 chat messages", goal: 3, xp: 30 }, { id: "play", title: "Run the gauntlet", hint: "Finish one Eclipse Run in the Arcade", goal: 1, xp: 30 }];
const G = { xp: 20, streak: 1, best: 0, plays: 0, n: { browse: 0, chat: 0, play: 0 }, done: [], stats: {}, ach: {}, earned: 0, lastSpin: 0 };
const rankOf = (xp) => RANKS.reduce((r, k, i) => (xp >= k.xp ? i : r), 0);
const pubGame = () => ({ coins: me.coins ?? 0, freePacks: me.freePacks ?? 0, bests: me.bests ?? {}, boosts: [], hours: 37.4, xp: G.xp, rank: rankOf(G.xp), streak: G.streak, best: G.best, plays: G.plays, next: RANKS[rankOf(G.xp) + 1] ?? null, sweep: 60, earnedToday: G.earned, cap: 500, nextSpin: G.lastSpin + 3600000, ach: Object.keys(G.ach).length, missions: MIS.map((m) => ({ ...m, n: Math.min(G.n[m.id], m.goal), done: G.done.includes(m.id) })) });
const boards = () => { const rows = [{ id: me.id, username: me.username, role: me.role, roleId: null, xp: G.xp, rank: rankOf(G.xp), streak: G.streak, best: G.best }]; return { ranks: RANKS, xp: rows.filter((r) => r.xp > 0), arcade: rows.filter((r) => r.best > 0) }; };
function gprogress(id, count = 1) {
  const gains = [], before = rankOf(G.xp), m = MIS.find((x) => x.id === id);
  for (let i = 0; i < count; i++) { G.n[id]++; if (id !== "play") G.xp += id === "chat" ? 2 : 1; if (G.n[id] >= m.goal && !G.done.includes(id)) { G.done.push(id); G.xp += m.xp; gains.push({ text: "Mission: " + m.title, xp: m.xp }); if (G.done.length === 3) { G.xp += 60; gains.push({ text: "Full sweep", xp: 60 }); } } }
  setTimeout(() => { push({ t: "game", game: pubGame(), gains, rankUp: rankOf(G.xp) > before ? RANKS[rankOf(G.xp)] : null }); if (rankOf(G.xp) === RANKS.length - 1 && before < rankOf(G.xp)) push({ t: "legend", user: { id: state.me?.id ?? "me", username: state.me?.username ?? "you" }, ts: Date.now() }); }, 0);
}

/* ---------------- api ---------------- */
const demoErr = (m, status = 400) => Object.assign(new Error(m), { status });
hooks.api = async (path, method = "GET", body = {}) => {
  await new Promise((r) => setTimeout(r, 15));
  const [p, qs] = path.split("?"); const q = new URLSearchParams(qs ?? "");
  const m = (re) => p.match(re);
  if (p === "/config") return { crew: [{ name: "Warmaster", title: "Owner", avatar: "__CREW_WARMASTER__" }, { name: "Razorblade", title: "Co-owner", avatar: "__CREW_RAZORBLADE__" }, { name: "Ditto", title: "Co-owner", avatar: "__CREW_DITTO__" }], firstRun: false, ownerName: "Warmaster", openRegistration: D.server.openRegistration, announcement: D.announcement, rules: DEFAULT_RULES, beta: true };
  if (p === "/login") {
    const n = String(body.username ?? "").trim(), a = accounts[n.toLowerCase()];
    if (n.toLowerCase() === "warmaster") { become("Warmaster"); remember("Warmaster"); return { user: me }; }
    if (!a || a.password !== body.password) throw demoErr("Wrong callsign or passcode", 401);
    become(a.name); remember(a.name); return { user: me };
  }
  if (p === "/register") {
    const n = String(body.username ?? "").trim();
    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(n)) throw demoErr("Username must be 3–24 letters, numbers, . _ -");
    if (String(body.password ?? "").length < 8) throw demoErr("Password must be at least 8 characters");
    if (accounts[n.toLowerCase()] || users.some((u) => u.username.toLowerCase() === n.toLowerCase())) throw demoErr("That callsign is taken", 409);
    if (!D.server.openRegistration && !D.invites.some((i) => i.code === String(body.invite ?? "").trim())) throw demoErr("A valid invite code is required", 403);
    accounts[n.toLowerCase()] = { name: n, password: body.password };
    become(n); X.onRegister?.(); remember(n); push({ t: "members", members: members() }); return { user: me };
  }
  if (p === "/logout") { remember(null); return { ok: true }; }
  if (p === "/account/username") {
    const n = String(body.username ?? "").trim();
    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(n)) throw demoErr("Username must be 3–24 letters, numbers, . _ -");
    if (users.some((u) => u.id !== me.id && u.username.toLowerCase() === n.toLowerCase())) throw demoErr("That callsign is taken", 409);
    const old = me.username, mu = users.find((u) => u.id === me.id); if (mu) mu.username = n; me.username = n;
    const a = accounts[old.toLowerCase()]; if (a) { delete accounts[old.toLowerCase()]; a.name = n; accounts[n.toLowerCase()] = a; remember(n); }
    D.messages.forEach((x) => { if (x.userId === me.id) x.username = n; });
    push({ t: "members", members: members() }); return { user: me };
  }
  if (p === "/account" && method === "DELETE") {
    if (me.role === "owner") throw demoErr("The owner can't delete their account. Transfer ownership first.", 403);
    const i = users.findIndex((u) => u.id === me.id); if (i >= 0) users.splice(i, 1);
    delete accounts[me.username.toLowerCase()]; remember(null); return { ok: true };
  }
  if (p === "/me") { if (!signedIn) throw demoErr("Not signed in", 401); return { user: me, perms: myPerms(), trusted: X.isTrusted?.(), roles, permInfo: PERM_INFO, proxyOrigin: "demo", proxyToken: "demo", bookmarks: D.bookmarks, channels: D.channels, announcement: D.announcement, maintenance: false, engines }; }
  if (p === "/proxy-token") return { proxyToken: "demo", proxyOrigin: "demo" };
  if (p === "/suggest") { const s = q.get("q") ?? ""; return { suggestions: s.length > 1 ? [`${s} history`, `${s} news`, `${s} wikipedia`, `how does ${s} work`] : [] }; }
  if (p === "/search") {
    X.activity?.("search");
    const s = q.get("q") ?? "", page = q.get("next") ? 2 : 1;
    const hosts = ["en.wikipedia.org", "www.nasa.gov", "www.space.com", "www.britannica.com", "science.nasa.gov"];
    const results = Array.from({ length: 5 }, (_, i) => ({ title: `Sample result ${(page - 1) * 5 + i + 1} for “${s}”`, url: `https://${hosts[i]}/sample/${encodeURIComponent(s)}`, host: hosts[i], snippet: "Preview sample. On a real server this is a live result parsed from the search engine, fetched privately by Artemis." }));
    return { q: s, engine: q.get("engine") || me.settings.engine, results, next: page === 1 ? "demo-next" : undefined, fallbackUrl: "https://duckduckgo.com/?q=" + encodeURIComponent(s), tried: [{ engine: "ddg", ok: true }] };
  }
  if (p === "/settings" && method === "PUT") { Object.assign(me.settings, body); return { settings: me.settings }; }
  if (p === "/reports") { D.reports.push({ id: uid(), userId: me.id, username: me.username, kind: body.kind, text: body.text, page: body.page, ts: Date.now(), status: "open" }); return { ok: true }; }
  const rpm = p.match(/^\/owner\/reports\/(\w+)$/);
  if (rpm) { const r = D.reports.find((x) => x.id === rpm[1]); if (method === "PUT" && r) r.status = body.status; else D.reports = D.reports.filter((x) => x.id !== rpm[1]); return { ok: true }; }
  if (p === "/game/rebirth" || p === "/game/rebirth/buy") {
    const st = () => { const rb = G.rb ?? 0, goals = [100, 150, 25, 15].map((b) => Math.max(5, Math.round(b * (1 + 0.6 * rb) / 5) * 5)), vals = [G.stats.msgs ?? 0, G.stats.pages ?? 0, G.plays, G.stats.packs ?? 0], base = G.wbase ?? [0, 0, 0, 0];
      const quests = [["msgs", "Radio Ring", "📡", "Send chat messages"], ["pages", "Explorer Ring", "🧭", "Open pages in the browser"], ["plays", "Arcade Ring", "🎮", "Finish arcade runs"], ["packs", "Crate Ring", "📦", "Open packs"]].map(([id, name, icon, verb], i) => { const n = Math.min(goals[i], Math.max(0, vals[i] - base[i])); return { id, name, icon, verb, goal: goals[i], n, done: n >= goals[i] }; });
      const atTop = G.xp >= 100000, ringsDone = quests.every((x) => x.done); return { rb, rp: G.rp ?? 0, world: Math.min(rb, 5), nextWorld: Math.min(rb + 1, 5), quests, atTop, ringsDone, can: atTop && ringsDone, mul: 2 * (1 + 0.25 * rb), bought: G.rbBought ?? [] }; };
    if (p === "/game/rebirth/buy") return { ok: true, state: st() };
    return st();
  }
  if (p === "/game") return { game: pubGame(), ...boards() };
  if (p === "/game/run") { const sc = Math.floor(body.score); G.plays++; G.best = Math.max(G.best, sc); G.xp += Math.min(30, Math.floor(sc / 40)); X.earn?.(Math.min(60, Math.floor(sc / 60))); gprogress("play"); return { game: pubGame(), ...boards() }; }
  if (p === "/owner/event") { push({ t: "event", kind: body.kind, title: body.title, sub: body.sub, by: me.username }); G.xp += 25; return { ok: true, reached: 1 }; }
  if (p === "/gifs" && method === "GET") return { library: [], mine: [], search: false };
  if (p.startsWith("/gifs/")) throw demoErr("GIFs need the real server.");
  if (p === "/yt/backends") return { backends: [] };
  if (p.startsWith("/yt/")) throw demoErr("Tube needs the real server.");
  if (p === "/updates" && method === "GET") return { updates: [...D.updates].sort((a, b) => b.ts - a.ts) };
  if (p === "/updates" && method === "POST") { if (me.role !== "owner") throw demoErr("Owner only", 403); const e = { id: uid(), ts: Date.now(), by: me.username, title: String(body.title ?? "").trim(), body: String(body.body ?? "") }; if (!e.title) throw demoErr("Give the update a title"); D.updates.push(e); return { update: e }; }
  if (m(/^\/updates\/([^/]+)$/)) { if (me.role !== "owner") throw demoErr("Owner only", 403); const id = m(/^\/updates\/([^/]+)$/)[1]; if (method === "DELETE") { D.updates = D.updates.filter((x) => x.id !== id); return { ok: true }; } const e = D.updates.find((x) => x.id === id); Object.assign(e, { title: body.title, body: body.body }); return { update: e }; }
  if (p === "/history" && method === "DELETE") { D.history = []; return { ok: true }; }
  if (p === "/password") return { ok: true };
  if (p === "/bookmarks" && method === "POST") { const b = { id: uid(), title: body.title || body.url, url: body.url }; D.bookmarks.push(b); return { bookmark: b }; }
  if (m(/^\/bookmarks\/(.+)$/) && method === "DELETE") { D.bookmarks = D.bookmarks.filter((b) => b.id !== m(/^\/bookmarks\/(.+)$/)[1]); return { ok: true }; }
  if (p === "/history" && method === "GET") return { history: D.history };
  if (p === "/history" && method === "POST") { if (body.url) D.history.unshift({ url: body.url, title: body.title || body.url, ts: Date.now() }); return { ok: true }; }
  if (p === "/history" && method === "DELETE") { D.history = []; return { ok: true }; }
  if (p === "/channels" && method === "POST") { const id = String(body.name).toLowerCase().replace(/[^a-z0-9-]/g, "-"); if (!id) throw demoErr("Invalid channel name"); D.channels.push({ id, name: id, topic: "" }); push({ t: "channels", channels: visCh() }); return { ok: true }; }
  if (m(/^\/channels\/([^/]+)\/topic$/)) { D.channels.find((c) => c.id === m(/^\/channels\/([^/]+)\/topic$/)[1]).topic = body.topic; push({ t: "channels", channels: visCh() }); return { ok: true }; }
  if (m(/^\/channels\/([^/]+)$/) && method === "DELETE") { D.channels = D.channels.filter((c) => c.id !== m(/^\/channels\/([^/]+)$/)[1]); push({ t: "channels", channels: visCh() }); return { ok: true }; }
  /* admin */
  if (p === "/admin/overview") return { perms: Object.keys(PERM_INFO), staff: true, roles, stats: stats(), users: users.map((u) => ({ ...u, rank: u.role === "owner" ? 0 : u.role === "coowner" ? 1 : u.role === "admin" ? 2 : (roles.find((r) => r.id === u.roleId)?.position ?? 99) + 1 })), invites: D.invites, blocklist: D.blocklist, server: D.server, announcement: D.announcement, audit: D.audit, privateAllowed: false, upstreamProxy: false, proxyIsolated: true };
  if (p === "/admin/coins") { const a = Math.round(Number(body.amount)); if (!a) throw demoErr("Enter an amount"); const nm = String(body.username ?? "").trim(); if (!nm) throw demoErr("No active player with that callsign"); return { ok: true, username: nm }; }
  if (p === "/admin/settings") { Object.assign(D.server, body); log("settings.update", JSON.stringify(body)); return { server: D.server }; }
  if (p === "/admin/announcement" && method === "POST") { D.announcement = { id: uid(), text: body.text, by: me.username, byTag: me.role === "owner" ? { tier: "owner", label: "OWNER", color: "#f5b942" } : me.role === "coowner" ? { tier: "coowner", label: "CO-OWNER", color: "#ff8a5b" } : me.role === "admin" ? { tier: "admin", label: "CMD", color: "#8b7bff" } : (() => { const r = roles.find((x) => x.id === me.roleId); return r ? { tier: "role", label: r.name, color: r.color } : undefined; })(), ts: Date.now() }; log("announcement.post", body.text); push({ t: "announcement", announcement: D.announcement }); return { announcement: D.announcement }; }
  if (p === "/admin/announcement") { D.announcement = null; log("announcement.clear"); push({ t: "announcement", announcement: null }); return { ok: true }; }
  if (p === "/admin/blocklist" && method === "POST") { if (!/^[a-z0-9.-]+\.[a-z]+$/i.test(body.host)) throw demoErr("Enter a domain like example.com"); D.blocklist.push(body.host.toLowerCase()); log("block.add", body.host); return { blocklist: D.blocklist }; }
  if (m(/^\/admin\/blocklist\/(.+)$/)) { const h = decodeURIComponent(m(/^\/admin\/blocklist\/(.+)$/)[1]); D.blocklist = D.blocklist.filter((x) => x !== h); log("block.remove", h); return { ok: true }; }
  if (p === "/me/2fa/start") return { secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", uri: "" };
  if (p === "/me/2fa/enable" || p === "/me/2fa/disable") return { ok: true };
  if (p === "/admin/invites" && method === "POST") { const code = "ARTEMIS-" + uid().toUpperCase(); D.invites.push({ code, createdBy: "Warmaster", createdAt: Date.now(), expiresAt: Date.now() + (Number(body?.hours) || 24) * 36e5 }); log("invite.create", code); return { code }; }
  if (m(/^\/admin\/invites\/(.+)$/)) { D.invites = D.invites.filter((i) => i.code !== m(/^\/admin\/invites\/(.+)$/)[1]); return { ok: true }; }
  const um = m(/^\/admin\/users\/([^/]+)\/(role|ban|reset-password)$/);
  if (um) { const u = users.find((x) => x.id === um[1]); if (um[2] === "role") { u.role = body.role; if (u.role !== "member") delete u.roleId; push({ t: "members", members: members() }); log("user.role", `${u.username} → ${u.role}`); } else if (um[2] === "ban") { u.banned = body.banned; log(u.banned ? "user.ban" : "user.unban", u.username); } else { log("user.reset-password", u.username); return { password: "Demo-" + uid() }; } return { ok: true }; }
  const dm = m(/^\/admin\/users\/([^/]+)$/); if (dm && method === "DELETE") { const i = users.findIndex((x) => x.id === dm[1]); log("user.remove", users[i].username); users.splice(i, 1); return { ok: true }; }
  if (p === "/profile") { Object.assign(me.profile, body); const mu = users.find((x) => x.id === me.id); mu.profile = me.profile; push({ t: "members", members: members() }); return { profile: me.profile }; }
  if (p === "/owner/roles" && method === "POST") { const r = { id: uid(), name: body.name, color: body.color, position: 2 + roles.length, perms: body.perms ?? [] }; roles.push(r); log("role.create", r.name); push({ t: "roles", roles }); return { role: r }; }
  const rm = m(/^\/owner\/roles\/([^/]+)(\/move)?$/);
  if (rm) { const i = roles.findIndex((x) => x.id === rm[1]); if (rm[2]) { const j = i + (body.dir === "up" ? -1 : 1); if (j >= 0 && j < roles.length) { [roles[i], roles[j]] = [roles[j], roles[i]]; roles.forEach((r, k) => (r.position = 2 + k)); } } else if (method === "DELETE") { users.forEach((u) => u.roleId === rm[1] && delete u.roleId); roles.splice(i, 1); roles.forEach((r, k) => (r.position = 2 + k)); } else Object.assign(roles[i], body); push({ t: "roles", roles }); push({ t: "members", members: members() }); return { ok: true }; }
  const cr = m(/^\/admin\/users\/([^/]+)\/custom-role$/); if (cr) { const u = users.find((x) => x.id === cr[1]); if (body.roleId) u.roleId = body.roleId; else delete u.roleId; push({ t: "members", members: members() }); return { ok: true }; }
  if (p === "/admin/command") { const [c, ...a] = String(body.line).trim().split(/\s+/); const out = (o, ok = true) => ({ output: [].concat(o), ok }); switch ((c || "").toLowerCase()) { case "help": return out(["Commands (preview): help, stats, who, users, channels, roles, announce <text>"]); case "stats": return out(["crew       " + users.length, "online     2", "channels   " + D.channels.length, "messages   " + D.messages.length]); case "who": return out(["Warmaster"]); case "users": return out(users.map((u) => u.username.padEnd(16) + u.role)); case "channels": return out(D.channels.map((x) => "#" + x.name)); case "roles": return out(roles.map((r) => r.name.padEnd(14) + (r.perms.join(", ") || "(no powers)"))); case "announce": { const text = a.join(" "); if (!text) return out("Usage: announce <text>", false); D.announcement = { id: uid(), text, by: "Warmaster", ts: Date.now() }; push({ t: "announcement", announcement: D.announcement }); return out("Sent."); } default: return out(`Unknown command "${c}". Type help.`, false); } }
  /* owner */
  if (p === "/owner/overview") return { reports: [...D.reports].reverse(), counts: { owner: 1, coowner: users.filter((u) => u.role === "coowner").length, admin: users.filter((u) => u.role === "admin").length, member: users.filter((u) => u.role === "member").length, banned: users.filter((u) => u.banned).length }, messages: D.messages.length, channels: D.channels.length, invites: D.invites.length, auditEntries: D.audit.length, history: D.history.length, bookmarks: D.bookmarks.length, dataBytes: 48210, node: "v22", memoryMb: 96, uptimeSec: 90000, maintenance: D.server.maintenance, maintenanceMessage: D.server.maintenanceMessage, viewerRole: me.role, coowners: users.filter((u) => u.role === "coowner").map((u) => ({ id: u.id, username: u.username, lastSeen: u.lastSeen })), commanders: users.filter((u) => u.role === "admin").map((u) => ({ id: u.id, username: u.username, lastSeen: u.lastSeen })), members: users.filter((u) => u.role === "member" && !u.banned).map((u) => ({ id: u.id, username: u.username })) };
  if (p === "/owner/maintenance") { D.server.maintenance = !!body.on; D.server.maintenanceMessage = body.message || ""; log(body.on ? "maintenance.on" : "maintenance.off"); return { ok: true }; }
  if (p === "/owner/signout-all" || p === "/owner/transfer") throw demoErr("Disabled in the preview.");
  if (p === "/owner/wipe") { if (body.what === "chat") D.messages = []; if (body.what === "audit") D.audit = []; if (body.what === "history") D.history = []; log("owner.wipe", body.what); return { ok: true }; }
  throw demoErr("Not available in the preview", 404);
};

/* ---------------- fake websocket ---------------- */
let sockets = [];
function push(m) { sockets.forEach((s) => s.deliver(m)); }
hooks.socket = () => {
  const s = {
    readyState: 0, adminSub: false, onopen: null, onmessage: null, onclose: null,
    deliver(m) { if (s.readyState === 1) setTimeout(() => s.onmessage?.({ data: JSON.stringify(m) }), 0); },
    close() { s.readyState = 3; sockets = sockets.filter((x) => x !== s); },
    send(raw) {
      const m = JSON.parse(raw);
      const find = (id) => D.messages.find((x) => x.id === id);
      if (m.t === "history") { if (D.channels.find((c) => c.id === m.channel)?.trusted && !X.isTrusted?.()) return; const l = D.messages.filter((x) => x.channel === m.channel); s.deliver({ t: "history", channel: m.channel, messages: l, more: false, older: false }); }
      else if (m.t === "send") {
        const ch = D.channels.find((c) => c.id === m.channel); if (ch?.trusted && !X.isTrusted?.()) return;
        const gate = X.gate?.(String(m.text), m.channel); if (gate) { if (gate.reply) { D.messages.push(gate.reply); push({ t: "msg", msg: gate.reply }); } s.deliver({ t: "error", message: gate.error }); return; }
        const msg = { id: uid(), channel: m.channel, userId: me.id, username: me.username, text: String(m.text).slice(0, 2000), ts: Date.now() };
        if (m.replyTo) { const o = find(m.replyTo); if (o) msg.replyTo = { id: o.id, username: o.username, text: o.text.slice(0, 140) }; }
        D.messages.push(msg); push({ t: "msg", msg }); gprogress("chat"); X.activity?.("chat"); X.recheck?.();
      } else if (m.t === "arena") { X.arena?.(m); }
      else if (m.t === "edit") { const x = find(m.id); if (x && x.userId === me.id) { x.text = m.text; x.edited = Date.now(); push({ t: "edited", id: x.id, text: x.text, edited: x.edited }); } }
      else if (m.t === "delete") { D.messages = D.messages.filter((x) => x.id !== m.id); push({ t: "deleted", id: m.id }); }
      else if (m.t === "react") { const x = find(m.id); if (!x) return; x.reactions ??= {}; const l = (x.reactions[m.emoji] ??= []); const i = l.indexOf(me.id); if (i >= 0) l.splice(i, 1); else l.push(me.id); if (!l.length) delete x.reactions[m.emoji]; push({ t: "reactions", id: x.id, reactions: x.reactions }); }
      else if (m.t === "admin-sub") s.adminSub = !!m.on;
    },
  };
  sockets.push(s);
  setTimeout(() => {
    s.readyState = 1; s.onopen?.();
    s.deliver({ t: "init", channels: visCh(), online: [{ id: me.id, username: me.username, role: me.role }], members: members(), announcement: D.announcement, roles, self: selfMsg(), ...X.init() });
  }, 30);
  return s;
};
setInterval(() => sockets.forEach((s) => s.adminSub && s.deliver({ t: "stats", stats: stats(), users })), 2000);

/* ---------------- proxied pages are replaced by a placeholder ---------------- */
hooks.frame = (iframe, url) => {
  gprogress("browse"); X.activity?.("browse"); X.proxyTick?.(); X.recheck?.();
  const safe = String(url).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  iframe.srcdoc = `<body style="margin:0;display:grid;place-items:center;height:100vh;background:#0a0d1c;color:#e8ecff;font:15px system-ui;text-align:center"><div style="max-width:460px;padding:24px"><div style="font-size:42px">🛰️</div><h2 style="margin:8px 0">Preview mode</h2><p style="color:#8e97c4;line-height:1.5">On a real Artemis server, <b style="color:#e8ecff">${safe}</b> would load here through the proxy.</p></div></body>`;
};

/* preview-only hint on the sign-in card */
queueMicrotask(() => {
  const add = () => {
    const f = document.querySelector("#authForm"); if (!f || f.querySelector(".demo-hint")) return;
    const p = document.createElement("p"); p.className = "note demo-hint";
    p.innerHTML = "Preview: sign in as <b>Warmaster</b> (any passcode) for the Owner view, or create your own account. Accounts live only in this tab.";
    f.insertBefore(p, f.querySelector("#authError"));
  };
  add(); document.addEventListener("DOMContentLoaded", add);
});

import { installEconomy } from "./demo-economy.js";
installEconomy({ me, users, push, G, pubGame, boards, gprogress, RANKS, demoErr, D, log, members, X, uid, visCh, selfMsg, myPerms });

/* ---------------- preview only: "View as" lets the owner see every panel from any role ---------------- */
(function viewAs() {
  if (!document.body) return;
  const box = document.createElement("div"); box.id = "viewAs";
  box.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:99999;display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:12px;background:#111426;color:#e8ecff;font:12px system-ui;box-shadow:0 0 0 1px #5b4dff,0 8px 30px rgba(0,0,0,.5)";
  box.innerHTML = '<span title="Preview only. Switch your view to see every panel as that role.">👁 View as</span><select style="background:#1b1f3a;color:#fff;border:0;border-radius:8px;padding:5px 8px;font:12px system-ui;max-width:170px"></select>';
  const sel = box.querySelector("select");
  const fill = () => { const cur = sel.value; sel.innerHTML = [["owner", "Owner"], ["coowner", "Co-owner"], ["admin", "Commander (admin)"], ...roles.map((r) => ["role:" + r.id, "Role: " + r.name]), ["trusted", "Trusted member"], ["member", "New member"]].map(([v, l]) => `<option value="${v}">${l}</option>`).join(""); if (cur) sel.value = cur; };
  fill(); sel.addEventListener("mousedown", fill); sel.addEventListener("focus", fill);
  sel.onchange = () => {
    const k = sel.value; let role = "member", roleId = null, trust;
    if (k === "owner" || k === "coowner" || k === "admin") role = k; else if (k.startsWith("role:")) roleId = k.slice(5); else if (k === "trusted") trust = "grant"; else trust = "revoke";
    Object.assign(me, { role, roleId }); if (trust) me.trust = trust; else delete me.trust;
    const mu = users.find((u) => u.id === me.id); if (mu) Object.assign(mu, { role, roleId }); if (mu && !roleId) delete mu.roleId;
    push({ t: "self", ...selfMsg() }); push({ t: "channels", channels: visCh() }); push({ t: "roles", roles }); push({ t: "members", members: members() });
    X.recheck?.();
  };
  document.body.appendChild(box);
})();
