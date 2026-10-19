/* Live-event arena rules ("Void Worms" / the Gulper). One shared world for everyone in the event.
   Pure logic with no DOM and no Node APIs, so the real server and the preview's fake backend run the exact same code.
   io = { send(id, msg), award(id, pts), coins(id, n), crate(id), name(id), feed(text) } */
export const SIZE = 2600;
export const PW = ["magnet", "shield", "speed", "x2"];
export const PW_MS = { magnet: 9000, shield: 7000, speed: 6000, x2: 12000 };
const rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = (a) => a[Math.floor(Math.random() * a.length)];
const BOT_NAMES = ["Vex", "Nyx", "Rogue", "Glitch", "Mothra", "Kraken", "Zap", "Ember", "Void", "Pixie", "Orbit", "Hex", "Rift", "Nova", "Slink", "Gulp"];
const LOOT_EVERY = { low: 9, med: 5, high: 3 }, BOSS_HP = { easy: 40, med: 70, hard: 110 };
const SPAWN_PROT = 2500, CELL = 120;

export class ArenaWorld {
  constructor(io) {
    this.io = io; this.w = new Map(); this.orbs = new Map(); this.grid = new Map(); this.nid = 1; this.mode = "none"; this.cfg = { bots: 0, loot: "med", boss: "med" };
    this.rm = []; this.add = []; this.tickN = 0; this.nextPw = 0; this.nextLoot = 0; this.nextCrate = 0; this.boss = null; this.pc = new Map(); this.got = new Map(); this.lastFlush = 0; this.botN = 0;
  }
  /* ---------- orbs ---------- */
  cellKey(x, y) { return ((x / CELL) | 0) * 1000 + ((y / CELL) | 0); }
  addOrb(x, y, v = 1, k = 0, pw = -1, c = rint(0, 3)) {
    x = Math.max(30, Math.min(SIZE - 30, x)); y = Math.max(30, Math.min(SIZE - 30, y));
    const o = { id: this.nid++, x: x | 0, y: y | 0, c, v, k, pw }; this.orbs.set(o.id, o);
    const key = this.cellKey(o.x, o.y); let s = this.grid.get(key); if (!s) this.grid.set(key, (s = new Set())); s.add(o.id);
    this.add.push([o.id, o.x, o.y, o.c, o.v, o.k, o.pw]); return o;
  }
  delOrb(o) { this.orbs.delete(o.id); this.grid.get(this.cellKey(o.x, o.y))?.delete(o.id); this.rm.push(o.id); }
  near(x, y, r, fn) {
    const c0 = ((x - r) / CELL) | 0, c1 = ((x + r) / CELL) | 0, r0 = ((y - r) / CELL) | 0, r1 = ((y + r) / CELL) | 0;
    for (let cx = Math.max(0, c0); cx <= c1; cx++) for (let cy = Math.max(0, r0); cy <= r1; cy++) { const s = this.grid.get(cx * 1000 + cy); if (!s) continue; for (const id of [...s]) { const o = this.orbs.get(id); if (o && (o.x - x) ** 2 + (o.y - y) ** 2 <= r * r) fn(o); } }
  }
  fullOrbs() { return [...this.orbs.values()].map((o) => [o.id, o.x, o.y, o.c, o.v, o.k, o.pw]); }
  countK(k) { let n = 0; for (const o of this.orbs.values()) if (o.k === k) n++; return n; }

