

/*
 * Quantcast / Quantserve (Q Pixel) – High‑fidelity Stub
 * Goals:
 *  - Emulate the public surface used by sites: window._qevents (queue), window.__qc, window.quantserve
 *  - Accept base tag and event pushes; never break page logic
 *  - No network; record events in memory; behave synchronously where expected
 *  - Native‑like toString/readonly props; idempotent; pre‑queue adoption
 *
 * References for public API shape:
 *  - Q Pixel base tag & events use `window._qevents` with objects like { qacct: "p-XXXX", event: "view" }
 *  - Loader URL typically https://secure.quantserve.com/quant.js (aka quantserve)
 */
(function(){
  "use strict";

  if (window.__quantcastStubLoaded) return; // idempotent
  Object.defineProperty(window, "__quantcastStubLoaded", { value:true, configurable:false });

  var __PROTECTO_DEBUG__ = !!window.__PROTECTO_DEBUG__;
  function dlog(){ try{ if(__PROTECTO_DEBUG__) console.debug.apply(console, ["[Protecto][Quantcast]"].concat([].slice.call(arguments))); }catch(_){} }

  // ---- tiny utils ----
  function isObj(x){ return x && typeof x === "object"; }
  function clone(v){ try{ return JSON.parse(JSON.stringify(v)); } catch(_){ return v; } }
  function defineRO(obj, key, val){ Object.defineProperty(obj, key, { value:val, enumerable:true, configurable:false, writable:false }); }
  function asArray(a){ return Array.isArray(a) ? a : (a==null ? [] : [a]); }
  function now(){ return Date.now ? Date.now() : (+new Date()); }
  function nf(fn, name){ try{ Object.defineProperty(fn, "name", { value:name, configurable:true }); }catch(_){} return fn; }
  function nativeLike(fn){ try{ fn.toString = function(){ return "function " + (fn.name||"quant") + "() { [native code] }"; }; }catch(_){} return fn; }

  // ---- internal state ----
  var __state = Object.seal({
    account: null,         // qacct (p-XXXXX)
    consent: { tcf: null },
    site: { type:null },
    events: [],            // stored events for diagnostics
    readyCbs: [],
    seenLimit: 0,
    maxKeep: 500
  });

  // ---- core ingest ----
  function ingest(ev){
    if (!isObj(ev)) return;
    var e = clone(ev);
    e.ts = now();
    if (!e.qacct && __state.account) e.qacct = __state.account;

    // Normalize common aliases
    if (e.event == null && e.qevent) e.event = e.qevent;
    if (e.event == null && e.type)   e.event = e.type;

    // Heuristics: treat `labels`, `_fp`, `_qopts` as metadata
    var meta = {};
    ["labels","_fp","_qopts","category","segment"].forEach(function(k){ if(e[k]!=null) meta[k] = e[k]; });
    if(Object.keys(meta).length) e.__meta = meta;

    // Keep bounded
    __state.events.push(e);
    if (__state.events.length > __state.maxKeep) __state.events.splice(0, __state.events.length - __state.maxKeep);

    dlog("ingest", e);
  }

  // ---- public queue window._qevents ----
  var pre = window._qevents;
  var _qevents = [];
  defineRO(window, "_qevents", _qevents);

  // define push that ingests entries and mimics array semantics
  var pushImpl = nativeLike(nf(function(){
    for (var i=0;i<arguments.length;i++) ingest(arguments[i]);
    return _qevents.length; // match Array.push contract
  }, "push"));

  // read‑only methods on array facade
  defineRO(_qevents, "push", pushImpl);
  ["pop","shift","unshift","splice","sort","reverse"].forEach(function(m){ defineRO(_qevents, m, nativeLike(nf(function(){ return 0; }, m))); });

  // adopt pre‑queue
  try{
    if (Array.isArray(pre)) {
      for (var j=0;j<pre.length;j++) ingest(pre[j]);
    }
  }catch(_){}

  // ---- __qc object (seen on some sites) ----
  var __qc = window.__qc;
  if (!isObj(__qc)) __qc = {};

  var api = {};

  api.init = nativeLike(nf(function(cfg){
    cfg = cfg||{};
    if (cfg.qacct) __state.account = String(cfg.qacct);
    if (cfg.site_type) __state.site.type = String(cfg.site_type);
    if (cfg.consent)  __state.consent.tcf = clone(cfg.consent);
    dlog("init", cfg);
  }, "init"));

  api.setAccount = nativeLike(nf(function(qacct){
    if (qacct) __state.account = String(qacct);
    dlog("setAccount", qacct);
  }, "setAccount"));

  api.setSiteType = nativeLike(nf(function(t){ __state.site.type = String(t||""); dlog("setSiteType", t); }, "setSiteType"));

  api.consent = nativeLike(nf(function(tcf){ __state.consent.tcf = clone(tcf||null); dlog("consent", tcf); }, "consent"));

  api.event = nativeLike(nf(function(name, data){ ingest(Object.assign({ event:String(name||"event") }, isObj(data)?data:{})); }, "event"));

  api.track = nativeLike(nf(function(name, data){ ingest(Object.assign({ event:String(name||"track") }, isObj(data)?data:{})); }, "track"));

  api.view = nativeLike(nf(function(data){ ingest(Object.assign({ event:"view" }, isObj(data)?data:{})); }, "view"));

  api.purchase = nativeLike(nf(function(order){
    var o = isObj(order) ? order : { value: order };
    ingest(Object.assign({ event:"purchase" }, o));
  }, "purchase"));

  api.ready = nativeLike(nf(function(cb){
    if (typeof cb === "function") {
      __state.readyCbs.push(cb);
      setTimeout(function(){ try{ cb(); }catch(_){}} , 0);
    }
  }, "ready"));

  api.getState = nativeLike(nf(function(){ return clone({ account:__state.account, site:__state.site, consent:__state.consent }); }, "getState"));

  api.getEvents = nativeLike(nf(function(){ return clone(__state.events); }, "getEvents"));

  // Provide a noop quantserve() symbol some integrations check for
  var quantserve = nativeLike(nf(function(){ dlog("quantserve() noop"); }, "quantserve"));

  // Expose globals in a realistic way
  Object.freeze(__state);
  defineRO(window, "__qc", Object.freeze(api));
  defineRO(window, "quantserve", quantserve);

  // also expose minimal __qc.qhash or helpers sometimes probed
  defineRO(window.__qc, "hash", nativeLike(nf(function(s){
    // very light non-crypto hash for compatibility probes only
    try{ s = String(s||""); }catch(_) { s = ""; }
    var h=0; for(var i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; }
    return (h>>>0).toString(16);
  }, "hash")));

  // ensure properties look non‑writable
  try{ Object.freeze(window._qevents); }catch(_){ }
  try{ Object.freeze(window.__qc); }catch(_){ }

  dlog("stub loaded; account=", __state.account);
})();