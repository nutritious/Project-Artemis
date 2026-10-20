/* Cosmetics catalog shared by the server and the browser: profile effects, titles (tags), themes, packs and live events. */
export const RARITY = {
  common: { name: "Common", color: "#9aa4cf", weight: 60, dupe: 20 },
  rare: { name: "Rare", color: "#4cc9f0", weight: 28, dupe: 50 },
  epic: { name: "Epic", color: "#b57bff", weight: 10, dupe: 120 },
  legendary: { name: "Legendary", color: "#ffc857", weight: 2, dupe: 300 },
  chroma: { name: "Chroma", color: "#ff4df0", weight: 0.2, dupe: 3000 },
  limited: { name: "Limited", color: "#ff5d9e", weight: 0, dupe: 0 },
  secret: { name: "Secret", color: "#ff2e4d", weight: 0, dupe: 10000 },
};
/** Secret items never show in a pack's odds or contents. Each item slot has this tiny chance of being one instead. */
export const SECRET_CHANCE = 1 / 200;
export const EFFECTS = [
  { id: "stardust", name: "Stardust", rarity: "common", desc: "Tiny stars twinkle around you" },
  { id: "ringlet", name: "Ringlet", rarity: "common", desc: "A slim ring that slowly spins" },
  { id: "aurora", name: "Aurora", rarity: "rare", desc: "Shifting northern lights glow" },
  { id: "neon", name: "Neon Pulse", rarity: "rare", desc: "A bright neon heartbeat" },
  { id: "orbit", name: "Orbit", rarity: "rare", desc: "A moon circles your picture" },
  { id: "glitch", name: "Glitch", rarity: "epic", desc: "Signal tearing at the edges" },
  { id: "flare", name: "Solar Flare", rarity: "epic", desc: "Licks of solar fire" },
  { id: "comet", name: "Comet Tail", rarity: "epic", desc: "A comet racing around you" },
  { id: "halo", name: "Eclipse Halo", rarity: "legendary", desc: "A burning corona around a dark core" },
  { id: "supernova", name: "Supernova", rarity: "legendary", desc: "Golden rays burst outward" },
  { id: "crown", name: "Starlight Crown", rarity: "legendary", desc: "A shimmering golden crown of light" },
  { id: "pixel", name: "Pixel Pop", rarity: "rare", cat: "gamer", desc: "8-bit sparkles pop around you" },
  { id: "hud", name: "Crosshair HUD", rarity: "epic", cat: "gamer", desc: "A locked-on targeting reticle" },
  { id: "code", name: "Green Code", rarity: "rare", cat: "hacker", desc: "Terminal green glow and falling bits" },
  { id: "scan", name: "Scanline", rarity: "epic", cat: "hacker", desc: "A scanner sweeping over your picture" },
  { id: "prism", name: "Prism", rarity: "chroma", desc: "A full-spectrum ring that never stops shifting" },
  { id: "holo", name: "Holo Burst", rarity: "chroma", desc: "Rainbow foil rays and a living glow" },
  { id: "opening-night", name: "Opening Night", rarity: "limited", limited: "opening", desc: "Fireworks from the Project Artemis Opening Event" },
  { id: "haunted", name: "Haunted", rarity: "limited", limited: "halloween", desc: "Ghostly wisps from the Halloween Night event" },
  { id: "bats", name: "Bat Swarm", rarity: "rare", only: "halloween", desc: "Bats circle your picture" },
  { id: "jack", name: "Jack-o'-Glow", rarity: "rare", only: "halloween", desc: "A flickering pumpkin glow" },
  { id: "ghostfire", name: "Ghostfire", rarity: "epic", only: "halloween", desc: "Cold green and violet flames" },
  { id: "cobweb", name: "Cobwebbed", rarity: "epic", only: "halloween", desc: "Spiderwebs creep across your picture" },
  { id: "witchmoon", name: "Witching Moon", rarity: "legendary", only: "halloween", desc: "A huge orange moon rises behind you" },
  { id: "wraith", name: "Spectral Wraith", rarity: "chroma", only: "halloween", desc: "A rainbow ghost haunts your picture" },
  { id: "prismjack", name: "Prismatic Jack", rarity: "chroma", only: "halloween", desc: "A pumpkin lit by every colour at once" },
  { id: "horizon", name: "Event Horizon", rarity: "secret", desc: "A black hole that should not be here" },
];
export const TAGS = [
  { id: "stargazer", name: "Stargazer", color: "#9aa4cf", rarity: "common" },
  { id: "night-owl", name: "Night Owl", color: "#8b7bff", rarity: "common" },
  { id: "moonwalker", name: "Moonwalker", color: "#cfe0ff", rarity: "rare" },
  { id: "void-runner", name: "Void Runner", color: "#4cc9f0", rarity: "rare" },
  { id: "eclipse-chaser", name: "Eclipse Chaser", color: "#ff8a5b", rarity: "epic" },
  { id: "deep-diver", name: "Deep Space Diver", color: "#b57bff", rarity: "epic" },
  { id: "starborn", name: "Starborn", color: "#ffc857", rarity: "legendary" },
  { id: "redacted", name: "[REDACTED]", color: "#ff2e4d", rarity: "secret" },
  { id: "respawn", name: "Respawn", color: "#9aa4cf", rarity: "common", cat: "gamer" },
  { id: "pro-gamer", name: "Pro Gamer", color: "#3dff7a", rarity: "rare", cat: "gamer" },
  { id: "clutch", name: "Clutch King", color: "#ff5d9e", rarity: "epic", cat: "gamer" },
  { id: "speedrun", name: "Speedrunner", color: "#ffd76a", rarity: "legendary", cat: "gamer" },
  { id: "packet", name: "Packet Sniffer", color: "#7dff6a", rarity: "common", cat: "hacker" },
  { id: "root", name: "Root Access", color: "#33ff33", rarity: "rare", cat: "hacker" },
  { id: "zero-day", name: "Zero Day", color: "#ff3b5c", rarity: "epic", cat: "hacker" },
  { id: "black-hat", name: "Black Hat", color: "#e8ecff", rarity: "legendary", cat: "hacker" },
  { id: "chroma-prime", name: "CHROMA", color: "#ff4df0", rarity: "chroma" },
  { id: "spectrum", name: "Spectrum Walker", color: "#3be8ff", rarity: "chroma" },
  { id: "og", name: "OG", color: "#ffd76a", rarity: "limited", limited: "launch" },
  { id: "opening-26", name: "Opening Night '26", color: "#ffd76a", rarity: "limited", limited: "opening" },
  { id: "halloween-26", name: "Trick or Treat '26", color: "#ff8a2b", rarity: "limited", limited: "halloween" },
  { id: "h-spooky", name: "Spooky", color: "#ff9a3c", rarity: "common", only: "halloween" },
  { id: "h-ghoul", name: "Ghoul", color: "#8dff7a", rarity: "common", only: "halloween" },
  { id: "h-pumpkin-king", name: "Pumpkin King", color: "#ff8a2b", rarity: "rare", only: "halloween" },
  { id: "h-night-witch", name: "Night Witch", color: "#c084fc", rarity: "epic", only: "halloween" },
  { id: "h-grim", name: "The Grim", color: "#ff3b3b", rarity: "legendary", only: "halloween" },
  { id: "h-nightmare", name: "NIGHTMARE", color: "#ff4df0", rarity: "chroma", only: "halloween" },
];
/* the four original themes are always owned; these unlock from theme packs */
export const BASE_THEMES = ["eclipse", "lunar", "orion", "aurora"];
export const THEMES = [
  { id: "ocean", name: "Deep Ocean", rarity: "common", c: ["#04111c", "#38bdf8"] },
  { id: "mono", name: "Monochrome", rarity: "common", c: ["#0b0b0c", "#e5e5e5"] },
  { id: "sakura", name: "Sakura", rarity: "rare", c: ["#14080f", "#ff8fb8"] },
  { id: "solar", name: "Solar Gold", rarity: "rare", c: ["#120d02", "#ffc857"] },
  { id: "nebula", name: "Nebula", rarity: "rare", c: ["#0d0518", "#d56bff"] },
  { id: "crimson", name: "Crimson Void", rarity: "epic", c: ["#12040a", "#ff3b5c"] },
  { id: "matrix", name: "Mainframe", rarity: "epic", c: ["#010a03", "#3dff7a"] },
  { id: "void", name: "Absolute Void", rarity: "legendary", c: ["#000000", "#8b7bff"] },
  { id: "terminal", name: "Terminal", rarity: "rare", cat: "hacker", c: ["#000a00", "#33ff33"] },
  { id: "arcade", name: "Arcade Neon", rarity: "epic", cat: "gamer", c: ["#07031a", "#ff3df0"] },
  { id: "prism", name: "Prismatic", rarity: "chroma", c: ["#05030f", "#ff4df0"] },
  { id: "pumpkin", name: "Pumpkin Night", rarity: "rare", only: "halloween", c: ["#140700", "#ff8a2b"] },
  { id: "witching", name: "Witching Hour", rarity: "epic", only: "halloween", c: ["#0c0414", "#b46bff"] },
  { id: "witchfire", name: "Witchfire", rarity: "chroma", only: "halloween", c: ["#0a0214", "#ff4df0"] },
];
/** Profile backgrounds: the banner behind your name on your profile. The look of each lives in the stylesheet as .pbg-<id>. */
export const BGS = [
  { id: "dusk", name: "Dusk", rarity: "common", desc: "Purple evening sky" },
  { id: "graphite", name: "Graphite", rarity: "common", desc: "Clean dark metal" },
  { id: "cosmos", name: "Deep Cosmos", rarity: "common", desc: "A dusting of far-off stars" },
  { id: "sunset-grid", name: "Synthwave Grid", rarity: "rare", cat: "gamer", desc: "Retro neon horizon" },
  { id: "abyss", name: "Abyss", rarity: "rare", desc: "The deep ocean at night" },
  { id: "greenrain", name: "Green Rain", rarity: "rare", cat: "hacker", desc: "Code falling down the screen" },
  { id: "aurora-sky", name: "Aurora Sky", rarity: "rare", desc: "Northern lights on the move" },
  { id: "circuit", name: "Circuit Board", rarity: "epic", cat: "hacker", desc: "Glowing traces and nodes" },
  { id: "pixel-grid", name: "Pixel Arcade", rarity: "epic", cat: "gamer", desc: "Chunky pixels and a power-up glow" },
  { id: "magma", name: "Magma", rarity: "epic", desc: "Molten rock, slowly flowing" },
  { id: "nebula-swirl", name: "Nebula Swirl", rarity: "epic", desc: "A churning cloud of colour" },
  { id: "galaxy", name: "Spiral Galaxy", rarity: "legendary", desc: "A slow-turning galaxy" },
  { id: "eclipse-rings", name: "Eclipse Rings", rarity: "legendary", desc: "A dark moon wrapped in fire" },
  { id: "gold-rush", name: "Gold Rush", rarity: "legendary", desc: "Liquid gold with a moving shine" },
  { id: "spectrum", name: "Spectrum", rarity: "chroma", desc: "Every colour, flowing together" },
  { id: "holo-foil", name: "Holo Foil", rarity: "chroma", desc: "Shimmering rainbow foil" },
  { id: "haunted-forest", name: "Haunted Forest", rarity: "rare", only: "halloween", desc: "Dead trees and drifting fog" },
  { id: "pumpkin-patch", name: "Pumpkin Patch", rarity: "rare", only: "halloween", desc: "A glowing field at dusk" },
  { id: "graveyard", name: "Graveyard", rarity: "epic", only: "halloween", desc: "Tombstones under a pale moon" },
  { id: "blood-moon", name: "Blood Moon", rarity: "legendary", only: "halloween", desc: "A huge red moon over the hills" },
  { id: "carnival", name: "Spectral Carnival", rarity: "chroma", only: "halloween", desc: "A haunted fairground in every colour" },
  { id: "the-rift", name: "The Rift", rarity: "secret", desc: "Something on the other side is looking back" },
];
/** Halloween ends (and the Halloween pack leaves) at midnight Pacific time on Nov 1, 2026. */
export const HALLOWEEN_END = Date.UTC(2026, 10, 1, 7, 0);
export const packOpen = (p, now = Date.now()) => !p.until || now < p.until;
export const PACKS = [
  { id: "crate", kind: "loot", name: "Supply Crate", cost: 150, count: 3, boost: 0, desc: "3 random effects, titles or backdrops", color: "#4cc9f0" },
  { id: "nova", kind: "loot", name: "Nova Crate", cost: 400, count: 4, boost: 1, desc: "4 items with better odds of rare finds", color: "#b57bff" },
  { id: "vault", kind: "loot", name: "Eclipse Vault", cost: 1000, count: 5, boost: 2, desc: "5 items, at least one epic or better", color: "#ffc857", guarantee: "epic" },
  { id: "gamer", kind: "loot", name: "Gamer Crate", cost: 350, count: 4, boost: 1, cat: "gamer", desc: "Gamer-only effects, titles, backdrops and more", color: "#3dff7a" },
  { id: "hacker", kind: "loot", name: "Hacker Crate", cost: 350, count: 4, boost: 1, cat: "hacker", desc: "Hacker-only effects, titles, backdrops and more", color: "#33ff33" },
  { id: "backdrops", kind: "loot", name: "Backdrop Pack", cost: 300, count: 3, boost: 1, pool: ["bg"], desc: "3 profile backgrounds", color: "#ff8a5b" },
  { id: "chroma", kind: "loot", name: "Chroma Vault", cost: 3000, count: 5, boost: 2, chromaBoost: 25, desc: "5 items and a real shot at Chroma", color: "#ff4df0", guarantee: "epic" },
  { id: "themes", kind: "theme", name: "Theme Pack", cost: 250, count: 2, boost: 0, desc: "2 random themes for your whole app", color: "#ff8fb8" },
  { id: "halloween", kind: "loot", name: "Halloween Pack", cost: 450, count: 4, boost: 1, pool: ["effect", "tag", "bg", "theme"], only: "halloween", until: HALLOWEEN_END, guarantee: "rare", chromaBoost: 14, desc: "Limited: spooky effects, titles, backdrops and themes, with a real shot at Halloween Chroma. Leaves Nov 1", color: "#ff8a2b" },
  { id: "themes-deluxe", kind: "theme", name: "Deep Space Themes", cost: 600, count: 3, boost: 2, desc: "3 themes, better odds of epic and legendary", color: "#8b7bff", guarantee: "rare" },
];
/** Earning rules. Everyday coins (games, chatting, searching, browsing, missions) stop at DAILY_CAP and reset each UTC day. Gifts, events, achievements, the wheel and duplicate refunds are not counted. */
export const DAILY_CAP = 500;
export const COIN_RATES = { chat: { coins: 1, gap: 20_000 }, search: { coins: 2, gap: 8_000 }, browse: { coins: 1, gap: 15_000 } };
export const WHEEL_MS = 3_600_000;
export const WHEEL = [
  { label: "8", coins: 8, w: 22, color: "#4a5388" }, { label: "12", coins: 12, w: 20, color: "#3b6fa6" }, { label: "15", coins: 15, w: 16, color: "#2f8f83" }, { label: "20", coins: 20, w: 12, color: "#6f58c9" },
  { label: "30", coins: 30, w: 9, color: "#c2410c" }, { label: "50", coins: 50, w: 6, color: "#d4a017" }, { label: "80", coins: 80, w: 3.5, color: "#c0369c" }, { label: "200", coins: 200, w: 1.2, color: "#14b85a" },
  { label: "CRATE", pack: 1, w: 1, color: "#00a3c4" }, { label: "400", coins: 400, w: 0.3, color: "#ff4df0" },
];
/** Lifetime achievements. stat is a counter the server keeps; reaching goal pays coins once. */
export const ACHIEVEMENTS = [
  { id: "chat10", name: "Say hello", desc: "Send 10 chat messages", stat: "msgs", goal: 10, coins: 25, icon: "💬" },
  { id: "chat100", name: "Chatterbox", desc: "Send 100 chat messages", stat: "msgs", goal: 100, coins: 75, icon: "💬" },
  { id: "chat1000", name: "Radio legend", desc: "Send 1,000 chat messages", stat: "msgs", goal: 1000, coins: 300, icon: "📡" },
  { id: "search10", name: "Curious mind", desc: "Search the web 10 times", stat: "searches", goal: 10, coins: 25, icon: "🔎" },
  { id: "search100", name: "Researcher", desc: "Search the web 100 times", stat: "searches", goal: 100, coins: 100, icon: "🔬" },
  { id: "search500", name: "Archivist", desc: "Search the web 500 times", stat: "searches", goal: 500, coins: 300, icon: "📚" },
  { id: "pages25", name: "Explorer", desc: "Open 25 pages in the browser", stat: "pages", goal: 25, coins: 25, icon: "🧭" },
  { id: "pages250", name: "Web walker", desc: "Open 250 pages in the browser", stat: "pages", goal: 250, coins: 100, icon: "🌐" },
  { id: "play5", name: "Insert coin", desc: "Finish 5 arcade runs", stat: "plays", goal: 5, coins: 25, icon: "🕹" },
  { id: "play50", name: "Arcade regular", desc: "Finish 50 arcade runs", stat: "plays", goal: 50, coins: 100, icon: "🎮" },
  { id: "play300", name: "Cabinet legend", desc: "Finish 300 arcade runs", stat: "plays", goal: 300, coins: 300, icon: "🏆" },
  { id: "pack1", name: "First crate", desc: "Open your first pack", stat: "packs", goal: 1, coins: 25, icon: "📦" },
  { id: "pack10", name: "Crate fan", desc: "Open 10 packs", stat: "packs", goal: 10, coins: 100, icon: "📦" },
  { id: "pack50", name: "Crate addict", desc: "Open 50 packs", stat: "packs", goal: 50, coins: 400, icon: "🎁" },
  { id: "spin1", name: "Spin it", desc: "Spin the hourly wheel", stat: "spins", goal: 1, coins: 20, icon: "🎡" },
  { id: "spin24", name: "Lucky streak", desc: "Spin the wheel 24 times", stat: "spins", goal: 24, coins: 100, icon: "🍀" },
  { id: "spin100", name: "Wheel master", desc: "Spin the wheel 100 times", stat: "spins", goal: 100, coins: 300, icon: "🎰" },
  { id: "items5", name: "Collector", desc: "Own 5 cosmetics", stat: "items", goal: 5, coins: 50, icon: "✨" },
  { id: "items15", name: "Hoarder", desc: "Own 15 cosmetics", stat: "items", goal: 15, coins: 150, icon: "💎" },
  { id: "items30", name: "Museum", desc: "Own 30 cosmetics", stat: "items", goal: 30, coins: 400, icon: "🏛" },
  { id: "chroma1", name: "Chroma hunter", desc: "Pull a Chroma item from a pack", stat: "chroma", goal: 1, coins: 500, icon: "🌈" },
  { id: "streak3", name: "On a roll", desc: "Reach a 3-day streak", stat: "streakmax", goal: 3, coins: 30, icon: "🔥" },
  { id: "streak7", name: "Week warrior", desc: "Reach a 7-day streak", stat: "streakmax", goal: 7, coins: 100, icon: "🔥" },
  { id: "streak30", name: "Unstoppable", desc: "Reach a 30-day streak", stat: "streakmax", goal: 30, coins: 500, icon: "☄" },
  { id: "rank2", name: "Pilot's wings", desc: "Reach the Pilot rank", stat: "rank", goal: 2, coins: 50, icon: "🚀" },
  { id: "rank4", name: "Captain on deck", desc: "Reach the Captain rank", stat: "rank", goal: 4, coins: 150, icon: "⭐" },
  { id: "rank6", name: "Legend", desc: "Reach the Legend rank", stat: "rank", goal: 6, coins: 500, icon: "👑" },
  { id: "event1", name: "Party starter", desc: "Join a live event", stat: "events", goal: 1, coins: 100, icon: "🎉" },
  { id: "event5", name: "Never miss a party", desc: "Join 5 live events", stat: "events", goal: 5, coins: 400, icon: "🎊" },
  { id: "trivia10", name: "Big brain", desc: "Answer 10 trivia questions right", stat: "trivia", goal: 10, coins: 100, icon: "🧠" },
  { id: "trivia50", name: "Quiz master", desc: "Answer 50 trivia questions right", stat: "trivia", goal: 50, coins: 300, icon: "🎓" },
  { id: "earn1k", name: "Piggy bank", desc: "Earn 1,000 coins in total", stat: "earned", goal: 1000, coins: 100, icon: "🐷" },
  { id: "earn10k", name: "Moon mogul", desc: "Earn 10,000 coins in total", stat: "earned", goal: 10000, coins: 500, icon: "🌕" },
];
export const EVENTS = {
  opening: { name: "Opening Event", tag: "opening-26", effect: "opening-night", color: "#ffd76a", blurb: "Project Artemis is open. Play the opening games to earn the limited Opening Night title and effect." },
  halloween: { name: "Halloween Night", tag: "halloween-26", effect: "haunted", color: "#ff8a2b", blurb: "The Moon turned orange. Survive the haunted games to earn the limited Trick or Treat title and effect." },
};
export const GAMES = [
  { id: "run", name: "Eclipse Run", desc: "Dodge asteroids, grab stars", per: 80, add: 50, coinDiv: 60 },
  { id: "blaster", name: "Asteroid Blaster", desc: "Blast the rocks, survive the waves", per: 200, add: 100, coinDiv: 90 },
  { id: "lander", name: "Moon Lander", desc: "Land softly with limited fuel", per: 0, add: 2000, coinDiv: 25 },
  { id: "memory", name: "Star Memory", desc: "Match the constellations", per: 0, add: 2000, coinDiv: 25 },
  { id: "snake", name: "Comet Snake", desc: "Grow your comet tail", per: 10, add: 100, coinDiv: 3 },
];
export const QUICK_EVENTS = [
  { id: "coinrain", name: "Coin rain", desc: "Coins fall on everyone online", icon: "🪙" },
  { id: "meteors", name: "Meteor shower", desc: "30 seconds of meteors to click for coins", icon: "☄" },
  { id: "doublexp", name: "Double XP", desc: "2x XP for everyone for 15 minutes", icon: "⚡" },
  { id: "doublecoins", name: "Double coins", desc: "2x coins from games and missions for 15 minutes", icon: "✦" },
  { id: "packdrop", name: "Free pack drop", desc: "Every online player gets a free Supply Crate", icon: "📦" },
  { id: "jackpot", name: "Jackpot", desc: "One random online player wins 500 coins", icon: "🎰" },
  { id: "treasure", name: "Treasure hunt", desc: "A hidden star appears. First click wins 250 coins", icon: "★" },
  { id: "xpgift", name: "XP gift", desc: "Everyone online gets 100 XP", icon: "🎁" },
  { id: "zerog", name: "Zero gravity", desc: "Everything floats for 20 seconds", icon: "◌" },
  { id: "luckyfive", name: "Lucky five", desc: "Five random online players win 150 coins each", icon: "🍀" },
  { id: "mysterybox", name: "Mystery box", desc: "Everyone online opens a box with 10 to 200 coins", icon: "🎲" },
  { id: "cosmeticdrop", name: "Cosmetic drop", desc: "Everyone online gets a random profile effect, title or theme", icon: "✨" },
  { id: "rushall", name: "Event rush", desc: "2x live-event points in every game for 3 minutes (needs a live event)", icon: "🔥" },
  { id: "confetti", name: "Confetti blast", desc: "Pure celebration on every screen", icon: "🎉" },
];
export const CUTSCENES = [
  { id: "launch", name: "Launch" }, { id: "eclipse", name: "Eclipse" }, { id: "party", name: "Party" },
  { id: "update", name: "Update incoming" }, { id: "opening", name: "Opening cinematic" }, { id: "halloween", name: "Halloween cinematic" },
  { id: "levelup:1", name: "Level-up: Cadet" }, { id: "levelup:2", name: "Level-up: Pilot" }, { id: "levelup:3", name: "Level-up: Navigator" },
  { id: "levelup:4", name: "Level-up: Captain" }, { id: "levelup:5", name: "Level-up: Voyager" }, { id: "levelup:6", name: "Level-up: Legend" },
  { id: "levelup:7", name: "Level-up: Nova" }, { id: "levelup:8", name: "Level-up: Quasar" }, { id: "levelup:9", name: "Level-up: Pulsar" }, { id: "levelup:10", name: "Level-up: Singularity" }, { id: "levelup:11", name: "Level-up: Paradox" }, { id: "levelup:12", name: "Level-up: Multiverse" }, { id: "levelup:13", name: "Level-up: Infinity" }, { id: "levelup:14", name: "Level-up: Touch Grass" },
];