  /* ---------- worms ---------- */
  humans() { return [...this.w.values()].filter((w) => !w.bot); }
  newWorm(id, name, bot) {
    const a = rnd(0, 6.28), x = rnd(300, SIZE - 300), y = rnd(300, SIZE - 300);
    return { id, name, bot, boss: false, x, y, a, len: bot ? rint(10, 30) : 14, segs: [], hist: [], alive: true, color: rint(0, 7), fx: {}, streak: 0, spawnAt: Date.now(), last: Date.now(), goal: a, think: 0, bias: rnd(-1, 1), boost: false, hit: new Map() };
  }
  join(id) {
    let w = this.w.get(id); if (!w) { w = this.newWorm(id, this.io.name(id), false); this.w.set(id, w); }
    w.last = Date.now(); w.alive = true; w.spawnAt = Date.now();
    this.io.send(id, { a: "init", size: SIZE, mode: this.mode, orbs: this.fullOrbs(), x: w.x | 0, y: w.y | 0, boss: this.bossInfo() });
  }
  leave(id) { this.w.delete(id); this.pc.delete(id); }
  has(id) { return this.w.has(id); }
  bossInfo() { return this.boss ? { hp: this.boss.hp, max: this.boss.max } : null; }
  setMode(mode, cfg) {
    if (cfg) this.cfg = { ...this.cfg, ...cfg };
    if (mode === this.mode) return;
    this.mode = mode; this.boss && this.w.delete(this.boss.id); this.boss = null;
    for (const w of [...this.w.values()]) if (w.bot) this.w.delete(w.id);
    if (mode === "none") { for (const o of [...this.orbs.values()]) this.delOrb(o); this.flushCoins(true); }
    else { this.fillOrbs(); if (mode === "boss") this.spawnBoss(); this.nextPw = Date.now() + 3000; this.nextLoot = Date.now() + 2500; this.nextCrate = Date.now() + 9000; }
    for (const w of this.humans()) { this.io.send(w.id, { a: "mode", mode, boss: this.bossInfo() }); }
    if (mode !== "none") for (const w of this.humans()) { w.alive = true; w.spawnAt = Date.now(); }
  }
  fillOrbs() { const want = 520; let n = this.countK(0) + this.countK(1); while (n < want) { this.addOrb(rnd(40, SIZE - 40), rnd(40, SIZE - 40), n % 26 === 0 ? 5 : 1, n % 26 === 0 ? 1 : 0); n++; } }
  spawnBoss() {
    const humans = this.humans().length, max = BOSS_HP[this.cfg.boss] + 4 * humans;
    const b = this.newWorm("boss", "THE GULPER", true); b.boss = true; b.len = 80; b.hp = max; b.max = max; b.dmg = new Map(); b.x = SIZE / 2; b.y = SIZE / 2; this.boss = b; this.w.set("boss", b);
    this.io.feed("A giant worm is loose. Touch its head to hurt it. Its body is deadly.");
  }

  /* ---------- messages from players ---------- */
  msg(id, m) {
    if (this.mode === "none") return;
    let w = this.w.get(id); if (!w) { this.join(id); w = this.w.get(id); }
    const now = Date.now();
    if (m.a === "pos") {
      if (now - w.last < 35) return; const dt = Math.min(1, (now - w.last) / 1000); w.last = now;
      if (!w.alive) return;
      const x = +m.x, y = +m.y; if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const max = 11 * dt * 60 * (w.fx.speed > now ? 1.5 : 1) + 60;
      if ((x - w.x) ** 2 + (y - w.y) ** 2 > max * max) { this.io.send(id, { a: "snap", x: w.x | 0, y: w.y | 0 }); return; }
      w.x = Math.max(4, Math.min(SIZE - 4, x)); w.y = Math.max(4, Math.min(SIZE - 4, y)); w.a = +m.ang || 0; w.boost = !!m.boost;
      if (Array.isArray(m.s)) { const s = m.s.slice(0, 64).map((n) => Math.round(+n) || 0); w.segs = s; }
      if (Number.isFinite(+m.len)) w.len = Math.min(w.len, Math.max(8, +m.len)); /* clients can shrink (boost) but only the server grows you */
      this.eat(w);
    } else if (m.a === "die") this.playerDie(w, String(m.by ?? ""));
    else if (m.a === "spawn") { if (w.alive && now - w.spawnAt < 1500) return; const a = rnd(0, 6.28); Object.assign(w, { x: rnd(300, SIZE - 300), y: rnd(300, SIZE - 300), a, alive: true, spawnAt: now, len: 14, segs: [], fx: {}, streak: 0 }); this.io.send(id, { a: "spawned", x: w.x | 0, y: w.y | 0, a2: a }); }
    else if (m.a === "hit") this.bossHit(w, now);
  }
  eat(w) {
    const now = Date.now(), magnet = w.fx.magnet > now, r = (magnet ? 150 : 34), x2 = w.fx.x2 > now ? 2 : 1;
    let pts = 0, grow = 0, n = 0, big = false;
    this.near(w.x, w.y, r, (o) => {
      const d2 = (o.x - w.x) ** 2 + (o.y - w.y) ** 2; if (d2 > 34 * 34 && !magnet) return; if (d2 > r * r) return;
      if (o.k === 4) { const t = PW[o.pw]; w.fx[t] = now + PW_MS[t]; this.io.send(w.id, { a: "fx", type: t, ms: PW_MS[t] }); this.delOrb(o); n++; return; }
      if (o.k === 2) { this.bumpCoins(w, o.v); this.delOrb(o); n++; big = true; return; }
      if (o.k === 3) { const g = this.got.get(w.id) ?? { c: 0, k: 0 }; if (g.k < 4) { g.k++; this.got.set(w.id, g); this.io.crate(w.id); this.io.send(w.id, { a: "loot", kind: "crate" }); } this.delOrb(o); n++; big = true; return; }
      pts += o.v * x2; grow += o.v * 0.35; n++; if (o.k === 1) big = true; this.delOrb(o);
    });
    if (!n) return;
    w.len += grow; if (pts) this.io.award(w.id, pts);
    this.io.send(w.id, { a: "eat", n, pts, grow, big, len: w.len });
  }
  bumpCoins(w, v) { const g = this.got.get(w.id) ?? { c: 0, k: 0 }; if (g.c >= 2500) return; g.c += v; this.got.set(w.id, g); this.pc.set(w.id, (this.pc.get(w.id) ?? 0) + v); this.io.send(w.id, { a: "loot", kind: "coin", n: v }); }
  flushCoins(force) { const now = Date.now(); if (!force && now - this.lastFlush < 4000) return; this.lastFlush = now; for (const [id, n] of this.pc) if (n > 0) this.io.coins(id, n); this.pc.clear(); }

