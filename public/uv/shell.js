/* Ultraviolet shell: boots the engine, then shows one proxied site full-size and reports
   address / title back to the Artemis browser (the parent window). Same messages as the Scramjet shells. */
const hash = new URLSearchParams(location.hash.slice(1));
let token = hash.get("t") || "";
let exitBase = hash.get("x") || "", exitTok = hash.get("xt") || "";
const boot = document.getElementById("boot"), msg = document.getElementById("msg");
const tell = (o) => { try { parent.postMessage({ ...o }, "*"); } catch { /* not framed */ } };
const cfg = self.__uv$config;

let frame, conn, current = "", lastTitle = "";

function setWisp() {
  if (exitBase && exitTok) return `${exitBase}/wisp/${encodeURIComponent(exitTok)}/`;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/wisp/${encodeURIComponent(token)}/`;
}
async function setTransport() {
  const w = setWisp();
  await conn.setTransport("/uv/curl/index.mjs", [{ wisp: w, websocket: w }]);
}
async function warmUp() {
  const { BareClient } = await import("/uv/mux/index.mjs");
  const probe = new BareClient("/uv/mux/worker.js");
  for (let i = 0; i < 30; i++) {
    try { await probe.fetch("http://127.0.0.1:9/", { method: "HEAD" }); return; }
    catch (e) { if (!/wasm not loaded/i.test(String(e?.message || e))) return; await new Promise((r) => setTimeout(r, 250)); }
  }
}

const realUrl = () => {
  try {
    const href = frame.contentWindow.location.href, base = location.origin + cfg.prefix;
    return href.startsWith(base) ? cfg.decodeUrl(href.slice(base.length)) : "";
  } catch { return ""; }
};
function report(quiet) {
  try {
    const href = realUrl() || current, doc = frame.contentDocument, title = (doc?.title || "").trim();
    if (quiet && href === current && title === lastTitle) return;
    if (href) current = href;
    lastTitle = title;
    tell({ artemis: "nav", url: current, title, favicon: doc?.querySelector('link[rel~="icon"]')?.href || "" });
  } catch { /* cross-document race: the next load event fixes it */ }
}
function go(url) { current = url; frame.src = cfg.prefix + cfg.encodeUrl(url); }

async function start() {
  if (!("serviceWorker" in navigator)) throw new Error("This browser can't run service workers here (needs https or localhost).");
  await navigator.serviceWorker.register("/uv/sw.js", { scope: "/uv/" });
  await navigator.serviceWorker.ready;
  const { BareMuxConnection } = await import("/uv/mux/index.mjs");
  conn = new BareMuxConnection("/uv/mux/worker.js");
  await setTransport();
  await warmUp();
  frame = document.createElement("iframe");
  frame.allow = "fullscreen; autoplay; clipboard-write; encrypted-media; picture-in-picture";
  frame.addEventListener("load", () => report());
  document.body.append(frame);
  setInterval(() => report(true), 700); /* pages that change address without loading */
  boot.remove();
}

window.addEventListener("message", async (e) => {
  const d = e.data;
  if (!d || e.source !== parent) return;
  if (d.artemis === "go" && d.url) {
    const ex = d.exit || "", xt = d.exitToken || "";
    if ((d.token && d.token !== token) || ex !== exitBase || xt !== exitTok) { if (d.token) token = d.token; exitBase = ex; exitTok = xt; try { await setTransport(); } catch { /* retried on next go */ } }
    go(d.url);
  } else if (d.artemis === "back") frame.contentWindow.history.back();
  else if (d.artemis === "forward") frame.contentWindow.history.forward();
  else if (d.artemis === "reload") frame.contentWindow.location.reload();
});

(async () => {
  try {
    await start();
    tell({ artemis: "ready" });
    const first = hash.get("u");
    if (first) go(first);
  } catch (err) {
    console.error(err);
    msg.textContent = "Ultraviolet couldn't start: " + (err?.message || err);
    boot.classList.add("err");
    tell({ artemis: "sj-failed", reason: String(err?.message || err) });
  }
})();
