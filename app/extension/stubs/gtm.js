(function(){
  "use strict";

  // ===== Idempotenz + Stealth =====
  if (window.__PROTECTO_GTM__) return;
  try { Object.defineProperty(window, '__PROTECTO_GTM__', { value: true, writable:false, configurable:false, enumerable:false }); } catch { window.__PROTECTO_GTM__ = true; }

  function nativeFn(name){ return function(){ return `function ${name}() { [native code] }`; }; }
  function defGlobal(obj, key, value){
    try { Object.defineProperty(obj, key, { value, writable:true, configurable:true, enumerable:false }); }
    catch { obj[key] = value; }
  }

  // ===== Utilities =====
  const MAX_EVENTS = 200;
  const jitter = (min=12, max=35) => Math.floor(min + Math.random()*(max-min));

  // Conservative real-GTM guard: nur überspringen, wenn klar echte Lib markiert ist
  if (window.gaRealLoaded === true || (window.gtag && window.gtag.loaded === true)) return;

  // ===== dataLayer (echtes Array, bounded) =====
  const dataLayer = (function(){
    const pre = Array.isArray(window.dataLayer) ? window.dataLayer.slice() : [];
    const visible = pre.slice(-MAX_EVENTS);
    let buffer = pre.slice(-MAX_EVENTS);

    function dlPush(){
      for (let i=0; i<arguments.length; i++){
        const ev = arguments[i];
        if (buffer.length >= MAX_EVENTS) buffer.shift();
        buffer.push(ev);
        if (visible.length >= MAX_EVENTS) visible.shift();
        visible.push(ev);
      }
      // leichte asynchrone Verarbeitung simulieren
      setTimeout(()=>{
        try { flushGtagQueue(); } catch {}
      }, jitter());
      return visible.length;
    }

    const handler = {
      get(t, prop){
        if (prop === 'push') return dlPush;
        if (prop === '__dump') return () => buffer.slice();
        return Reflect.get(t, prop);
      },
      set(t, prop, val){
        if (prop === 'length') { t.length = 0; buffer = []; return true; }
        return Reflect.set(t, prop, val);
      }
    };

    const prox = new Proxy(visible, handler);
    defGlobal(window, 'dataLayer', prox);
    try { prox.push.toString = nativeFn('push'); } catch {}

    // Boot-Events deduplizieren
    const hasEvent = (name) => visible.some(e => e && e.event === name || e && e["gtm.start"]);
    const now = Date.now();
    if (!hasEvent('gtm.js'))   visible.push({ "gtm.start": now, event: 'gtm.js' });
    if (!hasEvent('gtm.dom'))  visible.push({ event: 'gtm.dom'  });
    if (!hasEvent('gtm.load')) visible.push({ event: 'gtm.load' });

    return prox;
  })();

  // ===== google_tag_manager (lazy Container-Proxy) =====
  const gtmStore = {};
  const gtmProxy = new Proxy(gtmStore, {
    get(target, key){
      if (key === 'toString') return nativeFn('Object');
      if (key === 'dataLayer' || key === 'dl') return dataLayer;
      if (!(key in target)) target[key] = {};
      return target[key];
    }
  });
  defGlobal(window, 'google_tag_manager', gtmProxy);

  // ===== gtag() Fassade (synchron, kein Promise) =====
  const gtagQ = Array.isArray(window.gtag && window.gtag.q) ? window.gtag.q : [];
  function _gtag(){
    const args = Array.prototype.slice.call(arguments);
    try{
      const [cmd, a1, a2] = args;
      switch (String(cmd||'').toLowerCase()){
        case 'js':
          // noop
          break;
        case 'config':
          dataLayer.push({ event: 'gtag.config', id: a1, params: a2 || {} });
          break;
        case 'event':
          dataLayer.push({ event: a1 || 'gtag.event', params: a2 || {} });
          break;
        case 'consent':
          dataLayer.push({ event: 'gtag.consent', action: a1, params: a2 || {} });
          break;
        case 'set':
          dataLayer.push({ event: 'gtag.set', params: a1 || {} });
          break;
        default:
          dataLayer.push({ event: 'gtag.call', args });
      }
    }catch{}
    return true; // synchron
  }

  function flushGtagQueue(){
    if (!Array.isArray(gtagQ)) return;
    while (gtagQ.length){
      const a = gtagQ.shift();
      try { _gtag.apply(null, a); } catch {}
    }
  }

  if (typeof window.gtag !== 'function') {
    defGlobal(window, 'gtag', _gtag);
  }
  try { window.gtag.toString = nativeFn('gtag'); } catch {}
  // Bewahre eine (leere) Queue-Property für Integrationen, non-enum
  try { window.gtag.q = gtagQ; } catch {}
  // Direkt nach Init einmal spülen
  try { flushGtagQueue(); } catch {}

  // ===== ga() Legacy-Fassade (analytics.js Minimal) =====
  const gaShim = (function(){
    const q = [];
    function ga(){ try{ q.push(arguments); }catch{} return true; }
    ga.q = q; ga.l = +new Date();
    ga.create = function(){ return true; };
    ga.send   = function(){ return true; };
    ga.set    = function(){ return true; };
    ga.require= function(){ return true; };
    ga.getAll = function(){
      const tr = { get:function(){return null;}, send:function(){return true;}, set:function(){return true;}, require:function(){return true;} };
      try {
        tr.get.toString = nativeFn('get');
        tr.send.toString = nativeFn('send');
        tr.set.toString  = nativeFn('set');
        tr.require.toString = nativeFn('require');
      } catch {}
      return [tr];
    };
    try {
      ga.toString = nativeFn('ga');
      ga.create.toString = nativeFn('create');
      ga.send.toString = nativeFn('send');
      ga.set.toString = nativeFn('set');
      ga.require.toString = nativeFn('require');
    } catch {}
    return ga;
  })();
  defGlobal(window, 'ga', gaShim);

  // ===== leichte Initial-Jitter (Stealth) =====
  setTimeout(()=>{}, jitter());

})();