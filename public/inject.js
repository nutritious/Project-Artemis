/* Project Artemis — runs inside every proxied page. */
(function () {
  if (window.__artemis) return;
  window.__artemis = true;

  var PATH_RE = /^\/p\/([^/]+)\/([^/?#]+)/;
  var m0 = location.pathname.match(PATH_RE);
  if (!m0) return;
  var TOKEN = m0[1];
  var PREFIX = "/p/" + TOKEN + "/";

  function dec(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function enc(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function realUrl() {
    var m = location.pathname.match(PATH_RE);
    try { return m ? dec(m[2]) : ""; } catch (e) { return ""; }
  }
  // proxied (path or absolute) -> real url, otherwise unchanged
  function unprox(u) {
    try {
      var p = new URL(u, location.href);
      if (p.origin === location.origin) {
        var m = p.pathname.match(PATH_RE);
        if (m) return dec(m[2]);
      }
    } catch (e) {}
    return u;
  }
  var SKIP = /^(data|javascript|mailto|tel|blob|about|sms):/i;
  function prox(u) {
    u = String(u);
    if (!u || u.charAt(0) === "#" || SKIP.test(u)) return u;
    if (u.indexOf(PREFIX) === 0 || u.indexOf(location.origin + PREFIX) === 0) return u;
    try {
      // absolute URLs that point back at our own origin (not proxied) were resolved against the proxy URL
      var base = realUrl();
      var s = u;
      if (s.indexOf(location.origin + "/") === 0) s = s.slice(location.origin.length);
      var abs = new URL(s, base);
      if (abs.protocol !== "http:" && abs.protocol !== "https:") return u;
      return PREFIX + enc(abs.href);
    } catch (e) { return u; }
  }

  /* ---------- network hooks ---------- */
  var _fetch = window.fetch;
  if (_fetch) {
    window.fetch = function (input, init) {
      try {
        if (typeof input === "string" || input instanceof URL) input = prox(String(input));
        else if (input && input.url) input = new Request(prox(input.url), input);
      } catch (e) {}
      return _fetch.call(this, input, init);
    };
  }
  var _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    var args = Array.prototype.slice.call(arguments);
    args[1] = prox(String(url));
    return _open.apply(this, args);
  };
  if (navigator.sendBeacon) {
    var _beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) { return _beacon(prox(String(url)), data); };
  }
  if (navigator.serviceWorker) {
    try { navigator.serviceWorker.register = function () { return Promise.reject(new Error("Disabled by Artemis")); }; } catch (e) {}
  }

  /* ---------- property / attribute hooks ---------- */
  function hookProp(proto, prop) {
    if (!proto) return;
    var d = Object.getOwnPropertyDescriptor(proto, prop);
    if (!d || !d.set) return;
    Object.defineProperty(proto, prop, {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set: function (v) { d.set.call(this, prox(String(v))); },
    });
  }
  hookProp(window.HTMLImageElement && HTMLImageElement.prototype, "src");
  hookProp(window.HTMLScriptElement && HTMLScriptElement.prototype, "src");
  hookProp(window.HTMLIFrameElement && HTMLIFrameElement.prototype, "src");
  hookProp(window.HTMLSourceElement && HTMLSourceElement.prototype, "src");
  hookProp(window.HTMLMediaElement && HTMLMediaElement.prototype, "src");
  hookProp(window.HTMLEmbedElement && HTMLEmbedElement.prototype, "src");
  hookProp(window.HTMLLinkElement && HTMLLinkElement.prototype, "href");
  hookProp(window.HTMLAnchorElement && HTMLAnchorElement.prototype, "href");
  hookProp(window.HTMLFormElement && HTMLFormElement.prototype, "action");

  var ATTR_RE = /^(src|href|action|poster|data-src)$/i;
  var _setAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (ATTR_RE.test(name) && typeof value === "string") value = prox(value);
    return _setAttr.call(this, name, value);
  };

  // content inserted via innerHTML etc.
  var fixNode = function (el) {
    if (el.nodeType !== 1) return;
    var list = [el].concat(Array.prototype.slice.call(el.querySelectorAll("[src],[href],[action],[poster]")));
    list.forEach(function (n) {
      ["src", "href", "action", "poster"].forEach(function (a) {
        var v = n.getAttribute && n.getAttribute(a);
        if (v && v.indexOf(PREFIX) !== 0 && !SKIP.test(v) && v.charAt(0) !== "#") {
          try { _setAttr.call(n, a, prox(v)); } catch (e) {}
        }
      });
    });
  };
  try {
    new MutationObserver(function (muts) {
      muts.forEach(function (mu) { mu.addedNodes.forEach(fixNode); });
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}

  /* ---------- history / navigation ---------- */
  function notify() {
    var icon = document.querySelector('link[rel~="icon"]');
    var fav = "";
    try { fav = icon ? unprox(icon.href) : new URL("/favicon.ico", realUrl()).href; } catch (e) {}
    try { parent.postMessage({ artemis: "nav", url: realUrl(), title: document.title || "", favicon: fav }, "*"); } catch (e) {}
  }
  ["pushState", "replaceState"].forEach(function (fn) {
    var orig = history[fn];
    history[fn] = function (state, title, url) {
      if (url != null && url !== "") url = prox(String(url));
      var r = orig.call(this, state, title, url);
      setTimeout(notify, 0);
      return r;
    };
  });
  window.addEventListener("popstate", notify);
  window.addEventListener("hashchange", notify);
  window.addEventListener("load", function () {
    notify();
    var t = document.querySelector("title");
    if (t && window.MutationObserver) new MutationObserver(notify).observe(t, { childList: true });
  });
  document.addEventListener("DOMContentLoaded", notify);

  var _winOpen = window.open;
  window.open = function (url) {
    if (url) {
      try { parent.postMessage({ artemis: "open", url: unprox(prox(url)) }, "*"); return null; } catch (e) {}
    }
    return _winOpen.apply(window, arguments);
  };

  /* ---------- clicks, forms, keys ---------- */
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented) return;
    if (a.target === "_blank" || e.ctrlKey || e.metaKey || e.button === 1) {
      e.preventDefault();
      try { parent.postMessage({ artemis: "open", url: unprox(a.getAttribute("href") ? new URL(a.getAttribute("href"), location.href).href : a.href) }, "*"); } catch (err) {}
    }
  }, true);

  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (!(f instanceof HTMLFormElement)) return;
    var method = (f.getAttribute("method") || "get").toLowerCase();
    if (method !== "get") return;
    e.preventDefault();
    var raw = f.getAttribute("data-artemis-action") || unprox(f.getAttribute("action") || "") || realUrl();
    var url;
    try { url = new URL(raw, realUrl()); } catch (err) { return; }
    var sp = new URLSearchParams();
    new FormData(f).forEach(function (v, k) { if (typeof v === "string") sp.append(k, v); });
    if (e.submitter && e.submitter.name) sp.append(e.submitter.name, e.submitter.value || "");
    url.search = sp.toString();
    location.href = prox(url.href);
  }, true);

  window.addEventListener("keydown", function (e) {
    try { parent.postMessage({ artemis: "key", key: e.key, ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey, shift: e.shiftKey }, "*"); } catch (err) {}
  }, true);

  /* ---------- WebSocket / EventSource / Worker ---------- */
  if (window.WebSocket) {
    var _WS = window.WebSocket;
    var PWS = function (url, protocols) {
      var abs;
      try { abs = new URL(String(url), realUrl()); } catch (e) { return protocols === undefined ? new _WS(url) : new _WS(url, protocols); }
      var u = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/pws/" + TOKEN + "/" + enc(abs.href);
      return protocols === undefined ? new _WS(u) : new _WS(u, protocols);
    };
    PWS.prototype = _WS.prototype;
    ["CONNECTING", "OPEN", "CLOSING", "CLOSED"].forEach(function (k) { PWS[k] = _WS[k]; });
    window.WebSocket = PWS;
  }
  if (window.EventSource) {
    var _ES = window.EventSource;
    var PES = function (url, opts) { return new _ES(prox(String(url)), opts); };
    PES.prototype = _ES.prototype;
    ["CONNECTING", "OPEN", "CLOSED"].forEach(function (k) { PES[k] = _ES[k]; });
    window.EventSource = PES;
  }
  if (window.Worker) {
    var _W = window.Worker;
    var PW = function (url, opts) { return new _W(prox(String(url)), opts); };
    PW.prototype = _W.prototype;
    window.Worker = PW;
  }

  /* ---------- cookies set by page scripts (kept per page, sent by the server-side jar otherwise) ---------- */
  try {
    var cookieJar = {};
    Object.defineProperty(Document.prototype, "cookie", {
      configurable: true,
      get: function () { return Object.keys(cookieJar).map(function (k) { return k + "=" + cookieJar[k]; }).join("; "); },
      set: function (v) {
        var parts = String(v).split(";"), kv = parts[0], i = kv.indexOf("=");
        if (i < 0) return;
        var name = kv.slice(0, i).trim(), val = kv.slice(i + 1), expired = false;
        parts.slice(1).forEach(function (p) {
          var q = p.trim().toLowerCase();
          if (q.indexOf("max-age=") === 0 && parseInt(q.slice(8), 10) <= 0) expired = true;
          if (q.indexOf("expires=") === 0 && Date.parse(p.trim().slice(8)) < Date.now()) expired = true;
        });
        if (expired) delete cookieJar[name]; else cookieJar[name] = val;
      },
    });
  } catch (e) {}

  /* ---------- per-site storage: sites must not see each other's localStorage ---------- */
  function namespaced(real) {
    var origin = "null";
    try { origin = new URL(realUrl()).origin; } catch (e) {}
    var prefix = "artemis::" + origin + "::";
    var mine = function () { return Object.keys(real).filter(function (k) { return k.indexOf(prefix) === 0; }); };
    var methods = {
      getItem: function (k) { return real.getItem(prefix + k); },
      setItem: function (k, v) { real.setItem(prefix + k, v); },
      removeItem: function (k) { real.removeItem(prefix + k); },
      clear: function () { mine().forEach(function (k) { real.removeItem(k); }); },
      key: function (i) { var ks = mine(); return ks[i] === undefined ? null : ks[i].slice(prefix.length); },
    };
    return new Proxy(methods, {
      get: function (t, p) {
        if (p === "length") return mine().length;
        if (p in t) return t[p];
        if (typeof p === "string") { var v = real.getItem(prefix + p); return v === null ? undefined : v; }
      },
      set: function (t, p, v) { real.setItem(prefix + String(p), String(v)); return true; },
      deleteProperty: function (t, p) { real.removeItem(prefix + String(p)); return true; },
      has: function (t, p) { return p in t || (typeof p === "string" && real.getItem(prefix + p) !== null); },
      ownKeys: function () { return mine().map(function (k) { return k.slice(prefix.length); }); },
      getOwnPropertyDescriptor: function (t, p) {
        if (typeof p === "string" && real.getItem(prefix + p) !== null) return { value: real.getItem(prefix + p), writable: true, enumerable: true, configurable: true };
      },
    });
  }
  try {
    var nsLocal = namespaced(window.localStorage), nsSession = namespaced(window.sessionStorage);
    Object.defineProperty(window, "localStorage", { configurable: true, get: function () { return nsLocal; } });
    Object.defineProperty(window, "sessionStorage", { configurable: true, get: function () { return nsSession; } });
  } catch (e) {}

  window.addEventListener("message", function (e) {
    if (e.source !== parent) return;
    var d = e.data;
    if (!d || !d.artemisCmd) return;
    if (d.artemisCmd === "back") history.back();
    else if (d.artemisCmd === "forward") history.forward();
    else if (d.artemisCmd === "reload") location.reload();
  });
})();
