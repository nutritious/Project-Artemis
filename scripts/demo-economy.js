/* Preview-only: fake coins, packs, profile effects, live events and the party engine, so the new features can be tried without a server. */
import { hooks } from "../public/js/util.js";
import { playChroma } from "../public/js/chroma.js";
import { ArenaWorld } from "../public/js/arena-core.js";
import { CAS, flip as cFlip, slots as cSlots, roulette as cRoul, rouletteKindOk, bjDeal, bjHit, bjStand, bjDouble, bjView } from "../public/js/casino-core.js";
import { hasPass, UPGRADES, upgradeMap, upCost, noUps, refundMult, cleanSchedule, DEFAULT_CFG, DUPE_COINS, EVENT_PRESETS, QUICK_PRESETS, PHASE_KINDS, EVENTS, EFFECTS, TAGS, THEMES, BGS, PACKS, GAMES, QUICK_EVENTS, ACHIEVEMENTS, WHEEL, WHEEL_MS, DAILY_CAP, COIN_RATES, packMap, rollPack } from "../public/js/cosmetics.js";

const TQ = [["Which planet is known as the Red Planet?", "Mars", "Venus", "Jupiter", "Mercury"], ["What is NASA's program to return humans to the Moon called?", "Artemis", "Apollo", "Gemini", "Voyager"], ["What does \"GG\" mean in gaming?", "Good game", "Get going", "Great goal", "Go go"], ["Which planet is famous for its rings?", "Saturn", "Mars", "Earth", "Mercury"], ["In Minecraft, which block builds a Nether portal frame?", "Obsidian", "Bedrock", "Diamond", "Netherrack"], ["Not even what can escape a black hole?", "Light", "Sound", "Heat", "Radio waves"], ["What was the first dog in orbit called?", "Laika", "Belka", "Strelka", "Lassie"], ["Which planet spins on its side?", "Uranus", "Neptune", "Saturn", "Venus"], ["In Mario Kart, which item hits the player in first place?", "Blue shell", "Red shell", "Banana", "Bullet Bill"], ["About how long does sunlight take to reach Earth?", "8 minutes", "8 seconds", "8 hours", "8 days"]];
const WORDS = [["ASTEROID", "Space rock"], ["NEBULA", "Cloud where stars are born"], ["ORION", "The Artemis spacecraft"], ["ECLIPSE", "Sun, Moon and Earth line up"], ["COMET", "Icy tail"], ["GRAVITY", "What keeps you down"]];
const POLLS = [["Pizza", "Tacos"], ["Day", "Night"], ["Moon base", "Mars colony"], ["Xbox", "PlayStation"], ["Cats", "Dogs"], ["Play solo", "Play with friends"]];
const rint = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = rint(0, i); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const pickN = (n) => rint(0, n - 1);
const pick = (a) => a[pickN(a.length)];
let chatterT = 0;

