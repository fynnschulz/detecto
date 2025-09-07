(function(){
  "use strict";

  // If a real GTM/GA is present, do nothing (fail-safe)
  if ((typeof window.gtag === "function" && Array.isArray(window.dataLayer)) || window.gaRealLoaded) return;

  // --- Small utilities ----------------------------------------------------
  const jitter = (min=15, max=60) => new Promise(r => setTimeout(r, Math.floor(min + Math.random()*(max-min))));
  const safeGlobal = (name, valueFactory) => {
    try {
      if (Object.prototype.hasOwnProperty.call(window, name) && window[name]) return window[name];
      const val = typeof valueFactory === "function" ? valueFactory() : valueFactory;
      Object.defineProperty(window, name, { configurable:true, enumerable:false, writable:true, value: val });
      return val;
    } catch { /* ignore */ }
  };
  const noop = () => {};
  const noopPromise = () => Promise.resolve(true);

  // --- dataLayer with bounded history ------------------------------------
  const MAX_EVENTS = 200;
  const dataLayer = safeGlobal("dataLayer", () => []);
  const _state = {
    events: [],
    callbacks: []
  };

  const originalPush = Array.isArray(dataLayer) && typeof dataLayer.push === "function"
    ? dataLayer.push.bind(dataLayer)
    : function(){ return dataLayer.length; };

  dataLayer.push = function(){
    const args = Array.prototype.slice.call(arguments);
    for (const ev of args) {
      try {
        _state.events.push(ev);
        if (_state.events.length > MAX_EVENTS) _state.events.shift();
      } catch {}
    }
    // async notify to mimic GTM processing
    setTimeout(() => {
      for (const ev of args) {
        for (const cb of _state.callbacks) {
          try { cb(ev); } catch {}
        }
      }
    }, 10 + Math.floor(Math.random()*40));

    return originalPush.apply(dataLayer, args);
  };

  dataLayer.onEvent = function(cb){
    if (typeof cb === "function") _state.callbacks.push(cb);
  };

  // GTM bootstrap events (commonly observed)
  try {
    const now = Date.now();
    dataLayer.push({ "gtm.start": now, event: "gtm.js" });
    dataLayer.push({ event: "gtm.dom" });
    dataLayer.push({ event: "gtm.load" });
  } catch {}

  // --- google_tag_manager facade -----------------------------------------
  const gtmContainers = {};
  // Provide one default-looking container; pages only check existence
  gtmContainers["GTM-XXXXXXX"] = { dataLayer };

  safeGlobal("google_tag_manager", () => ({
    dl: dataLayer,
    dataLayer,
    ...gtmContainers
  }));

  // --- gtag facade --------------------------------------------------------
  // Keeps minimal state for config/consent/events
  const _gtag = function(){
    const args = Array.prototype.slice.call(arguments);
    try {
      const [cmd, a1, a2] = args;
      switch (String(cmd || "").toLowerCase()) {
        case "js":
          // gtag('js', new Date())
          // no-op
          break;
        case "config":
          // gtag('config','G-XXXX',{...})
          dataLayer.push({ event: "gtag.config", id: a1, params: a2 || {} });
          break;
        case "event":
          // gtag('event','name',{...})
          dataLayer.push({ event: a1 || "gtag.event", params: a2 || {} });
          break;
        case "consent":
          // gtag('consent','update',{ ad_storage:'granted', ... })
          dataLayer.push({ event: "gtag.consent", action: a1, params: a2 || {} });
          break;
        default:
          dataLayer.push({ event: "gtag.call", args });
      }
    } catch {}
    return Promise.resolve(true);
  };

  if (typeof window.gtag !== "function") {
    safeGlobal("gtag", () => _gtag);
  }

  // --- Legacy ga() facade -------------------------------------------------
  // Old analytics.js compatibility
  const _gaQueue = [];
  function gaShim(){
    try { _gaQueue.push(arguments); } catch {}
    return;
  }
  gaShim.q = _gaQueue;
  gaShim.l = +new Date();
  gaShim.create = noop;
  gaShim.send   = noop;
  gaShim.set    = noop;
  gaShim.require= noop;

  gaShim.getAll = function(){
    // Return a minimal fake tracker with common methods
    const fakeTracker = {
      get: noop,
      send: noop,
      set: noop,
      require: noop
    };
    return [fakeTracker];
  };

  if (typeof window.ga !== "function") {
    safeGlobal("ga", () => gaShim);
  }

  // --- Minor realism: short jitter on first calls ------------------------
  (async () => { try { await jitter(12, 35); } catch {} })();

})();