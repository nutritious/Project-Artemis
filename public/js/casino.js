/* Casino tab inside Games: coin flip, slots, roulette, blackjack. Artemis coins only, no real money. */
import { $, $$, api, esc, state, toast } from "./util.js";
import { CAS, SYMS, colorOf } from "./casino-core.js";
import { buildPoker, onPokerShown } from "./poker.js";

const GAMES = [["slots", "🎰", "Slots", "Line up three"], ["blackjack", "🃏", "Blackjack", "Beat the dealer to 21"], ["roulette", "🎡", "Roulette", "Red, black or a number"], ["flip", "🪙", "Coin Flip", "Heads or tails, 1.96×"], ["poker", "♠️", "Poker", "Hold'em with friends"]];
let root, cur = "slots", bet = 50, busy = false, bj = null, side = "heads", pick = { kind: "red", num: 7 };
const fmt = (n) => Number(n).toLocaleString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function setCoins(c) {
  if (typeof c !== "number") return; state.me.coins = c;
  $$(".coinbal").forEach((el) => (el.textContent = fmt(c))); $$("#liveBar .wallet b").forEach((el) => (el.textContent = fmt(c)));
  const w = $("#cWallet"); if (w) w.textContent = fmt(c);
}
function head() {

}
function msg(t, kind = "") { const el = $("#cMsg"); if (el) { el.textContent = t; el.className = "cmsg " + kind; } }
async function call(game, body) {
  if (busy) return null; busy = true;
  try { const r = await api("/casino/" + game, "POST", body); setCoins(r.coins); head(); return r; }
  catch (e) { toast(e.message, true); msg(e.message, "bad"); return null; }
  finally { busy = false; paintBet(); }
}

export function buildCasino(el) {
  root = el;
  root.innerHTML = `<div class="casino">
    <div class="c-top"><div class="gtabs c-tabs" id="cTabs">${GAMES.map(([id, ic, n, d]) => `<button data-c="${id}"><b>${ic} ${n}</b><small>${d}</small></button>`).join("")}</div>
      <div class="c-wallet glass"><span>Balance <b>◎ <i id="cWallet">0</i></b></span></div></div>
    <div class="c-table glass" id="cTable"></div>
    <div class="c-betbar glass" id="cBet"></div>
    <p class="c-fine">Artemis coins only. No real money, ever. Bets ${CAS.MIN}–${CAS.MAX} coins. Take a break if it stops being fun.</p></div>`;
  $("#cTabs").addEventListener("click", (e) => { const b = e.target.closest("[data-c]"); if (b && !busy) show(b.dataset.c); });
  root.addEventListener("click", onClick);
}
let pokerBuilt = false;
export async function onCasinoShown() {
  try { const r = await api("/casino"); bj = r.bj; setCoins(r.coins); } catch { /* offline */ }
  if (bj && cur !== "blackjack") cur = "blackjack"; show(cur);
}
function show(id) { cur = id; $$("#cTabs button").forEach((b) => b.classList.toggle("on", b.dataset.c === id)); head(); setCoins(state.me?.coins ?? 0); paintTable(); paintBet(); msg(""); }

