/* Project Artemis — launch intro (pure canvas, ~9s, skippable). */
export function playIntro2D({ canvas, hud, title, onDone }) {
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.width = Math.floor(innerWidth * dpr);
    H = canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
  };
  resize();
  addEventListener("resize", resize);

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  const stars = Array.from({ length: 320 }, () => ({ x: Math.random(), y: Math.random(), z: rnd(0.2, 1), tw: rnd(0, 6.28) }));
  const smoke = [];
  const trail = [];
  const craters = [[-.35, -.2, .16], [.25, -.3, .11], [.1, .25, .2], [-.4, .3, .09], [.45, .1, .08], [-.05, -.45, .07]];

  const T_IGNITE = 1.6, T_LIFT = 2.4, T_MOON = 4.2, T_TITLE = 6.4, T_SUB = 7.5, T_END = 9.4;
  let start = null, raf = 0, finished = false, last = 0, shakeSeed = 0;

  /* ---------- scene pieces ---------- */
  function sky(p) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    const top = [lerp(14, 3, p), lerp(22, 4, p), lerp(52, 10, p)];
    const bot = [lerp(255, 5, p), lerp(138, 6, p), lerp(66, 13, p)];
    g.addColorStop(0, `rgb(${top.map(Math.round)})`);
    g.addColorStop(0.7, `rgb(${[lerp(70, 5, p), lerp(52, 6, p), lerp(110, 13, p)].map(Math.round)})`);
    g.addColorStop(1, `rgb(${bot.map(Math.round)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  let starScroll = 0;
  function drawStars(t, a, speed, dt) {
    if (a <= 0) return;
    starScroll += speed * dt * 160 * dpr;
    for (const s of stars) {
      const tw = 0.6 + 0.4 * Math.sin(t * 2 + s.tw);
      const y = (s.y * H + starScroll * s.z) % H;
      ctx.globalAlpha = a * s.z * tw * (0.55 + 0.45 * (1 - Math.min(1, speed / 2)));
      ctx.fillStyle = "#cfe0ff";
      const len = s.z > 0.6 && speed > 0.2 ? speed * s.z * 5 * dpr : 0;
      ctx.fillRect(s.x * W, y, s.z * 1.6 * dpr, s.z * 1.6 * dpr + len);
    }
    ctx.globalAlpha = 1;
  }

  function drawGround(groundY, alt) {
    if (groundY - 420 * (H / 900) > H) return;
    const g = ctx.createLinearGradient(0, groundY, 0, groundY + 260 * dpr);
    g.addColorStop(0, "#0a0d1c");
    g.addColorStop(1, "#020309");
    ctx.fillStyle = g;
    ctx.fillRect(0, groundY, W, H - groundY + 600 * dpr);
    // horizon glow
    const hg = ctx.createLinearGradient(0, groundY - 90 * dpr, 0, groundY);
    hg.addColorStop(0, "rgba(255,138,66,0)");
    hg.addColorStop(1, "rgba(255,138,66,.22)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, groundY - 90 * dpr, W, 90 * dpr);
    // launch tower
    const tx = W / 2 - 120 * dpr, th = 380 * dpr * (H / 900 / dpr), tw = 26 * dpr;
    ctx.strokeStyle = "#1a2040";
    ctx.lineWidth = 2 * dpr;
    ctx.strokeRect(tx, groundY - th, tw, th);
    for (let i = 0; i < 14; i++) {
      const y = groundY - th + (th / 14) * i;
      ctx.beginPath();
      ctx.moveTo(tx, y);
      ctx.lineTo(tx + tw, y + th / 14);
      ctx.moveTo(tx + tw, y);
      ctx.lineTo(tx, y + th / 14);
      ctx.stroke();
    }
    ctx.fillStyle = "#ff3b3b";
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(performance.now() / 260);
    ctx.fillRect(tx + tw / 2 - 2 * dpr, groundY - th - 6 * dpr, 4 * dpr, 4 * dpr);
    ctx.globalAlpha = 1;
    // pad lights
    for (let i = -6; i <= 6; i++) {
      ctx.fillStyle = "rgba(255,200,140,.7)";
      ctx.fillRect(W / 2 + i * 70 * dpr, groundY + 14 * dpr, 3 * dpr, 3 * dpr);
    }
    void alt;
  }

  function drawEarth(t, a) {
    if (a <= 0) return;
    const R = Math.max(W, H) * 1.6;
    const top = H * lerp(0.86, 0.97, clamp((t - T_MOON) / 4));
    const cx = W / 2, cy = top + R;
    const glow = ctx.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.04);
    glow.addColorStop(0, `rgba(90,160,255,${0.55 * a})`);
    glow.addColorStop(1, "rgba(90,160,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.04, 0, 6.283);
    ctx.fill();
    const g = ctx.createRadialGradient(cx - R * 0.1, cy - R * 1.02, R * 0.1, cx, cy, R);
    g.addColorStop(0, `rgba(30,70,140,${a})`);
    g.addColorStop(1, `rgba(4,10,28,${a})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 6.283);
    ctx.fill();
  }

  function drawMoon(r, cx, cy, a) {
    if (r < 2) return;
    ctx.save();
    ctx.globalAlpha = a;
    const glow = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 2.4);
    glow.addColorStop(0, "rgba(180,200,255,.35)");
    glow.addColorStop(1, "rgba(180,200,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.4, 0, 6.283);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.283);
    ctx.clip();
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.3, r * 0.1, cx, cy, r * 1.05);
    g.addColorStop(0, "#f2f4ff");
    g.addColorStop(0.6, "#aab0cc");
    g.addColorStop(1, "#3a4062");
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    for (const [dx, dy, cr] of craters) {
      ctx.fillStyle = "rgba(60,66,100,.28)";
      ctx.beginPath();
      ctx.arc(cx + dx * r, cy + dy * r, cr * r, 0, 6.283);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.14)";
      ctx.lineWidth = Math.max(1, r * 0.01);
      ctx.beginPath();
      ctx.arc(cx + dx * r - cr * r * 0.08, cy + dy * r - cr * r * 0.08, cr * r, 0.6, 3.6);
      ctx.stroke();
    }
    // terminator shadow
    const sh = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    sh.addColorStop(0, "rgba(2,4,14,0)");
    sh.addColorStop(0.55, "rgba(2,4,14,0)");
    sh.addColorStop(1, "rgba(2,4,14,.7)");
    ctx.fillStyle = sh;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  function drawRocket(x, y, s, thrust, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // flame
    if (thrust > 0) {
      const fl = 150 * thrust * (0.85 + Math.random() * 0.3);
      const glow = ctx.createRadialGradient(0, 10, 4, 0, 40, 170 * thrust + 20);
      glow.addColorStop(0, `rgba(255,190,110,${0.55 * thrust})`);
      glow.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(-220, -60, 440, 420 * thrust + 60);
      for (const [fx, w, k] of [[0, 15, 1], [-24, 8, 0.75], [24, 8, 0.75]]) {
        const g = ctx.createLinearGradient(0, 0, 0, fl * k);
        g.addColorStop(0, "#fff7e0");
        g.addColorStop(0.25, "#ffc060");
        g.addColorStop(0.7, "#ff6a1f");
        g.addColorStop(1, "rgba(255,60,20,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(fx - w, 0);
        ctx.quadraticCurveTo(fx - w * 0.6, fl * k * 0.5, fx + Math.sin(t * 40) * 3, fl * k);
        ctx.quadraticCurveTo(fx + w * 0.6, fl * k * 0.5, fx + w, 0);
        ctx.closePath();
        ctx.fill();
      }
    }
    // boosters
    for (const sx of [-1, 1]) {
      ctx.fillStyle = "#e9ecf6";
      ctx.fillRect(sx * 24 - 7, -210, 14, 210);
      ctx.beginPath();
      ctx.moveTo(sx * 24 - 7, -210);
      ctx.quadraticCurveTo(sx * 24, -246, sx * 24 + 7, -210);
      ctx.fill();
      ctx.fillStyle = "#2a2f4d";
      ctx.fillRect(sx * 24 - 6, -4, 12, 8);
    }
    // core
    const cg = ctx.createLinearGradient(-15, 0, 15, 0);
    cg.addColorStop(0, "#c2c7dc");
    cg.addColorStop(0.5, "#ffffff");
    cg.addColorStop(1, "#aab0c8");
    ctx.fillStyle = cg;
    ctx.fillRect(-15, -300, 30, 300);
    ctx.fillStyle = "#e5833a";
    ctx.fillRect(-15, -300, 30, 140);
    ctx.fillStyle = "#1b1f3a";
    ctx.fillRect(-15, -160, 30, 3);
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(-15, -300);
    ctx.quadraticCurveTo(0, -372, 15, -300);
    ctx.fill();
    ctx.fillStyle = "#2a2f4d";
    ctx.fillRect(-10, -6, 20, 10);
    ctx.restore();
  }

  function drawSmoke(groundY, dt) {
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i];
      p.life -= dt;
      if (p.life <= 0) { smoke.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += p.grow * dt;
      const a = clamp(p.life / p.max) * 0.5;
      const g = ctx.createRadialGradient(p.x, groundY + p.y, 0, p.x, groundY + p.y, p.r);
      g.addColorStop(0, `rgba(${p.c},${p.c - 10},${p.c - 20},${a})`);
      g.addColorStop(1, `rgba(${p.c},${p.c - 10},${p.c - 20},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, groundY + p.y, p.r, 0, 6.283);
      ctx.fill();
    }
  }

  function drawTrail(dt) {
    for (let i = trail.length - 1; i >= 0; i--) {
      const p = trail[i];
      p.life -= dt;
      if (p.life <= 0) { trail.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = clamp(p.life / p.max) * 0.8;
      ctx.fillStyle = p.hot ? "#ffd08a" : "#ff7a2f";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- HUD ---------- */
  let lastHud = "";
  function setHud(t, alt, vel) {
    let line1, line2 = "";
    if (t < T_LIFT) {
      const c = Math.max(0, T_LIFT - t);
      line1 = t < T_IGNITE ? `T-${c.toFixed(1).padStart(4, "0")}` : "IGNITION";
      line2 = t < 0.8 ? "ALL SYSTEMS NOMINAL" : t < T_IGNITE ? "FINAL POLL · GO FOR LAUNCH" : "MAIN ENGINE START";
    } else {
      line1 = `T+${(t - T_LIFT).toFixed(1).padStart(4, "0")}`;
      line2 = t > T_TITLE ? "TRANS-LUNAR INJECTION COMPLETE" : `ALT ${alt.toFixed(1)} KM  ·  VEL ${Math.round(vel).toLocaleString()} M/S`;
    }
    const s = line1 + "|" + line2;
    if (s !== lastHud) {
      hud.querySelector(".hud-1").textContent = line1;
      hud.querySelector(".hud-2").textContent = line2;
      lastHud = s;
    }
  }

  /* ---------- main loop ---------- */
  function frame(ts) {
    if (finished) return;
    if (start === null) start = ts;
    const t = (ts - start) / 1000;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;

    const flying = Math.max(0, t - T_LIFT);
    const alt = 0.5 * 6.2 * flying * flying;                     // km
    const vel = 6.2 * flying * 1000 * 0.9;
    const p = clamp(flying / 3.2);
    const thrust = t < T_IGNITE ? 0 : easeOut(clamp((t - T_IGNITE) / 0.8));
    const scale = (H / 900) * 1.0;

    // shake
    shakeSeed += dt;
    const shakeAmt = t >= T_IGNITE && t < T_LIFT + 2.2 ? (t < T_LIFT ? 1.5 : 3) * dpr * (1 - clamp((t - T_LIFT) / 2.4) * 0.6) : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(Math.sin(shakeSeed * 91) * shakeAmt, Math.cos(shakeSeed * 77) * shakeAmt);

    sky(p);
    // streak speed ramps up during ascent, then settles as we coast toward the Moon
    const streak = clamp((flying - 1.2) / 1.8) * (1 - clamp((t - T_MOON - 1.5) / 2.5) * 0.85) * 2;
    drawStars(t, clamp(0.15 + p), streak, dt);

    // moon approach
    const mp = clamp((t - T_MOON) / 4.4);
    const moonR = lerp(0, Math.min(W, H) * 0.165, easeInOut(mp));
    drawMoon(moonR, W * 0.5, H * lerp(0.04, 0.26, easeOut(mp)), clamp(mp * 2));

    drawEarth(t, clamp((t - 3.4) / 1.5));

    // ground scrolls away
    const baseGround = H * 0.78;
    const groundY = baseGround + alt * 40 * (H / 900);
    drawGround(groundY, alt);

    // smoke
    if (t > T_IGNITE && t < T_LIFT + 1.6 && groundY < H + 200) {
      const n = t < T_LIFT ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        smoke.push({ x: W / 2 + dir * rnd(10, 40) * dpr, y: rnd(-10, 6) * dpr, vx: dir * rnd(40, 170) * dpr, vy: rnd(-20, 5) * dpr, r: rnd(18, 40) * dpr, grow: rnd(40, 90) * dpr, life: rnd(1.6, 3.2), max: 3.2, c: Math.random() < 0.4 ? 255 : 200 });
      }
    }
    drawSmoke(groundY, dt);

    // rocket path: sits on pad, climbs to 45% of screen, then arcs toward the moon and fades
    const padY = baseGround;
    let rx = W / 2, ry = padY, rs = scale * 0.9;
    if (t >= T_LIFT) {
      const climb = easeOut(clamp(flying / 2.6));
      ry = lerp(padY, H * 0.52, climb);
      const away = clamp((t - T_MOON) / 2.6);
      ry = lerp(ry, H * 0.18, easeInOut(away));
      rs = scale * lerp(0.9, 0.18, easeInOut(away));
      rx = W / 2 + Math.sin(away * 2.4) * W * 0.05;
    }
    const rocketAlpha = 1 - clamp((t - (T_MOON + 2.0)) / 1.0);
    if (rocketAlpha > 0) {
      ctx.globalAlpha = rocketAlpha;
      drawRocket(rx, ry, rs, thrust, t);
      ctx.globalAlpha = 1;
      if (thrust > 0.3) {
        for (let i = 0; i < 3; i++) {
          trail.push({ x: rx + rnd(-10, 10) * rs, y: ry + rnd(10, 30) * rs, vx: rnd(-30, 30) * dpr, vy: rnd(120, 340) * dpr, r: rnd(1.5, 4.5) * dpr * Math.max(rs / scale, 0.3), life: rnd(0.4, 1.1), max: 1.1, hot: Math.random() < 0.5 });
        }
      }
    }
    drawTrail(dt);

    // flash at liftoff
    if (t > T_LIFT - 0.05 && t < T_LIFT + 0.5) {
      ctx.fillStyle = `rgba(255,200,140,${0.22 * (1 - (t - T_LIFT) / 0.5)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    setHud(t, alt, vel);
    if (t > T_TITLE && !title.classList.contains("on")) title.classList.add("on");
    if (t > T_SUB && !title.classList.contains("sub")) title.classList.add("sub");
    if (t > T_END) return finish();
    raf = requestAnimationFrame(frame);
  }

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    removeEventListener("resize", resize);
    removeEventListener("keydown", skip);
    onDone();
  }
  function skip() {
    if (!finished) {
      title.classList.add("on", "sub");
      finish();
    }
  }
  addEventListener("keydown", skip);
  canvas.addEventListener("click", skip);
  hud.querySelector(".skip")?.addEventListener("click", skip);

  raf = requestAnimationFrame(frame);
  return skip;
}
