// Criteo OneTag Stub – criteo_q (pro-level, stealth, MV3-friendly)
// Simuliert das öffentliche API-Verhalten, damit Seiten denken SDK ist geladen.

(function(){
  'use strict';

  if (window.criteo_q && window.criteo_q.__PROTECTO_STUB__) return; // Idempotenz

  // --- Hilfsfunktionen ---
  const NATIVE_TO_STRING = Function.prototype.toString;
  const NATIVE_STR = "function () { [native code] }";
  const now = (typeof performance !== 'undefined' && performance.now) ? ()=>performance.now() : ()=>Date.now();

  function toNative(fn){
    try {
      fn.toString = NATIVE_TO_STRING.bind(function(){ return NATIVE_STR; });
    } catch(e){}
    return fn;
  }
  function named(name, fn){
    try {
      Object.defineProperty(fn, 'name', { value: name, configurable: true });
    } catch(e){}
    return fn;
  }
  function deepFreeze(obj){
    try { Object.freeze(obj); } catch(e){}
    return obj;
  }
  function clone(v){
    try{
      if (v == null) return v;
      if (typeof v === 'object') return JSON.parse(JSON.stringify(v));
      return v;
    }catch(e){ return v; }
  }

  // --- Vorherige Queue übernehmen ---
  const preQ = (window.criteo_q && (Array.isArray(window.criteo_q.q) || Array.isArray(window.criteo_q.queue)))
    ? (window.criteo_q.q || window.criteo_q.queue).slice()
    : [];

  // --- Internes State ---
  const _q = [];                  // Einträge: { t, a }
  const _subs = new Set();        // Subscriber callbacks
  const _pixels = new Set();      // Pixel-ID(s) nach init
  let _accountId = null;
  let _user = {};
  let _props = {};
  let _consent = { ad_storage: 'granted', analytics_storage: 'granted' };
  const _loadedTs = now();

  // --- Kernfunktion (funktionaler Aufrufer) ---
  const invoke = named('criteo_q', toNative(function(){
    try {
      const args = Array.prototype.slice.call(arguments);
      if (!args.length) return;
      const cmd = (args[0]||'').toString().toLowerCase();
      const rest = args.slice(1);

      switch(cmd){
        case 'init':
          // criteo_q('init', accountId, { opts })
          if (rest[0]) _accountId = String(rest[0]);
          enqueue(['init'].concat(rest));
          break;
        case 'setAccount':
          if (rest[0]) _accountId = String(rest[0]);
          enqueue(['setAccount'].concat(rest));
          break;
        case 'setSiteType':
          enqueue(['setSiteType'].concat(rest));
          break;
        case 'setEmail':
          enqueue(['setEmail'].concat(rest));
          break;
        case 'viewHome':
          enqueue(['viewHome'].concat(rest.map(clone)));
          break;
        case 'viewList':
          enqueue(['viewList'].concat(rest.map(clone)));
          break;
        case 'viewItem':
          enqueue(['viewItem'].concat(rest.map(clone)));
          break;
        case 'viewBasket':
          enqueue(['viewBasket'].concat(rest.map(clone)));
          break;
        case 'trackTransaction':
          enqueue(['trackTransaction'].concat(rest.map(clone)));
          break;
        case 'search':
          enqueue(['search'].concat(rest.map(clone)));
          break;
        case 'identify':
          if (rest && rest[0]) {
            if (typeof rest[0] === 'string') {
              _user.id = rest[0];
            } else if (typeof rest[0] === 'object') {
              Object.assign(_user, clone(rest[0]));
            }
          }
          enqueue(['identify'].concat(rest.map(clone)));
          break;
        case 'set':
          if (rest && typeof rest[0] === 'object' && rest[0]) {
            Object.assign(_props, clone(rest[0]));
          } else if (typeof rest[0] === 'string') {
            _props[rest[0]] = rest[1];
          }
          enqueue(['set'].concat(rest.map(clone)));
          break;
        case 'consent':
          if (rest && typeof rest[0] === 'object' && rest[0]) {
            const o = clone(rest[0]);
            if (o.ad_storage) _consent.ad_storage = String(o.ad_storage);
            if (o.analytics_storage) _consent.analytics_storage = String(o.analytics_storage);
          }
          enqueue(['consent'].concat(rest.map(clone)));
          break;
        case 'reset':
          _props = {}; _user = {};
          enqueue(['reset']);
          break;
        case 'ready':
          try { if (typeof rest[0] === 'function') setTimeout(()=>{ try{ rest[0](); }catch(e){} }, 0); } catch(e){}
          enqueue(['ready']);
          break;
        case 'event':
        case 'trackevent':
        case 'trigger':
        case 'sendevent':
          enqueue(['trackEvent'].concat(rest.map(clone)));
          break;
        case 'setdata':
          // some integrations use setData as a generic payload setter
          if (rest && typeof rest[0] === 'object' && rest[0]) {
            Object.assign(_props, clone(rest[0]));
          }
          enqueue(['setData'].concat(rest.map(clone)));
          break;
        default:
          enqueue([cmd].concat(rest));
      }
    } catch(e){ if (window.__PROTECTO_DEBUG__) try{ console.warn('[Protecto][criteo_q][invoke]', e); }catch(_){} }
  }));

  function enqueue(args){
    try{
      const entry = { t: now(), a: args.map(clone) };
      _q.push(entry);
      // cap length to 100 entries
      if (_q.length > 100) _q.shift();
      for (const s of _subs) {
        try { s.apply(null, entry.a); } catch(e){ if (window.__PROTECTO_DEBUG__) try{ console.warn('[Protecto][criteo_q][subscriber]', e); }catch(_){} }
      }
    }catch(e){ if (window.__PROTECTO_DEBUG__) try{ console.warn('[Protecto][criteo_q][enqueue]', e); }catch(_){} }
  }

  // --- Methoden-API (Facade) ---
  const pushImpl              = named('push',              toNative(function(){ return invoke.apply(null, arguments); }));
  const initImpl              = named('init',              toNative(function(){ return invoke.apply(null, ['init'].concat([].slice.call(arguments))); }));
  const setAccountImpl        = named('setAccount',        toNative(function(){ return invoke.apply(null, ['setAccount'].concat([].slice.call(arguments))); }));
  const setSiteTypeImpl       = named('setSiteType',       toNative(function(){ return invoke.apply(null, ['setSiteType'].concat([].slice.call(arguments))); }));
  const setEmailImpl          = named('setEmail',          toNative(function(){ return invoke.apply(null, ['setEmail'].concat([].slice.call(arguments))); }));
  const viewHomeImpl          = named('viewHome',          toNative(function(){ var a=[].slice.call(arguments).map(clone); return invoke.apply(null, ['viewHome'].concat(a)); }));
  const viewListImpl          = named('viewList',          toNative(function(){ var a=[].slice.call(arguments).map(clone); return invoke.apply(null, ['viewList'].concat(a)); }));
  const viewItemImpl          = named('viewItem',          toNative(function(){ var a=[].slice.call(arguments).map(clone); return invoke.apply(null, ['viewItem'].concat(a)); }));
  const viewBasketImpl        = named('viewBasket',        toNative(function(){ var a=[].slice.call(arguments).map(clone); return invoke.apply(null, ['viewBasket'].concat(a)); }));
  const trackTransactionImpl  = named('trackTransaction',  toNative(function(){ var a=[].slice.call(arguments).map(clone); return invoke.apply(null, ['trackTransaction'].concat(a)); }));
  const searchImpl            = named('search',            toNative(function(){ var a=[].slice.call(arguments).map(clone); return invoke.apply(null, ['search'].concat(a)); }));
  const identifyImpl          = named('identify',          toNative(function(){ var a=[].slice.call(arguments).map(clone); return invoke.apply(null, ['identify'].concat(a)); }));
  const setImpl               = named('set',               toNative(function(){ var a=[].slice.call(arguments).map(clone); return invoke.apply(null, ['set'].concat(a)); }));
  const consentImpl           = named('consent',           toNative(function(){ var a=[].slice.call(arguments).map(clone); return invoke.apply(null, ['consent'].concat(a)); }));
  const resetImpl             = named('reset',             toNative(function(){ return invoke.apply(null, ['reset'].concat([].slice.call(arguments))); }));
  const readyImpl             = named('ready',             toNative(function(cb){ try{ typeof cb==='function' && cb(); }catch(e){} return invoke('ready'); }));

  const subscribeImpl         = named('subscribe',          toNative(function(cb){ if(typeof cb==='function') _subs.add(cb); }));
  const unsubscribeImpl       = named('unsubscribe',        toNative(function(cb){ _subs.delete(cb); }));

  // --- Zusammensetzen des API Objekts ---
  const api = invoke;

  Object.defineProperties(api, {
    push:              { value: pushImpl,              writable:true, configurable:true, enumerable:false },
    init:              { value: initImpl,              writable:true, configurable:true, enumerable:false },
    setAccount:        { value: setAccountImpl,        writable:true, configurable:true, enumerable:false },
    setSiteType:       { value: setSiteTypeImpl,       writable:true, configurable:true, enumerable:false },
    setEmail:          { value: setEmailImpl,          writable:true, configurable:true, enumerable:false },
    viewHome:          { value: viewHomeImpl,          writable:true, configurable:true, enumerable:false },
    viewList:          { value: viewListImpl,          writable:true, configurable:true, enumerable:false },
    viewItem:          { value: viewItemImpl,          writable:true, configurable:true, enumerable:false },
    viewBasket:        { value: viewBasketImpl,        writable:true, configurable:true, enumerable:false },
    trackTransaction:  { value: trackTransactionImpl,   writable:true, configurable:true, enumerable:false },
    search:            { value: searchImpl,            writable:true, configurable:true, enumerable:false },
    identify:          { value: identifyImpl,          writable:true, configurable:true, enumerable:false },
    set:               { value: setImpl,               writable:true, configurable:true, enumerable:false },
    consent:           { value: consentImpl,           writable:true, configurable:true, enumerable:false },
    reset:             { value: resetImpl,             writable:true, configurable:true, enumerable:false },
    ready:             { value: readyImpl,             writable:true, configurable:true, enumerable:false },
    subscribe:         { value: subscribeImpl,         writable:true, configurable:true, enumerable:false },
    unsubscribe:       { value: unsubscribeImpl,       writable:true, configurable:true, enumerable:false },

    __PROTECTO_STUB__: { value: true,                 writable:true, configurable:true },
    version:           { value: '1.0',               writable:true, configurable:true },
    accountId:         { get: function(){ return _accountId; }, configurable:true },
    pixels:            { get: function(){ return Array.from(_pixels); }, configurable:true },
    user:              { get: function(){ return Object.assign({}, _user); }, configurable:true },
    props:             { get: function(){ return Object.assign({}, _props); }, configurable:true },
    consentState:      { get: function(){ return { ad_storage: _consent.ad_storage, analytics_storage: _consent.analytics_storage }; }, configurable:true },
    q:                 { get: function(){ return _q.slice(); }, configurable:true },
    queue:             { get: function(){ return _q.map(e=>e.a); }, configurable:true }
  });

  // Spoof native-like toString
  toNative(api);
  toNative(pushImpl); toNative(initImpl); toNative(setAccountImpl);
  toNative(setSiteTypeImpl); toNative(setEmailImpl); toNative(viewHomeImpl);
  toNative(viewListImpl); toNative(viewItemImpl); toNative(viewBasketImpl);
  toNative(trackTransactionImpl); toNative(searchImpl); toNative(identifyImpl);
  toNative(setImpl); toNative(consentImpl); toNative(resetImpl);
  toNative(readyImpl); toNative(subscribeImpl); toNative(unsubscribeImpl);

  // Lock down the API surface
  // deepFreeze(api);

  // Install stub globally
  Object.defineProperty(window, 'criteo_q', {
    value: api,
    configurable: true,
    writable: true,
    enumerable: false
  });

  // Flush pre-queue
  if (preQ && preQ.length) {
    for (let i = 0; i < preQ.length; i++) {
      const item = preQ[i];
      if (Array.isArray(item)) {
        setTimeout(()=>{ try { api.apply(null, item); } catch(e){ if (window.__PROTECTO_DEBUG__) try{ console.warn('[Protecto][criteo_q][preQ]', e); }catch(_){} } }, 0);
      }
    }
  }

  // Optional debug statement
  // if (window.__PROTECTO_DEBUG__) console.debug('[Protecto][Stub:criteo_q] loaded, preQ=', preQ.length);

}());