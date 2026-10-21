/* The Halloween look: orange accents, drifting bats and pumpkins. It switches itself off at midnight Pacific on Nov 1, 2026,
 * and anyone can turn it off sooner in Settings. */
import { HALLOWEEN_END, FALL_END } from "./cosmetics.js";

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

/* The Fall look: warm amber accents and drifting leaves. It starts the moment Halloween ends (Nov 1) and switches itself off at the end of Dec 20, 2026. Anyone can turn it off in Settings. */
const FKEY = "artemis.fall";
export const fallOpen = () => Date.now() >= HALLOWEEN_END && Date.now() < FALL_END;
export const fallWanted = () => { try { return localStorage.getItem(FKEY) !== "off"; } catch { return true; } };
export function setFall(on) { try { localStorage.setItem(FKEY, on ? "on" : "off"); } catch { /* storage blocked */ } applyFall(); }
const LEAVES = ["🍂", "🍁", "🍂", "🍃", "🍁", "🍂", "🍃", "🍁", "🍂"];
function applyFall() {
  const on = fallOpen() && fallWanted();
  document.documentElement.classList.toggle("fall", on);
  if (on) {
    if (!document.getElementById("fallfx")) {
      const l = document.createElement("div"); l.id = "fallfx"; l.setAttribute("aria-hidden", "true");
      l.innerHTML = LEAVES.map((e, i) => `<i style="--x:${(i * 10.9 + 7) % 96}%;--d:${15 + (i * 3.7) % 13}s;--w:${-(i * 2.4)}s;--s:${18 + (i % 4) * 4}px">${e}</i>`).join("");
      document.body.appendChild(l);
    }
  } else document.getElementById("fallfx")?.remove();
}
export function initSpooky() { apply(); applyFall(); setInterval(() => { apply(); applyFall(); }, 60_000); }
