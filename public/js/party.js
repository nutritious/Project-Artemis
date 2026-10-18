/* The party card: live rounds (trivia, word scramble, reaction race, this-or-that) docked over whatever you are doing. */
import { $, api, esc, on, state, toast } from "./util.js";

let card, R = null, timer = 0, hideT = 0, goAt = 0, lastTick = -1;
let ac;
function blip(f, d = 0.12, type = "sine", v = 0.07, w = 0) {
  if (state.me?.settings?.chatSound === false) return;
  try { ac ??= new (window.AudioContext || window.webkitAudioContext)(); const t = ac.currentTime + w, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + 0.05); } catch { /* silent */ }
}
const good = () => [523, 659, 880].forEach((f, i) => blip(f, 0.25, "triangle", 0.09, i * 0.08));
const bad = () => { blip(200, 0.25, "sawtooth", 0.05); blip(150, 0.3, "sawtooth", 0.05, 0.12); };
const color = () => state.event?.color ?? "#8b7bff";

/* Rounds live inside the full-screen live event only. Outside the arena nothing pops up over the app. */
const host = () => document.getElementById("arena");
function mount() {
  const h = host(); if (!h) return null;
  if (!card) {
    card = document.createElement("div"); card.id = "partyCard"; card.className = "glass hidden"; card.setAttribute("role", "dialog"); card.setAttribute("aria-live", "polite");
    card.addEventListener("click", onClick); card.addEventListener("submit", onSubmit);
  }
  if (card.parentNode !== h) h.appendChild(card);
  return card;
}
const show = () => { if (!mount()) return false; card.classList.remove("hidden"); card.style.setProperty("--ec", color()); card.classList.remove("leave"); clearTimeout(hideT); return true; };
/** Called when the arena opens, so a round that is already running appears right away. */
export function syncParty() { const r = state.event?.round; if (R) return void paintRound(); if (r) { R = { ...r, picked: null }; paintRound(); } }
const hide = () => { if (!card) return; card.classList.add("leave"); clearTimeout(hideT); hideT = setTimeout(() => { card.classList.add("hidden"); card.innerHTML = ""; }, 400); clearInterval(timer); R = null; };

const KIND = { trivia: "TRIVIA", scramble: "WORD SCRAMBLE", reaction: "REACTION RACE", poll: "THIS OR THAT" };
function head(r) { return `<div class="pc-head"><span>${KIND[r.kind] ?? "ROUND"}</span><b id="pcT">–</b><button type="button" class="pc-x" data-close aria-label="Hide">×</button></div><div class="pc-bar"><i id="pcBar"></i></div>`; }

