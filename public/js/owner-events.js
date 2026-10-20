/* Owner console: the live party (events, rounds, quick events, cutscene library) and the economy (coins, gifts, titles). */
import { $, api, ago, esc, isCoOwnerUp, isOwner, state, toast, promptBox, confirmBox } from "./util.js";
import { playSecret } from "./secret.js";
import { EVENTS, EFFECTS, TAGS, THEMES, BGS, QUICK_EVENTS, CUTSCENES, GAMES, PACKS, PHASE_KINDS, EVENT_PRESETS, QUICK_PRESETS, DEFAULT_CFG, DUPE_COINS, scheduleMins } from "./cosmetics.js";
import { playEvent } from "./event.js";

let E = null, Q = "", timer = 0, repaint = () => {};
export const events = { load, html: eventsHtml, click: eventsClick, submit: eventsSubmit };
export const economy = { load, html: economyHtml, click: ecoClick, submit: ecoSubmit, input: ecoInput };

export function bindOwnerEvents(fn) { repaint = fn; }
async function load() { try { E = await api("/owner/economy"); } catch (e) { toast(e.message, true); } return E; }
/** While the events tab is open, keep the status fresh. */
export function watch(on) { clearInterval(timer); if (on) timer = setInterval(async () => { if (state.view !== "owner") return; const f = document.activeElement; if (f && f.closest?.("#oBody") && /INPUT|SELECT|TEXTAREA/.test(f.tagName)) return; await load(); repaint(); }, 6000); }

