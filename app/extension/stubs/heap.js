/*
 * Protecto Stub — Heap Analytics (heap.js)
 * Goal: Behave like Heap’s browser SDK so sites don’t error and think it’s active.
 *  - No network I/O
 *  - 200 OK via extension redirect, page sees fully working API surface
 *  - Handles classic snippet queue semantics and rich API
 */
(function(){
  if (typeof window === 'undefined') return;
  if (window.heap && window.heap.__PROTECTO_STUB__) return; // idempotent

  var DEBUG = !!window.__PROTECTO_DEBUG__;
  var log = function(){ if (DEBUG) try { console.debug.apply(console, ['[Protecto][Stub][Heap]'].concat([].slice.call(arguments))); } catch(_){} };
  var now = function(){ return Date.now ? Date.now() : +new Date(); };
  var uid = function(){ return Math.random().toString(16).slice(2) + String(now()); };
  var clone = function(v){ try { return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; } catch(_) { return v; } };

  // Persist a small ring buffer to look realistic across navigations
  var SS_KEY = '__protecto_heap_buffer__';
  var MAX_BUF = 200;
  function readBuf(){ try { var s = sessionStorage.getItem(SS_KEY); return s ? JSON.parse(s) : []; } catch(_) { return []; } }
  function writeBuf(arr){ try { sessionStorage.setItem(SS_KEY, JSON.stringify(arr.slice(-MAX_BUF))); } catch(_){} }

  // Internal state per default instance
  var state = {
    appId: null,
    userId: null,
    deviceId: uid(),
    sessionId: now(),
    startedAt: now(),
    optOut: false,
    userProps: {},      // addUserProperties
    evStatic: {},       // addEventProperties (sticky)
    buffer: readBuf(),
    readyCbs: [],
    inited: false
  };

  function enqueue(evt){
    try {
      state.buffer.push(evt);
      if (state.buffer.length > MAX_BUF) state.buffer.shift();
      writeBuf(state.buffer);
    } catch(_){}
  }

  // Core API façade
  function Heap(){ /* callable legacy no-op */ }

  // --- load(appId, config) — classic snippet entry ---
  Heap.load = function(appId, config){
    state.appId = appId || state.appId || 'app_'+uid();
    state.inited = true;
    if (config && typeof config === 'object') {
      // honor some common options (no-ops but stored for realism)
      state.config = clone(config);
      if (config.userId) state.userId = String(config.userId);
    }
    log('load', { appId: state.appId });
    // flush ready callbacks async
    setTimeout(function(){
      var f; while ((f = state.readyCbs.shift())) { try { f(); } catch(_){} }
    }, 0);
    return Heap;
  };

  // --- identify(userId, traits?) ---
  Heap.identify = function(userId, traits){
    if (userId == null) return Heap;
    state.userId = String(userId);
    if (traits && typeof traits === 'object') {
      for (var k in traits) if (Object.prototype.hasOwnProperty.call(traits,k)) {
        state.userProps[k] = clone(traits[k]);
      }
    }
    enqueue({ t:'identify', uid: state.userId, traits: clone(traits)||{}, ts: now() });
    return Heap;
  };

  // --- resetIdentity() ---
  Heap.resetIdentity = function(){
    state.userId = null;
    state.sessionId = now();
    enqueue({ t:'reset', ts: now() });
    return Heap;
  };

  // --- addUserProperties(props) ---
  Heap.addUserProperties = function(props){
    if (!props || typeof props !== 'object') return Heap;
    for (var k in props) if (Object.prototype.hasOwnProperty.call(props,k)) {
      state.userProps[k] = clone(props[k]);
    }
    enqueue({ t:'userProps', props: clone(props), ts: now() });
    return Heap;
  };

  // --- addEventProperties(props) — sticky event props ---
  Heap.addEventProperties = function(props){
    if (!props || typeof props !== 'object') return Heap;
    for (var k in props) if (Object.prototype.hasOwnProperty.call(props,k)) {
      state.evStatic[k] = clone(props[k]);
    }
    enqueue({ t:'evStatic:add', props: clone(props), ts: now() });
    return Heap;
  };

  // --- clearEventProperties() ---
  Heap.clearEventProperties = function(){
    state.evStatic = {};
    enqueue({ t:'evStatic:clear', ts: now() });
    return Heap;
  };

  // --- removeEventProperty(key) ---
  Heap.removeEventProperty = function(key){
    if (key in state.evStatic) delete state.evStatic[key];
    enqueue({ t:'evStatic:remove', key: key, ts: now() });
    return Heap;
  };

  // --- setEventProperties(props) (alias for addEventProperties in some SDKs) ---
  Heap.setEventProperties = function(props){ return Heap.addEventProperties(props); };

  // --- track(event, props) ---
  Heap.track = function(ev, props){
    if (state.optOut) return Heap;
    var payload = {
      event: String(ev||'event'),
      properties: Object.assign({}, clone(state.evStatic), clone(props)||{}),
      userId: state.userId,
      deviceId: state.deviceId,
      sessionId: state.sessionId,
      time: now(),
      lib: 'protecto-stub-heap'
    };
    enqueue({ t:'event', e: payload });
    return Heap;
  };

  // --- consent/opt out (not official, but some wrappers use) ---
  Heap.optOut = function(flag){ state.optOut = !!flag; enqueue({ t:'optOut', v: state.optOut, ts: now() }); return Heap; };

  // --- ready(callback) ---
  Heap.ready = function(cb){ if (typeof cb === 'function') state.readyCbs.push(cb); if (state.inited) setTimeout(function(){ Heap.load(); }, 0); return Heap; };

  // --- getters ---
  Heap.getUserId = function(){ return state.userId; };
  Heap.getDeviceId = function(){ return state.deviceId; };
  Heap.getSessionId = function(){ return state.sessionId; };
  Heap.getAppId = function(){ return state.appId; };
  Heap.getEventProperties = function(){ return Object.assign({}, state.evStatic); };

  // --- custom cookie/storage helpers (no-op but present in some builds) ---
  Heap.storage = {
    get: function(key){ try { return sessionStorage.getItem(String(key)); } catch(_) { return null; } },
    set: function(key,val){ try { sessionStorage.setItem(String(key), String(val)); } catch(_){} },
    remove: function(key){ try { sessionStorage.removeItem(String(key)); } catch(_){} }
  };

  // Native-like toString for functions
  var nativeSig = 'function () { [native code] }';
  [
    'load','identify','resetIdentity','addUserProperties','addEventProperties','clearEventProperties','removeEventProperty','setEventProperties',
    'track','optOut','ready','getUserId','getDeviceId','getSessionId','getAppId','getEventProperties'
  ].forEach(function(name){ try { Object.defineProperty(Heap[name], 'toString', { value: function(){ return nativeSig; } }); } catch(_){} });

  // Expose internal state (read-only) for debugging
  Object.defineProperties(Heap, {
    __PROTECTO_STUB__: { value: true },
    _buffer: { get: function(){ return state.buffer.slice(); } },
    _userProps: { get: function(){ return Object.assign({}, state.userProps); } },
    _eventProps: { get: function(){ return Object.assign({}, state.evStatic); } },
    _config: { get: function(){ return Object.assign({}, state.config||{}); } }
  });

  // Install global
  var pre = Array.isArray(window.heap) ? window.heap.slice() : null; // classic snippet queue
  window.heap = Heap;

  // Drain pre-queued calls like ["load", APP_ID]
  if (pre) {
    pre.forEach(function(cmd){
      try {
        if (!Array.isArray(cmd) || !cmd.length) return;
        var m = cmd[0];
        var args = cmd.slice(1);
        if (typeof Heap[m] === 'function') Heap[m].apply(Heap, args);
      } catch(_){}
    });
  }

  log('Heap stub active');
})();
