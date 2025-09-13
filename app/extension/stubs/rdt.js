// ============================================================================
// Hubspot Stub – Stealth Mode Implementation (Protecto)
// ----------------------------------------------------------------------------
// This file emulates Hubspot's global _hsq queue API in a stealthy way so that
// tracker scripts believe it is present and functional. The design goal is to
// avoid console errors, allow writes and extensions, and simulate expected
// behaviors without sending real data.
//
// Notes:
//  - We do not freeze objects, use preventExtensions, or define read-only props.
//  - The stub should be extensible and writable like the real Hubspot object.
//  - Queue semantics are preserved: any pre-existing commands are flushed.
//  - Known commands like `trackPageView`, `identify`, `trackEvent` are handled.
//  - Unknown commands are accepted silently for compatibility.
//  - A subscriber system is included for debugging or monitoring internally.
//
// ============================================================================

(function(){
  try {
    // Prevent re-initialization
    if (window._hsq && window._hsq.__PROTECTO_STUB__) return;

    // ------------------------------------------------------------------------
    // Utilities
    // ------------------------------------------------------------------------
    const now = (typeof performance !== "undefined" && performance.now)
      ? ()=>performance.now()
      : ()=>Date.now();

    function safeCall(fn, args) {
      try { return fn.apply(null, args); } catch(e) {}
    }

    function isFunc(x) { return typeof x === "function"; }
    function isObj(x) { return x && typeof x === "object"; }

    // ------------------------------------------------------------------------
    // Internal State
    // ------------------------------------------------------------------------
    const _q = [];             // All queued calls {t, a}
    const _subs = new Set();   // Subscribers for internal monitoring
    const _stats = {           // Counters for fake metrics
      totalCalls: 0,
      lastCommand: null,
      lastTimestamp: null,
      byCommand: {}
    };

    // Grab any pre-existing commands on _hsq
    const preQ = Array.isArray(window._hsq) ? window._hsq.slice() : [];

    // ------------------------------------------------------------------------
    // Core Push Implementation
    // ------------------------------------------------------------------------
    function pushImpl() {
      const args = Array.prototype.slice.call(arguments);
      const entry = { t: now(), a: args };
      _q.push(entry);

      // Update stats
      _stats.totalCalls++;
      _stats.lastCommand = args[0] || null;
      _stats.lastTimestamp = entry.t;
      if (_stats.byCommand[_stats.lastCommand]) {
        _stats.byCommand[_stats.lastCommand]++;
      } else {
        _stats.byCommand[_stats.lastCommand] = 1;
      }

      // Notify subscribers
      for (const s of _subs) { safeCall(s, args); }

      // Handle known commands stealthily
      const cmd = (args[0]||"").toString().toLowerCase();
      switch(cmd){
        case "trackpageview":
          // Hubspot typically expects a page view to be tracked
          fakeTrackPageView(args.slice(1));
          break;
        case "identify":
          fakeIdentify(args.slice(1));
          break;
        case "trackevent":
          fakeTrackEvent(args.slice(1));
          break;
        default:
          // Accept everything, no errors
          break;
      }
      return _q.length;
    }

    // ------------------------------------------------------------------------
    // Dummy Implementations for Known Commands
    // ------------------------------------------------------------------------
    function fakeTrackPageView(rest) {
      // Emulate pageview registration
      const url = (rest && rest[0] && rest[0].url) || document.location.href;
      // Silent no-op
      return { status: "ok", url };
    }

    function fakeIdentify(rest) {
      // Emulate identify user
      let props = {};
      if (isObj(rest[0])) props = rest[0];
      else if (typeof rest[0]==="string") props = { id: rest[0] };
      return { status: "ok", props };
    }

    function fakeTrackEvent(rest) {
      // Emulate custom event
      const eventName = rest[0] || "custom_event";
      const props = isObj(rest[1]) ? rest[1] : {};
      return { status: "ok", event: eventName, props };
    }

    // ------------------------------------------------------------------------
    // API Assembly
    // ------------------------------------------------------------------------
    const api = [];

    // Core push method
    api.push = pushImpl;

    // Metadata
    api.__PROTECTO_STUB__ = true;
    api.loadedAt = now();
    api.version = "1.0";

    // Queue reference
    api.q = _q;

    // Subscribe/unsubscribe for debug
    api.subscribe = function(cb){ if (isFunc(cb)) _subs.add(cb); };
    api.unsubscribe = function(cb){ _subs.delete(cb); };

    // Diagnostics
    api.getStats = function(){ return JSON.parse(JSON.stringify(_stats)); };
    api.dumpQueue = function(){ return _q.map(e => e.a); };

    // Fake Hubspot helper methods (placebo implementations)
    api.trackPageView = function(opts){ return fakeTrackPageView([opts]); };
    api.identify = function(props){ return fakeIdentify([props]); };
    api.trackEvent = function(name, props){ return fakeTrackEvent([name, props]); };

    // Convenience no-op methods that might be invoked
    api.setPath = function(p){ return true; };
    api.addIdentity = function(){ return true; };
    api.removeIdentity = function(){ return true; };
    api.clearIdentities = function(){ return true; };
    api.doNotTrack = function(flag){ return !!flag; };

    // Simulate readiness
    api.onReady = function(cb){ if (isFunc(cb)) safeCall(cb, []); };

    // ------------------------------------------------------------------------
    // Install Global
    // ------------------------------------------------------------------------
    window._hsq = api;

    // ------------------------------------------------------------------------
    // Replay Pre-Queued Items
    // ------------------------------------------------------------------------
    if (preQ && preQ.length) {
      for (let i=0; i<preQ.length; i++) {
        const item = preQ[i];
        if (Array.isArray(item)) {
          try { pushImpl.apply(null, item); } catch(e){}
        }
      }
    }

    // ------------------------------------------------------------------------
    // Extended Dummy Surface
    // ------------------------------------------------------------------------
    // Add many additional placebo methods to look realistic
    api._internal = {
      enqueue: pushImpl,
      subs: _subs,
      stats: _stats
    };

    api.reset = function(){
      _q.length = 0;
      _stats.totalCalls = 0;
      _stats.lastCommand = null;
      _stats.lastTimestamp = null;
      _stats.byCommand = {};
      return true;
    };

    api.reload = function(){ return true; };
    api.load = function(){ return true; };
    api.save = function(){ return true; };
    api.restore = function(){ return true; };

    // Add verbose no-op methods to increase realism
    api.addUserToken = function(token){ return !!token; };
    api.removeUserToken = function(token){ return !!token; };
    api.getUserTokens = function(){ return []; };
    api.hasUserToken = function(token){ return false; };

    api.setSessionCookie = function(name, value){ return {name, value}; };
    api.getSessionCookie = function(name){ return null; };
    api.clearSessionCookie = function(name){ return true; };

    api.setCustomProperty = function(k,v){ return {[k]:v}; };
    api.getCustomProperty = function(k){ return null; };
    api.removeCustomProperty = function(k){ return true; };

    // Add long list of supported aliases
    const aliases = [
      "trackPageview",
      "track_pageview",
      "pageview",
      "track",
      "recordEvent",
      "logEvent",
      "event",
      "identifyUser",
      "identify_user",
      "id",
      "setProperty",
      "set_property",
      "setProp",
      "getProperty",
      "removeProperty"
    ];
    aliases.forEach(alias => {
      if (!api[alias]) {
        api[alias] = function(){ return true; };
      }
    });

    // Provide fake configuration API
    api.config = {
      set: function(key,val){ api.config[key]=val; },
      get: function(key){ return api.config[key]; },
      reset: function(){ for (const k in api.config){ if (["set","get","reset"].indexOf(k)===-1) delete api.config[k]; } }
    };

    // ------------------------------------------------------------------------
    // Debugging / Diagnostics
    // ------------------------------------------------------------------------
    api.debugInfo = function(){
      return {
        queueLength: _q.length,
        stats: api.getStats(),
        version: api.version,
        loadedAt: api.loadedAt
      };
    };

    // Optional debug output
    // if (window.__PROTECTO_DEBUG__) {
    //   console.debug("[Protecto][Stub:hubspot] active, preQ=", preQ.length);
    // }

  } catch(e){}
})();
