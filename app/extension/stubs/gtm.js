(function(){
  "use strict";

  // Idempotenz & Stealth-Helpers
  if (window.__PROTECTO_GTM__) return;
  window.__PROTECTO_GTM__ = true;
  function nativeFn(name){ return function(){ return `function ${name}() { [native code] }`; }; }
  function defGlobal(obj, key, value){
    try { Object.defineProperty(obj, key, { value, writable:false, configurable:false, enumerable:false }); }
    catch { obj[key] = value; }
  }

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

    try {
      if (Array.isArray(window.gtag && window.gtag.q)) {
        for (const args of window.gtag.q) { _gtag.apply(null, args); }
        window.gtag.q.length = 0;
      }
    } catch {}

    return originalPush.apply(dataLayer, args);
  };

  dataLayer.onEvent = function(cb){
    if (typeof cb === "function") _state.callbacks.push(cb);
  };
  try { dataLayer.onEvent.toString = nativeFn('addEventListener'); } catch {}

  try { dataLayer.push.toString = nativeFn('push'); } catch {}

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

  try { window.google_tag_manager.toString = nativeFn('google_tag_manager'); } catch {}

  // --- gtag facade --------------------------------------------------------
  // Keeps minimal state for config/consent/events
  const _gtag = function(){
    const args = Array.prototype.slice.call(arguments);
    try {
      const [cmd, a1, a2] = args;
      switch (String(cmd || "").toLowerCase()) {
        case "js":
          break;
        case "config":
          dataLayer.push({ event: "gtag.config", id: a1, params: a2 || {} });
          break;
        case "event":
          dataLayer.push({ event: a1 || "gtag.event", params: a2 || {} });
          break;
        case "consent":
          dataLayer.push({ event: "gtag.consent", action: a1, params: a2 || {} });
          break;
        case "set":
          dataLayer.push({ event: "gtag.set", params: a1 || {} });
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

  if (window.gtag && !Array.isArray(window.gtag.q)) {
    try {
      Object.defineProperty(window.gtag, 'q', { value: [], writable: false, configurable: false, enumerable: false });
    } catch { window.gtag.q = []; }
  }
  try { window.gtag.toString = nativeFn('gtag'); } catch {}

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
  try {
    gaShim.create.toString = nativeFn('create');
    gaShim.send.toString   = nativeFn('send');
    gaShim.set.toString    = nativeFn('set');
    gaShim.require.toString= nativeFn('require');
  } catch {}

  gaShim.getAll = function(){
    // Return a minimal fake tracker with common methods
    const fakeTracker = {
      get: noop,
      send: noop,
      set: noop,
      require: noop
    };
    try {
      fakeTracker.get.toString = nativeFn('get');
      fakeTracker.send.toString = nativeFn('send');
      fakeTracker.set.toString  = nativeFn('set');
      fakeTracker.require.toString = nativeFn('require');
    } catch {}
    return [fakeTracker];
  };

  try { gaShim.toString = nativeFn('ga'); } catch {}
  defGlobal(window, 'ga', gaShim);

  // --- Minor realism: short jitter on first calls ------------------------
  (async () => { try { await jitter(12, 35); } catch {} })();

})();