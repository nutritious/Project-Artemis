/* The live-event director: walks the owner's timeline (Gulper arena, loot storm, boss hunt, trivia) and switches the world and the party on cue. */
import { audit, db } from "./store.js";
import { PHASE_KINDS } from "../public/js/cosmetics.js";
import { broadcast } from "./chat.js";
import { endLive, onLiveEnd, onLiveStart, pushEventState } from "./economy.js";
import { setAuto } from "./party.js";
import { world } from "./arena.js";
import { saveDb } from "./store.js";

let timer: NodeJS.Timeout | undefined, began = "";
const ev = () => db.data.event;
function apply() {
  const e = ev(); if (!e?.schedule) return;
  const k = e.schedule[e.phase ?? 0].kind, def = PHASE_KINDS[k];
  world.setMode(def?.arena ? k : "none", e.cfg);
  try { setAuto("director", k === "trivia", 2500); } catch { /* event ended */ }
}
function arm() {
  clearTimeout(timer); const e = ev(); if (!e?.schedule) return;
  timer = setTimeout(next, Math.max(500, (e.phaseEnd ?? Date.now()) - Date.now()));
}
function begin(i: number, when = Date.now()) {
  const e = ev(); if (!e?.schedule) return;
  began = e.id; e.phase = i; e.phaseStart = when; e.phaseEnd = when + e.schedule[i].mins * 60_000; saveDb();
  apply(); arm(); pushEventState();
  const def = PHASE_KINDS[e.schedule[i].kind]; broadcast({ t: "phase", kind: e.schedule[i].kind, name: def?.name ?? "", icon: def?.icon ?? "", blurb: def?.blurb ?? "", mins: e.schedule[i].mins });
}
function next() {
  const e = ev(); if (!e?.schedule) return; const i = (e.phase ?? 0) + 1;
  if (i >= e.schedule.length) { if (e.loop) return begin(0); try { endLive("director"); } catch { /* already ended */ } return; }
  begin(i);
}
export function skipPhase(by: string) { if (!ev()?.schedule) throw new Error("No event is running"); audit(by, "event.phase.skip", String(ev()!.phase)); next(); }
export function extendPhase(by: string, mins: number) { const e = ev(); if (!e?.schedule) throw new Error("No event is running"); const m = Math.max(1, Math.min(10, Math.round(mins) || 1)); e.phaseEnd = (e.phaseEnd ?? Date.now()) + m * 60_000; saveDb(); arm(); pushEventState(); audit(by, "event.phase.extend", `+${m}m`); }
export function gotoPhase(by: string, i: number) { const e = ev(); if (!e?.schedule || !(i >= 0 && i < e.schedule.length)) throw new Error("No such phase"); audit(by, "event.phase.goto", String(i)); begin(i); }

onLiveStart((e) => { const wait = Math.max(0, (e.phaseStart ?? Date.now()) - Date.now()); world.setMode("none"); setTimeout(() => { if (ev()?.id === e.id && began !== e.id) { began = e.id; const k = e.schedule![0].kind; apply(); pushEventState(); broadcast({ t: "phase", kind: k, name: PHASE_KINDS[k]?.name ?? "", icon: PHASE_KINDS[k]?.icon ?? "", blurb: PHASE_KINDS[k]?.blurb ?? "", mins: e.schedule![0].mins }); } }, wait); arm(); });
onLiveEnd(() => { clearTimeout(timer); world.setMode("none"); });
/** After a restart the clock keeps running from where it was. */
export function resumeDirector() { const e = ev(); if (!e?.schedule) return; if ((e.phaseEnd ?? 0) <= Date.now()) return void next(); apply(); arm(); }
