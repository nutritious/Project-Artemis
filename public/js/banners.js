/* Top-of-screen banners: the owner's event countdown, and "an update is live, restart" after a deploy. */
import { $, esc, on, state, emit, toast } from "./util.js";

let cd = null, timer = 0;
const left = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${m}m ${String(s % 60).padStart(2, "0")}s` : `${m}m ${String(s % 60).padStart(2, "0")}s`; };
function paintCountdown() {
  const c = state.countdown; clearInterval(timer);
  if (!c || c.at < Date.now() - 90_000 || !state.me) { cd?.remove(); cd = null; document.documentElement.classList.remove("has-cd"); return; }
  if (!cd) { cd = document.createElement("div"); cd.id = "cdBanner"; cd.setAttribute("role", "status"); document.body.appendChild(cd); }
  const when = new Date(c.at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  cd.innerHTML = `<span class="cd-ic">⏳</span><div class="cd-t"><b>${esc(c.title)}</b>${c.about ? `<small>${esc(c.about)}</small>` : ""}</div><div class="cd-n"><b id="cdN"></b><small>${esc(when)}</small></div>`;
  document.documentElement.classList.add("has-cd");
  const tick = () => { const ms = c.at - Date.now(), n = $("#cdN"); if (!n) return; if (ms <= 0) { n.textContent = "Starting now"; cd?.classList.add("now"); if (ms < -90_000) paintCountdown(); } else { n.textContent = left(ms); cd?.classList.remove("now"); } }; tick(); timer = setInterval(tick, 1000);
}
let upd = null;
function showUpdate() {
  if (upd) return; upd = document.createElement("button"); upd.type = "button"; upd.id = "updBanner";
  upd.innerHTML = `<span>🚀</span><b>The update is live!</b><span>Click here to restart and get the new version. Your account, chat and progress are kept.</span>`;
  upd.onclick = () => (window.onbeforeunload = null, location.reload()); document.body.appendChild(upd); toast("A new update is live", "ok");
}
export function initBanners() { on("countdown", paintCountdown); on("updatelive", showUpdate); on("self", () => { if (state.countdown && !cd) paintCountdown(); }); paintCountdown(); }
export { emit };
