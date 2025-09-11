/*
 * VWO (Visual Website Optimizer) – High‑fidelity MV3 Stub
 * -------------------------------------------------------
 * Ziel: API‑kompatibles, stealthy Verhalten ohne Netzwerkanfragen.
 * Eigenschaften:
 *  - Idempotent (Mehrfachladen sicher)
 *  - Kompatibel zu gängigen VWO Snippet‑Mustern (Array‑Queue, .push([...]))
 *  - Events: on/off/once, ready()
 *  - Commands: track, goal, event, set, get, is, log, flush, version, getVariationName
 *  - Deep Cloning, Limits, No‑op Network, Native‑like toString()
 *  - Queue verarbeitet vor Stub definierte Befehle
 *
 * Hinweis: Diese Datei ist Teil der Protecto/Detecto Stub‑Bibliothek.
 */

(function stubVWO(global) {
  'use strict';

  // Prevent double installation
  if (global && global.VWO && global.VWO.__isStub) {
    try { global.VWO.__metrics.reinstallCount++; } catch (_) {}
    return; // already installed
  }

  var _now = function() { return Date.now ? Date.now() : +new Date(); };

  // Native‑like toString for stealth
  var NATIVE_TOSTRING = 'function () { [native code] }';
  function nativeLike(fn) {
    try {
      Object.defineProperty(fn, 'toString', { value: function() { return NATIVE_TOSTRING; }, configurable: true });
    } catch (_) {}
    return fn;
  }

  function defineRO(obj, key, value) {
    try {
      Object.defineProperty(obj, key, { value: value, writable: false, enumerable: false, configurable: false });
    } catch (_) {
      obj[key] = value;
    }
  }

  // Simple UID
  var _uidSeq = 1;
  function uid(prefix) {
    return (prefix || 'vwo') + '_' + (_uidSeq++) + '_' + (_now().toString(36));
  }

  // Deep clone (safe JSON first, then shallow copy of functions)
  function deepClone(value, depth) {
    if (value == null || typeof value !== 'object') return value;
    if (depth && depth > 50) return value; // recursion guard
    if (Array.isArray(value)) {
      var arr = new Array(value.length);
      for (var i = 0; i < value.length; i++) arr[i] = deepClone(value[i], (depth||0)+1);
      return arr;
    }
    var out = {};
    for (var k in value) {
      if (!Object.prototype.hasOwnProperty.call(value, k)) continue;
      var v = value[k];
      out[k] = (typeof v === 'function') ? v : deepClone(v, (depth||0)+1);
    }
    return out;
  }

  // Micro Emitter
  function Emitter() { this._ev = Object.create(null); }
  Emitter.prototype.on = nativeLike(function(name, fn) {
    if (!name || typeof fn !== 'function') return this;
    (this._ev[name] || (this._ev[name] = [])).push(fn);
    return this;
  });
  Emitter.prototype.off = nativeLike(function(name, fn) {
    var list = this._ev[name];
    if (!list) return this;
    if (!fn) { this._ev[name] = []; return this; }
    for (var i = list.length - 1; i >= 0; i--) if (list[i] === fn) list.splice(i, 1);
    return this;
  });
  Emitter.prototype.once = nativeLike(function(name, fn) {
    if (!name || typeof fn !== 'function') return this;
    var self = this;
    function wrap() { self.off(name, wrap); try { fn.apply(self, arguments); } catch(_){} }
    this.on(name, wrap);
    return this;
  });
  Emitter.prototype.emit = nativeLike(function(name) {
    var list = this._ev[name];
    if (!list || !list.length) return 0;
    var args = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < list.length; i++) {
      try { list[i].apply(this, args); } catch (_) {}
    }
    return list.length;
  });

  // Rate limiter (token bucket lite)
  function Limiter(maxPerMin) {
    this.max = Math.max(1, maxPerMin || 120);
    this.win = 60000; // 1 min
    this.buf = [];
  }
  Limiter.prototype.push = function(ts) {
    ts = ts || _now();
    this.buf.push(ts);
    var cutoff = ts - this.win;
    while (this.buf.length && this.buf[0] < cutoff) this.buf.shift();
    return this.buf.length <= this.max;
  };

  // Memory key/value with TTL
  function MemStore() { this._m = Object.create(null); }
  MemStore.prototype.set = function(k, v, ttlMs) {
    this._m[k] = { v: deepClone(v), e: ttlMs ? (_now() + ttlMs) : 0 };
  };
  MemStore.prototype.get = function(k) {
    var o = this._m[k];
    if (!o) return undefined;
    if (o.e && _now() > o.e) { delete this._m[k]; return undefined; }
    return deepClone(o.v);
  };
  MemStore.prototype.del = function(k){ delete this._m[k]; };

  // Capture any preexisting queue (array form)
  var preQueue = Array.isArray(global && global.VWO) ? global.VWO.slice() : [];

  // Core object implementing both Array‑like push and rich API
  function createAPI() {
    var api = new Emitter();

    var metrics = {
      createdAt: _now(),
      commandsProcessed: 0,
      dropped: 0,
      reinstallCount: 0,
      version: 'stub-1.0.0'
    };

    var store = new MemStore();
    var limiter = new Limiter(240); // generous default

    var state = {
      ready: false,
      id: uid('vwo'),
      visitor: {},
      variations: Object.create(null),
      logs: [],
      config: { debug: false },
      lastFlush: 0
    };

    function log(level, msg, data) {
      var entry = { t: _now(), level: level, msg: String(msg||''), data: deepClone(data) };
      if (state.logs.length > 1000) state.logs.shift();
      state.logs.push(entry);
      if (state.config.debug && typeof console !== 'undefined' && console[level]) {
        try { console[level]('[VWO stub]', msg, data || ''); } catch(_){}
      }
    }

    // --- API methods ---

    var api_on = nativeLike(function(name, fn){ api.on(name, fn); return api; });
    var api_off = nativeLike(function(name, fn){ api.off(name, fn); return api; });
    var api_once = nativeLike(function(name, fn){ api.once(name, fn); return api; });

    var api_readyPromise;
    var api_ready = nativeLike(function(cb){
      if (!api_readyPromise) {
        api_readyPromise = Promise.resolve().then(function(){ state.ready = true; api.emit('ready'); return true; });
      }
      if (typeof cb === 'function') api_once('ready', cb);
      return api_readyPromise;
    });

    // Track generic event or goal
    var api_track = nativeLike(function(name, props){
      if (!limiter.push()) { metrics.dropped++; return false; }
      log('info', 'track', { name: name, props: props });
      api.emit('event', deepClone({ name: name, props: props||{} }));
      return true;
    });

    // Alias for legacy goal tracking: track.goal or goal(id, revenue)
    var api_goal = nativeLike(function(goalId, revenue){
      return api_track('goal', { id: goalId, revenue: revenue });
    });

    // Set / Get state
    var api_set = nativeLike(function(key, value){
      if (key && typeof key === 'object') {
        for (var k in key) if (Object.prototype.hasOwnProperty.call(key, k)) state[k] = deepClone(key[k]);
      } else if (typeof key === 'string') {
        state[key] = deepClone(value);
      }
      api.emit('set', { key: key, value: deepClone(value) });
      return api;
    });

    var api_get = nativeLike(function(key, fallback){
      var v = (key in state) ? state[key] : store.get(key);
      return v === undefined ? fallback : v;
    });

    var api_is = nativeLike(function(flag){ return !!state[flag]; });

    var api_log = nativeLike(function(){
      try { return deepClone(state.logs); } catch(_) { return []; }
    });

    var api_flush = nativeLike(function(){ state.lastFlush = _now(); api.emit('flush', { t: state.lastFlush }); return true; });

    var api_version = nativeLike(function(){ return 'vwo-stub/1.0.0'; });

    // Common helper used by sites to read variation
    var api_getVariationName = nativeLike(function(testKey){
      return state.variations[testKey] || 'Control';
    });

    // Visitor/profile controls
    var api_visitor = nativeLike(function(attrs){
      if (!attrs || typeof attrs !== 'object') return deepClone(state.visitor);
      for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs,k)) state.visitor[k] = deepClone(attrs[k]);
      api.emit('visitor', deepClone(state.visitor));
      return deepClone(state.visitor);
    });

    // Simple command router for array push([...]) patterns
    function routeCommand(cmd) {
      metrics.commandsProcessed++;
      try {
        if (!cmd) return;
        if (!Array.isArray(cmd)) {
          // Allow function callbacks pushed directly
          if (typeof cmd === 'function') { cmd.call(api); return; }
          return;
        }
        var name = cmd[0];
        var args = cmd.slice(1);
        switch (name) {
          case 'on': return api_on.apply(api, args);
          case 'off': return api_off.apply(api, args);
          case 'once': return api_once.apply(api, args);
          case 'ready': return api_ready.apply(api, args);
          case 'track': return api_track.apply(api, args);
          case 'event': return api_track.apply(api, args);
          case 'goal': return api_goal.apply(api, args);
          case 'set': return api_set.apply(api, args);
          case 'get': return api_get.apply(api, args);
          case 'is': return api_is.apply(api, args);
          case 'log': return api_log.apply(api, args);
          case 'flush': return api_flush.apply(api, args);
          case 'version': return api_version.apply(api, args);
          case 'getVariationName': return api_getVariationName.apply(api, args);
          case 'visitor': return api_visitor.apply(api, args);
          default:
            // Many integrations push callbacks as ['on', 'load', fn]
            if (typeof name === 'function') { name.apply(api, args); return; }
            log('warn', 'Unknown command', { cmd: name, args: args });
        }
      } catch (e) {
        log('error', 'Command error', { e: String(e && e.message || e), cmd: cmd });
      }
    }

    // Array‑like push interface (VWO snippet style)
    var api_push = nativeLike(function() {
      for (var i = 0; i < arguments.length; i++) routeCommand(arguments[i]);
      return api.length;
    });

    // Build public shape
    var pub = function() { return api_push.apply(pub, arguments); };

    // Copy event methods
    pub.on = api_on; pub.off = api_off; pub.once = api_once; pub.emit = nativeLike(function(){ return api.emit.apply(api, arguments); });

    // Expose core API
    pub.ready = api_ready;
    pub.track = api_track;
    pub.goal = api_goal;
    pub.set = api_set;
    pub.get = api_get;
    pub.is = api_is;
    pub.log = api_log;
    pub.flush = api_flush;
    pub.version = api_version;
    pub.getVariationName = api_getVariationName;
    pub.visitor = api_visitor;

    // Metadata / flags (non‑enumerable)
    defineRO(pub, '__isStub', true);
    defineRO(pub, '__metrics', metrics);
    defineRO(pub, '__state', state);
    defineRO(pub, '__store', store);
    defineRO(pub, 'length', 0);

    // Native‑like toString for the callable object as well
    nativeLike(pub);

    // Ready tick (asynchron, wie echte SDKs)
    setTimeout(function(){ pub.ready(); }, 0);

    return pub;
  }

  // Install API
  var api = createAPI();

  // Support legacy aliases often seen on sites
  // VWO häufig: window.VWO = window.VWO || []; VWO.push([...])
  // teils auch: window._vwo or window._vwoq
  var existing = global.VWO;
  global.VWO = api;
  try { defineRO(global, '_vwo', api); } catch(_) { global._vwo = api; }
  try { defineRO(global, '_vwoq', api); } catch(_) { global._vwoq = api; }

  // Process preexisting queue safely
  if (Array.isArray(existing) && existing.length) {
    for (var i = 0; i < existing.length; i++) {
      try { api.push(existing[i]); } catch(_) {}
    }
  }

  // Public shims for common globals used by some integrations
  // Emulate minimal document.vwoVersion readouts
  try {
    if (typeof document !== 'undefined') {
      if (!document.vwoVersion) document.vwoVersion = api.version();
    }
  } catch(_){}

  // Light Consent helper: VWO.consent.set(true/false) – many sites call this
  api.consent = (function(){
    var key = 'vwo_consent';
    return {
      set: nativeLike(function(val){ store.set(key, !!val); api.emit('consent', !!val); return true; }),
      get: nativeLike(function(){ var v = store.get(key); return v == null ? undefined : !!v; })
    };
  })();

  // Variant assignment helper – deterministic per test if already set
  api.assign = nativeLike(function(testKey, variants){
    variants = Array.isArray(variants) ? variants.slice() : ['Control'];
    var k = 'vwo_var_'+testKey;
    var cur = store.get(k) || api.__state.variations[testKey];
    if (cur) { api.__state.variations[testKey] = cur; return cur; }
    var pick = variants[Math.floor(Math.random()*variants.length)] || 'Control';
    api.__state.variations[testKey] = pick;
    store.set(k, pick, 24*60*60*1000); // 24h stickiness
    api.emit('variation', { key: testKey, value: pick });
    return pick;
  });

  // Debug switch via localStorage flag
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('vwo_debug') === '1') {
      api.__state.config.debug = true;
    }
  } catch(_){}

  // Small safety no‑ops that some sites probe
  api.activate = nativeLike(function(){ return true; });
  api.deactivate = nativeLike(function(){ return true; });
  api.reset = nativeLike(function(){ api.__state.variations = {}; api.__store.del('vwo_consent'); api.emit('reset'); return true; });

  // Ensure JSON stringify looks plausible
  try { defineRO(api, 'toJSON', nativeLike(function(){ return { id: api.__state.id, version: api.version() }; })); } catch(_){}

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