function paintBet() {
  const bar = $("#cBet"); if (!bar) return; bar.hidden = cur === "poker"; if (cur === "poker") return;
  const inHand = cur === "blackjack" && bj && !bj.done;
  bar.innerHTML = inHand ? `<span class="c-bjact"><button class="btn" data-bj="hit" ${busy ? "disabled" : ""}>Hit</button><button class="btn pri" data-bj="stand" ${busy ? "disabled" : ""}>Stand</button><button class="btn" data-bj="double" ${busy || bj.player.length !== 2 ? "disabled" : ""}>Double (${fmt(bj.bet)})</button></span>`
    : `<div class="c-chips">${[10, 50, 100, 250, 500].map((v) => `<button class="cchip ${bet === v ? "on" : ""}" data-bet="${v}">${v}</button>`).join("")}<label class="c-in">Bet <input id="cBetIn" type="number" min="${CAS.MIN}" max="${CAS.MAX}" value="${bet}"></label></div>
      <button class="btn pri c-go" data-go ${busy ? "disabled" : ""}>${cur === "slots" ? "Spin" : cur === "flip" ? "Flip" : cur === "roulette" ? "Spin the wheel" : "Deal"}</button>`;
  const inp = $("#cBetIn"); if (inp) inp.oninput = () => { bet = Math.max(0, Math.floor(+inp.value || 0)); $$(".cchip").forEach((c) => c.classList.toggle("on", +c.dataset.bet === bet)); };
}
const cardHtml = (c, back) => back ? `<div class="bjcard back"></div>` : `<div class="bjcard ${c.u === "♥" || c.u === "♦" ? "suitred" : ""}"><b>${["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][c.r]}</b><i>${c.u}</i></div>`;
function paintTable() {
  const t = $("#cTable"); if (!t) return;
  t.classList.toggle("pk", cur === "poker");
  if (cur === "poker") { t.innerHTML = `<div id="pokerBox" class="pokerbox"></div>`; if (!pokerBuilt) { pokerBuilt = true; } buildPoker(t); onPokerShown(); return; }
  if (cur === "slots") t.innerHTML = `<div class="slotm"><div class="reels">${[0, 1, 2].map((i) => `<div class="reel" id="reel${i}"><span>${SYMS[i * 2 % 6].s}</span></div>`).join("")}</div><div class="paytab">${SYMS.slice().reverse().map((y) => `<span>${y.s}${y.s}${y.s} <b>${y.x3}×</b></span>`).join("")}<span>🍒🍒 <b>1.2×</b></span><span>🍒 <b>0.5×</b></span></div></div><div id="cMsg" class="cmsg"></div>`;
  else if (cur === "flip") t.innerHTML = `<div class="flipm"><div class="coin3d" id="coin3d"><i class="f h">H</i><i class="f t">T</i></div><div class="c-sides"><button class="cchip ${side === "heads" ? "on" : ""}" data-side="heads">Heads</button><button class="cchip ${side === "tails" ? "on" : ""}" data-side="tails">Tails</button></div></div><div id="cMsg" class="cmsg"></div>`;
  else if (cur === "roulette") t.innerHTML = `<div class="roum"><div class="rball" id="rball">?</div><div class="rbets">${[["red", "Red 2×"], ["black", "Black 2×"], ["odd", "Odd 2×"], ["even", "Even 2×"], ["low", "1–18 2×"], ["high", "19–36 2×"]].map(([k, n]) => `<button class="cchip rk-${k} ${pick.kind === k ? "on" : ""}" data-kind="${k}">${n}</button>`).join("")}<button class="cchip ${pick.kind === "number" ? "on" : ""}" data-kind="number">Number 36× <input id="rnum" type="number" min="0" max="36" value="${pick.num}"></button></div></div><div id="cMsg" class="cmsg"></div>`;
  else paintBj();
}
function paintBj(final) {
  const t = $("#cTable"); if (!t) return;
  if (!bj) { t.innerHTML = `<div class="bjm"><p class="c-hint">Place a bet and deal. Blackjack pays 3:2. Dealer stands on 17.</p></div><div id="cMsg" class="cmsg"></div>`; return; }
  const out = bj.done ? ({ blackjack: "Blackjack! 3:2", win: "You win", push: "Push, bet returned", lose: "Dealer wins", bust: "Bust" }[bj.result] ?? "") : "";
  t.innerHTML = `<div class="bjm"><div class="bj-row"><small>Dealer ${bj.done ? bj.dt : bj.dt + "+"}</small><div class="hand">${bj.dealer.map((c) => cardHtml(c)).join("")}${bj.hidden ? cardHtml(null, true) : ""}</div></div>
    <div class="bj-row"><small>You ${bj.pt}</small><div class="hand">${bj.player.map((c) => cardHtml(c)).join("")}</div></div></div><div id="cMsg" class="cmsg ${bj.done ? (bj.payout > bj.bet ? "ok" : bj.payout === bj.bet ? "" : "bad") : ""}">${out ? out + (bj.payout > bj.bet ? ` +${fmt(bj.payout - bj.bet)}` : bj.payout < bj.bet ? ` −${fmt(bj.bet - bj.payout)}` : "") : ""}</div>`;
}