  /* ---------- deaths and kills ---------- */
  near2(w, o, r) { if (Math.hypot(o.x - w.x, o.y - w.y) < r) return true; for (let i = 0; i + 1 < o.segs.length; i += 2) if (Math.hypot(o.segs[i] - w.x, o.segs[i + 1] - w.y) < r) return true; return false; }
  playerDie(w, byId) {
    const now = Date.now(); if (!w.alive || now - w.spawnAt < SPAWN_PROT || w.fx.shield > now) return;
    const by = byId ? this.w.get(byId) : null;
    if (byId && (!by || !by.alive || !this.near2(w, by, 80))) return; /* claimed killer is not close enough */
    this.kill(w, by);
  }
  kill(v, by) {
    v.alive = false; v.streak = 0;
    const pts = []; const s = v.segs.length ? v.segs : [v.x, v.y];
    for (let i = 0; i + 1 < s.length && pts.length < 30; i += 2) this.addOrb(s[i] + rnd(-10, 10), s[i + 1] + rnd(-10, 10), 2, 0, -1);
    this.add.length > 400 && (this.add.length = 400);
    if (!v.bot) this.io.send(v.id, { a: "dead", by: by?.name ?? "" });
    if (by && !by.boss) {
      by.streak++; const bonus = Math.min(25, (by.streak - 1) * 3), p = 5 + bonus;
      if (!by.bot) { this.io.award(by.id, p); this.io.send(by.id, { a: "kill", name: v.name, pts: p, streak: by.streak }); }
      this.io.feed(`${by.name} took down ${v.name}${by.streak > 1 ? ` (x${by.streak} streak)` : ""}`);
    }
    if (v.bot && !v.boss) { setTimeout(() => { if (this.mode !== "none" && this.w.get(v.id) === v) { this.w.delete(v.id); } }, 100); }
  }
  bossHit(w, now) {
    const b = this.boss; if (!b || !w.alive || b.hp <= 0) return; if (now - (b.hit.get(w.id) ?? 0) < 450) return;
    if (Math.hypot(b.x - w.x, b.y - w.y) > 90) return; b.hit.set(w.id, now);
    b.hp--; b.dmg.set(w.id, (b.dmg.get(w.id) ?? 0) + 1); this.io.award(w.id, 3); this.io.send(w.id, { a: "bosshit", hp: b.hp });
    if (b.hp <= 0) this.bossDead();
  }
  bossDead() {
    const b = this.boss; if (!b) return; this.boss = null; this.w.delete("boss");
    for (let i = 0; i < 70; i++) this.addOrb(b.x + rnd(-260, 260), b.y + rnd(-260, 260), i % 5 === 0 ? 8 : 3, 1, -1, rint(0, 3));
    let top = null, topN = 0;
    for (const [id, n] of b.dmg) { this.io.award(id, 40 + n * 8); this.bumpCoins({ id }, Math.min(600, 80 + n * 15)); this.io.send(id, { a: "bossdead", dmg: n, coins: Math.min(600, 80 + n * 15) }); if (n > topN) { top = id; topN = n; } }
    if (top) { const g = this.got.get(top) ?? { c: 0, k: 0 }; g.k = Math.min(4, g.k + 1); this.got.set(top, g); this.io.crate(top); }
    this.io.feed(`The Gulper was defeated${top ? ` · most damage: ${this.io.name(top)}` : ""}`);
    for (const w of this.humans()) this.io.send(w.id, { a: "boss", hp: 0, max: b.max });
  }

