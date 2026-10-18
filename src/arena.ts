/* The live-event arena on the server: connects the shared world rules to real players, points and rewards. */
import { db } from "./store.js";
import { ArenaWorld } from "../public/js/arena-core.js";
import { onArena, sendToUser } from "./chat.js";
import { addEventPoints, giveCoins, publicGame } from "./game.js";
import { saveDb } from "./store.js";
import { pushEventState } from "./economy.js";

const user = (id: string) => db.data.users.find((u) => u.id === id && !u.banned);
export const world: ArenaWorld = new ArenaWorld({
  send: (id, m) => sendToUser(id, { t: "arena", ...m }),
  award: (id, pts) => { const u = user(id), ev = db.data.event; if (!u || !ev) return; ev.points[id] ??= 0; addEventPoints(u, pts); },
  coins: (id, n) => { const u = user(id); if (u && db.data.event) giveCoins(u, n, "Loot drop"); },
  crate: (id) => { const u = user(id); if (!u) return; u.freePacks++; saveDb(); sendToUser(id, { t: "game", game: publicGame(u), gains: [{ text: "Loot crate", xp: 0 }], rankUp: null }); },
  name: (id) => user(id)?.username ?? "?",
  feed: (text) => { for (const h of world.humans()) sendToUser(h.id, { t: "arena", a: "feed", text }); },
});
onArena((u, m) => {
  if (!db.data.event) return;
  if (m.a === "join") world.join(u.id); else if (m.a === "leave") world.leave(u.id); else world.msg(u.id, m);
});
setInterval(() => { if (db.data.event) world.tick(0.05); }, 50).unref();
/* keeps the leaderboards and timer in the arena fresh */
setInterval(() => { if (db.data.event && world.humans().length) pushEventState(); }, 3000).unref();
