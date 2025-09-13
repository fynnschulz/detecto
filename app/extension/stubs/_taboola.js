(function(){
  'use strict';

  // ------------------------------------------------------------
  // Protecto Stub: Taboola JS Tag / Pixel
  // Goal: behave truthy and API-compatible so sites think Taboola
  //       loaded successfully while no network beacons are sent.
  // ------------------------------------------------------------

  if (typeof window === 'undefined') return;
  if (window._taboola && window._taboola.__PROTECTO_STUB__) return;

  var MAX_QUEUE = 200;                 // keep last N commands
  var VERSION = 'protecto-taboola-stub@1.0.0';
  var DEBUG = !!window.__PROTECTO_DEBUG__;

  function log(){ if(DEBUG) try{ console.debug.apply(console, ['[Protecto][_taboola]'].concat([].slice.call(arguments))); }catch(e){} }

  // ------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------
  function typeOf(v){ return Object.prototype.toString.call(v).slice(8,-1).toLowerCase(); }
  function isObj(v){ return v && typeof v === 'object' && !Array.isArray(v); }
  function clone(v){
    try {
      if (v === null || typeof v !== 'object') return v;
      return JSON.parse(JSON.stringify(v));
    } catch (e) {
      // Best-effort clone
      if (Array.isArray(v)) return v.map(clone);
      var o = {}; for (var k in v){ try{ o[k] = clone(v[k]); }catch(_){} }
      return o;
    }
  }

  // Generate a pseudo placement id for realism
  function uid(){ return 'tb_'+Math.random().toString(36).slice(2)+Date.now().toString(36); }

  // ------------------------------------------------------------
  // Internal state
  // ------------------------------------------------------------
  var state = {
    placements: [],        // last declared placements
    page: {                // page context flags (mimic Taboola params)
      article: false, video: false, photo: false,
      search: false, category: false, home: false
    },
    readyCbs: [],          // callbacks passed via `ready`
    subscribers: [],       // generic event subscribers
    account: null,
    target_type: 'mix',
    lastFlushAt: 0
  };

  // ------------------------------------------------------------
  // Core queue & facade
  // ------------------------------------------------------------
  var _q = [];             // publicly exposed queue snapshot
  var history = [];        // internal bounded history

  function boundPush(entry){
    history.push(entry);
    if (history.length > MAX_QUEUE) history.shift();
    _q.length = 0; // refresh public snapshot
    for(var i=0;i<history.length;i++) _q[i] = history[i];
  }

  function emit(evt, payload){
    try {
      state.subscribers.forEach(function(fn){ try{ fn(evt, clone(payload)); }catch(e){ log('subscriber err', e); } });
    } catch(_){}
  }

  // Accept commands shaped as objects (real Taboola pushes objects)
  // Examples from docs:
  //   _taboola.push({ mode:'thumbnails-a', container:'taboola-slot', placement:'Below Article Thumbnails', target_type:'mix' });
  //   _taboola.push({ article:'auto' });
  //   _taboola.push({ flush:true });

  function handlePush(obj){
    var o = isObj(obj) ? obj : {};
    var rec = clone(o);

    // Page type hints
    ['article','video','photo','search','category','home'].forEach(function(k){
      if (k in o){ state.page[k] = true; }
    });

    // Placement declaration
    if (typeof o.mode === 'string' && (o.container || o.placement)){
      var placement = {
        id: uid(),
        mode: String(o.mode),
        container: o.container || null,
        placement: o.placement || null,
        target_type: o.target_type || state.target_type,
        timestamp: Date.now()
      };
      try { state.placements.push(placement); } catch(_){ /* ignore */ }
      emit('placement', placement);
    }

    // Account / page settings occasionally passed
    if (typeof o.account_id === 'string' || typeof o.publisher_id === 'string'){
      try { state.account = o.account_id || o.publisher_id; } catch(_){ }
    }
    if (typeof o.target_type === 'string'){
      try { state.target_type = o.target_type; } catch(_){ }
    }

    // Flush means: render now. For the stub, just record a timestamp
    if (o.flush === true){
      state.lastFlushAt = Date.now();
      emit('flush', {at: state.lastFlushAt});
    }

    boundPush(rec);
    return 1; // many libs return queue length or truthy
  }

  // Public callable function (array-like + callable), native-ish
  function taboolaFacade(){
    // Some sites incorrectly call `_taboola('flush')`
    try {
      if (arguments.length === 1 && typeof arguments[0] === 'string'){
        var cmd = arguments[0].toLowerCase();
        if (cmd === 'flush'){ return handlePush({flush:true}); }
      }
      if (arguments.length === 1 && isObj(arguments[0])) return handlePush(arguments[0]);
      if (arguments.length > 1){ return handlePush({ args: [].slice.call(arguments) }); }
    } catch(e){ log('facade call error', e); }
    return 1;
  }

  // Methods commonly used by integrations
  taboolaFacade.push = function(){
    for (var i=0;i<arguments.length;i++) handlePush(arguments[i]);
    return _q.length;
  };
  taboolaFacade.ready = function(cb){
    if (typeof cb === 'function'){
      // async fire to mimic real lib behavior
      state.readyCbs.push(cb);
      setTimeout(function(){ try{ cb(); }catch(e){ log('ready cb err', e);} }, 0);
    }
  };
  taboolaFacade.on = function(listener){
    if (typeof listener === 'function') state.subscribers.push(listener);
  };
  taboolaFacade.off = function(listener){
    var i = state.subscribers.indexOf(listener); if (i>=0) state.subscribers.splice(i,1);
  };

  // Read-only props (without freezing)
  Object.defineProperties(taboolaFacade, {
    __PROTECTO_STUB__: { value: true, writable: false },
    version:           { value: VERSION, writable: false },
    q:                 { get: function(){ return _q; } },
    queue:             { get: function(){ return _q; } },
    placements:        { get: function(){ return state.placements.slice(); } },
    page:              { get: function(){ return clone(state.page); } },
    account:           { get: function(){ return state.account; } },
    target_type:       { get: function(){ return state.target_type; } },
    lastFlushAt:       { get: function(){ return state.lastFlushAt; } }
  });

  // Native-like stringification for sanity checks
  function nativeishToString(){ return 'function _taboola() { [native code] }'; }
  try { taboolaFacade.toString = nativeishToString; } catch(_){}
  try { taboolaFacade.push.toString = function(){ return 'function push() { [native code] }'; }; } catch(_){}

  // ------------------------------------------------------------
  // Pre-existing queue support
  // ------------------------------------------------------------
  var pre = window._taboola;
  window._taboola = taboolaFacade;

  if (Array.isArray(pre)){
    // some sites assign window._taboola = [] then push objects before loader
    // process them asynchronously to avoid layout jank
    setTimeout(function(){
      try {
        for (var i=0;i<pre.length;i++) handlePush(pre[i]);
        log('pre-queue flushed', pre.length);
      } catch(e){ log('pre-queue err', e); }
    }, 0);
  }

  log('stub installed', VERSION);
})();