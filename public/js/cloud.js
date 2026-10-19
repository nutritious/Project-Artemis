/* Cloud browser: Chrome, Firefox or Edge running on the host computer, streamed to a canvas. Admins and above are unlimited; everyone else gets 30 minutes. */
import { api, esc, hooks, overlay, state, toast, can } from "./util.js";

const BROWSERS = [["chrome", "Chrome", "#4c8bf5"], ["firefox", "Firefox", "#ff7139"], ["edge", "Edge", "#2fc2a0"]];
const unlimited = () => ["owner", "coowner", "admin"].includes(state.me?.role);
let o = null, ws = null;

export function openCloud(startUrl = "") {
  if (o?.isConnected) return;
  o = overlay(`<div class="cb-launch glass" role="dialog" aria-label="Cloud browser"><button type="button" class="prof-x" data-x aria-label="Close">×</button>
    <h2>Cloud Browser</h2><p class="sub">Pick Chrome, Firefox or Edge. It runs on the server, not your computer, and nothing is saved. ${unlimited() ? "You have unlimited time." : "Sessions last 30 minutes."}</p>
    <label class="cb-l">URL<input id="cbUrl" placeholder="https://example.com or search anything" value="${esc(startUrl)}" autocomplete="off" spellcheck="false"></label>
    <div class="cb-l">Browser<div class="cb-pick">${BROWSERS.map(([id, n, c], i) => `<button type="button" class="cb-b ${i === 0 ? "on" : ""}" data-b="${id}" style="--bc:${c}"><i></i>${n}</button>`).join("")}</div></div>
    <button type="button" class="btn pri cb-go" id="cbGo">Launch Cloud Browser</button><p class="cb-err" id="cbErr"></p></div>`, { center: true });
  let pick = "chrome";
  o.addEventListener("click", (e) => { const b = e.target.closest("[data-b]"); if (b) { pick = b.dataset.b; o.querySelectorAll("[data-b]").forEach((x) => x.classList.toggle("on", x === b)); } });
  const go = () => launch(pick, o.querySelector("#cbUrl").value.trim());
  o.querySelector("#cbGo").addEventListener("click", go); o.querySelector("#cbUrl").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  o.querySelector("#cbUrl").focus();
}

async function launch(browser, url) {
  const err = (m) => { const e = o?.querySelector("#cbErr"); if (e) e.textContent = m; };
  if (hooks.api) return err("The cloud browser needs the real site with a home computer connected, so it isn't in this preview.");
  let pass; try { pass = await api("/cloud-pass"); } catch { return err("Couldn't start the cloud browser. Sign in again and retry."); }
  const base = (pass.url || `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}`).replace(/\/$/, "");
  const u = new URL(base + "/cb/" + encodeURIComponent(pass.token));
  o.innerHTML = `<div class="cb-view"><div class="cb-bar"><button class="tb" data-c="back" title="Back">‹</button><button class="tb" data-c="forward" title="Forward">›</button><button class="tb" data-c="reload" title="Reload">↻</button>
    <input id="cbAddr" placeholder="Search or enter address" spellcheck="false" autocomplete="off"><span class="chip" id="cbTag">${esc(browser)}</span><button class="btn" data-c="end">End session</button></div>
    <div class="cb-stage" id="cbStage"><canvas id="cbCv" tabindex="0"></canvas><div class="cb-load" id="cbLoad">Starting ${esc(browser)}…</div></div></div>`;
  const stage = o.querySelector("#cbStage"), cv = o.querySelector("#cbCv"), cx = cv.getContext("2d"), addr = o.querySelector("#cbAddr");
  let W = 0, H = 0, ready = false, dead = false, mv = 0;
  const fit = () => { const r = stage.getBoundingClientRect(); W = Math.max(320, Math.floor(r.width)); H = Math.max(240, Math.floor(r.height)); cv.width = W; cv.height = H; cv.style.width = W + "px"; cv.style.height = H + "px"; };
  fit();
  ws = new WebSocket(u.toString());
  const tx = (m) => { if (ws?.readyState === 1) ws.send(JSON.stringify(m)); };
  ws.binaryType = "blob";
  ws.onopen = () => tx({ t: "start", url: url ? (/^https?:\/\//i.test(url) ? url : /^[\w-]+(\.[\w-]+)+(\/|$)/.test(url) ? "https://" + url : "https://duckduckgo.com/?q=" + encodeURIComponent(url)) : "", browser, w: W, h: H });
  ws.onerror = () => finish("Couldn't reach the cloud browser. Is the home computer on?");
  ws.onclose = () => finish();
  ws.onmessage = async (e) => {
    if (typeof e.data !== "string") { try { const bmp = await createImageBitmap(e.data); cx.drawImage(bmp, 0, 0, W, H); bmp.close?.(); if (!ready) { ready = true; o.querySelector("#cbLoad")?.remove(); cv.focus(); } } catch { /* bad frame */ } return; }
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.t === "meta") { if (document.activeElement !== addr) addr.value = m.url === "about:blank" ? "" : m.url; }
    else if (m.t === "error") finish(m.message);
    else if (m.t === "ended") finish(m.reason);
    else if (m.t === "note") toast(m.message, true);
  };
  function finish(msg) {
    if (dead) return; dead = true; removeEventListener("resize", onResize); try { ws?.close(); } catch { /* done */ } ws = null;
    if (!o?.isConnected) return; o.innerHTML = `<div class="cb-launch glass"><h2>Cloud Browser closed</h2><p class="sub">${esc(msg || "Session ended")}</p><button class="btn pri" data-again>Open another</button> <button class="btn" data-x>Close</button></div>`;
    o.querySelector("[data-again]").onclick = () => { o.remove(); openCloud(); };
  }
  let rt = 0; const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { fit(); tx({ t: "resize", w: W, h: H }); }, 250); }; addEventListener("resize", onResize);
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: Math.round(e.clientX - r.left), y: Math.round(e.clientY - r.top) }; };
  cv.addEventListener("mousemove", (e) => { const n = performance.now(); if (n - mv < 30) return; mv = n; tx({ t: "mouse", type: "move", ...pos(e) }); });
  cv.addEventListener("mousedown", (e) => { e.preventDefault(); cv.focus(); tx({ t: "mouse", type: "down", button: e.button, ...pos(e) }); });
  cv.addEventListener("mouseup", (e) => tx({ t: "mouse", type: "up", button: e.button, ...pos(e) }));
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  cv.addEventListener("wheel", (e) => { e.preventDefault(); tx({ t: "wheel", dx: e.deltaX, dy: e.deltaY, ...pos(e) }); }, { passive: false });
  cv.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") return; e.preventDefault(); e.stopPropagation(); tx({ t: "key", key: e.key, ctrl: e.ctrlKey || e.metaKey }); });
  cv.addEventListener("paste", (e) => { e.preventDefault(); const t = e.clipboardData?.getData("text"); if (t) tx({ t: "text", text: t }); });
  addr.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { tx({ t: "nav", url: addr.value }); cv.focus(); } });
  o.querySelector(".cb-bar").addEventListener("click", (e) => { const c = e.target.closest("[data-c]")?.dataset.c; if (!c) return; if (c === "end") { tx({ t: "close" }); setTimeout(() => finish("You ended the session"), 150); } else tx({ t: c }); });
}
