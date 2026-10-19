/* Scramjet shell: boots the engine, then shows one proxied site full-size and reports
   address / title back to the Artemis browser (the parent window). */
const hash = new URLSearchParams(location.hash.slice(1));
let token = hash.get("t") || "";
let exitBase = hash.get("x") || "", exitTok = hash.get("xt") || ""; /* home exit node, when the owner set one up */
const boot = document.getElementById("boot"), msg = document.getElementById("msg");
const tell = (o) => { try { parent.postMessage({ ...o }, "*"); } catch { /* not framed */ } };

let scramjet, frame, conn, wispUrl = "", current = "";

function setWisp() {
  if (exitBase && exitTok) return `${exitBase}/wisp/${encodeURIComponent(exitTok)}/`;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/wisp/${encodeURIComponent(token)}/`;
}
async function setTransport() {
  wispUrl = setWisp();
  await conn.setTransport("/sj1/curl/index.mjs", [{ wisp: wispUrl, websocket: wispUrl }]);
}

/* The tunnel library decodes a WebAssembly module on first use; a request that arrives before that
   finishes fails with "wasm not loaded yet". Poke it with a harmless closed-port request until it answers. */
async function warmUp() {
  const { BareClient } = await import("/sj1/mux/index.mjs");
  const probe = new BareClient("/sj1/mux/worker.js");
  for (let i = 0; i < 30; i++) {
    try { await probe.fetch("http://127.0.0.1:9/", { method: "HEAD" }); return; }
    catch (e) {
      if (!/wasm not loaded/i.test(String(e?.message || e))) return; // any other answer means the engine is awake
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

async function start() {
  if (!("serviceWorker" in navigator)) throw new Error("This browser can't run service workers here (needs https or localhost).");
  const { ScramjetController } = $scramjetLoadController();
  scramjet = new ScramjetController({
    prefix: "/sj1/service/",
    files: { wasm: "/sj1/lib/scramjet.wasm.wasm", all: "/sj1/lib/scramjet.all.js", sync: "/sj1/lib/scramjet.sync.js" },
  });
  await scramjet.init();
  await navigator.serviceWorker.register("/sj1/sw.js", { scope: "/sj1/" });
  await navigator.serviceWorker.ready;
  const { BareMuxConnection } = await import("/sj1/mux/index.mjs");
  conn = new BareMuxConnection("/sj1/mux/worker.js");
  await setTransport();
  await warmUp();

  frame = scramjet.createFrame();
  document.body.append(frame.frame);
  frame.frame.allow = "fullscreen; autoplay; clipboard-write; encrypted-media; picture-in-picture";
  frame.addEventListener("urlchange", (e) => report(e.url));
  frame.frame.addEventListener("load", () => report());
  boot.remove();
}

let lastTitle = "";
function report(url) {
  try {
    const href = url ? String(url) : frame.url?.href ? String(scramjet.decodeUrl(frame.url.href)) : current;
    if (href) current = href;
    const doc = frame.frame.contentDocument;
    const title = (doc?.title || "").trim();
    const icon = doc?.querySelector('link[rel~="icon"]')?.href || "";
    lastTitle = title;
    tell({ artemis: "nav", url: current, title, favicon: icon });
  } catch { /* cross-document race: next load event fixes it */ }
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
    if ((d.token && d.token !== token) || ex !== exitBase || xt !== exitTok) { if (d.token) token = d.token; exitBase = ex; exitTok = xt; try { await setTransport(); } catch { /* retried on next go */ } }
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
