// Google Analytics Stub – pro-level fake that satisfies API calls but sends nothing
(function(){
  "use strict";
  if (window.ga && window.ga.loaded) return; // already defined

  const state = {
    trackers: {}, // tracker registry keyed by name
    lastEvent: null,
    fields: {}
  };

  function GA(){
    const args = Array.prototype.slice.call(arguments);
    if (!args.length) return;
    const cmd = args[0];

    // Universal Analytics style: ga('create', 'UA-XXXXX-Y', 'auto')
    if (cmd === "create") {
      const trackingId = args[1] || "UA-FAKE-0";
      const name = args[2] && typeof args[2] === "string" ? args[2] : "t0";
      state.trackers[name] = { id: trackingId, name, created: Date.now(), fields: {} };
      return state.trackers[name];
    }

    // ga('send', 'pageview'|'event'|...)
    if (cmd === "send") {
      const hitType = args[1] || "pageview";
      const params = args.slice(2);
      state.lastEvent = { hitType, params, ts: Date.now() };
      return true;
    }

    // ga('set', fieldName, value)
    if (cmd === "set") {
      if (typeof args[1] === "object") {
        Object.assign(state.fields, args[1]);
      } else if (typeof args[1] === "string") {
        state.fields[args[1]] = args[2];
      }
      return;
    }

    // ga('get', fieldName)
    if (cmd === "get") {
      const field = args[1];
      return state.fields[field];
    }

    // Tracker-specific calls: ga('trackerName.send', ...)
    if (typeof cmd === "string" && cmd.includes(".")) {
      const [trackerName, method] = cmd.split(".");
      const tracker = state.trackers[trackerName];
      if (tracker && method === "send") {
        const hitType = args[1] || "event";
        const params = args.slice(2);
        state.lastEvent = { hitType, params, tracker: trackerName, ts: Date.now() };
        return true;
      }
    }

    // Default: ignore silently
    return;
  }

  GA.loaded = true;
  GA.l = +new Date();
  GA.q = [];
  GA.create = function(){ return GA.apply(null, ["create"].concat(Array.from(arguments))); };
  GA.send   = function(){ return GA.apply(null, ["send"].concat(Array.from(arguments))); };
  GA.set    = function(){ return GA.apply(null, ["set"].concat(Array.from(arguments))); };
  GA.get    = function(){ return GA.apply(null, ["get"].concat(Array.from(arguments))); };

  // Expose globally
  window.ga = GA;
})();