const mins = (ts) => { const m = Math.max(0, Math.floor((Date.now() - ts) / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
const sel = (name, opts, cur = "") => `<select name="${name}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
const targetUI = (p = "") => `<div class="tgt"><label>Who<select name="${p}ttype" data-tt>${[["online", "Everyone online"], ["all", "Every account"], ["user", "One person"], ["role", "A whole role"]].map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label><label class="tval hidden">Pick<select name="${p}tvalue" data-tv></select></label></div>`;
const roleOpts = () => [["member", "Crew (no role)"], ["admin", "Commanders"], ["coowner", "Co-owners"], ...state.roles.map((r) => [r.id, r.name])];
const target = (v, p = "") => ({ type: v.get(p + "ttype"), value: v.get(p + "tvalue") || undefined });

/* ================= Live event tab ================= */
/* the timeline the owner is building before starting an event */
let DRAFT = { sched: EVENT_PRESETS.opening.map((p) => ({ ...p })), cfg: { ...DEFAULT_CFG } };
const kindOpts = (sel) => Object.entries(PHASE_KINDS).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${v.icon} ${esc(v.name)}</option>`).join("");
function builderHtml() {
  const c = DRAFT.cfg, tot = scheduleMins(DRAFT.sched);
  const rows = DRAFT.sched.map((p, i) => `<div class="phrow"><b>${i + 1}</b><select data-ph="kind:${i}">${kindOpts(p.kind)}</select><label class="phmin"><input type="number" min="1" max="30" value="${p.mins}" data-ph="mins:${i}"> min</label>
    <span class="inline"><button type="button" class="btn sm" data-phmv="${i}:-1" ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button><button type="button" class="btn sm" data-phmv="${i}:1" ${i === DRAFT.sched.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button><button type="button" class="btn sm danger" data-phdel="${i}" ${DRAFT.sched.length < 2 ? "disabled" : ""} aria-label="Remove">✕</button></span></div>`).join("");
  return `<h4 class="sec">Timeline <span class="chip">${tot} min total</span></h4>
    <p class="note">Players move through these phases in order. The Gulper arena, loot storm and boss hunt all happen in the same shared arena. Trivia and word games show up inside the event too. Everyone sees a timer and a leaderboard for each phase.</p>
    <div class="inline" style="margin-bottom:8px"><select id="phPreset"><option value="">Load a preset…</option>${Object.entries(EVENTS).map(([k, e]) => EVENT_PRESETS[k] ? `<option value="ev:${k}">${esc(e.name)} (${scheduleMins(EVENT_PRESETS[k])} min)</option>` : "").join("")}${QUICK_PRESETS.map((q) => `<option value="q:${q.id}">${esc(q.name)}</option>`).join("")}</select><button type="button" class="btn sm" data-phadd>+ Add phase</button></div>
    <div class="phlist">${rows}</div>
    <h4 class="sec">Settings</h4>
    <div class="row2 phset"><label>Loot drops<select data-cfg="loot">${["low", "med", "high"].map((v) => `<option value="${v}" ${c.loot === v ? "selected" : ""}>${{ low: "Calm (one every 9s)", med: "Normal (every 5s)", high: "Storm (every 3s)" }[v]}</option>`).join("")}</select></label>
      <label>Boss strength<select data-cfg="boss">${["easy", "med", "hard"].map((v) => `<option value="${v}" ${c.boss === v ? "selected" : ""}>${{ easy: "Easy", med: "Normal", hard: "Hard" }[v]}</option>`).join("")}</select></label>
      <label class="switch-row" style="align-self:end"><input type="checkbox" data-cfg="loop" ${c.loop ? "checked" : ""}> <b>Loop the timeline</b> <span class="faint">otherwise the event ends and rewards players when the last phase finishes</span></label></div>
    <p class="note">Rewards: every player gets the event's own limited title and effect. If they already own both from an earlier run they get <b>${DUPE_COINS.toLocaleString()} bonus coins</b> instead.</p>`;
}
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
function phaseControls(ev) {
  const ph = ev.phase; if (!ph) return "";
  const rows = ph.schedule.map((p, i) => `<div class="phrow ${i === ph.idx ? "cur" : i < ph.idx ? "done" : ""}"><b>${i + 1}</b><span class="grow">${PHASE_KINDS[p.kind]?.icon ?? ""} ${esc(PHASE_KINDS[p.kind]?.name ?? p.kind)}</span><span class="faint">${p.mins} min</span>${i !== ph.idx ? `<button type="button" class="btn sm" data-phgo="${i}">Jump here</button>` : `<span class="chip ok">now · <span data-until="${ph.endsAt}"><b></b></span></span>`}</div>`).join("");
  return `<h4 class="sec">Timeline ${ph.loop ? `<span class="chip">looping</span>` : ""}</h4><div class="phlist">${rows}</div>
    <div class="inline" style="margin-top:8px"><button type="button" class="btn" data-phskip>Skip to next phase</button><button type="button" class="btn" data-phext="1">+1 min</button><button type="button" class="btn" data-phext="3">+3 min</button></div>`;
}
function eventsHtml() {
  if (!E) return `<div class="card glass"><div class="skel"></div></div>`;
  const ev = E.event, party = E.party ?? {}, boosts = E.boosts ?? [];
  let top = "";
  if (ev) {
    const rd = party.round ? `<span class="chip ok">Round: ${esc(party.round.title)}</span>` : `<span class="chip">Between rounds</span>`;
    top = `<div class="card glass evlive" style="--ec:${esc(ev.color)}"><h3><i class="ev-dot"></i> ${esc(ev.name)} is live <span class="chip">${mins(ev.startedAt)}</span> <span class="chip">${ev.count} playing</span> ${rd}${ev.rush ? ` <span class="chip warn">2× rush: ${esc(GAMES.find((g) => g.id === ev.rush.game)?.name ?? "all games")}</span>` : ""}</h3>
      ${phaseControls(ev)}
      <p class="note">Everyone who plays or answers keeps their points. When you end the event, every player gets the limited <b>title</b> and <b>profile effect</b>, plus coins and free crates. Top 3 get big bonuses.</p>
      <div class="evctl"><label class="switch-row"><input type="checkbox" data-auto ${party.auto ? "checked" : ""}> <b>Auto-host</b> <span class="faint">keeps the party going: trivia, scrambles, reaction races, polls, rushes, drops</span></label></div>
      <div class="roundbtns">${[["trivia", "Trivia", "❓"], ["scramble", "Word scramble", "🔤"], ["reaction", "Reaction race", "⚡"], ["poll", "This or that", "🗳"]].map(([k, l, i]) => `<button class="btn" data-round="${k}" ${party.round ? "disabled" : ""}>${i} ${l}</button>`).join("")}
        <span class="inline"><select id="rushGame" class="sm-sel">${GAMES.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join("")}</select><button class="btn" data-rush>🔥 Game rush ×2</button></span>
        <button class="btn" data-skip ${party.round ? "" : "disabled"}>Skip round</button></div>
      <h4 class="sec">Leaderboard</h4><ol class="evtop">${ev.top.map((t) => `<li><span>${esc(t.username)}</span><b>${t.points}</b></li>`).join("") || `<li class="faint">Nobody has scored yet</li>`}</ol>
      <div class="inline" style="margin-top:14px"><button class="btn danger" data-endlive>End event and give rewards</button></div></div>`;
  } else {
    top = `<div class="card glass"><h3>Start a live event</h3><p class="note">Plays a cinematic opening on every screen, then everyone drops into the full-screen arena and your timeline runs. When it finishes, everyone who took part gets that event's <b>limited title</b>, <b>limited profile effect</b>, coins and free crates.</p>
      ${builderHtml()}
      <h4 class="sec">Pick the event and start</h4>
      <div class="evcards">${Object.entries(EVENTS).map(([k, e]) => `<article class="evcard" style="--ec:${e.color}"><h4>${esc(e.name)}</h4><p>${esc(e.blurb)}</p><small>Reward: ${esc(TAGS.find((t) => t.id === e.tag)?.name ?? e.tag)} title + ${esc(EFFECTS.find((x) => x.id === e.effect)?.name ?? e.effect)} effect</small><div class="inline"><button class="btn primary" data-golive="${k}">Start ${esc(e.name)}</button><button class="btn" data-cine="${k}">Preview</button></div></article>`).join("")}</div></div>`;
  }
  if (!isOwner(state.me)) top = `<div class="card glass"><h3>Live events ${ev ? `<span class="chip ok">${esc(ev.name)} is live</span>` : ""}</h3><p class="note">Only the owner can start or end live events and run their rounds. You can still fire any quick event below${ev ? ", and you can see the event is running" : ""}.</p></div>`;
  const quick = `<div class="card glass"><h3>Quick events ${boosts.map((b) => `<span class="chip warn">${b.kind === "xp" ? "2× XP" : "2× coins"} live</span>`).join(" ")}</h3><p class="note">One-click moments. Send them to everyone online, one person, or a whole role. They work with or without a live event. Boosts and the rush always go to everyone.</p>
    <div id="qTgt">${targetUI("q")}</div>
    <div class="qgrid">${QUICK_EVENTS.map((q) => `<button class="qbtn" data-quick="${q.id}"><span>${q.icon}</span><b>${esc(q.name)}</b><small>${esc(q.desc)}</small></button>`).join("")}</div></div>`;
  const lib = `<div class="card glass"><h3>Cutscene library</h3><p class="note">Preview any cutscene on your own screen, or play it for everyone who is online (it gives them 25 XP for showing up). Press Esc to skip.</p>
    <div class="cgrid2">${CUTSCENES.map((c) => `<div class="cs"><b>${esc(c.name)}</b><div class="inline"><button class="btn sm" data-cine="${c.id}">Preview</button><button class="btn sm primary" data-cineall="${c.id}">Play for everyone</button></div></div>`).join("")}<div class="cs"><b>Secret pull</b><div class="inline"><button class="btn sm" data-secret="play">Preview</button><button class="btn sm primary" data-secret="all">Test the announcement</button></div></div></div>
    ${window.__demo ? `<h4 class="sec">Give myself a Secret</h4><form data-selfsecret class="evform"><div class="row2"><label>Which one<select name="id">${[...EFFECTS.map((x) => [x, "Profile effect"]), ...TAGS.map((x) => [x, "Title"]), ...BGS.map((x) => [x, "Backdrop"])].filter(([x]) => x.rarity === "secret").map(([x, k]) => `<option value="${esc(x.id)}">${esc(x.name)} (${k})</option>`).join("")}</select></label></div><div class="inline"><button class="btn primary">Give it to me</button></div></form><p class="note">Adds it to your collection, sends the "someone pulled a Secret" announcement to everyone online, and plays the cutscene on your screen.</p>` : ""}
    <h4 class="sec">Update cutscene text</h4><form data-upd class="evform"><label>Version or title<input name="title" maxlength="40" value="UPDATE 1.8" required></label><label>What's new (one line each, up to 7)<textarea name="items" rows="4" maxlength="500" placeholder="Packs and profile effects&#10;Live events&#10;Four new arcade games"></textarea></label><div class="inline"><button type="button" class="btn" data-updprev>Preview</button><button class="btn primary">Play for everyone</button></div></form>
    <h4 class="sec">Custom announcement cutscene</h4><form data-event class="evform"><label>Style<select name="kind"><option value="launch">Launch (purple and blue warp)</option><option value="eclipse">Eclipse (amber corona)</option><option value="party">Party (confetti)</option></select></label><label>Big title<input name="title" maxlength="60" value="LIFTOFF" required></label><label>Line underneath<input name="sub" maxlength="140" placeholder="Something new just landed in Artemis"></label><div class="inline"><button class="btn primary">Start for everyone online</button><button type="button" class="btn" data-evprev>Preview on my screen</button></div></form></div>`;
  const c = state.countdown, cdv = c ? new Date(c.at - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : "";
  const cdCard = `<div class="card glass"><h3>Countdown banner ${c ? `<span class="chip ok">showing for everyone</span>` : `<span class="chip">off</span>`}</h3>
    <p class="note">Shows a banner at the top of every screen counting down to a date and time you pick, with what it is about. It goes away on its own a minute after the time passes.</p>
    <form data-countdown class="evform"><label>What is it?<input name="title" maxlength="60" required placeholder="Halloween Night starts" value="${esc(c?.title ?? "")}"></label>
      <label>A line about it (optional)<input name="about" maxlength="160" placeholder="Costume contest, spooky games and free crates" value="${esc(c?.about ?? "")}"></label>
      <label>Date and time (your local time)<input name="at" type="datetime-local" required value="${esc(cdv)}"></label>
      <div class="inline"><button class="btn primary" type="submit">${c ? "Update banner" : "Show banner"}</button>${c ? `<button class="btn danger" type="button" data-cdclear>Remove banner</button>` : ""}</div></form></div>`;
  const upd = isOwner(state.me) ? `<div class="card glass"><h3>Update is live</h3><p class="note">After you deploy a new version, players already online are told automatically when the server comes back. You can also press this to show everyone the green "The update is live, click to restart" banner. Accounts, chat, packs and progress are never reset by an update.</p><div class="inline"><button class="btn primary" data-updlive>Tell everyone the update is live</button></div></div>` : "";
  return top + cdCard + upd + quick + lib;
}
const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok, "ok"); await load(); repaint(); } catch (e) { toast(e.message, true); } return true; };
async function eventsClick(b) {
  const d = b.dataset;
  if (d.golive) return run(() => api("/owner/live", "POST", { kind: d.golive, schedule: DRAFT.sched, loop: DRAFT.cfg.loop, cfg: DRAFT.cfg }), "Event started");
  if (b.matches("[data-phadd]")) { if (DRAFT.sched.length < 14) DRAFT.sched.push({ kind: "gulper", mins: 3 }); repaint(); return true; }
  if (d.phdel != null && d.phdel !== "") { DRAFT.sched.splice(+d.phdel, 1); repaint(); return true; }
  if (d.phmv) { const [i, k] = d.phmv.split(":").map(Number), j = i + k; if (DRAFT.sched[j]) [DRAFT.sched[i], DRAFT.sched[j]] = [DRAFT.sched[j], DRAFT.sched[i]]; repaint(); return true; }
  if (d.phgo != null && d.phgo !== "") return run(() => api("/owner/phase", "POST", { action: "goto", idx: +d.phgo }), "Jumped");
  if (b.matches("[data-phskip]")) return run(() => api("/owner/phase", "POST", { action: "skip" }), "Next phase");
  if (d.phext) return run(() => api("/owner/phase", "POST", { action: "extend", mins: +d.phext }), `+${d.phext} min`);
  if (d.secret === "play") { playSecret({ name: "Event Horizon", type: "effect" }); return true; }
  if (d.secret === "all") return run(async () => { await api("/owner/secret-announce", "POST", {}); toast("Announcement sent to everyone online", "ok"); });
  if (d.cine) { const c = CUTSCENES.find((x) => x.id === d.cine), e = EVENTS[d.cine]; return playEvent({ kind: d.cine, title: (e?.name ?? c?.name ?? "Preview").toUpperCase(), sub: e?.blurb ?? "Preview of this cutscene|Added a new feature|Fixed a few bugs", by: state.me.username }), true; }
  if (d.cineall) { const c = CUTSCENES.find((x) => x.id === d.cineall), e = EVENTS[d.cineall]; return run(async () => { const r = await api("/owner/event", "POST", { kind: d.cineall, title: (e?.name ?? c.name).toUpperCase(), sub: e?.blurb ?? "" }); toast(`Playing for ${r.reached} online`, "ok"); }); }
  if (d.round) return run(() => api("/owner/round", "POST", { kind: d.round }));
  if (b.matches("[data-rush]")) return run(() => api("/owner/round", "POST", { kind: "rush", game: $("#rushGame").value }), "Game rush started");
  if (b.matches("[data-skip]")) return run(() => api("/owner/round", "POST", { action: "skip" }));
  if (b.matches("[data-endlive]")) { if (await confirmBox("End the event?", "Every player who took part gets the limited title, effect, coins and crates right now.", { ok: "End and reward" })) run(async () => { const r = await api("/owner/live", "POST", { action: "end" }); toast(`${r.rewarded} players rewarded`, "ok"); }); return true; }
  if (b.matches("[data-cdclear]")) return run(() => api("/owner/countdown", "DELETE"), "Banner removed");
  if (b.matches("[data-updlive]")) return run(() => api("/owner/updatelive", "POST"), "Everyone online was told");
  if (d.quick) return run(async () => { const sel = $("#qTgt [data-tt]"), tv = $("#qTgt [data-tv]"); const r = await api("/owner/quick", "POST", { kind: d.quick, target: { type: sel?.value ?? "online", value: tv?.value || undefined } }); toast(r.note ? `Done · ${r.note}` : "Done", "ok"); });
  if (b.matches("[data-updprev]")) { const f = new FormData(b.closest("form")); return playEvent({ kind: "update", title: f.get("title"), sub: String(f.get("items")).split("\n").filter(Boolean).join("|"), by: state.me.username }), true; }
  if (b.matches("[data-evprev]")) { const f = new FormData(b.closest("form")); return playEvent({ kind: f.get("kind"), title: f.get("title"), sub: f.get("sub"), by: state.me.username }), true; }
  return false;
}
async function eventsSubmit(f, v) {
  if (f.matches("[data-countdown]")) { await run(() => api("/owner/countdown", "PUT", { title: v.get("title"), about: v.get("about"), at: new Date(String(v.get("at"))).getTime() }), "Countdown banner is live"); return true; }
  if (f.matches("[data-upd]")) { await run(async () => { const r = await api("/owner/event", "POST", { kind: "update", title: v.get("title"), sub: String(v.get("items")).split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 7).join("|") }); toast(`Playing for ${r.reached} online`, "ok"); }); return true; }
  if (f.matches("[data-event]")) { await run(async () => { const r = await api("/owner/event", "POST", { kind: v.get("kind"), title: v.get("title"), sub: v.get("sub") }); toast(`Event started for ${r.reached} online`, "ok"); }); return true; }
  return false;
}
/* the Auto-host checkbox is a change event, handled by the owner console */
export async function eventsChange(el) {
  if (el.matches("#phPreset")) { const v = el.value; if (!v) return true; const [t, id] = v.split(":"); const src = t === "ev" ? EVENT_PRESETS[id] : QUICK_PRESETS.find((q) => q.id === id)?.sched; if (src) DRAFT.sched = src.map((p) => ({ ...p })); repaint(); return true; }
  if (el.dataset?.ph) { const [k, i] = el.dataset.ph.split(":"), p = DRAFT.sched[+i]; if (p) { if (k === "kind") p.kind = el.value; else p.mins = Math.max(1, Math.min(30, Math.round(+el.value) || 1)); } repaint(); return true; }
  if (el.dataset?.cfg) { const k = el.dataset.cfg; DRAFT.cfg[k] = el.type === "checkbox" ? el.checked : k === "bots" ? Math.max(0, Math.min(30, Math.round(+el.value) || 0)) : el.value; return true; } if (el.matches("[data-auto]")) { await run(() => api("/owner/round", "POST", { action: "auto", on: el.checked }), el.checked ? "Auto-host is on" : "Auto-host is off"); return true; } return false; }

