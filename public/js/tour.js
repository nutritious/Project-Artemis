/* The first-login tour, the rules text and the beta notes. Everything a new person should know, one step at a time. */
import { $, api, esc, emit, hue, overlay, state } from "./util.js";

/** Turns the owner's rules text into HTML. "## Heading" is a section, "- Title — text" is a rule, anything else is a paragraph. */
export function rulesHtml(text) {
  const out = []; let open = false;
  const close = () => { if (open) { out.push("</ul>"); open = false; } };
  for (const raw of String(text ?? "").split("\n")) {
    const l = raw.trim(); if (!l) continue;
    if (l.startsWith("## ")) { close(); out.push(`<h4>${esc(l.slice(3))}</h4>`); }
    else if (l.startsWith("- ")) { if (!open) { out.push("<ul>"); open = true; } const body = l.slice(2), i = body.indexOf(" — "); out.push(i > 0 ? `<li><b>${esc(body.slice(0, i))}</b> ${esc(body.slice(i + 3))}</li>` : `<li>${esc(body)}</li>`); }
    else { close(); out.push(`<p>${esc(l)}</p>`); }
  }
  close(); return out.join("");
}
export function showRules(text) {
  const o = overlay(`<div class="modal glass rules-modal" role="dialog" aria-modal="true" aria-label="Rules"><h3>Rules</h3><div class="rules-body">${rulesHtml(text)}</div><div class="row"><button class="btn primary" data-x>Got it</button></div></div>`);
  o.querySelector("[data-x]").onclick = () => o.remove(); o.addEventListener("click", (e) => { if (e.target === o) o.remove(); });
}

const BETA = `<span class="tour-beta">BETA</span>`;
const STEPS = [
  { i: "🌙", t: "Welcome to Project Artemis", b: ["Artemis is a place to browse, chat, play and collect, all in one spot.", `This site is in <b>beta</b>. That means it is still being built: things can break, change or reset while we fix them. Thanks for being here early!`, "This quick tour shows what you can do. It takes about a minute."], beta: true },
  { i: "🧭", t: "Browse", b: ["Open any website through Artemis. Type a search or a web address at the top.", `The proxy is <b>still in beta</b>. Some sites work great and some might not work. If a site breaks, go to <b>Settings &gt; Proxy engine</b> and try another one (Scramjet V2, Scramjet V1, Ultraviolet or Classic).`], beta: true },
  { i: "💬", t: "Chat", b: ["Talk in channels, send direct messages, add friends and jump in the voice lounge.", "Send GIFs with the GIF button, react to messages, and use @name to get someone's attention."] },
  { i: "▶️", t: "Tube", b: [`Watch videos in a YouTube-style page. Pick Full site or Grid mode at the top.`, `Tube is in <b>beta</b> too. Videos can fail to load sometimes, and it can depend on the day. Try again, or pick another server.`], beta: true },
  { i: "🎮", t: "Arcade, Hub and Casino", b: ["Play games and earn <b>coins</b> and <b>XP</b>. XP raises your rank, from Cadet all the way up to Touch Grass.", "Do the daily missions in the Hub, spin the hourly wheel, and try the Casino (it only uses Artemis coins, never real money)."] },
  { i: "📦", t: "Packs and the shop", b: ["Spend coins on packs to unlock profile effects, titles, backdrops and themes. The rarer, the cooler.", "Upgrades in the shop give you extra luck and faster openings. Limited packs, like the Fall pack, leave when the season ends."] },
  { i: "🎨", t: "Make it yours", b: ["Equip what you unlock from your profile and the Packs page. Change your theme, picture and bio in <b>Settings</b>.", "There are also tab cloak presets, a panic key, and Anti-close in Settings."] },
  { i: "☁️", t: "Events and the Cloud Browser", b: ["Live events pop up with arenas, trivia and prizes. You will see a banner when one starts.", `The <b>Cloud Browser</b> (the cloud button in Browse) runs a real browser for you. It is in <b>beta</b> and might not work every time.`], beta: true },
  { i: "📜", t: "Be kind, and you are set", b: ["Keep it friendly and keep it SFW. You agreed to the rules when you joined, and you can read them again any time in <b>Settings &gt; About Artemis</b>.", "See something broken? Use <b>Report issue</b> in the left menu. It helps a lot while we are in beta.", "You can replay this tour from Settings whenever you like. Have fun!"], rules: true },
];

