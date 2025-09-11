/*
 * Mixpanel Browser SDK – High‑Fidelity Stub (Protecto)
 * ----------------------------------------------------
 * Ziel: Seiten glauben, dass Mixpanel vollständig geladen ist.
 *  - API‑Kompatibilität: track, identify, alias, people.*, register, time_event, init, get_instance …
 *  - Pre‑Queue‑Übernahme (klassischer Mixpanel‑Snippet)
 *  - Keine Netzwerkaufrufe, nur In‑Memory/Storage Simulation
 *  - Idempotent, read‑only Oberfläche, native‑like toString
 */
(function(){
  'use strict';

  if (window.__PROTECTO_MIXPANEL_STUB__) return; // idempotent
  Object.defineProperty(window, '__PROTECTO_MIXPANEL_STUB__', { value:true, configurable:false });

  var __PROTECTO_DEBUG__ = !!window.__PROTECTO_DEBUG__;
  function dlog(){ try{ if(__PROTECTO_DEBUG__) console.debug.apply(console, ['[Protecto][Mixpanel]'].concat([].slice.call(arguments))); }catch(_){} }

  // ---------- utils ----------
  function isObj(x){ return x && typeof x === 'object'; }
  function clone(x){ try{ return JSON.parse(JSON.stringify(x)); } catch(_){ return x; } }
  function now(){ return Date.now ? Date.now() : (+new Date()); }
  function defineRO(obj, key, val){ Object.defineProperty(obj, key, { value:val, enumerable:true, configurable:false, writable:false }); }
  function defineROh(obj, key, getter){ Object.defineProperty(obj, key, { get:getter, enumerable:true, configurable:false }); }
  function nativeLike(fn){ try{ fn.toString = function(){ return 'function '+(fn.name||'anonymous')+'() { [native code] }'; }; }catch(_){ } return fn; }
  function nf(fn, name){ try{ Object.defineProperty(fn, 'name', { value:name, configurable:true }); }catch(_){} return fn; }
  function safeLS(){ try{ return window.localStorage; }catch(_){ return null; } }
  function getLS(k, d){ try{ var s=safeLS(); if(!s) return d; var v=s.getItem(k); return v==null?d:v; }catch(_){ return d; } }
  function setLS(k, v){ try{ var s=safeLS(); if(!s) return; s.setItem(k, v); }catch(_){} }
  function uuid(){ return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){ var r=Math.random()*16|0, v=c==='x'?r:(r&0x3|0x8); return v.toString(16); }); }

  // ---------- Event Emitter ----------
  var listeners = Object.create(null);
  function on(evt, cb){ if(typeof cb!=='function') return; (listeners[evt]=listeners[evt]||[]).push(cb); }
  function off(evt, cb){ var a=listeners[evt]; if(!a) return; var i=a.indexOf(cb); if(i>=0) a.splice(i,1); }
  function emit(evt, payload){ var a=listeners[evt]; if(!a) return; a.slice().forEach(function(fn){ try{ fn(clone(payload)); }catch(_){ } }); }

  // ---------- Core state ----------
  var STORE_KEY = '__protecto_mixpanel__';
  var persisted = {}; try { persisted = JSON.parse(getLS(STORE_KEY, '{}')) || {}; } catch(_){ persisted = {}; }

  function save(){ setLS(STORE_KEY, JSON.stringify(persisted)); }

  // Global default instance name is 'mixpanel'
  var instances = Object.create(null);

  function createState(name){
    var ns = name || 'mixpanel';
    var p = persisted[ns] || (persisted[ns] = {});
    var st = {
      name: ns,
      token: p.token || null,
      config: p.config || {},
      distinct_id: p.distinct_id || (p.distinct_id = uuid()),
      people_props: p.people_props || {},
      super_props: p.super_props || {},
      timed: p.timed || {}, // event -> start timestamp
      opted_out: !!p.opted_out,
      queue: p.queue || [],
      maxKeep: 1000
    };
    save();
    return st;
  }

  function persistState(st){
    var p = persisted[st.name] || (persisted[st.name] = {});
    p.token = st.token; p.config = st.config; p.distinct_id = st.distinct_id;
    p.people_props = st.people_props; p.super_props = st.super_props;
    p.timed = st.timed; p.opted_out = !!st.opted_out; p.queue = st.queue;
    save();
  }

  function logEvent(st, kind, payload){
    var evt = { ts: now(), kind: kind, payload: clone(payload||{}) };
    st.queue.push(evt); if(st.queue.length>st.maxKeep) st.queue.splice(0, st.queue.length-st.maxKeep);
    emit(kind, { instance: st.name, data: evt.payload });
    dlog(st.name+':', kind, evt.payload);
    persistState(st);
  }

  // ---------- API factory (per instance) ----------
  function makeAPI(name){
    var state = createState(name);

    function checkOpt(){ return !!state.opted_out; }

    function _applySuperProps(props){ if(!isObj(props)) return; Object.keys(props).forEach(function(k){ state.super_props[k]=props[k]; }); }

    function init(token, config, instanceName){
      if (instanceName && instanceName!==state.name) {
        // delegate to named instance
        var inst = mixpanel.get_instance(instanceName) || mixpanel.init(token, config, instanceName);
        return inst;
      }
      state.token = token || state.token; state.config = isObj(config)?clone(config):state.config; 
      logEvent(state, 'init', { token: state.token, config: state.config });
      return api; // mixpanel.init returns instance
    }

    function track(event, props, cb){
      if(checkOpt()) return; 
      var payload = clone(props||{});
      // merge super props (do not override explicit props)
      Object.keys(state.super_props).forEach(function(k){ if(!(k in payload)) payload[k]=state.super_props[k]; });
      logEvent(state, 'track', { event: String(event||'event'), properties: payload, distinct_id: state.distinct_id, token: state.token });
      if(typeof cb==='function') setTimeout(function(){ try{ cb(1); }catch(_){ } },0);
    }

    function identify(id){
      if(id==null) return state.distinct_id; // getter form
      state.distinct_id = String(id);
      logEvent(state, 'identify', { distinct_id: state.distinct_id });
    }

    function alias(newId, originalId){
      logEvent(state, 'alias', { alias: String(newId||''), original: originalId==null?state.distinct_id:String(originalId) });
      // just record; some sites expect alias to not change distinct immediately
    }

    function reset(){
      state.distinct_id = uuid();
      state.super_props = {}; state.people_props = {}; state.timed = {}; state.opted_out=false;
      logEvent(state, 'reset', {});
    }

    function register(props){ _applySuperProps(props); logEvent(state,'register', clone(props||{})); }
    function register_once(props){ var p=clone(props||{}); Object.keys(p).forEach(function(k){ if(!(k in state.super_props)) state.super_props[k]=p[k]; }); logEvent(state,'register_once',p); }
    function unregister(key){ if(key in state.super_props) delete state.super_props[key]; logEvent(state,'unregister',{key:key}); }
    function get_property(key){ return state.super_props[key]; }

    function time_event(event){ state.timed[String(event||'event')] = now(); logEvent(state,'time_event',{event:String(event||'event')}); }

    function track_timed(event, props){
      var e = String(event||'event'); var start=state.timed[e]; var dur = start? Math.max(0, now()-start) : undefined;
      var p = clone(props||{}); if(dur!=null) p.$duration = dur/1000;
      track(e, p);
      delete state.timed[e];
    }

    function opt_in_tracking(){ state.opted_out=false; logEvent(state,'opt_in',{}); }
    function opt_out_tracking(){ state.opted_out=true; logEvent(state,'opt_out',{}); }

    function set_config(cfg){ if(isObj(cfg)) { state.config = clone(cfg); logEvent(state,'set_config', clone(cfg)); } }
    function get_config(k){ if(!k) return clone(state.config); return state.config[k]; }

    // people API
    var people = {};
    function pplSet(obj){ if(!isObj(obj)) return; Object.keys(obj).forEach(function(k){ state.people_props[k]=obj[k]; }); logEvent(state,'people.set', clone(obj)); }
    function pplSetOnce(obj){ if(!isObj(obj)) return; Object.keys(obj).forEach(function(k){ if(!(k in state.people_props)) state.people_props[k]=obj[k]; }); logEvent(state,'people.set_once', clone(obj)); }
    function pplUnion(obj){ if(!isObj(obj)) return; var o=clone(obj); Object.keys(o).forEach(function(k){ var v=o[k]; var cur = state.people_props[k]; if(!Array.isArray(cur)) cur = []; if(Array.isArray(v)) { v.forEach(function(x){ if(cur.indexOf(x)<0) cur.push(x); }); } else { if(cur.indexOf(v)<0) cur.push(v); } state.people_props[k]=cur; }); logEvent(state,'people.union', o); }
    function pplAppend(obj){ if(!isObj(obj)) return; Object.keys(obj).forEach(function(k){ var cur = state.people_props[k]; if(!Array.isArray(cur)) cur = []; cur.push(obj[k]); state.people_props[k]=cur; }); logEvent(state,'people.append', clone(obj)); }
    function pplIncrement(obj){ if(!isObj(obj)) return; Object.keys(obj).forEach(function(k){ var v=Number(obj[k]||0); var cur = Number(state.people_props[k]||0); state.people_props[k]=cur+v; }); logEvent(state,'people.increment', clone(obj)); }
    function pplDelete(){ state.people_props={}; logEvent(state,'people.delete',{}); }

    [
      ['set', pplSet],
      ['set_once', pplSetOnce],
      ['union', pplUnion],
      ['append', pplAppend],
      ['increment', pplIncrement],
      ['delete_user', pplDelete]
    ].forEach(function(pair){ defineRO(people, pair[0], nativeLike(nf(pair[1], pair[0]))); });
    try{ Object.freeze(people); }catch(_){ }

    // groups API (minimal façade)
    function add_group(key, value){ logEvent(state,'group.add', { key:key, value:value }); }
    function set_group(key, value){ logEvent(state,'group.set', { key:key, value:value }); }

    // Track helpers (no-op wrappers)
    function track_links(){ logEvent(state,'track_links',{}); }
    function track_forms(){ logEvent(state,'track_forms',{}); }

    // expose
    var api = {};
    [
      ['init', init],
      ['track', track],
      ['identify', identify],
      ['alias', alias],
      ['reset', reset],
      ['register', register],
      ['register_once', register_once],
      ['unregister', unregister],
      ['get_property', get_property],
      ['time_event', time_event],
      ['track_timed', track_timed],
      ['opt_in_tracking', opt_in_tracking],
      ['opt_out_tracking', opt_out_tracking],
      ['set_config', set_config],
      ['get_config', get_config],
      ['people', people],
      ['add_group', add_group],
      ['set_group', set_group],
      ['on', on], ['off', off]
    ].forEach(function(p){ defineRO(api, p[0], nativeLike(nf(p[1], p[0]))); });

    defineROh(api, 'get_distinct_id', function(){ return function(){ return state.distinct_id; }; });
    defineROh(api, 'toString', function(){ return function(){ return 'function mixpanel() { [native code] }'; }; });

    // debug helpers
    defineRO(api, '_getState', nativeLike(nf(function(){ return clone(state); }, '_getState')));

    try{ Object.freeze(api); }catch(_){ }
    return api;
  }

  // ---------- Global mixpanel façade ----------
  var pre = window.mixpanel; // may be array from snippet

  var mixpanel = instances['mixpanel'] = makeAPI('mixpanel');

  // support namespaces via init(token, cfg, name) returning instance, and get_instance(name)
  function get_instance(name){ if(!name) return mixpanel; if(!instances[name]) instances[name]=makeAPI(name); return instances[name]; }
  defineRO(mixpanel, 'get_instance', nativeLike(nf(get_instance, 'get_instance')));

  // Snippet compatibility flags/fields
  defineRO(mixpanel, '__SV', 1.2); // common flag in real snippet
  defineRO(mixpanel, '__loaded', true);

  // adopt pre-queue
  try {
    if (Array.isArray(pre)) {
      // The classic snippet pushes function names to create stubs; we already have methods.
      // But it might contain real calls like ['init', token, config]
      for (var i=0;i<pre.length;i++){
        var it = pre[i];
        if (!it) continue;
        if (Array.isArray(it)){
          var m = it[0]; var args = it.slice(1);
          if (typeof mixpanel[m] === 'function') { try{ mixpanel[m].apply(mixpanel, args); }catch(_){ } }
        }
      }
    }
  } catch(_){ }

  // expose globally (read-only)
  try { Object.defineProperty(window, 'mixpanel', { value: mixpanel, enumerable:true, configurable:false, writable:false }); }
  catch(_){ window.mixpanel = mixpanel; }

  dlog('stub loaded');
})();