/* ================= Economy tab ================= */
function giveOptions(type) {
  if (type === "effect") return EFFECTS.map((e) => [e.id, `${e.name}${e.limited ? " (limited)" : ""}`]);
  if (type === "theme") return THEMES.map((t) => [t.id, t.name]);
  if (type === "bg") return BGS.map((b) => [b.id, b.name]);
  return [...TAGS, ...(state.customTags ?? [])].filter((t) => t.id !== "og" || state.me?.role === "owner").map((t) => [t.id, `${t.name}${t.limited ? " (limited)" : ""}`]);
}
function userRows() {
  const q = Q.trim().toLowerCase();
  return E.users.filter((u) => !q || u.username.toLowerCase().includes(q)).sort((a, b) => b.coins - a.coins).map((u) => `<div class="mrow"><div class="grow"><b>${esc(u.username)}</b><div class="sub">${u.xp} XP · ${u.freePacks} free crate${u.freePacks === 1 ? "" : "s"} · ${u.effects} effects · ${u.tags} titles · ${u.themes} themes</div></div><b class="coinnum">◎ ${u.coins.toLocaleString()}</b><button class="btn sm" data-coin="${esc(u.id)}" data-name="${esc(u.username)}">Give / take</button></div>`).join("") || `<p class="note">No matches.</p>`;
}
function economyHtml() {
  if (!E) return `<div class="card glass"><div class="skel"></div></div>`;
  const custom = E.customTags ?? [];
  return `<div class="card glass"><h3>Coins <span class="chip">${E.users.length} players</span> <span class="chip ok">◎ ${E.totalCoins.toLocaleString()} in circulation</span></h3>
    <form data-givecoins class="evform"><div class="row2"><label>Amount (negative takes coins back)<input name="amount" type="number" value="100" required></label><label>Reason (they see it)<input name="reason" maxlength="60" placeholder="Event prize"></label></div>${targetUI()}<div class="inline"><button class="btn primary">Give coins</button></div></form></div>
  ${isCoOwnerUp(state.me) ? `<div class="card glass"><h3>XP</h3><form data-givexp class="evform"><div class="row2"><label>Amount (any number, negative takes XP back)<input name="amount" type="number" value="1000" required></label><label>Reason (they see it)<input name="reason" maxlength="60" placeholder="Event prize"></label></div>${targetUI("x")}<div class="inline"><button class="btn primary">Give XP</button></div></form><p class="note">Owner and co-owners only. A big gift can level someone up through several ranks and plays their level-up cutscenes.</p></div>` : ""}
  <div class="card glass"><h3>Gift items and crates</h3><form data-gift class="evform"><div class="row2"><label>Type<select name="type" data-gtype><option value="tag">Title (tag)</option><option value="effect">Profile effect</option><option value="bg">Profile backdrop</option><option value="theme">Theme</option><option value="pack">Free Supply Crates</option></select></label><label class="gitem">Item<select name="id" data-gitem>${giveOptions("tag").map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select></label><label class="gcount hidden">How many<input name="count" type="number" min="1" max="20" value="1"></label></div>${targetUI("g")}<div class="inline"><button class="btn primary">Give it</button></div></form>
    <p class="note">Only the owner and co-owners can give titles. "Every account" covers the whole server in one go.</p></div>
  ${isCoOwnerUp(state.me) ? `<div class="card glass"><h3>Give myself a whole pack</h3><form data-selfpack class="evform"><div class="row2"><label>Pack<select name="pack">${PACKS.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></label></div><div class="inline"><button class="btn primary">Add everything to my collection</button></div></form>
    <p class="note">Puts every item the pack can drop into your own collection at once, with no opening animation and no coins spent. For testing and checking how things look.</p></div>` : ""}
  ${state.me?.role === "owner" ? `<div class="card glass"><h3>Remove a title or item</h3><form data-take class="evform"><div class="row2"><label>Type<select name="type" data-rtype><option value="tag">Title (tag)</option><option value="effect">Profile effect</option><option value="bg">Profile backdrop</option><option value="theme">Theme</option></select></label><label>Item<select name="id" data-ritem>${giveOptions("tag").map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select></label></div>${targetUI("r")}<div class="inline"><button class="btn danger">Remove it</button></div></form>
    <p class="note">Only you, the owner, can do this. The item leaves their collection and is unequipped if they were wearing it. You can give it back any time.</p></div>` : ""}
  <div class="card glass"><h3>Custom titles</h3><form data-newtag class="inline"><input name="name" maxlength="24" placeholder="Title name, e.g. Moon Mayor" required><input name="color" type="color" value="#8b7bff" aria-label="Color" style="width:54px;padding:2px"><button class="btn primary">Create</button></form>
    <div class="tagrow">${custom.map((t) => `<span class="chip title" style="--tc:${esc(t.color)}">${esc(t.name)} <button class="x" data-deltag="${esc(t.id)}" aria-label="Delete ${esc(t.name)}">×</button></span>`).join("") || `<span class="faint">None yet. Create one, then give it above.</span>`}</div></div>
  <div class="card glass"><h3>Everyone's coins</h3><div class="inline"><input id="ecoSearch" type="search" placeholder="Search players…" value="${esc(Q)}" autocomplete="off"></div><div class="mlist" id="ecoList">${userRows()}</div></div>`;
}
function wireTargets() {
  const root = $("#oBody"); if (!root) return;
  root.querySelectorAll("[data-tt]").forEach((s) => {
    const val = s.closest(".tgt").querySelector(".tval"), tv = val.querySelector("select");
    const sync = () => {
      const t = s.value; val.classList.toggle("hidden", !(t === "user" || t === "role"));
      tv.innerHTML = (t === "user" ? E.users.map((u) => [u.id, u.username]) : roleOpts()).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("");
    };
    if (!s._w) { s.addEventListener("change", sync); s._w = 1; } sync();
  });
}
export function afterPaint() { wireTargets(); }
async function ecoClick(b) {
  const d = b.dataset;
  if (d.coin) { const r = await promptBox(`Coins for ${d.name}`, { label: "Amount (negative takes coins)", value: "100", type: "number", ok: "Apply" }); if (r == null || !Number(r)) return true; await run(async () => { await api("/owner/coins", "POST", { amount: Number(r), target: { type: "user", value: d.coin }, reason: "From the owner" }); toast("Done", "ok"); }); return true; }
  if (d.deltag) { if (await confirmBox("Delete this title?", "Everyone who owns it loses it.", { ok: "Delete", danger: true })) await run(() => api("/owner/tags/" + d.deltag, "DELETE")); return true; }
  return false;
}
function ecoInput(e) { if (e.target.id === "ecoSearch") { Q = e.target.value; $("#ecoList").innerHTML = userRows(); return true; } return false; }
export function ecoChange(el) {
  if (el.matches("[data-rtype]")) { el.closest("form").querySelector("[data-ritem]").innerHTML = giveOptions(el.value).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join(""); return true; }
  if (!el.matches("[data-gtype]")) return false;
  const form = el.closest("form"), t = el.value, item = form.querySelector(".gitem"), count = form.querySelector(".gcount");
  item.classList.toggle("hidden", t === "pack"); count.classList.toggle("hidden", t !== "pack");
  form.querySelector("[data-gitem]").innerHTML = giveOptions(t).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join(""); return true;
}
async function ecoSubmit(f, v) {
  if (f.matches("[data-selfsecret]")) { try { const r = await api("/owner/secret-give", "POST", { id: v.get("id") }); await playSecret({ name: r.item.name, type: r.item.type, id: r.item.id }); } catch (e) { toast(e.message, true); } return true; }
  if (f.matches("[data-givexp]")) { await run(async () => { const r = await api("/owner/xp", "POST", { amount: Number(v.get("amount")), reason: v.get("reason"), target: target(v, "x") }); toast(`Gave XP to ${r.reached} player${r.reached === 1 ? "" : "s"}`, "ok"); }); return true; }
  if (f.matches("[data-givecoins]")) { await run(async () => { const r = await api("/owner/coins", "POST", { amount: Number(v.get("amount")), reason: v.get("reason"), target: target(v) }); toast(`Gave coins to ${r.reached} player${r.reached === 1 ? "" : "s"}`, "ok"); }); return true; }
  if (f.matches("[data-gift]")) { const type = v.get("type"); await run(async () => { const r = await api("/owner/give", "POST", { type, id: v.get("id"), count: Number(v.get("count")) || 1, target: target(v, "g") }); toast(`Given to ${r.reached} player${r.reached === 1 ? "" : "s"}`, "ok"); }); return true; }
  if (f.matches("[data-selfpack]")) { await run(async () => { const r = await api("/owner/selfpack", "POST", { pack: v.get("pack") }); toast(`${r.name}: ${r.added} new item${r.added === 1 ? "" : "s"} added (${r.total} in the pack)`, "ok"); }); return true; }
  if (f.matches("[data-take]")) { const t = target(v, "r"); if (!(await confirmBox("Remove this?", t.type === "all" ? "It will be taken from every account." : "It will be taken from the selected people.", { ok: "Remove", danger: true }))) return true; await run(async () => { const r = await api("/owner/take", "POST", { type: v.get("type"), id: v.get("id"), target: t }); toast(`Removed from ${r.reached} player${r.reached === 1 ? "" : "s"}`, "ok"); }); return true; }
  if (f.matches("[data-newtag]")) { await run(() => api("/owner/tags", "POST", { name: v.get("name"), color: v.get("color") }), "Title created"); return true; }
  return false;
}