export function installEconomy(C) {
  const { me, users, push, G, pubGame, boards, gprogress, RANKS, demoErr, X, uid, D } = C;
  Object.assign(me, { coins: 600, freePacks: 2, bests: me.bests ?? {}, inv: me.inv ?? { effects: [], tags: [], themes: [], bgs: [] }, equip: me.equip ?? { effect: "", tag: "", bg: "" } });
  me.inv.bgs ??= []; me.equip.bg ??= "";
  const bots = {}, now = Date.now();
  [["Nova", "aurora", "moonwalker", 1280, 420], ["Pixel", "glitch", "", 640, 180], ["Comet", "comet", "void-runner", 2210, 860], ["Lunar", "", "stargazer", 150, 40], ["Zed", "supernova", "eclipse-chaser", 3400, 1500], ["Mika", "stardust", "", 460, 120]].forEach(([name, fxId, tag, xp, coins], i) => {
    const id = "b-" + name.toLowerCase();
    users.push({ id, username: name, role: "member", profile: { status: ["Grinding the arcade", "", "gg", "brb", "Trivia champ", ""][i], presence: "online", avatar: "" }, createdAt: now - (i + 2) * 864e5, lastSeen: now - i * 6e4, banned: false, requests: 20, bytes: 1e5 });
    bots[id] = { id, username: name, xp, coins, freePacks: 0, bests: { run: xp * 2, blaster: xp, lander: Math.round(xp / 2), memory: Math.round(xp / 3), snake: Math.round(xp / 4) }, inv: { effects: fxId ? [fxId] : [], tags: tag ? [tag] : [], themes: [] }, equip: { effect: fxId, tag }, plays: Math.round(xp / 20), streak: i + 1 };
  });
  Object.values(bots).forEach((b) => { b.inv.bgs ??= []; b.equip ??= { effect: b.inv.effects[0] ?? "", tag: b.inv.tags[0] ?? "" }; b.equip.bg ??= ""; });
  [["b-nova", "aurora-sky"], ["b-zed", "galaxy"], ["b-comet", "spectrum"], ["b-pixel", "pixel-grid"]].forEach(([id, bg]) => { bots[id].inv.bgs.push(bg); bots[id].equip.bg = bg; });
  X.ex = (u) => (u.id === me.id ? me : bots[u.id] ?? null);
  const ids = () => [me.id, ...Object.keys(bots)];
  const byId = (id) => (id === me.id ? me : bots[id]);
  const nameOf = (id) => (id === me.id ? me.username : bots[id]?.username ?? "?");
  const CT = []; let boosts = [];
  const codeItem = (i) => { const l = i.type === "effect" ? EFFECTS : i.type === "tag" ? allTags() : i.type === "theme" ? THEMES : BGS, f = l.find((x) => x.id === i.id); return { type: i.type, id: i.id, name: f?.name ?? i.id, rarity: f?.rarity ?? "common" }; };
  const codeView = (c) => ({ code: c.code, coins: c.coins, crates: c.crates, items: c.items.map(codeItem), maxUses: c.maxUses, used: Object.keys(c.uses).length, expiresAt: c.expiresAt, note: c.note, by: c.by, createdAt: c.createdAt, disabled: !!c.disabled });
  const CODES = [{ code: "WELCOME", coins: 150, crates: 1, items: [{ type: "bg", id: "galaxy" }], maxUses: 0, uses: {}, expiresAt: 0, note: "Preview sample code. Try it!", by: "Warmaster", createdAt: Date.now() - 36e5 }, { code: "COINS500", coins: 500, crates: 0, items: [], maxUses: 0, uses: {}, expiresAt: 0, note: "", by: "Warmaster", createdAt: Date.now() - 72e5 }];
  const allTags = () => [...TAGS, ...CT];
  const gp = () => push({ t: "game", game: pubGame(), gains: [], rankUp: null });
  const giveMe = (n, why) => { me.coins += n; gp(); return n; };

  /* ---------- earning cap, achievements, wheel, chroma ---------- */
  X.earn = (n) => { const got = Math.max(0, Math.min(Math.floor(n), DAILY_CAP - G.earned)); me.coins += got; G.earned += got; G.stats.earned = (G.stats.earned ?? 0) + got; return got; };
  const statVal = (k) => (k === "rank" ? RANKS.reduce((r, x, i) => (G.xp >= x.xp ? i : r), 0) : k === "items" ? me.inv.effects.length + me.inv.tags.length + me.inv.themes.length + me.inv.bgs.length : k === "plays" ? G.plays : G.stats[k] ?? 0);
  const checkAch = () => { let any = false; for (const a of ACHIEVEMENTS) { if (G.ach[a.id] || statVal(a.stat) < a.goal) continue; G.ach[a.id] = Date.now(); me.coins += a.coins; any = true; push({ t: "ach", id: a.id, name: a.name, coins: a.coins, icon: a.icon }); } if (any) gp(); };
  const bump = (k, n = 1) => { G.stats[k] = (G.stats[k] ?? 0) + n; checkAch(); };
  const last = {};
  X.activity = (kind) => { const key = { chat: "msgs", search: "searches", browse: "pages" }[kind], r = COIN_RATES[kind], t = Date.now(); let got = 0; if (t - (last[kind] ?? 0) >= r.gap) { last[kind] = t; got = X.earn(r.coins); } G.stats[key] = (G.stats[key] ?? 0) + 1; checkAch(); if (got) gp(); };
  const announceChroma = (items) => items.filter((i) => i.rarity === "chroma").forEach((i) => push({ t: "chroma", user: me.username, item: { type: i.type, id: i.id, name: i.name } }));

  /* ---------- trust, launch window, chatbot ---------- */
  const NEED = { msgs: 300, banFreeDays: 14, proxyHours: 3, ageDays: 10 }, SRV = { launchAt: 0, bot: { enabled: false, action: "ban", strikes: 3, words: [], log: [], strikesBy: 0 } };
  const rot = (s) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
  const SEV = ["phag", "avtt", "sntt", "ergneq", "xvyy lbhefrys"].map(rot), MILDW = ["shpx", "fuvg", "ovgpu", "nffubyr", "qvpxurnq"].map(rot);
  const leet = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s", "!": "i" };
  const norm = (t) => t.toLowerCase().replace(/[01345 7@$!]/g, (c) => leet[c] ?? c).replace(/\b(?:[a-z][\s.\-_*]+){2,}[a-z]\b/g, (m) => m.replace(/[^a-z]/g, "")).replace(/[^a-z\s]/g, "").replace(/(.)\1{2,}/g, "$1$1");
  const hit = (t, list, deep) => { const n = norm(t), sq = n.replace(/\s+/g, ""); return list.find((w) => w && (w.includes(" ") ? n.includes(w) : new RegExp("(^|\\s)" + w).test(n) || (deep && w.length >= 4 && sq.includes(w)))); };
  const staffRole = () => ["owner", "coowner", "admin"].includes(me.role) || !!me.roleId;
  const stat = (name, msgs, hrs) => ({ username: name, msgs, proxyHours: hrs, banFreeDays: null });
  const info = (s) => { const met = { msgs: s.msgs >= NEED.msgs, ban: s.banFreeDays == null || s.banFreeDays >= NEED.banFreeDays, proxy: s.proxyHours >= NEED.proxyHours, age: s.ageDays >= NEED.ageDays }, earned = met.msgs && met.ban && met.proxy && met.age, staff = !!s.staff; return { ...s, staff, met, earned, manual: s.trust ?? null, trusted: staff || s.trust === "grant" || (s.trust !== "revoke" && earned), need: NEED }; };
  const myStat = () => ({ username: me.username, msgs: G.stats.msgs ?? 0, proxyHours: Math.round(((G.stats.proxyMin ?? 0) / 60) * 10) / 10, banFreeDays: null, ageDays: Math.floor((Date.now() - (me.createdAt ?? Date.now())) / 864e5), staff: staffRole(), trust: me.trust });
  X.trust = () => info(myStat());
  X.isTrusted = (u) => { if (!u || u.id === me.id) return info(myStat()).trusted; const b = bots[u.id]; return b ? info({ ...b.trustStat, trust: b.trust }).trusted : false; };
  Object.entries({ "b-nova": [340, 6.5, 12], "b-zed": [520, 12, 20], "b-comet": [310, 4.1, 11], "b-pixel": [120, 1.2, 4], "b-lunar": [30, 0.4, 3], "b-mika": [80, 0.9, 5] }).forEach(([id, [m, h, a]]) => { if (bots[id]) bots[id].trustStat = { username: bots[id].username, msgs: m, proxyHours: h, ageDays: a, banFreeDays: null }; });
  const wasT = { v: undefined };
  X.recheck = () => { const t = X.isTrusted(me); if (wasT.v !== undefined && wasT.v !== t) { push({ t: "channels", channels: C.visCh?.() }); push({ t: "self", ...C.selfMsg() }); push({ t: "trusted", trusted: t }); push({ t: "members", members: C.members() }); } wasT.v = t; };
  X.proxyTick = () => { G.stats.proxyMin = (G.stats.proxyMin ?? 0) + 30; };  /* preview speed-up: every page counts as 30 minutes on the proxy */
  X.onRegister = () => { if (SRV.launchAt && Date.now() < SRV.launchAt + 864e5) { me.inv.tags.includes("og") || me.inv.tags.push("og"); me.equip.tag = "og"; } };
  X.gate = (text, channel) => {
    if (/https?:\/\/\S*(\.gif(\?\S*)?(\s|$)|giphy\.com|tenor\.com)/i.test(text) && !X.isTrusted(me)) return { error: "GIFs are for trusted members only. Check your progress in the Hub." };
    const b = SRV.bot; if (!b.enabled || ["owner", "coowner", "admin"].includes(me.role)) return null;
    const sev = hit(text, [...SEV, ...b.words.map((w) => w.toLowerCase())], true), mild = !sev && hit(text, MILDW, false); if (!sev && !mild) return null;
    b.strikesBy += sev ? b.strikes : 1; const say = (t) => ({ id: uid(), channel, userId: "bot", username: "ArtemisBot", text: t, ts: Date.now() });
    if (b.action === "ban" && b.strikesBy >= b.strikes) { b.strikesBy = 0; b.log.unshift({ ts: Date.now(), user: me.username, action: "banned", why: sev ? "severe language" : "language strikes" }); return { reply: say(me.username + " was banned for inappropriate language. (Preview: the ban lifts so you can keep testing.)"), error: "You were banned for inappropriate language." }; }
    b.log.unshift({ ts: Date.now(), user: me.username, action: "warned", why: sev ? "severe language" : "language" }); return { reply: say(me.username + ", keep it clean. Strike " + Math.min(b.strikesBy, b.strikes) + " of " + b.strikes + "."), error: "Message blocked: keep it clean." };
  };

  /* ---------- live event + party ---------- */
  let EV = null, rush = null, auto = false, round = null, step = 0, autoT = 0, FX = {};
  const MILES = [[300, 25], [1000, 60], [2500, 120], [5000, 250]];
  const addPts = (id, n) => { if (!EV || !(n > 0)) return; const was = EV.points[id] ?? 0, nw = was + Math.floor(n); EV.points[id] = nw; { const pp = ((EV.phasePts ??= {})[EV.phase ?? 0] ??= {}); pp[id] = (pp[id] ?? 0) + Math.floor(n); } if (id === me.id) for (const [at, c] of MILES) if (was < at && nw >= at) { me.coins += c; push({ t: "fx", kind: "milestone", pts: at, coins: c }); gp(); } };
  const pubRound = () => !round ? null : { id: round.id, kind: round.kind, title: round.title, prompt: round.prompt, options: round.options, len: round.word?.length, startedAt: round.startedAt, endsAt: round.endsAt, go: round.go, answered: !!round.answers[me.id], pts: round.answers[me.id]?.pts ?? 0, ok: round.answers[me.id]?.ok };
  const rushNow = () => (rush && rush.until > Date.now() ? rush : null);
  const pubEv = () => {
    if (!EV) return null; const d = EVENTS[EV.kind];
    const top = Object.entries(EV.points).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, points]) => ({ username: nameOf(id), points }));
    const sc = EV.schedule?.[EV.phase ?? 0], pt = Object.entries(EV.phasePts?.[EV.phase ?? 0] ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, points]) => ({ username: nameOf(id), points }));
    const phase = sc ? { idx: EV.phase, of: EV.schedule.length, kind: sc.kind, mins: sc.mins, startsAt: EV.phaseStart, endsAt: EV.phaseEnd, next: EV.schedule[EV.phase + 1]?.kind ?? (EV.loop ? EV.schedule[0].kind : null), schedule: EV.schedule, loop: !!EV.loop, cfg: EV.cfg, top: pt, mine: EV.phasePts?.[EV.phase ?? 0]?.[me.id] ?? 0 } : null;
    return { phase, id: EV.id, kind: EV.kind, name: d.name, color: d.color, blurb: d.blurb, startedAt: EV.startedAt, by: EV.by, games: GAMES.map((g) => g.id), joined: me.id in EV.points, mine: EV.points[me.id] ?? 0, count: Object.keys(EV.points).length, top, rush: rushNow(), round: pubRound(), auto };
  };
  const pushEv = () => push({ t: "liveevent", event: pubEv() });
  let CD = null; X.init = () => ({ customTags: CT, event: pubEv(), boosts, build: "demo", countdown: CD });

  /* the arena world: the very same rules file the real server runs. Other players are bots in the preview. */
  const world = new ArenaWorld({
    send: (id, m) => { if (id === me.id) push({ t: "arena", ...m }); }, award: (id, pts) => { if (id === me.id) addPts(me.id, pts); },
    coins: (id, n) => { if (id === me.id) { me.coins += n; gp(); } }, crate: (id) => { if (id === me.id) { me.freePacks++; gp(); } },
    name: (id) => (id === me.id ? me.username : nameOf(id)), feed: (text) => push({ t: "arena", a: "feed", text }),
  });
  X.arena = (m) => { if (!EV) return; if (m.a === "join") world.join(me.id); else if (m.a === "leave") world.leave(me.id); else world.msg(me.id, m); };
  let arenaT = 0, phaseT = 0, botScoreT = 0;
  const applyPhase = () => { const k = EV.schedule[EV.phase].kind; world.setMode(PHASE_KINDS[k]?.arena ? k : "none", EV.cfg); const was = auto; auto = k === "trivia"; clearTimeout(autoT); if (auto && !round) autoT = setTimeout(runNext, 2500); void was; };
  const announcePhase = (i) => { const k = EV.schedule[i].kind, d = PHASE_KINDS[k]; push({ t: "phase", kind: k, name: d.name, icon: d.icon, blurb: d.blurb, mins: EV.schedule[i].mins }); };
  const beginPhase = (i, when = Date.now()) => { if (!EV) return; EV.began = true; EV.phase = i; EV.phaseStart = when; EV.phaseEnd = when + EV.schedule[i].mins * 6e4; applyPhase(); armPhase(); pushEv(); announcePhase(i); };
  const armPhase = () => { clearTimeout(phaseT); if (EV) phaseT = setTimeout(nextPhase, Math.max(500, EV.phaseEnd - Date.now())); };
  const nextPhase = () => { if (!EV) return; const i = EV.phase + 1; if (i >= EV.schedule.length) { if (EV.loop) return beginPhase(0); endEvent(); return; } beginPhase(i); };
  const startDirector = () => { world.setMode("none"); clearInterval(arenaT); arenaT = setInterval(() => { if (EV) world.tick(0.05); }, 50);
    clearInterval(botScoreT); botScoreT = setInterval(() => { if (EV?.schedule && Date.now() > EV.phaseStart) for (const b of Object.keys(bots)) if (Math.random() < 0.5) addPts(b, rint(1, 9)); pushEv(); }, 2500);
    const eid = EV.id; setTimeout(() => { if (EV && EV.id === eid && !EV.began) { applyPhase(); pushEv(); announcePhase(EV.phase); } }, Math.max(0, EV.phaseStart - Date.now())); armPhase(); };
  const stopDirector = () => { clearTimeout(phaseT); clearInterval(arenaT); clearInterval(botScoreT); world.setMode("none"); };

  function startRound(kind) {
    if (!EV) throw demoErr("No event is running"); if (round) throw demoErr("A round is already running");
    const t = Date.now(), titles = { trivia: "Trivia", scramble: "Word scramble", reaction: "Reaction race", poll: "This or that" };
    const r = round = { id: uid(), kind, title: titles[kind], prompt: "", startedAt: t, endsAt: t + (kind === "trivia" ? 15000 : kind === "scramble" ? 30000 : kind === "poll" ? 20000 : 0), answers: {}, go: false };
    if (kind === "trivia") { const [q, ok, ...bad] = TQ[pickN(TQ.length)]; r.prompt = q; r.options = shuffle([ok, ...bad]); r.correct = r.options.indexOf(ok); }
    if (kind === "scramble") { const [w, h] = WORDS[pickN(WORDS.length)]; r.word = w; r.prompt = shuffle([...w]).join(""); if (r.prompt === w) r.prompt = [...w].reverse().join(""); r.options = [h]; }
    if (kind === "poll") { const [a, b] = POLLS[pickN(POLLS.length)]; r.prompt = "Which would you pick?"; r.options = [a, b]; }
    if (kind === "reaction") { r.goAt = t + rint(2500, 5500); r.endsAt = r.goAt + 4000; setTimeout(() => { if (round === r) { r.go = true; r.goAt = Date.now(); push({ t: "roundgo", id: r.id }); } }, r.goAt - t); }
    push({ t: "round", round: pubRound() });
    Object.keys(bots).forEach((bid) => { if (Math.random() < 0.75) setTimeout(() => { if (round !== r || r.answers[bid]) return; const dur = r.endsAt - r.startedAt, el = Date.now() - r.startedAt;
      if (kind === "trivia") { const ok = Math.random() < 0.6, pts = ok ? 100 + Math.round(100 * (r.endsAt - Date.now()) / dur) : 0; r.answers[bid] = { ok, pts, t: Date.now() }; addPts(bid, pts); }
      else if (kind === "scramble") { const rank = Object.values(r.answers).filter((a) => a.ok).length, pts = Math.max(50, 200 - 25 * rank); r.answers[bid] = { ok: true, pts, t: Date.now() }; addPts(bid, pts); }
      else if (kind === "poll") { r.answers[bid] = { ok: true, v: rint(0, 1), pts: 25, t: Date.now() }; addPts(bid, 25); }
      else if (kind === "reaction") { r.answers[bid] = { ok: true, ms: rint(190, 520), pts: 0, t: Date.now() }; } }, kind === "reaction" ? (r.goAt - t) + rint(250, 600) : rint(1500, Math.max(2500, (r.endsAt - t) * 0.7))); });
    r.timer = setTimeout(() => endRound(r), r.endsAt - t + 80);
  }
  function endRound(r) {
    if (round !== r) return; clearTimeout(r.timer); round = null;
    let board = [], answer = "", counts, coins = {};
    const ok = Object.entries(r.answers).filter(([, a]) => a.ok);
    if (r.kind === "trivia") { answer = r.options[r.correct]; board = ok.sort((a, b) => a[1].t - b[1].t).slice(0, 5).map(([id, a]) => ({ username: nameOf(id), pts: a.pts })); ok.forEach(([id]) => (coins[id] = 5)); }
    if (r.kind === "scramble") { answer = r.word; board = ok.sort((a, b) => a[1].t - b[1].t).slice(0, 5).map(([id, a]) => ({ username: nameOf(id), pts: a.pts })); }
    if (r.kind === "reaction") { const f = ok.filter(([, a]) => a.ms != null).sort((a, b) => a[1].ms - b[1].ms); f.forEach(([id, a], i) => { a.pts = [200, 150, 100, 75, 50][i] ?? 25; addPts(id, a.pts); }); board = f.slice(0, 5).map(([id, a]) => ({ username: nameOf(id), pts: a.pts, note: a.ms + " ms" })); answer = f[0] ? `${nameOf(f[0][0])} · ${f[0][1].ms} ms` : "Nobody tapped in time"; }
    if (r.kind === "poll") { counts = [0, 0]; Object.values(r.answers).forEach((a) => counts[a.v === 1 ? 1 : 0]++); answer = counts[0] === counts[1] ? "It's a tie!" : `${r.options[counts[0] > counts[1] ? 0 : 1]} wins`; }
    if (r.kind !== "poll") board.slice(0, 3).forEach((b, i) => { const id = ids().find((x) => nameOf(x) === b.username); if (id) coins[id] = (coins[id] ?? 0) + [30, 20, 10][i]; });
    for (const [id, c] of Object.entries(coins)) { const e = byId(id); if (e) e.coins += c; }
    const a = r.answers[me.id], place = board.findIndex((b) => b.username === me.username);
    push({ t: "roundend", id: r.id, kind: r.kind, title: r.title, answer, board, counts, options: r.kind === "poll" ? r.options : undefined, mine: { answered: !!a, ok: !!a?.ok, pts: a?.pts ?? 0, place: place < 0 ? 0 : place + 1, coins: coins[me.id] ?? 0, vote: a?.v } });
    gp(); pushEv(); if (auto) autoT = setTimeout(runNext, 9000);
  }
  const PLAY = ["trivia", "trivia", "scramble", "reaction", "poll", "rush", "trivia", "trivia", "meteors", "scramble", "reaction", "poll", "luckyfive", "trivia"];
  function runNext() { if (!auto || !EV) return; if (round) return void (autoT = setTimeout(runNext, 3000)); const k = PLAY[step++ % PLAY.length];
    if (k === "rush") { const g = GAMES[rint(0, 3)].id; rush = { game: g, until: Date.now() + 18e4 }; push({ t: "fx", kind: "rush", game: g, ms: 18e4 }); pushEv(); autoT = setTimeout(runNext, 5000); return; }
    if (["meteors", "luckyfive"].includes(k)) { quick(k); autoT = setTimeout(runNext, 12000); return; }
    startRound(k); }
  function endEvent() {
    const d = EVENTS[EV.kind], ranked = Object.entries(EV.points).sort((a, b) => b[1] - a[1]); let n = 0;
    ranked.forEach(([id, points], pl) => { const e = byId(id); if (!e) return; n++; const had = e.inv.tags.includes(d.tag) && e.inv.effects.includes(d.effect); if (!e.inv.tags.includes(d.tag)) e.inv.tags.push(d.tag); if (!e.inv.effects.includes(d.effect)) e.inv.effects.push(d.effect);
      const coins = 100 + Math.min(300, Math.floor(points / 4)) + (pl === 0 ? 400 : pl === 1 ? 250 : pl === 2 ? 150 : 0), crates = 1 + (pl === 0 ? 2 : pl < 3 ? 1 : 0); const dupe = had ? DUPE_COINS : 0; e.coins += coins + dupe; e.freePacks += crates;
      if (id === me.id) push({ t: "eventend", name: d.name, color: d.color, tag: d.tag, effect: d.effect, coins: coins + dupe, dupe, crates, place: pl + 1, points, of: ranked.length }); });
    stopDirector(); clearTimeout(autoT); if (round) { clearTimeout(round.timer); round = null; } auto = false; EV = null; rush = null; step = 0; push({ t: "roundstop" }); push({ t: "liveevent", event: null }); gp(); push({ t: "members", members: C.members() }); return n;
  }
  function quick(kind) {
    const on = ids(); let note = "";
    switch (kind) {
      case "coinrain": on.forEach((id) => (byId(id).coins += rint(20, 80))); push({ t: "fx", kind }); break;
      case "meteors": { const list = Array.from({ length: 24 }, () => ({ id: uid(), at: Math.random() * 28, x: 0.05 + Math.random() * 0.9, coins: rint(5, 15) })).sort((a, b) => a.at - b.at); list.forEach((m) => (FX[m.id] = { coins: m.coins, until: Date.now() + 5e4 })); push({ t: "fx", kind, meteors: list }); break; }
      case "doublexp": case "doublecoins": { const k = kind === "doublexp" ? "xp" : "coins"; boosts = [...boosts.filter((b) => b.kind !== k), { kind: k, until: Date.now() + 15 * 6e4 }]; push({ t: "boost", boosts }); break; }
      case "packdrop": on.forEach((id) => byId(id).freePacks++); push({ t: "fx", kind }); break;
      case "jackpot": { const w = on[rint(0, on.length - 1)]; byId(w).coins += 500; push({ t: "fx", kind, winner: nameOf(w), coins: 500 }); note = nameOf(w); break; }
      case "treasure": { const id = uid(); FX[id] = { coins: 250, until: Date.now() + 3e4, single: true }; push({ t: "fx", kind, id, x: 0.1 + Math.random() * 0.8, y: 0.15 + Math.random() * 0.7, ms: 3e4 }); break; }
      case "xpgift": G.xp += 100; push({ t: "fx", kind }); push({ t: "game", game: pubGame(), gains: [{ text: "XP gift", xp: 100 }], rankUp: null }); break;
      case "zerog": push({ t: "fx", kind, ms: 2e4 }); break;
      case "luckyfive": { const w = shuffle(on).slice(0, 5); w.forEach((id) => (byId(id).coins += 150)); push({ t: "fx", kind, winners: w.map(nameOf), coins: 150 }); note = w.map(nameOf).join(", "); break; }
      case "mysterybox": { const c = rint(10, 200); me.coins += c; push({ t: "fx", kind, coins: c }); break; }
      case "cosmeticdrop": { const it = rollPack({ ...packMap.get("crate"), count: 1 }, me.inv, Math.random)[0]; if (it.dupe) me.coins += it.refund; else me.inv[({ tag: "tags", effect: "effects", theme: "themes", bg: "bgs" })[it.type]].push(it.id); push({ t: "fx", kind, item: it }); break; }
      case "rushall": if (!EV) throw demoErr("Start a live event first"); rush = { game: "", until: Date.now() + 18e4 }; push({ t: "fx", kind: "rush", game: "", ms: 18e4 }); pushEv(); break;
      case "confetti": push({ t: "fx", kind }); break;
      default: throw demoErr("Unknown event");
    }
    gp(); return note;
  }

  /* ---------- helpers ---------- */
  const UP = noUps(); const shop = () => ({ up: UP, nextSpin: G.lastSpin + WHEEL_MS, coins: me.coins, freePacks: me.freePacks, inv: me.inv, equip: me.equip, packs: PACKS, customTags: CT });
  const rows = () => [me, ...Object.values(bots)].map((e) => ({ id: e.id, username: e.username, role: e.id === me.id ? me.role : "member", roleId: null, xp: e.id === me.id ? G.xp : e.xp, rank: RANKS.reduce((r, k, i) => ((e.id === me.id ? G.xp : e.xp) >= k.xp ? i : r), 0), streak: e.streak ?? G.streak, best: e.bests?.run ?? 0, fx: e.equip.effect, tag: e.equip.tag }));
  const gameBoards = () => { const r = rows(), arcade = {}; for (const g of GAMES) arcade[g.id] = [me, ...Object.values(bots)].filter((e) => (e.bests?.[g.id] ?? 0) > 0).sort((a, b) => b.bests[g.id] - a.bests[g.id]).map((e) => ({ ...r.find((x) => x.id === e.id), best: e.bests[g.id] })); return { ranks: RANKS, xp: r.filter((x) => x.xp > 0).sort((a, b) => b.xp - a.xp), arcade }; };
  const gamePayload = () => ({ game: pubGame(), ...gameBoards(), event: pubEv(), boosts });
  const targets = (t) => { const all = [me, ...Object.values(bots)]; if (t?.type === "user") return all.filter((e) => e.id === t.value); if (t?.type === "role") return t.value === "member" ? all.filter((e) => e.id !== me.id) : []; return all; };
  const staff = () => me.role === "owner" || me.role === "coowner" || C.myPerms().includes("use_owner_panel");
  const need = () => { if (!staff()) throw demoErr("Owner and co-owners only", 403); };
  const addItem = (e, type, id) => { const l = e.inv[({ tag: "tags", effect: "effects", theme: "themes", bg: "bgs" })[type]]; if (l.includes(id)) return false; l.push(id); return true; };
  const baseApi = hooks.api;
  window.__demo = { cutscene: (type = "tag", id = "spectrum", name = "Spectrum Walker") => playChroma({ name, type, id }), coins: (n) => { me.coins = n; gp(); }, chroma: () => announceChroma([{ type: "tag", id: "spectrum", name: "Spectrum Walker", rarity: "chroma" }].map((i) => ({ ...i }))), spinReady: () => { G.lastSpin = 0; gp(); }, cap: () => { G.earned = 480; gp(); }, legend: () => push({ t: "legend", user: { id: "b-zed", username: "Zed" }, ts: Date.now() }) }; /* handy for trying the Legend announcement in the preview */

  hooks.api = async (path, method = "GET", body = {}) => {
    const [p] = path.split("?"), m = (re) => p.match(re);
    if (p === "/shop") return shop();
    if (p === "/shop/open") {
      const pack = packMap.get(body.pack); if (!pack) throw demoErr("No such pack");
      const n = Math.floor(body.count) || 1; if (n < 1 || n > 5 || (n > 1 && (!hasPass(UP, "bulk") || body.free))) throw demoErr("You need the Open ×5 pass for that");
      if (body.free) { if (pack.id !== "crate" || me.freePacks < 1) throw demoErr("No free crates left"); me.freePacks--; } else { if (me.coins < pack.cost * n) throw demoErr("Not enough coins"); me.coins -= pack.cost * n; }
      const rolled = { ...pack, count: pack.count + (hasPass(UP, "slot") ? 1 : 0) }, items = []; let cashback = 0, doubles = 0;
      const take = (list, bonus) => { for (const it of list) { if (it.dupe) { if (it.rarity !== "chroma" && !["secret","forbidden","omega"].includes(it.rarity)) it.refund = Math.round(it.refund * refundMult(UP.refund)); me.coins += it.refund; } else addItem(me, it.type, it.id); if (bonus) it.bonus = true; items.push(it); } };
      for (let k = 0; k < n; k++) { take(rollPack(rolled, me.inv, Math.random, UP.luck), false); if (!body.free && Math.random() < UP.cash * 0.01) { me.coins += pack.cost; cashback += pack.cost; } if (!body.free && Math.random() < UP.dbl * 0.01) { take(rollPack(rolled, me.inv, Math.random, UP.luck), true); doubles++; } }
      bump("packs", n); announceChroma(items); bump("chroma", items.filter((i) => i.rarity === "chroma").length); gp(); return { items, coins: me.coins, freePacks: me.freePacks, inv: me.inv, cashback, doubles, up: UP };
    }
    if (p === "/shop/upgrade") {
      const def = upgradeMap.get(body.id); if (!def) throw demoErr("No such upgrade");
      if (def.kind === "pass") { if (UP.pass.includes(def.id)) throw demoErr("You already own that"); if (me.coins < def.cost) throw demoErr("Not enough coins"); me.coins -= def.cost; UP.pass.push(def.id); }
      else { const l = UP[def.id]; if (def.max && l >= def.max) throw demoErr("That one is maxed out"); const c = upCost(def, l); if (me.coins < c) throw demoErr("Not enough coins"); me.coins -= c; UP[def.id] = l + 1; }
      gp(); return shop();
    }
    if (p === "/shop/pass") { const def = upgradeMap.get(body.id); if (!def || def.kind !== "pass" || !UP.pass.includes(def.id)) throw demoErr("You do not own that pass"); UP.off = (UP.off ?? []).filter((x) => x !== def.id); if (!body.on) UP.off.push(def.id); gp(); return shop(); }
    if (p === "/shop/gift") {
      const def = upgradeMap.get(body.id); if (!def || def.kind !== "pass") throw demoErr("Only one-time passes can be gifted");
      const to = String(body.to ?? "").trim(); const bot = Object.values(bots).find((b) => b.username.toLowerCase() === to.toLowerCase()); if (!bot) throw demoErr("No one here has that username");
      if (me.coins < def.cost) throw demoErr("Not enough coins"); me.coins -= def.cost; gp(); return { ...shop(), to: bot.username };
    }
    if (p === "/equip" && method === "PUT") {
      if ("effect" in body) { const v = String(body.effect ?? ""); if (v && !me.inv.effects.includes(v)) throw demoErr("You don't own that effect"); me.equip.effect = v; }
      if ("tag" in body) { const v = String(body.tag ?? ""); if (v && !me.inv.tags.includes(v)) throw demoErr("You don't own that title"); me.equip.tag = v; }
      if ("bg" in body) { const v = String(body.bg ?? ""); if (v && !me.inv.bgs.includes(v)) throw demoErr("You don't own that background"); me.equip.bg = v; }
      push({ t: "members", members: C.members() }); return shop();
    }
    if (p === "/redeem") {
      const code = String(body.code ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, ""), c = CODES.find((x) => x.code === code);
      if (!c || c.disabled) throw demoErr("That code is not valid"); if (c.expiresAt && c.expiresAt < Date.now()) throw demoErr("That code has expired");
      if (c.uses[me.id]) throw demoErr("You already used that code"); if (c.maxUses && Object.keys(c.uses).length >= c.maxUses) throw demoErr("That code has been used up");
      c.uses[me.id] = Date.now();
      const got = c.items.map((i) => ({ ...codeItem(i), isNew: addItem(me, i.type, i.id) })); me.freePacks += c.crates; me.coins += c.coins; announceChroma(got.filter((i) => i.isNew)); gp();
      return { code: c.code, note: c.note, coins: c.coins, crates: c.crates, items: got, balance: me.coins, freePacks: me.freePacks };
    }
    if (p === "/owner/codes" && method === "GET") { need(); return { codes: CODES.map(codeView) }; }
    if (p === "/owner/codes" && method === "POST") {
      need(); let code = String(body.code ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, ""); if (!code) code = Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[rint(0, 31)]).join("");
      if (CODES.some((x) => x.code === code)) throw demoErr("That code already exists"); const coins = Math.max(0, Math.round(+body.coins || 0)), crates = Math.max(0, Math.round(+body.crates || 0)), items = body.items ?? [];
      if (!coins && !crates && !items.length) throw demoErr("Add at least one reward: coins, crates or an item"); const h = +body.hours || 0;
      CODES.unshift({ code, coins, crates, items, maxUses: Math.max(0, Math.round(+body.maxUses || 0)), uses: {}, expiresAt: h ? Date.now() + h * 36e5 : 0, note: String(body.note ?? "").slice(0, 80), by: me.username, createdAt: Date.now() }); return { ok: true, code };
    }
    if (m(/^\/owner\/codes\/(.+)$/)) { need(); const code = decodeURIComponent(m(/^\/owner\/codes\/(.+)$/)[1]), i = CODES.findIndex((x) => x.code === code); if (i < 0) throw demoErr("No such code", 404); if (method === "DELETE") CODES.splice(i, 1); else CODES[i].disabled = !CODES[i].disabled; return { ok: true }; }
    if (p === "/trust") return X.trust();
    if (p === "/owner/safety") {
      need(); const rows = [{ id: me.id, ...myStat() }, ...Object.values(bots).map((b) => ({ id: b.id, ...b.trustStat, trust: b.trust }))].map((s) => ({ id: s.id, username: s.username, role: s.id === me.id ? me.role : "member", roleId: null, ...info(s) }));
      return { launchAt: SRV.launchAt, rules: NEED, bot: { enabled: SRV.bot.enabled, action: SRV.bot.action, strikes: SRV.bot.strikes, words: SRV.bot.words, log: SRV.bot.log }, users: rows };
    }
    if (p === "/owner/launch") { need(); SRV.launchAt = body.action === "stop" ? 0 : Date.now(); return { ok: true, launchAt: SRV.launchAt }; }
    if (p === "/owner/bot" && method === "PUT") { need(); const b = SRV.bot; if ("enabled" in body) b.enabled = !!body.enabled; if (body.action === "ban" || body.action === "warn") b.action = body.action; if ("strikes" in body) b.strikes = Math.max(1, Math.min(10, Math.round(Number(body.strikes)) || 3)); if (Array.isArray(body.words)) b.words = [...new Set(body.words.map((w) => String(w).trim().toLowerCase()).filter(Boolean))]; return { ok: true }; }
    if (p === "/owner/trust") { need(); const t = body.id === me.id ? me : bots[body.id]; if (!t) throw demoErr("No such player", 404); if (body.mode === "grant") t.trust = "grant"; else if (body.mode === "revoke") t.trust = "revoke"; else delete t.trust; X.recheck(); push({ t: "members", members: C.members() }); return { ok: true }; }
    if (p === "/casino" || /^\/casino\/\w+$/.test(p)) {
      const C = (me.casino ??= { net: 0, bj: null }), rnd = Math.random, out = (o) => ({ ...o, coins: me.coins });
      if (p === "/casino") return { min: CAS.MIN, max: CAS.MAX, coins: me.coins, bj: C.bj ? bjView(C.bj) : null };
      const g = p.split("/")[2], b = body ?? {};
      const stake = (v) => { const bet = Math.floor(+v); if (!(bet >= CAS.MIN && bet <= CAS.MAX)) throw demoErr(`Bets are ${CAS.MIN} to ${CAS.MAX} coins`); if (me.coins < bet) throw demoErr("Not enough coins"); return bet; };
      const pay = (bet, win) => { me.coins += win - bet; C.net += win - bet; gp(); };
      if (g !== "bj" && C.bj) throw demoErr("Finish your blackjack hand first");
      if (g === "flip") { const bet = stake(b.bet), r = cFlip(bet, b.side === "tails" ? "tails" : "heads", rnd); pay(bet, r.payout); return out(r); }
      if (g === "slots") { const bet = stake(b.bet), r = cSlots(bet, rnd); pay(bet, r.payout); return out(r); }
      if (g === "roulette") { const num = Math.floor(+b.num); if (!rouletteKindOk(String(b.kind), num)) throw demoErr("Pick a bet"); const bet = stake(b.bet), r = cRoul(bet, b.kind, num, rnd); pay(bet, r.payout); return out(r); }
      if (g === "bj") {
        if (b.act === "deal") { if (C.bj) throw demoErr("You already have a hand going"); const bet = stake(b.bet); me.coins -= bet; C.net -= bet; const st = bjDeal(bet, rnd); if (st.done) { me.coins += st.payout ?? 0; C.net += st.payout ?? 0; } else C.bj = st; gp(); return out({ bj: bjView(st) }); }
        let st = C.bj; if (!st) throw demoErr("No hand in play");
        if (b.act === "hit") st = bjHit(st, rnd); else if (b.act === "stand") st = bjStand(st, rnd);
        else if (b.act === "double") { if (st.player.length !== 2 || me.coins < st.bet) throw demoErr("You can't double now"); me.coins -= st.bet; C.net -= st.bet; st = bjDouble(st, rnd); } else throw demoErr("Unknown move");
        if (st.done) { me.coins += st.payout ?? 0; C.net += st.payout ?? 0; C.bj = null; } else C.bj = st; gp(); return out({ bj: bjView(st) });
      }
      throw demoErr("Unknown game");
    }
    if (p === "/wheel/spin" && method === "POST") {
      if (Date.now() < G.lastSpin + WHEEL_MS) throw demoErr("The wheel is still recharging");
      const total = WHEEL.reduce((a, b) => a + b.w, 0); let r = Math.random() * total, idx = 0; for (let i = 0; i < WHEEL.length; i++) { r -= WHEEL[i].w; if (r < 0) { idx = i; break; } }
      const seg = WHEEL[idx]; G.lastSpin = Date.now(); if (seg.coins) me.coins += seg.coins; else me.freePacks += seg.pack ?? 0; bump("spins"); gp();
      return { index: idx, coins: seg.coins ?? 0, crate: seg.pack ?? 0, next: G.lastSpin + WHEEL_MS, balance: me.coins, freePacks: me.freePacks };
    }
    if (p === "/achievements") return { list: ACHIEVEMENTS.map((a) => ({ ...a, done: G.ach[a.id] ?? 0 })), stats: { ...G.stats, plays: G.plays, rank: statVal("rank"), items: statVal("items") }, earnedToday: G.earned };
    const pm = m(/^\/profile\/(.+)$/);
    if (pm) {
      const name = decodeURIComponent(pm[1]).toLowerCase(), u = users.find((x) => x.username.toLowerCase() === name); if (!u) throw demoErr("No one with that callsign", 404);
      const e = X.ex(u) ?? { xp: 0, bests: {}, inv: { effects: [], tags: [], themes: [], bgs: [] }, equip: { effect: "", tag: "", bg: "" }, coins: 0, plays: 0, streak: 0 }, mine = u.id === me.id, xp = mine ? G.xp : e.xp;
      return { id: u.id, username: u.username, role: u.role, roleId: u.roleId ?? null, profile: u.profile, createdAt: u.createdAt, lastSeen: u.lastSeen, xp, rank: RANKS.reduce((r, k, i) => (xp >= k.xp ? i : r), 0), streak: mine ? G.streak : e.streak, plays: mine ? G.plays : e.plays, bests: e.bests ?? {}, equip: e.equip, inv: { bgs: [], ...e.inv }, ach: mine ? Object.keys(G.ach).length : 4 + (xp % 5), ...(staff() ? { coins: e.coins } : {}) };
    }
    if (p === "/game") return gamePayload();
    if (p === "/game/run") {
      const g = GAMES.find((x) => x.id === body.game) ?? GAMES[0], sc = Math.floor(Number(body.score) || 0), secs = Number(body.secs) || 10;
      if (sc > secs * g.per + g.add) throw demoErr("That score doesn't look right");
      G.plays++; me.bests[g.id] = Math.max(me.bests[g.id] ?? 0, sc); if (g.id === "run") G.best = me.bests.run;
      G.xp += Math.min(30, Math.floor(sc / (g.coinDiv * 0.7))); X.earn(Math.min(60, Math.floor(sc / g.coinDiv)));
      const rh = rushNow(); if (EV) addPts(me.id, sc * (rh && (!rh.game || rh.game === g.id) ? 2 : 1));
      gprogress("play"); pushEv(); return gamePayload();
    }
    if (p === "/owner/countdown") {
      need(); if (method === "DELETE") { CD = null; push({ t: "countdown", countdown: null }); return { ok: true }; }
      const at = +body.at, title = String(body.title ?? "").trim().slice(0, 60); if (!title || !Number.isFinite(at) || at < Date.now() - 6e4) throw demoErr("Add a title and a time in the future");
      CD = { title, about: String(body.about ?? "").slice(0, 160), at, by: me.username }; push({ t: "countdown", countdown: CD }); return { ok: true };
    }
    if (p === "/owner/updatelive") { if (me.role !== "owner") throw demoErr("Owner only", 403); push({ t: "updatelive" }); return { ok: true }; }
    if (p === "/event/join") { if (!EV) throw demoErr("No event is running"); if (!(me.id in EV.points)) { EV.points[me.id] = 0; bump("events"); } pushEv(); return gamePayload(); }
    if (p === "/event/answer") {
      const r = round; if (!r || r.id !== body.id || Date.now() > r.endsAt + 150) throw demoErr("That round is over"); EV.points[me.id] ??= 0; const t = Date.now(), v = body.answer;
      if (r.kind === "trivia") { if (r.answers[me.id]) throw demoErr("Already answered"); const ok = v === r.correct, pts = ok ? 100 + Math.round(100 * (r.endsAt - t) / (r.endsAt - r.startedAt)) : 0; r.answers[me.id] = { ok, pts, t }; if (ok) bump("trivia"); addPts(me.id, pts); return { ok, pts, correct: r.correct }; }
      if (r.kind === "scramble") { if (r.answers[me.id]?.ok) throw demoErr("You already got it"); if (String(v ?? "").trim().toUpperCase() !== r.word) return { ok: false, pts: 0 }; const rank = Object.values(r.answers).filter((a) => a.ok).length, pts = Math.max(50, 200 - 25 * rank); r.answers[me.id] = { ok: true, pts, t }; addPts(me.id, pts); return { ok: true, pts }; }
      if (r.kind === "reaction") { if (r.answers[me.id]) throw demoErr("One tap per round"); if (!r.go || t < r.goAt) { r.answers[me.id] = { ok: false, pts: 0, t }; return { ok: false, falseStart: true }; } const ms = t - r.goAt; r.answers[me.id] = { ok: true, ms, pts: 0, t }; return { ok: true, ms }; }
      if (r.answers[me.id]) throw demoErr("Already voted"); r.answers[me.id] = { ok: true, v: v === 1 ? 1 : 0, pts: 25, t }; addPts(me.id, 25); return { ok: true, pts: 25 };
    }
    if (p === "/fx/claim") { const f = FX[body.id]; if (!f || f.until < Date.now()) throw demoErr("Too late"); if (f.got) throw demoErr(f.single ? "Someone was faster" : "Already caught"); if (f.single) f.got = 1; else f.got = 1; giveMe(f.coins); return { coins: f.coins }; }
    if (p === "/owner/economy") { need(); const all = [me, ...Object.values(bots)]; return { users: all.map((e) => ({ id: e.id, username: e.username, role: e.id === me.id ? me.role : "member", roleId: null, coins: e.coins, xp: e.id === me.id ? G.xp : e.xp, rank: 0, freePacks: e.freePacks, equip: e.equip, effects: e.inv.effects.length, tags: e.inv.tags.length, themes: e.inv.themes.length })), customTags: CT, event: pubEv(), party: { auto, round: round ? { kind: round.kind, title: round.title, endsAt: round.endsAt } : null }, boosts, totalCoins: all.reduce((n, e) => n + e.coins, 0) }; }
    if (p === "/owner/xp") { need(); const a = Math.round(Number(body.amount)); if (!a) throw demoErr("Enter an XP amount"); const t = targets(body.target); t.forEach((e) => { e.xp = Math.max(0, (e.xp ?? 0) + a); }); gp(); return { ok: true, reached: t.length }; }
    if (p === "/owner/coins") { need(); const a = Math.round(Number(body.amount)); if (!a || Math.abs(a) > 1e12) throw demoErr("Enter an amount between 1 and 1,000,000"); const t = targets(body.target); t.forEach((e) => (e.coins = Math.max(0, e.coins + a))); gp(); return { ok: true, reached: t.length }; }
    if (p === "/owner/secret-give") { need(); const all = [...EFFECTS.map((x) => ({ ...x, type: "effect" })), ...TAGS.map((x) => ({ ...x, type: "tag" })), ...BGS.map((x) => ({ ...x, type: "bg" }))].filter((x) => ["secret","forbidden","omega"].includes(x.rarity)); const it = all.find((x) => x.id === body.id) ?? all[0]; const isNew = addItem(me, it.type, it.id); push({ t: "secret", user: me.username, tier: it.rarity }); gp(); return { item: { type: it.type, id: it.id, name: it.name, rarity: it.rarity }, isNew, inv: me.inv }; }
    if (p === "/owner/secret-announce") { need(); push({ t: "secret", user: me.username }); return { ok: true }; }
    if (p === "/owner/give") { need(); const t = targets(body.target); if (body.type === "pack") { t.forEach((e) => (e.freePacks += Math.max(1, Math.min(20, Number(body.count) || 1)))); gp(); return { ok: true, reached: t.length }; } let n = 0; t.forEach((e) => { if (addItem(e, body.type, body.id)) { n++; if (e.id === me.id) push({ t: "gift", type: body.type, id: body.id }); } }); push({ t: "members", members: C.members() }); return { ok: true, reached: n }; }
    if (p === "/owner/tags" && method === "POST") { need(); const name = String(body.name ?? "").trim().slice(0, 24); if (name.length < 2) throw demoErr("Give the tag a name"); const tag = { id: "c-" + uid(), name, color: /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : "#8b7bff" }; CT.push(tag); push({ t: "customtags", customTags: CT }); return { tag }; }
    const tm = m(/^\/owner\/tags\/(.+)$/); if (tm && method === "DELETE") { need(); const i = CT.findIndex((t) => t.id === tm[1]); if (i >= 0) CT.splice(i, 1); [me, ...Object.values(bots)].forEach((e) => { e.inv.tags = e.inv.tags.filter((x) => x !== tm[1]); if (e.equip.tag === tm[1]) e.equip.tag = ""; }); push({ t: "customtags", customTags: CT }); return { ok: true }; }
    if (p === "/owner/live") {
      if (me.role !== "owner") throw demoErr("Only the owner can run live events", 403); need(); if (body.action === "end") { if (!EV) throw demoErr("No event is running"); return { ok: true, rewarded: endEvent() }; }
      const d = EVENTS[body.kind]; if (!d) throw demoErr("Unknown event"); if (EV) throw demoErr("An event is already running. End it first.");
      const sch = cleanSchedule(body.schedule), schedule = sch.length ? sch : cleanSchedule(EVENT_PRESETS[body.kind] ?? QUICK_PRESETS[0].sched), cc = body.cfg ?? {}, t0 = Date.now() + 16000;
      EV = { id: uid(), kind: body.kind, startedAt: Date.now(), by: me.username, points: {}, schedule, phase: 0, phaseStart: t0, phaseEnd: t0 + schedule[0].mins * 6e4, loop: !!body.loop, cfg: { bots: Math.max(0, Math.min(30, Math.round(+(cc.bots ?? DEFAULT_CFG.bots)))), loot: ["low", "med", "high"].includes(cc.loot) ? cc.loot : "med", boss: ["easy", "med", "hard"].includes(cc.boss) ? cc.boss : "med" }, phasePts: {} }; startDirector(); Object.keys(bots).forEach((b) => { if (Math.random() < 0.8) EV.points[b] = rint(20, 220); });
      push({ t: "event", kind: body.kind, title: d.name.toUpperCase(), sub: d.blurb, by: me.username, live: true }); setTimeout(pushEv, 600);
      clearInterval(chatterT); const LINES = ["lets gooo", "this arena is so cool", "who is top rn??", "i just got eaten lol", "pumpkins are worth 5 💀", "boost is op", "gg", "anyone else lagging? nah just me", "the intro was fire"]; chatterT = setInterval(() => { if (!EV) return clearInterval(chatterT); const b = pick(Object.values(bots)); const msg = { id: uid(), channel: "live-event", userId: b.id, username: b.username, text: pick(LINES), ts: Date.now() }; D.messages.push(msg); push({ t: "msg", msg }); }, 7000);
      return { ok: true };
    }
    if (p === "/owner/phase") { if (me.role !== "owner") throw demoErr("Only the owner can run live events", 403); need(); if (!EV) throw demoErr("No event is running"); if (body.action === "skip") nextPhase(); else if (body.action === "extend") { EV.phaseEnd += Math.max(1, Math.min(10, Math.round(+body.mins) || 1)) * 6e4; armPhase(); pushEv(); } else if (body.action === "goto") { if (!(body.idx >= 0 && body.idx < EV.schedule.length)) throw demoErr("No such phase"); beginPhase(+body.idx); } return { ok: true }; }
    if (p === "/owner/round") {
      if (me.role !== "owner") throw demoErr("Only the owner can run live events", 403); need(); if (!EV) throw demoErr("No event is running");
      if (body.action === "skip") { if (!round) throw demoErr("No round is running"); endRound(round); }
      else if (body.action === "auto") { auto = !!body.on; clearTimeout(autoT); if (auto && !round) autoT = setTimeout(runNext, 4000); pushEv(); }
      else if (body.kind === "rush") { rush = { game: GAMES.some((g) => g.id === body.game) ? body.game : "run", until: Date.now() + 18e4 }; push({ t: "fx", kind: "rush", game: rush.game, ms: 18e4 }); pushEv(); }
      else startRound(String(body.kind));
      return { ok: true, auto, round: round ? { kind: round.kind, title: round.title } : null };
    }
    if (p === "/owner/quick") { need(); return { ok: true, note: quick(String(body.kind ?? "")) }; }
    return baseApi(path, method, body);
  };
}
