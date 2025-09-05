// FB Pixel — Pro-level stub (silent, deterministic, no network)
(function(){
  "use strict";
  if (window.fbq && window.fbq.loaded) return; // already present

  const state = {
    pixels: {},           // { [pixelId]: { id, options, enabled, created } }
    queue: [],            // queued calls before init/callMethod is available
    lastEvent: null,      // { name, params, ts }
    consent: { granted: true },
    dpo: null             // data processing options
  };

  const DEBUG = false;
  function jitter(min=30,max=200){
    return new Promise(res=>setTimeout(res, Math.floor(min + Math.random()*(max-min))));
  }
  function log(...a){ if (DEBUG) console.debug("[Protecto-fbq-stub]",...a); }

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
        return;
      }

      case "track": // fbq('track', 'PageView', {...})
      case "trackCustom": {
        const name = args[1] || "event";
        const params = args[2] || {};
        state.lastEvent = { name, params, ts: Date.now() };
        await jitter();
        log("track", name, params);
        return Promise.resolve(true); // pretend success
      }

      case "consent": { // fbq('consent', 'grant'|'revoke')
        const action = (args[1]||"").toString().toLowerCase();
        state.consent.granted = (action === "grant");
        await jitter();
        log("consent", action);
        return;
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
        return;
      }

      case "dataProcessingOptions": {
        // fbq('dataProcessingOptions', ['LDU'], country, state)
        state.dpo = args.slice(1);
        await jitter();
        log("dataProcessingOptions", state.dpo);
        return;
      }

      default:
        // Unknown command → ignore silently to avoid breaking sites
        await jitter(10,50);
        log("unknown command", cmd, args.slice(1));
        return;
    }
  };

  // Expose globals used by integrations
  if (!window._fbq) window._fbq = FBQ;
  window.fbq = FBQ;
})();