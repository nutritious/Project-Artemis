/* Project Artemis — cinematic WebGL launch intro with synthesized sound.
   Contract: playIntro({ canvas, hud, title, sound, onDone }) -> skip()
   hud needs .hud-1 / .hud-2 (/.skip); title gets classes "on" and "sub".
   Falls back to the 2D canvas intro when WebGL is unavailable. */
import { playIntro2D } from "./intro2d.js";

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

const FRAG = `
precision highp float;
uniform vec2 R; uniform float T; uniform float BOOST; uniform float FADE;

float h11(float n){ return fract(sin(n*127.1)*43758.5453); }
float h31(vec3 p){ p = fract(p*0.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn(vec3 x){
  vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p*=2.03; a*=.5; } return s; }

vec3 stars(vec3 d){
  vec3 q = d*70.; vec3 id=floor(q); vec3 f=fract(q)-.5;
  float r=h31(id); float m=step(.93,r);
  float s = m*smoothstep(.22,0.,length(f))*(.4+.6*h31(id+7.));
  vec3 tint = mix(vec3(.7,.8,1.),vec3(1.,.85,.7),h31(id+3.));
  vec3 q2 = d*180.; vec3 id2=floor(q2); vec3 f2=fract(q2)-.5;
  float s2 = step(.965,h31(id2))*smoothstep(.3,0.,length(f2))*.6;
  float band = smoothstep(.35,0.,abs(dot(d,normalize(vec3(.3,.9,.2)))))*fbm(d*6.)*.35;
  return tint*s + vec3(s2) + vec3(.35,.4,.7)*band*band*1.4;
}

bool sph(vec3 ro, vec3 rd, vec3 c, float r, out float t){
  vec3 oc=ro-c; float b=dot(oc,rd), cc=dot(oc,oc)-r*r, h=b*b-cc;
  if(h<0.) return false; t=-b-sqrt(h); return t>0.;
}
float atmo(vec3 ro, vec3 rd, vec3 c, float r){
  vec3 oc=ro-c; float b=dot(oc,rd); float d=length(oc+rd*max(-b,0.));
  return smoothstep(r*1.16,r*.99,d);
}

vec3 earth(vec3 n, vec3 sun, vec3 rd){
  vec3 p = n*2.2 + vec3(T*.004,0.,0.);
  float land = fbm(p*1.6);
  float isLand = smoothstep(.5,.56,land);
  float lat = abs(n.y);
  vec3 ocean = mix(vec3(.01,.06,.2),vec3(.02,.2,.45), fbm(p*6.)*.6);
  vec3 ground = mix(vec3(.12,.28,.08),vec3(.45,.38,.2), smoothstep(.55,.75,fbm(p*3.+4.)));
  ground = mix(ground, vec3(.9), smoothstep(.78,.92,lat));
  vec3 col = mix(ocean, ground, isLand);
  float cl = smoothstep(.5,.78, fbm(n*3.4+vec3(T*.02,0.,T*.01)));
  col = mix(col, vec3(1.), cl*.85);
  float dif = dot(n,sun);
  float day = smoothstep(-.08,.25,dif);
  vec3 lit = col*(.06+max(dif,0.)*1.15);
  // specular glint on ocean
  vec3 hv = normalize(sun-rd);
  lit += (1.-isLand)*(1.-cl)*pow(max(dot(n,hv),0.),60.)*.5;
  // city lights on the night side
  float cities = step(.72,vn(p*40.))*isLand*(1.-cl);
  vec3 night = vec3(1.,.7,.3)*cities*(1.-day)*1.6;
  vec3 res = lit + night;
  float fr = pow(1.-max(dot(n,-rd),0.),3.);
  res += vec3(.2,.5,1.)*fr*(.25+.75*day)*.9;
  return res;
}
vec3 moon(vec3 n, vec3 sun, vec3 pos){
  float g = fbm(n*5.+3.);
  float c = fbm(n*18.);
  float crater = smoothstep(.62,.68,c)*.25 + smoothstep(.45,.4,c)*.1;
  float mare = smoothstep(.45,.6,fbm(n*2.2+9.));
  vec3 alb = mix(vec3(.62,.6,.58), vec3(.28,.28,.3), mare);
  alb *= .75 + g*.5 - crater;
  float dif = max(dot(n,sun),0.);
  return alb*(.03+dif*1.25);
}

mat3 look(vec3 f){
  vec3 r = normalize(cross(vec3(0.,1.,0.),f)); vec3 u = cross(f,r);
  return mat3(r,u,f);
}
float ease(float x){ x=clamp(x,0.,1.); return x*x*(3.-2.*x); }

void main(){
  vec2 uv = (gl_FragCoord.xy*2.-R)/min(R.x,R.y);
  // shake: engines at liftoff
  float shake = smoothstep(2.0,2.6,T)*(1.-smoothstep(4.6,6.2,T))*.012 + smoothstep(0.,2.,T)*(1.-smoothstep(2.,2.4,T))*.003;
  uv += shake*vec2(sin(T*61.)+sin(T*37.), cos(T*53.)+cos(T*29.));

  vec3 E = vec3(0.), M = vec3(4.5,1.2,40.), sun = normalize(vec3(.75,.32,.55)); vec3 sunM = normalize(vec3(-.55,.35,-.6));
  // camera path
  float climb = ease((T-2.2)/4.6);
  float turn  = ease((T-6.2)/2.4);
  float d = 1.85 + 5.0*climb*climb*(1.4-.4*climb);
  float pushM = ease((T-7.0)/4.2);
  vec3 ro = vec3(0.,0.,d) + (M-vec3(0.,0.,d))*0.0;
  ro = vec3(0.,.0,d) + vec3(3.6,1.0,24.)*pushM;
  vec3 toE = normalize(E-ro);
  vec3 toM = normalize(M-ro);
  vec3 fwd = normalize(mix(toE, toM, turn));
  
  float fov = 1.5 + BOOST*.7;
  vec3 rd = look(fwd)*normalize(vec3(uv, fov));
  // roll during ascent
  float roll = .07*sin(T*.7)*smoothstep(2.4,5.,T);
  rd = look(fwd)*normalize(vec3(mat2(cos(roll),-sin(roll),sin(roll),cos(roll))*uv, fov));

  vec3 col = stars(rd);
  // stretched stars while boosting
  if(BOOST>0.01){
    vec3 s2 = stars(normalize(rd + fwd*0.0));
    float ang = atan(uv.y,uv.x); float rr=length(uv);
    float streak = pow(h11(floor(ang*60.)),12.)*smoothstep(.2,1.4,rr)*BOOST;
    col += vec3(.6,.7,1.)*streak*.6;
  }
  float t;
  float aE = atmo(ro,rd,E,1.);
  
  if(sph(ro,rd,M,2.2,t)){ vec3 p=ro+rd*t; col = moon(normalize(p-M),sunM,p); }
  else col += vec3(.7,.75,.9)*0.0;
  if(sph(ro,rd,E,1.,t)){ vec3 p=ro+rd*t; col = earth(normalize(p),sun,rd); }
  // atmosphere halos
  vec3 oc=ro-E; float b=dot(oc,rd); float dist=length(oc+rd*max(-b,0.));
  float halo = smoothstep(1.17,1.0,dist)*smoothstep(.9,1.02,dist);
  float sunSide = .25+.75*smoothstep(-.3,.6,dot(normalize(oc+rd*max(-b,0.)),sun));
  col += vec3(.25,.55,1.)*halo*halo*1.4*sunSide*step(0.5,1.-step(1.,dist)*0.0);
  // sun flare at start
  float sd = max(dot(rd,sun),0.);
  col += vec3(1.,.8,.55)*pow(sd,600.)*.6 + vec3(1.,.7,.4)*pow(sd,30.)*.03;

  // engine glow on liftoff
  float eng = smoothstep(2.0,2.5,T)*(1.-smoothstep(4.2,5.4,T));
  float g = smoothstep(1.4,-.9,uv.y);
  col += vec3(1.,.45,.12)*eng*g*g*(.45+.25*sin(T*40.)) ;
  // stage separation flash
  float flash = exp(-pow((T-5.35)*7.,2.));
  col += vec3(1.,.9,.8)*flash*.35;

  // vignette + filmic tone
  float vg = smoothstep(2.1,.3,length(uv));
  col *= mix(.55,1.,vg);
  col = 1.-exp(-col*1.25);
  col = pow(col, vec3(.92));
  col *= FADE;
  gl_FragColor = vec4(col,1.);
}`;

