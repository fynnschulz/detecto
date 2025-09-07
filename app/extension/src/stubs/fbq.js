// FB Pixel — Pro-level stub (silent, deterministic, no network)
(function(){
  "use strict";

  // Vorhandene Queue vom Boot-Strap übernehmen
  const preQueue = (window.fbq && Array.isArray(window.fbq.queue)) ? window.fbq.queue.slice() : [];

  // Nur behalten, wenn bereits eine vollwertige fbq-API aktiv ist.
  // Reine Queue-Stubs (ohne callMethod/loaded) wollen wir ersetzen.
  if (window.fbq && window.fbq.loaded && typeof window.fbq.callMethod === "function") return; // already present

  const EVENT_MAX = 200;
  const state = {
    pixels: {},           // { [pixelId]: { id, options, enabled, created } }
    queue: [],            // queued calls before init/callMethod is available
    lastEvent: null,      // { name, params, ts }
    events: [],           // ring buffer of recent events
    consent: { granted: true },
    dpo: null             // data processing options
  };

  const DEBUG = false;
  function jitter(min=30,max=200){
    return new Promise(res=>setTimeout(res, Math.floor(min + Math.random()*(max-min))));
  }
  function log(...a){ if (DEBUG) console.debug("[Protecto-fbq-stub]",...a); }

  function recordEvent(name, params){
    try {
      const e = { name: String(name||"event"), params: params || {}, ts: Date.now() };
      state.lastEvent = e;
      state.events.push(e);
      if (state.events.length > EVENT_MAX) state.events.shift();
    } catch {}
  }

  function FBQ(){
    const args = Array.prototype.slice.call(arguments);
    if (typeof FBQ.callMethod === "function") {
      try { return FBQ.callMethod.apply(FBQ, args); } catch { return; }
    }
    state.queue.push(args);
    return state.queue.length;
  }

  // Core flags expected by sites
  FBQ.loaded = true;
  FBQ.version = "2.0";
  FBQ.queue = [];
  FBQ.push = function(){
    const args = Array.prototype.slice.call(arguments);
    state.queue.push(args);
    return state.queue.length;
  };
  FBQ.disablePushState = true;

  // API implementation (no‑ops with local bookkeeping)
  FBQ.callMethod = async function(){
    const args = Array.prototype.slice.call(arguments);
    const cmd = (args[0]||"").toString();

    switch (cmd) {
      case "init": {
        const pixelId = args[1];
        const options = args[2] || {};
        if (pixelId) {
          state.pixels[pixelId] = {
            id: pixelId,
            options,
            enabled: true,
            created: Date.now()
          };
        }
        // drain any pre‑init queue (keep as no‑op processing)
        if (state.queue.length) state.queue.length = 0;
        await jitter();
        log("init", pixelId, options);
        return Promise.resolve(true);
      }

      case "track": // fbq('track', 'PageView', {...})
      case "trackCustom": {
        const name = args[1] || "event";
        const params = args[2] || {};
        recordEvent(name, params);
        await jitter();
        log("track", name, params);
        return Promise.resolve(true); // pretend success
      }

      case "consent": { // fbq('consent', 'grant'|'revoke')
        const action = (args[1]||"").toString().toLowerCase();
        state.consent.granted = (action === "grant");
        await jitter();
        log("consent", action);
        return Promise.resolve(true);
      }

      case "set": {
        // Variants:
        //  - fbq('set', 'autoConfig', false, 'PIXEL_ID')
        //  - fbq('set', { external_id: '...' })
        //  - fbq('set', 'dataProcessingOptions', ['LDU'], 0, 0)
        // We accept and store but never send.
        try {
          if (typeof args[1] === 'object' && args[1]) {
            state.pixels._global = Object.assign({}, state.pixels._global || {}, args[1]);
          } else if (typeof args[1] === 'string') {
            const key = args[1];
            const val = args[2];
            const pid = args[3];
            if (pid && state.pixels[pid]) {
              state.pixels[pid][key] = val;
            } else {
              state.pixels._global = Object.assign({}, state.pixels._global || {}, { [key]: val });
            }
          }
        } catch {}
        await jitter();
        log("set", args[1], args[2], args[3]);
        return Promise.resolve(true);
      }

      case "dataProcessingOptions": {
        // fbq('dataProcessingOptions', ['LDU'], country, state)
        state.dpo = args.slice(1);
        await jitter();
        log("dataProcessingOptions", state.dpo);
        return Promise.resolve(true);
      }

      default:
        // Unknown command → ignore silently to avoid breaking sites
        await jitter(10,50);
        log("unknown command", cmd, args.slice(1));
        return Promise.resolve(true);
    }
  };

  // Zusätzliche No-Op-Helfer (häufig abgefragt)
  FBQ.load = function(){ return true; };
  FBQ.enable = function(){ return true; };
  FBQ.disable = function(){ return true; };
  FBQ.getState = function(){
    try {
      return {
        pixelCount: Object.keys(state.pixels).length,
        lastEvent: state.lastEvent,
        eventsCount: state.events.length,
        consentGranted: !!state.consent.granted
      };
    } catch { return {}; }
  };

  // Expose globals used by integrations
  // Some themes expect _fbq to be an array (bootstrap queue). We provide that,
  // plus the functional fbq API.
  if (!window._fbq) window._fbq = [];
  try { window._fbq.disablePushState = true; } catch {}
  try { window._fbq.push = function(){ return true; }; } catch {}
  window.fbq = FBQ;

  // Vorbestehende Queue-Aufrufe (vom Bootstrapping) nachträglich abarbeiten
  (async () => {
    if (preQueue && preQueue.length) {
      for (const args of preQueue) {
        try { await FBQ.callMethod.apply(FBQ, args); } catch {}
      }
      try { FBQ.queue = []; } catch {}
    }
  })();
})();