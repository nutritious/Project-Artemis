/* GIF library for chat: the server library (curated by the owner and co-owners), your own saved GIFs, and search when a key is set. */
import { api, esc, isCoOwnerUp, state, toast } from "./util.js";

const thumb = (u) => `/api/img?u=${encodeURIComponent(u)}`;
let panel = null, off = () => {};

export function closeGifPicker() { off(); panel?.remove(); panel = null; }

/** Open the picker. onPick(url) is called with the GIF link the person chose. */
export async function openGifPicker(onPick) {
  closeGifPicker();
  let data = { library: [], mine: [], search: false }, tab = "library", q = "", found = [], err = "", busy = 0;
  const el = document.createElement("div"); el.className = "gifpanel glass"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "GIF library");
  document.body.appendChild(el); panel = el;
  const staff = isCoOwnerUp(state.me);
  const mineUrls = () => new Set(data.mine.map((g) => g.url));

  const items = () => {
    if (tab === "library") return data.library.filter((g) => !q || (g.title || "").toLowerCase().includes(q.toLowerCase())).map((g) => ({ ...g, rm: staff ? "library" : "" }));
    if (tab === "mine") return data.mine.filter((g) => !q || g.url.toLowerCase().includes(q.toLowerCase())).map((g) => ({ ...g, title: "", rm: "mine" }));
    return found.map((g) => ({ ...g, id: "", rm: "" }));
  };
  const paint = () => {
    const keep = el.querySelector(".gp-grid")?.scrollTop ?? 0, saved = mineUrls(), list = items();
    el.innerHTML = `<div class="gp-head"><div class="gp-tabs"><button data-t="library" class="${tab === "library" ? "on" : ""}">Library</button><button data-t="mine" class="${tab === "mine" ? "on" : ""}">Saved</button>${data.search ? `<button data-t="search" class="${tab === "search" ? "on" : ""}">Search</button>` : ""}</div><button class="gp-x" data-close aria-label="Close">×</button></div>
      <form class="gp-q" data-q><input name="q" value="${esc(q)}" placeholder="${tab === "search" ? "Search GIFs, press Enter" : "Filter…"}" autocomplete="off" spellcheck="false">${tab === "search" ? `<button class="btn sm">Go</button>` : ""}</form>
      <div class="gp-grid">${busy ? `<p class="gp-msg">Loading…</p>` : err ? `<p class="gp-msg">${esc(err)}</p>` : list.length ? list.map((g, i) => `<figure class="gp-it" data-i="${i}" title="${esc(g.title || "")}"><img src="${esc(thumb(g.preview || g.url))}" alt="${esc(g.title || "GIF")}" loading="lazy" referrerpolicy="no-referrer"><span class="gp-act">${saved.has(g.url) ? "" : `<button data-save="${i}" title="Save to my GIFs">☆</button>`}${g.rm ? `<button data-rm="${i}" title="Remove">×</button>` : ""}</span></figure>`).join("") : `<p class="gp-msg">${tab === "library" ? "The library is empty." + (staff ? " Add a GIF link below." : " The owner has not added any yet. Try Saved.") : tab === "mine" ? "You have no saved GIFs yet. Paste a link below, or tap ☆ on a GIF from the library." : "Nothing yet. Search for something."}</p>`}</div>
      ${tab === "mine" || (tab === "library" && staff) ? `<form class="gp-add" data-add><input name="url" placeholder="Paste a link that ends in .gif" autocomplete="off" spellcheck="false" required>${tab === "library" ? `<input name="title" maxlength="40" placeholder="Name (optional)" autocomplete="off">` : ""}<button class="btn sm primary">Add</button></form>` : ""}${tab === "library" && staff ? `<form class="gp-add" data-bulk><textarea name="text" rows="3" placeholder="Add a lot at once: paste many links that end in .gif, one per line" spellcheck="false" required></textarea><button class="btn sm primary">Add all</button></form>` : ""}${tab === "library" && staff && data.search ? `<div class="gp-add"><button class="btn sm primary" data-import>Import lots of GIFs from the internet</button></div>` : ""}`;
    const g = el.querySelector(".gp-grid"); if (g && keep) g.scrollTop = keep;
  };
  const load = async () => { try { data = await api("/gifs"); } catch (e) { err = e.message; } paint(); };
  const runSearch = async () => {
    const id = ++busy; err = ""; paint();
    try { const r = await api("/gifs/search?q=" + encodeURIComponent(q)); found = r.gifs; } catch (e) { found = []; err = e.message; }
    if (id === busy) busy = 0; paint();
  };
  /* a GIF that fails to load gets two quiet retries (the server may be busy), then its tile is hidden so no broken pictures show */
  el.addEventListener("error", (e) => {
    const im = e.target; if (!(im instanceof HTMLImageElement) || !im.closest(".gp-it")) return;
    const n = +(im.dataset.try || 0);
    if (n < 2) { im.dataset.try = String(n + 1); const base = im.getAttribute("src").replace(/&r=\d+$/, ""); setTimeout(() => { if (im.isConnected) im.src = base + "&r=" + (n + 1); }, 700 * (n + 1) + Math.random() * 600); }
    else im.closest(".gp-it").classList.add("gp-dead");
  }, true);
  el.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-t],[data-close],[data-save],[data-rm],[data-import],.gp-it"); if (!t) return;
    if (t.matches("[data-close]")) return closeGifPicker();
    if (t.dataset.t) { tab = t.dataset.t; q = ""; err = ""; busy = 0; paint(); if (tab === "search") runSearch(); return; }
    const list = items();
    if (t.dataset.save != null) { e.stopPropagation(); const g = list[+t.dataset.save]; try { const r = await api("/gifs/mine", "POST", { url: g.url }); data.mine = r.mine; toast("Saved", "ok"); paint(); } catch (x) { toast(x.message, true); } return; }
    if (t.dataset.import != null) { e.stopPropagation(); t.disabled = true; t.textContent = "Importing, this takes a minute…"; try { const r = await api("/gifs/library/import", "POST", {}); data = { ...data, library: r.library }; toast(`Added ${r.added} GIFs`, "ok"); } catch (x) { toast(x.message, true); } paint(); return; }
    if (t.dataset.rm != null) { e.stopPropagation(); const g = list[+t.dataset.rm]; try { if (g.rm === "mine") data.mine = (await api("/gifs/mine/" + g.id, "DELETE")).mine; else data = { ...data, ...(await api("/gifs/library/" + g.id, "DELETE")) }; paint(); } catch (x) { toast(x.message, true); } return; }
    const g = list[+t.dataset.i ?? -1] ?? list[+t.closest?.(".gp-it")?.dataset.i]; if (g) { closeGifPicker(); onPick(g.url); }
  });
  el.addEventListener("submit", async (e) => {
    e.preventDefault(); const f = new FormData(e.target);
    if (e.target.matches("[data-q]")) { q = String(f.get("q") ?? "").trim(); if (tab === "search") runSearch(); else paint(); return; }
    if (e.target.matches("[data-bulk]")) { try { const r = await api("/gifs/library/bulk", "POST", { text: String(f.get("text") ?? "") }); data = { ...data, library: r.library }; toast(`Added ${r.added}${r.skipped ? `, skipped ${r.skipped}` : ""}`, "ok"); paint(); } catch (x) { toast(x.message, true); } return; }
    if (e.target.matches("[data-add]")) {
      try { const url = String(f.get("url") ?? ""); if (tab === "library") data = { ...data, ...(await api("/gifs/library", "POST", { url, title: String(f.get("title") ?? "") })) }; else data.mine = (await api("/gifs/mine", "POST", { url })).mine; toast("Added", "ok"); paint(); }
      catch (x) { toast(x.message, true); }
    }
  });
  const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); closeGifPicker(); } };
  const onDoc = (e) => { if (!e.composedPath().includes(el) && !e.target.closest("#chatGif")) closeGifPicker(); }; /* composedPath: the clicked button may already be gone after a re-render */
  addEventListener("keydown", onKey, true); setTimeout(() => document.addEventListener("click", onDoc), 0);
  off = () => { removeEventListener("keydown", onKey, true); document.removeEventListener("click", onDoc); };
  paint(); await load();
}