/** The first thing a new person sees: who runs the place. Next leads into the tour; the X skips both. */
export async function openWelcome(onNext) {
  let crew = [{ name: "Warmaster", title: "Owner", avatar: "" }];
  try { crew = (await api("/config")).crew ?? crew; } catch {}
  const pic = (c) => c.avatar ? `<img src="${esc(c.avatar)}" alt="">` : `<span style="background:linear-gradient(135deg,hsl(${hue(c.name)} 60% 50%),hsl(${(hue(c.name) + 40) % 360} 55% 38%))">${esc(c.name[0].toUpperCase())}</span>`;
  const o = overlay(`<div class="modal glass welcome" role="dialog" aria-modal="true" aria-label="Welcome">
    <header><h3>Welcome to Project Artemis!</h3><button type="button" class="wl-x" data-x aria-label="Close">✕</button></header>
    <div class="wl-body"><p>Mission control for the open web. Browse, chat, play and collect, all in one place.</p>
      <h4>Meet the owners</h4>
      <div class="wl-crew">${crew.map((c) => `<div class="wl-card"><i class="wl-pic">${pic(c)}</i><div><b>${esc(c.name)}</b><small>${esc(c.title)}</small></div></div>`).join("")}</div></div>
    <footer><small>Tell a friend about Artemis!</small><button type="button" class="btn primary" data-next>Next</button></footer></div>`);
  const done = async (next) => { document.removeEventListener("keydown", key, true); o.remove(); if (next) return onNext?.(); if (state.me?.settings && !state.me.settings.tourSeen) { state.me.settings.tourSeen = true; try { await api("/settings", "PUT", { tourSeen: true }); } catch {} } };
  const key = (e) => { if (e.key === "Escape") done(false); else if (e.key === "Enter") done(true); };
  document.addEventListener("keydown", key, true);
  o.addEventListener("click", (e) => { if (e.target.closest("[data-next]")) done(true); else if (e.target.closest("[data-x]") || e.target === o) done(false); });
  o.querySelector("[data-next]").focus();
}

let open = null;
export function openTour(onDone) {
  if (open) return; let n = 0;
  const o = overlay(`<div class="modal glass tour" role="dialog" aria-modal="true" aria-label="Welcome tour"></div>`); open = o;
  const box = o.querySelector(".tour");
  const finish = async () => { open = null; document.removeEventListener("keydown", key, true); o.remove(); if (state.me?.settings && !state.me.settings.tourSeen) { state.me.settings.tourSeen = true; try { await api("/settings", "PUT", { tourSeen: true }); } catch { /* best effort */ } } onDone?.(); };
  const paint = () => {
    const s = STEPS[n], last = n === STEPS.length - 1;
    box.innerHTML = `<div class="tour-top"><span class="tour-step">Step ${n + 1} of ${STEPS.length}</span>${s.beta ? BETA : ""}<button class="tour-skip" data-skip>Skip tour</button></div>
      <div class="tour-ic" aria-hidden="true">${s.i}</div><h3>${esc(s.t)}</h3>${s.b.map((p) => `<p>${p}</p>`).join("")}
      <div class="tour-dots">${STEPS.map((_, k) => `<i class="${k === n ? "on" : k < n ? "done" : ""}"></i>`).join("")}</div>
      <div class="row">${n ? `<button class="btn" data-back>Back</button>` : ""}<button class="btn primary" data-next>${last ? "Start exploring" : "Next"}</button></div>`;
    box.querySelector("[data-next]").onclick = () => (last ? finish() : (n++, paint()));
    box.querySelector("[data-back]")?.addEventListener("click", () => { n--; paint(); });
    box.querySelector("[data-skip]").onclick = finish; box.querySelector("[data-next]").focus();
  };
  const key = (e) => { if (e.key === "Escape") { e.preventDefault(); finish(); } else if (e.key === "ArrowRight" && n < STEPS.length - 1) { n++; paint(); } else if (e.key === "ArrowLeft" && n > 0) { n--; paint(); } };
  document.addEventListener("keydown", key, true); paint();
}

/** Shows the tour once for a new account, after the launch animation is finished. */
const WKEY = "artemis.welcome1";
const seenWelcome = () => { try { return localStorage.getItem(WKEY) === "1"; } catch { return false; } };
const markWelcome = () => { try { localStorage.setItem(WKEY, "1"); } catch {} };
/** New people get the welcome, then the tour. People who already did the tour get the welcome once. */
export function maybeTour() {
  if (!state.me) return;
  const first = state.me.settings?.tourSeen === false;
  if (!first && seenWelcome()) return;
  let tries = 0;
  const wait = setInterval(() => {
    const introOn = !$("#intro")?.classList.contains("hidden") || !!document.querySelector("#gate:not(.hidden)");
    if (++tries > 150) return void clearInterval(wait);
    if (introOn || !state.me) return;
    clearInterval(wait); markWelcome(); openWelcome(first ? () => openTour() : undefined);
  }, 400);
}
export const replayTour = () => openWelcome(() => openTour());
void emit;