/* ---------------------------------- audio ---------------------------------- */
function makeAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  let ctx;
  try { ctx = new AC(); } catch { return null; }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const master = ctx.createGain();
  master.gain.value = 0.0;
  master.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.4);
  master.connect(ctx.destination);

  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < nd.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; nd[i] = last * 8; } // brown noise
  const noise = () => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; };

  const t0 = ctx.currentTime;
  // engine rumble
  const rn = noise(), rl = ctx.createBiquadFilter(), rg = ctx.createGain();
  rl.type = "lowpass"; rl.frequency.setValueAtTime(90, t0 + 1.5);
  rl.frequency.linearRampToValueAtTime(420, t0 + 4.2);
  rl.frequency.linearRampToValueAtTime(120, t0 + 7);
  rg.gain.setValueAtTime(0, t0); rg.gain.linearRampToValueAtTime(0.25, t0 + 2.1);
  rg.gain.linearRampToValueAtTime(1.0, t0 + 3.4);
  rg.gain.linearRampToValueAtTime(0.9, t0 + 5.2);
  rg.gain.exponentialRampToValueAtTime(0.02, t0 + 8.2);
  rn.connect(rl).connect(rg).connect(master); rn.start(t0); rn.stop(t0 + 9);
  // crackle (higher noise)
  const cn = noise(), cf = ctx.createBiquadFilter(), cg = ctx.createGain();
  cf.type = "bandpass"; cf.frequency.value = 1800; cf.Q.value = 0.6;
  cg.gain.setValueAtTime(0, t0 + 2); cg.gain.linearRampToValueAtTime(0.16, t0 + 3.2);
  cg.gain.exponentialRampToValueAtTime(0.002, t0 + 6.5);
  cn.connect(cf).connect(cg).connect(master); cn.start(t0); cn.stop(t0 + 7);
  // sub
  const so = ctx.createOscillator(), sg = ctx.createGain();
  so.type = "sine"; so.frequency.setValueAtTime(34, t0 + 2); so.frequency.linearRampToValueAtTime(58, t0 + 5);
  sg.gain.setValueAtTime(0, t0 + 1.9); sg.gain.linearRampToValueAtTime(0.7, t0 + 3); sg.gain.exponentialRampToValueAtTime(0.001, t0 + 7);
  so.connect(sg).connect(master); so.start(t0); so.stop(t0 + 7.5);

  const beep = (when, f = 880, len = 0.12, vol = 0.18) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0, t0 + when); g.gain.linearRampToValueAtTime(vol, t0 + when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + when + len);
    o.connect(g).connect(master); o.start(t0 + when); o.stop(t0 + when + len + 0.05);
  };
  beep(0.5, 740); beep(1.1, 740); beep(1.7, 740); beep(2.3, 1320, 0.5, 0.22);

  // stage separation thunk
  const thunk = (when) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(160, t0 + when); o.frequency.exponentialRampToValueAtTime(40, t0 + when + 0.25);
    g.gain.setValueAtTime(0.6, t0 + when); g.gain.exponentialRampToValueAtTime(0.001, t0 + when + 0.35);
    o.connect(g).connect(master); o.start(t0 + when); o.stop(t0 + when + 0.4);
  };
  thunk(5.35);

  // title pad (Dmaj9-ish swell)
  const padAt = 8.6;
  for (const [f, v] of [[146.8, 0.1], [220, 0.07], [293.7, 0.07], [370, 0.05], [440, 0.05], [554.4, 0.035]]) {
    for (const det of [-4, 4]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det;
      lp.type = "lowpass"; lp.frequency.value = 1400;
      g.gain.setValueAtTime(0, t0 + padAt); g.gain.linearRampToValueAtTime(v * 0.5, t0 + padAt + 1.8);
      g.gain.linearRampToValueAtTime(0.0001, t0 + padAt + 5.5);
      o.connect(lp).connect(g).connect(master); o.start(t0 + padAt); o.stop(t0 + padAt + 6);
    }
  }
  return {
    ctx,
    stop() {
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
        setTimeout(() => ctx.close().catch(() => {}), 500);
      } catch { /* closed */ }
    },
  };
}