  /* ---------- the tick ---------- */
  tick(dt) {
    if (this.mode === "none") return; const now = Date.now(); this.tickN++;
    /* drop players that went quiet (tab closed) */
    for (const w of [...this.w.values()]) if (!w.bot && now - w.last > 9000) this.leave(w.id);
    /* keep the arena stocked */
    const want = 0; /* no filler bots: only real players (and the boss worm) are in the arena */ let nb = 0; for (const w of this.w.values()) if (w.bot && !w.boss) nb++;
    if (nb < want && this.tickN % 10 === 0) { const b = this.newWorm("b" + ++this.botN, pick(BOT_NAMES) + rint(1, 99), true); b.spawnAt = now; this.w.set(b.id, b); }
    if (this.tickN % 20 === 0) { let n = this.countK(0) + this.countK(1); for (let i = 0; i < 24 && n < 520; i++, n++) this.addOrb(rnd(40, SIZE - 40), rnd(40, SIZE - 40), n % 26 === 0 ? 5 : 1, n % 26 === 0 ? 1 : 0); }
    if (now > this.nextPw) { this.nextPw = now + 9000; if (this.countK(4) < 6) this.addOrb(rnd(200, SIZE - 200), rnd(200, SIZE - 200), 1, 4, rint(0, 3)); }
    if (this.mode === "loot") {
      if (now > this.nextLoot) { this.nextLoot = now + LOOT_EVERY[this.cfg.loot] * 1000; const x = rnd(300, SIZE - 300), y = rnd(300, SIZE - 300), n = rint(8, 14); for (let i = 0; i < n; i++) this.addOrb(x + rnd(-130, 130), y + rnd(-130, 130), rint(5, 15), 2, -1, 3); for (const h of this.humans()) this.io.send(h.id, { a: "drop", x: x | 0, y: y | 0, kind: "coins" }); }
      if (now > this.nextCrate) { this.nextCrate = now + LOOT_EVERY[this.cfg.loot] * 4500; const x = rnd(300, SIZE - 300), y = rnd(300, SIZE - 300); this.addOrb(x, y, 1, 3, -1, 2); for (const h of this.humans()) this.io.send(h.id, { a: "drop", x: x | 0, y: y | 0, kind: "crate" }); this.io.feed("A loot crate dropped! Check the minimap."); }
    }
    for (const w of this.w.values()) if (w.bot) this.botStep(w, dt, now);
    /* bots die on other bodies */
    for (const w of [...this.w.values()]) if (w.bot && !w.boss && w.alive && now - w.spawnAt > SPAWN_PROT) for (const o of this.w.values()) { if (o === w || !o.alive || o.segs.length < 4) continue; const skip = o.boss ? 12 : 0; let hit = false; for (let i = skip * 2; i + 1 < o.segs.length; i += 2) if ((o.segs[i] - w.x) ** 2 + (o.segs[i + 1] - w.y) ** 2 < 26 * 26) { hit = true; break; } if (hit) { this.kill(w, o.bot && !o.boss ? o : o.boss ? null : o); break; } }
    if (this.boss) { const b = this.boss; for (const h of this.humans()) if (h.alive) { /* the boss lunges at the nearest player */ } }
    this.flushCoins();
    if (this.tickN % 2 === 0) this.snapshot(now);
  }
  botStep(w, dt, now) {
    if (!w.alive) return;
    const boss = w.boss, speed = (boss ? 2.2 : 2.9) * dt * 60 * (w.fx.speed > now ? 1.4 : 1);
    w.think -= dt;
    if (w.think <= 0) {
      w.think = rnd(0.15, 0.4);
      if (boss) { let best = null, bd = 1e12; for (const h of this.humans()) if (h.alive) { const d = (h.x - w.x) ** 2 + (h.y - w.y) ** 2; if (d < bd) { bd = d; best = h; } } w.goal = best ? Math.atan2(best.y - w.y, best.x - w.x) + Math.sin(now / 900) * 0.5 : w.a + 0.3; }
      else { let best = null, bd = 420 * 420; this.near(w.x, w.y, 420, (o) => { const d = (o.x - w.x) ** 2 + (o.y - w.y) ** 2; if (d < bd && o.k !== 2) { bd = d; best = o; } }); w.goal = best ? Math.atan2(best.y - w.y, best.x - w.x) : w.a + w.bias * 0.8; if (Math.random() < 0.1) w.bias = rnd(-1, 1); }
    }
    let want = w.goal; const m = 150; if (w.x < m) want = 0; else if (w.x > SIZE - m) want = Math.PI; if (w.y < m) want = Math.PI / 2; else if (w.y > SIZE - m) want = -Math.PI / 2;
    if (!boss) for (const o of this.w.values()) { if (o === w || !o.alive) continue; if (Math.hypot(o.x - w.x, o.y - w.y) > 400) continue; const fx = w.x + Math.cos(w.a) * 45, fy = w.y + Math.sin(w.a) * 45; for (let i = 0; i + 1 < o.segs.length; i += 2) if (Math.hypot(o.segs[i] - fx, o.segs[i + 1] - fy) < 42) { want = Math.atan2(w.y - o.segs[i + 1], w.x - o.segs[i]); i = 1e9; } }
    const diff = ((want - w.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI, turn = (boss ? 0.04 : 0.075) * dt * 60; w.a += Math.max(-turn, Math.min(turn, diff));
    w.x += Math.cos(w.a) * speed; w.y += Math.sin(w.a) * speed; w.x = Math.max(8, Math.min(SIZE - 8, w.x)); w.y = Math.max(8, Math.min(SIZE - 8, w.y));
    w.hist.unshift(w.x, w.y); const keep = Math.round(w.len * 2.4) * 2; if (w.hist.length > keep) w.hist.length = keep;
    const s = []; for (let i = 0; i < w.hist.length && s.length < 48; i += 4) s.push(w.hist[i] | 0, w.hist[i + 1] | 0); w.segs = s;
    if (!boss) { this.near(w.x, w.y, 26, (o) => { if (o.k === 2 || o.k === 3 || o.k === 4) return; w.len += o.v * 0.35; this.delOrb(o); }); }
  }
  snapshot(now) {
    const list = [...this.w.values()].filter((w) => w.alive), humans = this.humans();
    if (this.add.length || this.rm.length) { const m = { a: "orbs", rm: this.rm, add: this.add }; for (const h of humans) this.io.send(h.id, m); this.rm = []; this.add = []; }
    for (const h of humans) {
      const out = [];
      for (const w of list) { if (w.id === h.id) continue; if (!w.boss && Math.abs(w.x - h.x) > 1700 && Math.abs(w.y - h.y) > 1700) continue; const f = (w.bot ? 1 : 0) | (w.boss ? 2 : 0) | (w.fx.shield > now ? 4 : 0) | (w.boost ? 8 : 0) | (now - w.spawnAt < SPAWN_PROT ? 32 : 0); out.push([w.id, w.name, w.x | 0, w.y | 0, Math.round(w.a * 100), w.len | 0, f, w.color, ...w.segs]); }
      this.io.send(h.id, { a: "s", w: out, boss: this.bossInfo(), n: humans.length });
    }
  }
}