async function onClick(e) {
  const t = e.target;
  const b = t.closest("[data-bet]"); if (b) { bet = +b.dataset.bet; paintBet(); return; }
  const sd = t.closest("[data-side]"); if (sd && !busy) { side = sd.dataset.side; $$("[data-side]").forEach((x) => x.classList.toggle("on", x.dataset.side === side)); return; }
  const k = t.closest("[data-kind]"); if (k && !busy) { pick.kind = k.dataset.kind; $$("[data-kind]").forEach((x) => x.classList.toggle("on", x.dataset.kind === pick.kind)); return; }
  if (t.closest("[data-go]")) return go();
  const bjb = t.closest("[data-bj]"); if (bjb) return bjMove(bjb.dataset.bj);
}
function outcome(win, payout, b2) { const net = payout - b2; msg(net > 0 ? `You win +${fmt(net)}` : net === 0 ? "Even, you get your bet back" : `You lose −${fmt(-net)}`, net > 0 ? "ok" : net === 0 ? "" : "bad"); }
async function go() {
  if (busy) return; const b0 = bet;
  if (cur === "slots") {
    const r = await call("slots", { bet: b0 }); if (!r) return; busy = true; paintBet();
    const sp = SYMS.map((y) => y.s);
    const ids = [0, 1, 2].map((i) => $("#reel" + i)); ids.forEach((el) => el.classList.add("spin"));
    for (let i = 0; i < 3; i++) { const el = ids[i]; const end = Date.now() + 700 + i * 450; while (Date.now() < end) { el.firstElementChild.textContent = sp[Math.floor(Math.random() * sp.length)]; await sleep(70); } el.classList.remove("spin"); el.firstElementChild.textContent = r.reels[i]; el.classList.add("stop"); await sleep(60); el.classList.remove("stop"); }
    busy = false; paintBet(); if (r.payout > b0) { outcome(true, r.payout, b0); $("#cTable").classList.add("winpulse"); setTimeout(() => $("#cTable")?.classList.remove("winpulse"), 1400); } else if (r.payout) outcome(true, r.payout, b0); else msg("No luck. Spin again?", "bad");
  } else if (cur === "flip") {
    const r = await call("flip", { bet: b0, side }); if (!r) return; busy = true; paintBet();
    const c = $("#coin3d"); c.style.transition = "none"; c.style.transform = "rotateY(0)"; void c.offsetWidth; c.style.transition = "transform 1.3s cubic-bezier(.2,.7,.2,1)"; c.style.transform = `rotateY(${1800 + (r.out === "tails" ? 180 : 0)}deg)`;
    await sleep(1400); busy = false; paintBet(); outcome(r.win, r.payout, b0);
  } else if (cur === "roulette") {
    const num = pick.kind === "number" ? Math.floor(+($("#rnum")?.value ?? 7)) : 0; pick.num = num;
    const r = await call("roulette", { bet: b0, kind: pick.kind, num }); if (!r) return; busy = true; paintBet();
    const ball = $("#rball"); ball.className = "rball spin"; const end = Date.now() + 2200; while (Date.now() < end) { const n = Math.floor(Math.random() * 37); ball.textContent = n; ball.dataset.c = colorOf(n); await sleep(60 + (2200 - (end - Date.now())) / 14); }
    ball.className = "rball"; ball.textContent = r.n; ball.dataset.c = r.color; busy = false; paintBet(); outcome(r.win, r.payout, b0);
  } else {
    const r = await call("bj", { act: "deal", bet: b0 }); if (!r) return; bj = r.bj; paintBj(); paintBet();
    if (bj.done) { bj = bj; }
  }
}
async function bjMove(act) {
  const r = await call("bj", { act }); if (!r) return; bj = r.bj; paintBj(); paintBet();
}
