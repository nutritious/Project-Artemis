/* Scramjet shell: boots the engine, then shows one proxied site full-size and reports
   address / title back to the Artemis browser (the parent window). */
const hash = new URLSearchParams(location.hash.slice(1));
let token = hash.get("t") || "";
let exitBase = hash.get("x") || "", exitTok = hash.get("xt") || ""; /* home exit node, when the owner set one up */
const boot = document.getElementById("boot"), msg = document.getElementById("msg");
const tell = (o) => { try { parent.postMessage({ ...o }, "*"); } catch { /* not framed */ } };

let controller, frame, current = "", poll = 0;
const PREFIX = "/sj/service/";

function setWisp() {
  if (exitBase && exitTok) return `${exitBase}/wisp/${encodeURIComponent(exitTok)}/`;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/wisp/${encodeURIComponent(token)}/`;
}
const useEpoxy = hash.get("tr") === "epoxy";
const makeTransport = () => {
  const u = setWisp();
  if (useEpoxy) { const E = globalThis.EpoxyTransport; const C = E?.default ?? E?.EpoxyClient ?? E; return new C({ wisp: u }); }
  return new LibcurlTransport.LibcurlClient({ wisp: u, websocket: u });
};
const loadScript = (src) => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("Could not load " + src)); document.head.append(s); });

async function start() {
  if (!("serviceWorker" in navigator)) throw new Error("This browser can't run service workers here (needs https or localhost).");
  if (useEpoxy) await loadScript("/sj/epoxy/index.js");
  const reg = await navigator.serviceWorker.register("/sj/sw.js", { scope: "/sj/" });
  fetch("/sj/lib/scramjet.wasm").catch(() => {}); /* warm the cache while the worker starts */
  await navigator.serviceWorker.ready;
  const sw = reg.active || navigator.serviceWorker.controller;
  if (!sw) throw new Error("The service worker did not start. Reload the page.");
  const { Controller } = $scramjetController;
  controller = new Controller({
    serviceworker: sw,
    transport: makeTransport(),
    config: { prefix: PREFIX, scramjetPath: "/sj/lib/scramjet.js", wasmPath: "/sj/lib/scramjet.wasm", injectPath: "/sj/ctl/controller.inject.js" },
  });
  await controller.wait();
  frame = controller.createFrame();
  const el = frame.element;
  el.allow = "fullscreen; autoplay; clipboard-write; encrypted-media; picture-in-picture";
  document.body.append(el);
  el.addEventListener("load", () => { report(); applyCookie(); });
  poll = setInterval(() => report(true), 700); /* pages that change address without loading (YouTube, SPAs) */
  boot.remove();
}

/** The real address behind the iframe's rewritten one. */
function realUrl() {
  try {
    const href = frame.element.contentWindow.location.href, base = location.origin + frame.prefix;
    if (!href.startsWith(base)) return "";
    return controller.config.codec.decode(href.slice(base.length));
  } catch { return ""; }
}

let lastTitle = "";
function report(quiet) {
  try {
    const href = realUrl() || current;
    const doc = frame.element.contentDocument;
    const title = (doc?.title || "").trim();
    if (quiet && href === current && title === lastTitle) return;
    if (href) current = href;
    const icon = doc?.querySelector('link[rel~="icon"]')?.href || "";
    lastTitle = title;
    tell({ artemis: "nav", url: current, title, favicon: icon });
  } catch { /* cross-document race: next load event fixes it */ }
}

/** Optional: the opener can ask for one cookie to be set on the site it is opening (used by Tube to turn on the server's \"proxy videos\" setting). */
const wantCookie = hash.get("pc") || "";
let cookieSet = false;
function applyCookie() {
  if (!wantCookie || cookieSet) return;
  try { const w = frame.element.contentWindow; if (!w || !realUrl().startsWith("http")) return; w.eval("document.cookie=" + JSON.stringify(wantCookie)); cookieSet = true; } catch { /* retried on the next load */ }
}

function go(url) {
  current = url;
  frame.go(url);
}

window.addEventListener("message", async (e) => {
  const d = e.data;
  if (!d || e.source !== parent) return;
  if (d.artemis === "go" && d.url) {
    const ex = d.exit || "", xt = d.exitToken || "";
    if ((d.token && d.token !== token) || ex !== exitBase || xt !== exitTok) { if (d.token) token = d.token; exitBase = ex; exitTok = xt; try { controller.setTransport(makeTransport()); } catch { /* retried on next go */ } }
    go(d.url);
  } else if (d.artemis === "back") frame.back();
  else if (d.artemis === "forward") frame.forward();
  else if (d.artemis === "reload") frame.reload();
});

(async () => {
  try {
    await start();
    tell({ artemis: "ready" });
    const first = hash.get("u");
    if (first) go(first);
  } catch (err) {
    console.error(err);
    msg.textContent = "Scramjet couldn't start: " + (err?.message || err);
    boot.classList.add("err");
    tell({ artemis: "sj-failed", reason: String(err?.message || err) });
  }
})();