function paintRound() {
  const r = R; if (!r) return;
  if (!show()) return;
  let body = "";
  if (r.kind === "trivia") body = `<p class="pc-q">${esc(r.prompt)}</p><div class="pc-opts">${r.options.map((o, i) => `<button type="button" data-a="${i}" ${r.answered ? "disabled" : ""} class="${r.picked === i ? "pick" : ""}">${esc(o)}</button>`).join("")}</div>`;
  if (r.kind === "poll") body = `<p class="pc-q">${esc(r.prompt)}</p><div class="pc-opts two">${r.options.map((o, i) => `<button type="button" data-a="${i}" ${r.answered ? "disabled" : ""} class="${r.picked === i ? "pick" : ""}">${esc(o)}</button>`).join("")}</div>`;
  if (r.kind === "scramble") body = `<p class="pc-hint">Hint: ${esc(r.options?.[0] ?? "")} · ${r.len} letters</p><div class="pc-tiles">${[...r.prompt].map((c) => `<i>${esc(c)}</i>`).join("")}</div><form class="pc-form"><input name="w" maxlength="20" autocomplete="off" autocapitalize="characters" placeholder="Type the word" ${r.answered ? "disabled" : ""}><button class="btn" ${r.answered ? "disabled" : ""}>Go</button></form><p class="pc-fb" id="pcFb">${r.answered ? "Solved!" : ""}</p>`;
  if (r.kind === "reaction") body = `<button type="button" class="pc-pad ${r.go ? "go" : ""}" data-tap ${r.answered ? "disabled" : ""}>${r.answered ? "Locked in" : r.go ? "TAP!" : "Wait for green…"}</button><p class="pc-fb" id="pcFb"></p>`;
  card.innerHTML = head(r) + body + `<p class="pc-fb" id="pcMsg"></p>`;
  if (r.fb) $("#pcFb", card) && ($("#pcFb", card).textContent = r.fb);
  if (r.kind === "scramble" && !r.answered) $("input", card)?.focus();
  clearInterval(timer); lastTick = -1; timer = setInterval(tick, 100); tick();
}
function tick() {
  const r = R; if (!r || !card) return;
  const now = Date.now(), total = r.endsAt - r.startedAt, left = Math.max(0, r.endsAt - now), s = Math.ceil(left / 1000);
  const bar = $("#pcBar", card), t = $("#pcT", card);
  if (bar) bar.style.width = (r.kind === "reaction" ? 100 : (left / total) * 100) + "%";
  if (t) t.textContent = r.kind === "reaction" ? (r.go ? "GO" : "…") : s + "s";
  if (r.kind !== "reaction" && s <= 3 && s > 0 && s !== lastTick && !r.answered) { lastTick = s; blip(660 + (3 - s) * 110, 0.08, "square", 0.04); }
}
async function send(answer) {
  const r = R; if (!r) return null;
  try { return await api("/event/answer", "POST", { id: r.id, answer }); } catch (e) { toast(e.message, true); return null; }
}
async function onClick(e) {
  if (e.target.closest("[data-close]")) return hide();
  const r = R; if (!r) return;
  const a = e.target.closest("[data-a]");
  if (a && !r.answered) {
    const i = +a.dataset.a; r.answered = true; r.picked = i; const res = await send(i); paintRound();
    if (!res) { r.answered = false; r.picked = null; return paintRound(); }
    const msg = $("#pcMsg", card);
    if (r.kind === "trivia") { const btns = [...card.querySelectorAll("[data-a]")]; btns[res.correct]?.classList.add("right"); if (!res.ok) btns[i]?.classList.add("wrong"); if (msg) msg.textContent = res.ok ? `Correct! +${res.pts} pts` : "Not this time"; res.ok ? good() : bad(); }
    else { if (msg) msg.textContent = "Vote locked in. +25 pts"; blip(660, 0.1); }
    return;
  }
  if (e.target.closest("[data-tap]") && !r.answered) {
    r.answered = true; const res = await send(null); const pad = $(".pc-pad", card);
    if (res?.falseStart) { pad.textContent = "Too early!"; pad.classList.add("early"); bad(); } else if (res) { pad.textContent = `${res.ms} ms`; pad.classList.add("done"); good(); }
    pad.disabled = true;
  }
}
async function onSubmit(e) {
  e.preventDefault(); const r = R; if (!r || r.kind !== "scramble" || r.answered) return;
  const w = new FormData(e.target).get("w"); if (!String(w).trim()) return;
  const res = await send(w), fb = $("#pcFb", card);
  if (!res) return;
  if (res.ok) { r.answered = true; good(); paintRound(); const f = $("#pcFb", card); if (f) f.textContent = `Solved! +${res.pts} pts`; }
  else { bad(); if (fb) fb.textContent = "Nope, try again"; e.target.reset(); }
}

function showResult(m) {
  clearInterval(timer); R = null; if (!show()) return;
  const me = m.mine ?? {}, medal = ["", "🥇", "🥈", "🥉"][me.place] ?? "";
  let mid = "";
  if (m.kind === "poll" && m.counts) { const t = Math.max(1, m.counts[0] + m.counts[1]); mid = `<div class="pc-poll">${m.options.map((o, i) => `<div class="${me.vote === i ? "mine" : ""}"><i style="width:${Math.round((m.counts[i] / t) * 100)}%"></i><span>${esc(o)}</span><b>${m.counts[i]}</b></div>`).join("")}</div>`; }
  const board = m.board?.length ? `<ol class="pc-board">${m.board.map((b) => `<li><span>${esc(b.username)}</span><small>${esc(b.note ?? "")}</small><b>+${b.pts}</b></li>`).join("")}</ol>` : "";
  card.innerHTML = `<div class="pc-head"><span>${esc(m.title.toUpperCase())} · RESULT</span><button type="button" class="pc-x" data-close aria-label="Hide">×</button></div>
    <p class="pc-ans">${m.kind === "trivia" ? "Answer: " : ""}<b>${esc(m.answer)}</b></p>${mid}
    <p class="pc-you">${me.answered ? `${medal} ${me.pts ? `You earned <b>+${me.pts}</b> pts` : "No points this time"}${me.coins ? ` · +${me.coins} coins` : ""}` : "You sat this one out. Jump in next round!"}</p>${board}`;
  if (me.place === 1) { good(); blip(1175, 0.4, "triangle", 0.08, 0.3); }
  clearTimeout(hideT); hideT = setTimeout(() => { if (!R) hide(); }, 8500);
}

export function initParty() {
  on("round", (m) => { R = { ...m.round, picked: null }; paintRound(); blip(440, 0.12, "triangle"); blip(660, 0.16, "triangle", 0.07, 0.1); });
  on("roundgo", (m) => { if (R && R.id === m.id) { R.go = true; paintRound(); blip(988, 0.2, "square", 0.06); } });
  on("roundend", showResult);
  on("roundstop", hide);
  on("liveevent", () => { const r = state.event?.round; if (r && (!R || R.id !== r.id)) { R = { ...r, picked: null }; paintRound(); } if (!state.event) hide(); });
}
