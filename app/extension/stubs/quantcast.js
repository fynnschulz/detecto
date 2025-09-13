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
  window.__quantcastStubLoaded = true;

  var __PROTECTO_DEBUG__ = !!window.__PROTECTO_DEBUG__;
  function dlog(){ try{ if(__PROTECTO_DEBUG__) console.debug.apply(console, ["[Protecto][Quantcast]"].concat([].slice.call(arguments))); }catch(_){} }

  // ---- tiny utils ----
  function isObj(x){ return x && typeof x === "object"; }
  function clone(v){ try{ return JSON.parse(JSON.stringify(v)); } catch(_){ return v; } }
  function asArray(a){ return Array.isArray(a) ? a : (a==null ? [] : [a]); }
  function now(){ return Date.now ? Date.now() : (+new Date()); }
  function nf(fn, name){ try{ Object.defineProperty(fn, "name", { value:name, configurable:true }); }catch(_){} return fn; }
  function nativeLike(fn){ try{ fn.toString = function(){ return "function " + (fn.name||"quant") + "() { [native code] }"; }; }catch(_){} return fn; }

  // ---- internal state ----
  var __state = {
    account: null,         // qacct (p-XXXXX)
    consent: { tcf: null },
    site: { type:null },
    events: [],            // stored events for diagnostics
    readyCbs: [],
    seenLimit: 0,
    maxKeep: 500
  };

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
  window._qevents = _qevents;

  _qevents.push = nativeLike(nf(function(){
    for (var i=0;i<arguments.length;i++) ingest(arguments[i]);
    return Array.prototype.push.apply(_qevents, arguments);
  }, "push"));

  _qevents.pop = nativeLike(nf(function(){
    return Array.prototype.pop.apply(_qevents, arguments);
  }, "pop"));

  _qevents.shift = nativeLike(nf(function(){
    return Array.prototype.shift.apply(_qevents, arguments);
  }, "shift"));

  _qevents.unshift = nativeLike(nf(function(){
    return Array.prototype.unshift.apply(_qevents, arguments);
  }, "unshift"));

  _qevents.splice = nativeLike(nf(function(){
    return Array.prototype.splice.apply(_qevents, arguments);
  }, "splice"));

  _qevents.sort = nativeLike(nf(function(){
    return Array.prototype.sort.apply(_qevents, arguments);
  }, "sort"));

  _qevents.reverse = nativeLike(nf(function(){
    return Array.prototype.reverse.apply(_qevents, arguments);
  }, "reverse"));

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

  window.__qc = api;

  // Provide a noop quantserve() symbol some integrations check for
  function quantserve() { dlog("quantserve() noop"); }
  quantserve = nativeLike(nf(quantserve, "quantserve"));
  window.quantserve = quantserve;

  // also expose minimal __qc.hash or helpers sometimes probed
  api.hash = nativeLike(nf(function(s){
    // very light non-crypto hash for compatibility probes only
    try{ s = String(s||""); }catch(_) { s = ""; }
    var h=0; for(var i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; }
    return (h>>>0).toString(16);
  }, "hash"));

  dlog("stub loaded; account=", __state.account);
})();