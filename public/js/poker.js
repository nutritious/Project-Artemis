/* Texas Hold'em tab inside the Casino. Tables with bots are practice (free chips); tables with friends use real Artemis coins. */
import { $, $$, esc, hooks, on, state, toast, avatar } from "./util.js";
import { chatSend } from "./chat.js";
import { rankLabel, BB, newTable, addSeat, startHand, act as lact, botMove, leaveSeat, view as lview, canStart } from "./poker-core.js";

let root, T = null, coins = 0, invites = [], bots = 3, buyin = 250, raiseTo = 0, wired = false;
const fmt = (n) => Number(n).toLocaleString();
const me = () => state.me;

/* ---- transport: the real server over the socket, or a local table in the preview ---- */
let L = null, LT = null;
const lpush = () => { const v = lview(L, me().id); onPk({ t: "pk", table: L ? v : null, coins: me().coins, buyin: 1000 }); };
function lafter() {
  clearTimeout(LT); if (!L) return;
  if (L.phase === "showdown") { lpush(); LT = setTimeout(() => { if (!L) return; const r = startHand(L, Math.random); if (!r.ok || !L.seats.some((s) => s.id === me().id)) { onPk({ t: "pk", table: null, coins: me().coins, busted: true }); L = null; return; } lafter(); }, 5000); return; }
  lpush(); const s = L.seats[L.turn]; if (s?.bot) LT = setTimeout(() => { if (!L || L.seats[L.turn] !== s) return; const [a, am] = botMove(L, s.id, Math.random); try { lact(L, s.id, a, am); } catch { try { lact(L, s.id, "call"); } catch { lact(L, s.id, "fold"); } } lafter(); }, 700 + Math.random() * 900);
}
function localTx(m) {
  if (m.t === "pk-create") {
    if (!m.practice) return toast("Tables with friends need the real server. Try practice here.", true);
    L = newTable({ id: "local", host: me().id, practice: true }); addSeat(L, { id: me().id, name: me().username, stack: 1000 });
    ["Nova", "Comet", "Rocket", "Pixel"].slice(0, Math.max(1, m.bots ?? 3)).forEach((n, i) => addSeat(L, { id: "bot" + i, name: n + " (bot)", bot: true, stack: 1000 })); lpush();
  } else if (m.t === "pk-start") { if (L && canStart(L)) { startHand(L, Math.random); lafter(); } }
  else if (m.t === "pk-act") { try { lact(L, me().id, m.action, m.amount); lafter(); } catch (e) { toast(e.message, true); } }
  else if (m.t === "pk-leave") { clearTimeout(LT); L = null; onPk({ t: "pk", table: null, coins: me().coins }); }
}
const tx = (m) => (hooks.api ? localTx(m) : chatSend(m));

export function buildPoker(el) { if (root === el) return; root = el; if (!wired) { wired = true; on("ws", (m) => { if (m.t === "pk") onPk(m); else if (m.t === "pk-invite") onInvite(m); else if (m.t === "pk-note") toast(m.message, "ok"); }); } root.addEventListener("click", onClick); root.addEventListener("input", onInput); }
export function onPokerShown() { if (!hooks.api) tx({ t: "pk-state" }); paint(); }

function onPk(m) {
  if (m.coins != null && me()) { me().coins = m.coins; $$(".coinbal").forEach((e) => (e.textContent = fmt(m.coins))); $$("#liveBar .wallet b").forEach((e) => (e.textContent = fmt(m.coins))); }
  const had = T; T = m.table ?? null; if (m.busted) toast("You're out of chips. Sit down again any time.", true);
  if (T && had?.phase !== T.phase && T.phase === "showdown") { /* result banner is drawn from T.result */ }
  if (!T) invites = invites.filter((i) => true); paint();
}
function onInvite(m) { invites = invites.filter((i) => i.table !== m.table); invites.push(m); toast(`${m.from} invited you to poker (${fmt(m.buyin)} coins)`, "ok"); paint(); }

