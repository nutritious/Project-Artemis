/* Generative arena music: a small step sequencer on WebAudio. A different feel per theme and per phase. */
const SCALES = { halloween: [0, 2, 3, 5, 7, 8, 10], opening: [0, 2, 4, 7, 9] };
const ROOT = { halloween: 146.83, opening: 196 };
export function startMusic(theme, getPhase, enabled) {
  let ac, master, step = 0, timer = 0, on = enabled, nextT = 0;
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return { stop() {}, mute() {}, on: false }; }
  master = ac.createGain(); master.gain.value = on ? 0.5 : 0; master.connect(ac.destination);
  const scale = SCALES[theme] ?? SCALES.opening, root = ROOT[theme] ?? 196, hall = theme === "halloween";
  const note = (deg, oct = 0) => root * 2 ** ((scale[((deg % scale.length) + scale.length) % scale.length] + 12 * (oct + Math.floor(deg / scale.length))) / 12);
  const tone = (f, t, d, type, v, to) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(master); o.start(t); o.stop(t + d + 0.05); };
  const noise = (t, d, v, hp) => { const b = ac.createBuffer(1, ac.sampleRate * d, ac.sampleRate), c = b.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = Math.random() * 2 - 1; const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = b; f.type = "highpass"; f.frequency.value = hp; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(f).connect(g).connect(master); s.start(t); };
  const BASS = hall ? [0, 0, 3, 0, 5, 0, 3, 2] : [0, 0, 2, 0, 3, 0, 2, 4], LEAD = hall ? [7, -1, 9, 7, -1, 10, 9, -1, 7, -1, 5, -1, 3, -1, 5, 7] : [7, 9, 11, 9, 7, -1, 9, 11, 14, 11, 9, -1, 7, 9, 11, -1];
  const sched = () => {
    const kind = getPhase?.() ?? "gulper", tempo = kind === "boss" ? 148 : kind === "loot" ? 132 : kind === "trivia" ? 92 : 116, sp = 60 / tempo / 4;
    while (nextT < ac.currentTime + 0.25) {
      const t = nextT, s = step % 16, bar = Math.floor(step / 16) % 4;
      if (kind !== "trivia") { if (s % 4 === 0) tone(110, t, 0.18, "sine", 0.55, 45); if (s % 2 === 1) noise(t, 0.04, 0.05, 7000); if (kind === "boss" && s % 8 === 4) noise(t, 0.16, 0.12, 900); }
      if (s % 2 === 0) tone(note(BASS[(s / 2 + bar * 2) % 8], -2), t, sp * 1.8, hall ? "sawtooth" : "triangle", 0.1);
      const l = LEAD[(s + bar * 4) % 16]; if (l >= 0 && (kind !== "trivia" || s % 4 === 0)) tone(note(l, 0), t, sp * (kind === "loot" ? 1.1 : 1.6), kind === "boss" ? "square" : hall ? "triangle" : "sine", kind === "trivia" ? 0.05 : 0.07);
      if (s === 0 && bar % 2 === 0) { tone(note(0, 1), t, sp * 15, "sine", 0.04); tone(note(2, 1), t, sp * 15, "sine", 0.03); }
      step++; nextT += sp;
    }
  };
  nextT = ac.currentTime + 0.1; timer = setInterval(sched, 80); ac.resume?.();
  return { get on() { return on; }, mute(v) { on = !v; master.gain.setTargetAtTime(on ? 0.5 : 0, ac.currentTime, 0.1); ac.resume?.(); }, stop() { clearInterval(timer); try { master.gain.setTargetAtTime(0, ac.currentTime, 0.2); setTimeout(() => ac.close(), 600); } catch { /* ok */ } } };
}