const byId = (list) => new Map(list.map((x) => [x.id, x]));
export const effectMap = byId(EFFECTS), tagMap = byId(TAGS), themeMap = byId(THEMES), packMap = byId(PACKS), bgMap = byId(BGS), achMap = byId(ACHIEVEMENTS);
const order = ["common", "rare", "epic", "legendary", "chroma"];

/** Roll a pack. rand() returns [0,1). have = {effects,tags,themes,bgs} arrays. Returns items with a refund for duplicates. */
export function rollPack(pack, have, rand) {
  const items = [], owned = { effect: new Set(have.effects), tag: new Set(have.tags), theme: new Set([...BASE_THEMES, ...have.themes]), bg: new Set(have.bgs ?? []) };
  const lists = { effect: EFFECTS, tag: TAGS, theme: THEMES, bg: BGS };
  const pools = (type) => lists[type].filter((x) => x.rarity !== "limited" && x.rarity !== "secret" && (pack.only ? x.only === pack.only : !x.only));
  /* Chroma is its own tiny roll: a little better in bigger packs, far better in the Chroma Vault */
  const pickRarity = (min = 0) => {
    const w = order.map((r, i) => (i < min ? 0 : r === "chroma" ? RARITY.chroma.weight * (1 + pack.boost * 0.5) * (pack.chromaBoost ?? 1) : RARITY[r].weight * Math.pow(1 + 0.9 * pack.boost, i)));
    let n = rand() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) { n -= w[i]; if (n <= 0) return order[i]; } return "common";
  };
  const pickType = () => {
    if (pack.kind === "theme") return "theme";
    const pool = pack.pool ?? ["effect", "tag", "bg"], r = rand();
    if (pool.length === 1) return pool[0];
    const wt = { effect: 0.45, tag: 0.35, bg: 0.2, theme: pack.only ? 0.12 : 0 }, tot = pool.reduce((a, t) => a + wt[t], 0); let n = r * tot;
    for (const t of pool) { n -= wt[t]; if (n <= 0) return t; } return pool[0];
  };
  const find = (type, rar) => {
    let pool = pools(type).filter((x) => x.rarity === rar);
    if (pack.cat) { const c = pool.filter((x) => x.cat === pack.cat); if (c.length && rand() < 0.8) pool = c; }
    return pool;
  };
  for (let k = 0; k < pack.count; k++) {
    /* the hidden roll: a very small chance that this slot is a Secret */
    if (rand() < SECRET_CHANCE) {
      const secrets = ["effect", "tag", "bg"].flatMap((t) => lists[t].filter((x) => x.rarity === "secret").map((x) => ({ ...x, type: t })));
      if (secrets.length) { const sx = secrets[Math.floor(rand() * secrets.length)], sd = owned[sx.type].has(sx.id); owned[sx.type].add(sx.id); items.push({ type: sx.type, id: sx.id, name: sx.name, rarity: "secret", dupe: sd, refund: sd ? RARITY.secret.dupe : 0 }); continue; }
    }
    const type = pickType();
    const need = pack.guarantee && k === pack.count - 1 && !items.some((i) => order.indexOf(i.rarity) >= order.indexOf(pack.guarantee)) ? order.indexOf(pack.guarantee) : 0;
    let rar = pickRarity(need), pool = find(type, rar), guard = 0;
    while (!pool.length && guard++ < 10) { rar = order[(order.indexOf(rar) + 1) % order.length]; pool = find(type, rar); }
    if (!pool.length) pool = pools(type);
    const it = pool[Math.floor(rand() * pool.length)], dupe = owned[type].has(it.id);
    owned[type].add(it.id);
    items.push({ type, id: it.id, name: it.name, rarity: it.rarity, dupe, refund: dupe ? RARITY[it.rarity].dupe : 0 });
  }
  return items;
}

