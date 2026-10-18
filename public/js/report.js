/* Report an issue: sends a note to the owner and co-owners. */
import { api, esc, overlay, state, toast } from "./util.js";

export function openReport() {
  const o = overlay(`<form class="modal glass" style="width:min(480px,100%)"><h3>Report an issue</h3>
    <p>Something broken or annoying? Tell the owner and co-owners. Only they can see this.</p>
    <label>What kind of problem?<select name="kind"><option value="bug">Something is broken</option><option value="proxy">A site won't load</option><option value="chat">Chat problem</option><option value="idea">Idea or request</option><option value="other">Other</option></select></label>
    <label>Details<textarea name="text" rows="5" maxlength="1500" required placeholder="What happened? What did you expect?"></textarea></label>
    <div class="row"><button type="button" class="btn" data-x>Cancel</button><button class="btn primary">Send report</button></div></form>`);
  o.addEventListener("click", (e) => { if (e.target === o || e.target.matches("[data-x]")) o.remove(); });
  o.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = new FormData(e.target), btn = e.target.querySelector(".primary"); btn.disabled = true;
    try { await api("/reports", "POST", { kind: f.get("kind"), text: f.get("text"), page: state.view }); o.remove(); toast("Report sent. Thank you!", "ok"); } catch (err) { toast(err.message, true); btn.disabled = false; }
  });
  o.querySelector("textarea").focus();
}