/* ---------------------------------- main ---------------------------------- */
const T_TITLE = 9.0, T_SUB = 10.1, T_END = 13.2;

const HUD_LINES = [
  [0.0, "T-MINUS 3", "ALL SYSTEMS NOMINAL"],
  [0.5, "T-MINUS 3", "CREW ACCESS ARM RETRACTED"],
  [1.1, "T-MINUS 2", "MAIN ENGINE START"],
  [1.7, "T-MINUS 1", "GUIDANCE INTERNAL"],
  [2.3, "IGNITION", "WE HAVE IGNITION"],
  [3.8, "MAX Q", "THROTTLE DOWN · THROTTLE UP"],
  [5.35, "STAGE SEPARATION", "BOOSTERS JETTISONED"],
  [6.4, "TRANS-LUNAR INJECTION", "BURN COMPLETE"],
  [8.0, "ARTEMIS", "APPROACHING THE MOON"],
];

/** startAt: seconds into the sequence to begin from (used for the short cut on sign-in; plays silently). */
export function playIntro({ canvas, hud, title, sound = true, startAt = 0, onDone }) {
  let gl = null;
  try {
    gl = canvas.getContext("webgl", { antialias: false, powerPreference: "high-performance" }) ||
         canvas.getContext("experimental-webgl");
  } catch { /* no webgl */ }
  if (!gl) return playIntro2D({ canvas, hud, title, onDone });

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
    return s;
  };
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
  } catch (e) {
    console.warn("[intro] WebGL shader failed, using 2D intro", e);
    return playIntro2D({ canvas, hud, title, onDone });
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(prog, "R"), uT = gl.getUniformLocation(prog, "T");
  const uB = gl.getUniformLocation(prog, "BOOST"), uF = gl.getUniformLocation(prog, "FADE");

  // adaptive resolution: render smaller on slow GPUs
  let scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.8;
  const resize = () => {
    canvas.width = Math.max(2, Math.floor(canvas.clientWidth * scale));
    canvas.height = Math.max(2, Math.floor(canvas.clientHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();
  addEventListener("resize", resize);

  const audio = sound && !startAt ? makeAudio() : null;
  const h1 = hud.querySelector(".hud-1"), h2 = hud.querySelector(".hud-2");
  let hudIdx = -1;
  let finished = false, raf = 0;
  const start = performance.now() - startAt * 1000;
  let slow = 0, lastFrame = start;

  function frame(now) {
    if (finished) return;
    const t = (now - start) / 1000;
    const dt = now - lastFrame; lastFrame = now;
    if (t > 1 && dt > 40 && ++slow > 20 && scale > 0.45) { scale *= 0.75; slow = 0; resize(); }

    let idx = -1;
    for (let i = 0; i < HUD_LINES.length; i++) if (t >= HUD_LINES[i][0]) idx = i;
    if (idx !== hudIdx && idx >= 0) {
      hudIdx = idx;
      if (h1) h1.textContent = HUD_LINES[idx][1];
      if (h2) h2.textContent = HUD_LINES[idx][2];
    }
    if (t > T_TITLE - 0.6) hud.classList.add("dim");
    if (t > T_TITLE && !title.classList.contains("on")) title.classList.add("on");
    if (t > T_SUB && !title.classList.contains("sub")) title.classList.add("sub");

    const boost = Math.max(0, Math.min(1, (t - 2.3) / 1.2)) * (1 - Math.max(0, Math.min(1, (t - 5.2) / 1.6)));
    const fade = Math.min(1, (t - startAt) / 0.9) * (1 - Math.max(0, Math.min(1, (t - (T_END - 0.7)) / 0.7)));
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, t);
    gl.uniform1f(uB, boost);
    gl.uniform1f(uF, fade);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (t > T_END) return finish();
    raf = requestAnimationFrame(frame);
  }

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    removeEventListener("resize", resize);
    removeEventListener("keydown", skip);
    audio?.stop();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    onDone();
  }
  function skip() {
    if (finished) return;
    title.classList.add("on", "sub");
    finish();
  }
  addEventListener("keydown", skip);
  canvas.addEventListener("click", skip);
  hud.querySelector(".skip")?.addEventListener("click", skip);
  raf = requestAnimationFrame(frame);
  return skip;
}