/** What a pack can contain: per-item chances by rarity (for one item slot, ignoring guarantees) and the items themselves. */
export function packContents(pack) {
  const types = pack.kind === "theme" ? ["theme"] : pack.pool ?? ["effect", "tag", "bg"];
  const lists = { effect: EFFECTS, tag: TAGS, theme: THEMES, bg: BGS };
  const items = types.flatMap((t) => lists[t].filter((x) => x.rarity !== "limited" && x.rarity !== "secret" && (pack.only ? x.only === pack.only : !x.only)).map((x) => ({ ...x, type: t })));
  const w = order.map((r, i) => (r === "chroma" ? RARITY.chroma.weight * (1 + pack.boost * 0.5) * (pack.chromaBoost ?? 1) : RARITY[r].weight * Math.pow(1 + 0.9 * pack.boost, i)));
  const tot = w.reduce((a, b) => a + b, 0), odds = Object.fromEntries(order.map((r, i) => [r, w[i] / tot]));
  const chromaPack = 1 - Math.pow(1 - odds.chroma, pack.count);
  return { items, odds, chromaPack };
}

/* ---------- live event timeline ---------- */
export const PHASE_KINDS = {
  gulper: { name: "Gulper arena", icon: "🐛", arena: true, blurb: "Eat orbs, grow, take down worms" },
  loot: { name: "Loot drop storm", icon: "🎁", arena: true, blurb: "Coins and crates drop all over the map" },
  boss: { name: "Boss worm hunt", icon: "👹", arena: true, blurb: "Everyone hunts a giant worm together" },
  trivia: { name: "Trivia and word games", icon: "❓", arena: false, blurb: "Trivia, scrambles, reaction races and polls inside the event" },
};
export const EVENT_PRESETS = {
  opening: [{ kind: "gulper", mins: 4 }, { kind: "trivia", mins: 3 }, { kind: "loot", mins: 2 }, { kind: "boss", mins: 3 }, { kind: "gulper", mins: 3 }],
  halloween: [{ kind: "gulper", mins: 4 }, { kind: "boss", mins: 3 }, { kind: "trivia", mins: 3 }, { kind: "loot", mins: 2 }, { kind: "gulper", mins: 3 }],
};
export const QUICK_PRESETS = [{ id: "short", name: "Short (10 min)", sched: [{ kind: "gulper", mins: 4 }, { kind: "trivia", mins: 3 }, { kind: "boss", mins: 3 }] }, { id: "long", name: "Long (25 min)", sched: [{ kind: "gulper", mins: 5 }, { kind: "trivia", mins: 4 }, { kind: "loot", mins: 3 }, { kind: "boss", mins: 4 }, { kind: "gulper", mins: 4 }, { kind: "trivia", mins: 3 }, { kind: "loot", mins: 2 }] }, { id: "gulper", name: "Gulper only (15 min)", sched: [{ kind: "gulper", mins: 15 }] }];
export const DUPE_COINS = 2500;
export const DEFAULT_CFG = { bots: 0, loot: "med", boss: "med", loop: false };
/** Clean up a timeline that came from the browser. */
export function cleanSchedule(list) {
  const out = (Array.isArray(list) ? list : []).slice(0, 14).map((p) => ({ kind: String(p?.kind), mins: Math.max(1, Math.min(30, Math.round(Number(p?.mins) || 0))) })).filter((p) => PHASE_KINDS[p.kind]);
  return out;
}
export const scheduleMins = (s) => s.reduce((n, p) => n + p.mins, 0);