const suitCls = (u) => (u === "♥" || u === "♦" ? "suitred" : "");
const card = (c, small) => !c ? `<div class="bjcard back ${small ? "sm" : ""}"></div>` : `<div class="bjcard ${suitCls(c.u)} ${small ? "sm" : ""}"><b>${rankLabel(c.r)}</b><i>${c.u}</i></div>`;
function paint() {
  const box = $("#pokerBox"); if (!box) return;
  box.innerHTML = T ? tableHtml() : lobbyHtml();
  if (T) { const you = T.seats.find((s) => s.id === me().id); if (you && T.turn === me().id) { const min = T.bet + T.minRaise, max = you.bet + you.stack; if (!raiseTo || raiseTo < min || raiseTo > max) raiseTo = Math.min(max, min); const r = $("#pkRaise"); if (r) r.value = raiseTo; const n = $("#pkRaiseN"); if (n) n.value = raiseTo; } }
}
function lobbyHtml() {
  const friends = [...state.people.values()].filter((p) => state.friendRel?.(p.id) === "friends");
  return `<div class="pk-lobby"><div class="pk-card glass"><h3>🤖 Practice vs bots</h3><p>Free chips (1,000 each). No coins at risk, so bots never pay out coins.</p>
      <label class="c-in">Bots <select id="pkBots">${[1, 2, 3, 4].map((n) => `<option ${n === bots ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <button class="btn pri" data-pk="practice">Sit down</button></div>
    <div class="pk-card glass"><h3>🤝 Table with friends</h3><p>Real Artemis coins. You pay the buy-in, invite your friends, and whatever you have left is yours when you stand up. ${friends.length ? "" : "Add some friends first to invite them."}</p>
      <div class="c-chips">${[100, 250, 500].map((v) => `<button class="cchip ${buyin === v ? "on" : ""}" data-buyin="${v}">${v}</button>`).join("")}</div>
      <button class="btn pri" data-pk="create" ${me().coins < buyin ? "disabled" : ""}>Create table (${fmt(buyin)} coins)</button></div>
    ${invites.length ? `<div class="pk-card glass"><h3>📨 Invites</h3>${invites.map((i) => `<div class="pk-inv"><span><b>${esc(i.from)}</b> invited you · ${fmt(i.buyin)} coins</span><button class="btn pri" data-pk="join" data-t="${esc(i.table)}">Join</button></div>`).join("")}</div>` : ""}</div>
    <p class="c-fine">Texas Hold'em, blinds 5/10. Only friends can sit at your table. Practice chips and coin tables are separate.</p>`;
}
function tableHtml() {
  const n = T.seats.length, meIdx = Math.max(0, T.seats.findIndex((s) => s.id === me().id)), you = T.seats[meIdx];
  const pos = (k) => { const a = Math.PI / 2 + (k / Math.max(n, 2)) * Math.PI * 2; return [50 + Math.cos(a) * 41, 50 + Math.sin(a) * 38]; };
  const seats = T.seats.map((s, i) => { const k = (i - meIdx + n) % n, [x, y] = pos(k), turn = T.turn === s.id, win = T.result?.winners?.[s.id];
    return `<div class="pk-seat ${turn ? "turn" : ""} ${s.folded ? "fold" : ""} ${win ? "won" : ""}" style="left:${x}%;top:${y}%"><div class="pk-cards">${s.cards.map((c) => card(c, true)).join("")}</div><div class="pk-name"><b>${esc(s.name)}</b>${s.tag ? `<em>${esc(s.tag)}</em>` : ""}</div><div class="pk-stack">◎ ${fmt(s.stack)}${s.allIn ? " · ALL-IN" : ""}</div>${s.bet ? `<div class="pk-bet">${fmt(s.bet)}</div>` : ""}${win ? `<div class="pk-win">+${fmt(win)}</div>` : ""}</div>`; }).join("");
  const host = T.host === me().id, wait = T.phase === "wait", over = T.phase === "showdown", myTurn = T.turn === me().id && you;
  const friends = host && !T.practice ? [...state.people.values()].filter((p) => state.friendRel?.(p.id) === "friends" && !T.seats.some((s) => s.id === p.id)) : [];
  let bar = "";
  if (myTurn) { const call = T.toCall, max = you.bet + you.stack, min = Math.min(max, T.bet + T.minRaise);
    bar = `<div class="pk-actions"><button class="btn" data-act="fold">Fold</button>${call ? `<button class="btn pri" data-act="call">Call ${fmt(call)}</button>` : `<button class="btn pri" data-act="check">Check</button>`}
      ${max > T.bet ? `<div class="pk-raise"><input id="pkRaise" type="range" min="${min}" max="${max}" step="5" value="${raiseTo}"><input id="pkRaiseN" type="number" value="${raiseTo}"><button class="btn" data-act="raise">${T.bet ? "Raise to" : "Bet"}</button><button class="cchip" data-pre="half">½ pot</button><button class="cchip" data-pre="pot">Pot</button><button class="btn" data-act="allin">All-in</button></div>` : ""}</div>`;
  } else if (!wait && !over) bar = `<div class="pk-wait">${T.turn ? `Waiting for ${esc(T.seats.find((s) => s.id === T.turn)?.name ?? "")}…` : "Dealing…"}</div>`;
  else if (wait) bar = host ? `<div class="pk-wait">${T.seats.length < 2 ? "Invite a friend to start" : "Everyone here?"} <button class="btn pri" data-pk="start" ${T.seats.length < 2 ? "disabled" : ""}>Deal</button></div>` : `<div class="pk-wait">Waiting for the host to deal…</div>`;
  else bar = `<div class="pk-wait">Next hand in a few seconds…${host ? ` <button class="btn" data-pk="start">Deal now</button>` : ""}</div>`;
  const myHand = T.result?.reveal?.find((r) => r.id === me().id)?.hand;
  return `<div class="pk-table"><div class="pk-felt"><div class="pk-mid"><div class="pk-board">${[0, 1, 2, 3, 4].map((i) => T.board[i] ? card(T.board[i]) : `<div class="bjcard ghostc"></div>`).join("")}</div><div class="pk-pot">Pot ◎ ${fmt(T.pot)}</div><div class="pk-info">${esc(over ? T.result?.text ?? "" : T.lastAct ?? "")}</div></div>${seats}</div>
    ${bar}<div class="pk-foot"><span>${T.practice ? "Practice table · free chips" : "Coin table · real Artemis coins"}${myHand && over ? ` · you had ${esc(myHand)}` : ""}</span><button class="btn" data-pk="leave">Leave table</button></div>
    ${friends.length ? `<div class="pk-invites"><b>Invite a friend</b>${friends.map((p) => `<button class="cchip" data-pk="invite" data-f="${esc(p.id)}">${esc(p.username)}</button>`).join("")}</div>` : ""}</div>`;
}
function onInput(e) {
  if (e.target.id === "pkRaise") { raiseTo = +e.target.value; $("#pkRaiseN").value = raiseTo; }
  else if (e.target.id === "pkRaiseN") { raiseTo = Math.floor(+e.target.value || 0); }
  else if (e.target.id === "pkBots") bots = +e.target.value;
}
function onClick(e) {
  const t = e.target, b = t.closest("[data-buyin]"); if (b) { buyin = +b.dataset.buyin; paint(); return; }
  const k = t.closest("[data-pk]")?.dataset.pk;
  if (k === "practice") { bots = +($("#pkBots")?.value ?? bots); tx({ t: "pk-create", practice: true, bots }); }
  else if (k === "create") tx({ t: "pk-create", practice: false, buyin });
  else if (k === "join") { const id = t.closest("[data-t]").dataset.t; invites = invites.filter((i) => i.table !== id); tx({ t: "pk-join", table: id }); }
  else if (k === "start") tx({ t: "pk-start" });
  else if (k === "leave") tx({ t: "pk-leave" });
  else if (k === "invite") tx({ t: "pk-invite", friend: t.closest("[data-f]").dataset.f });
  const a = t.closest("[data-act]")?.dataset.act;
  if (a) { raiseTo = Math.floor(+($("#pkRaiseN")?.value ?? raiseTo)); tx({ t: "pk-act", action: a, amount: raiseTo }); }
  const pre = t.closest("[data-pre]")?.dataset.pre;
  if (pre && T) { const you = T.seats.find((s) => s.id === me().id), pot = T.pot + T.toCall; raiseTo = Math.min(you.bet + you.stack, Math.max(T.bet + T.minRaise, T.bet + Math.floor(pre === "half" ? pot / 2 : pot))); $("#pkRaise").value = raiseTo; $("#pkRaiseN").value = raiseTo; }
}
