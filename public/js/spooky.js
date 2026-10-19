/* The Halloween look: orange accents, drifting bats and pumpkins. It switches itself off at midnight Pacific on Nov 1, 2026,
 * and anyone can turn it off sooner in Settings. */
import { HALLOWEEN_END } from "./cosmetics.js";

const KEY = "artemis.spooky";
export const halloweenOpen = () => Date.now() < HALLOWEEN_END;
export const spookyWanted = () => { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } };
export function setSpooky(on) { try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* storage blocked */ } apply(); }

const ITEMS = ["🦇", "🎃", "👻", "🦇", "🕸", "🦇", "🎃", "👻", "🦇"];
function build() {
  if (document.getElementById("spooky")) return;
  const l = document.createElement("div"); l.id = "spooky"; l.setAttribute("aria-hidden", "true");
  l.innerHTML = ITEMS.map((e, i) => `<i style="--x:${(i * 11.7 + 4) % 96}%;--d:${16 + (i * 3.1) % 14}s;--w:${-(i * 2.7)}s;--s:${e === "🦇" ? 20 + (i % 3) * 6 : 22}px">${e}</i>`).join("");
  document.body.appendChild(l);
}
function apply() {
  const on = halloweenOpen() && spookyWanted();
  document.documentElement.classList.toggle("spooky", on);
  if (on) build(); else document.getElementById("spooky")?.remove();
}
export function initSpooky() { apply(); setInterval(apply, 60_000); }
