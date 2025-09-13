// Quora Pixel Stub – qp (pro‑level, stealth, MV3‑friendly)
// Emulates the public Quora Pixel API so sites believe the SDK is loaded.
// Compatible with common call patterns like:
//   qp('init','PIXEL_ID'); qp('track','ViewContent', {value: 12});
//   qp('set', { currency: 'EUR' }); qp('identify', { email: 'x@y.z' });
//   window.qp=window.qp||function(){ (window.qp.q=window.qp.q||[]).push(arguments) };

(function(){
  'use strict';
  try {
    if (window.qp && window.qp.__PROTECTO_STUB__) return; // idempotent

    // ===== Utilities =====
    const NATIVE_TO_STRING = Function.prototype.toString;
    const NATIVE_STR = "function () { [native code] }";
    const now = (typeof performance !== 'undefined' && performance.now) ? ()=>performance.now() : ()=>Date.now();

    function toNative(fn){ try{ fn.toString = NATIVE_TO_STRING.bind(function(){ return NATIVE_STR; }); }catch{} return fn; }
    function named(name, fn){ try{ Object.defineProperty(fn, 'name', { value: name, configurable: true }); }catch{} return fn; }

    // ===== Adopt any pre‑existing bootstrap queue =====
    // Quora snippet often defines a function shim that queues calls before SDK loads.
    const preQ = (window.qp && (Array.isArray(window.qp.q) || Array.isArray(window.qp.queue)))
      ? (window.qp.q || window.qp.queue).slice() : [];

    // ===== Internal State =====
    const _q = [];                    // entries { t, a }
    const _subs = new Set();          // subscribers(args...)
    const _pixels = new Set();        // pixel IDs (from init)
    let _user = {};                   // identify data
    let _props = {};                  // set/consent properties
    let _consent = { ad_storage: 'granted', analytics_storage: 'granted' };
    const _loadedTs = now();

    // ===== Core invoker (function form) =====
    const invoke = named('qp', toNative(function(){
      try {
        const args = Array.prototype.slice.call(arguments);
        if (!args.length) return;
        const cmd = (args[0]||'').toString().toLowerCase();
        const rest = args.slice(1);
        switch (cmd) {
          case 'init':
            // qp('init', 'PIXEL_ID', options?)
            if (rest[0]) _pixels.add(String(rest[0]));
            enqueue(['init'].concat(rest));
            break;
          case 'track':
            // qp('track', 'PageView'|'ViewContent'|'Purchase'|..., payload?)
            enqueue(['track'].concat(rest));
            break;
          case 'sendevent': // alias sometimes seen
          case 'send':
            enqueue(['track'].concat(rest));
            break;
          case 'page': // not official everywhere, but used by some wrappers
            enqueue(['page'].concat(rest));
            break;
          case 'identify':
            // qp('identify', { id:..., email:..., external_id:... })
            if (rest && rest[0]) {
              if (typeof rest[0] === 'string') {
                _user.id = rest[0];
              } else if (typeof rest[0] === 'object') {
                Object.assign(_user, rest[0]);
              }
            }
            enqueue(['identify'].concat(rest));
            break;
          case 'set':
            // qp('set', key, val) or qp('set', {..})
            if (rest && typeof rest[0] === 'object' && rest[0]) {
              Object.assign(_props, rest[0]);
            } else if (typeof rest[0] === 'string') {
              _props[rest[0]] = rest[1];
            }
            enqueue(['set'].concat(rest));
            break;
          case 'consent':
            if (rest && typeof rest[0]==='object' && rest[0]) {
              const o = rest[0];
              if (o.ad_storage) _consent.ad_storage = String(o.ad_storage);
              if (o.analytics_storage) _consent.analytics_storage = String(o.analytics_storage);
            }
            enqueue(['consent'].concat(rest));
            break;
          case 'reset':
            _props = {}; _user = {}; enqueue(['reset']);
            break;
          case 'ready':
            try { typeof rest[0]==='function' && rest[0](); } catch{}
            enqueue(['ready']);
            break;
          default:
            enqueue([cmd].concat(rest)); // keep unknown to avoid breaking site logic
        }
      } catch {}
    }));

    function enqueue(args){
      const entry = { t: now(), a: args };
      _q.push(entry);
      for (const s of _subs) { try { s.apply(null, args); } catch{} }
    }

    // ===== API surface (methods) =====
    const pushImpl       = named('push',       toNative(function(){ return invoke.apply(null, arguments); }));
    const initImpl       = named('init',       toNative(function(){ return invoke.apply(null, ['init'].concat([].slice.call(arguments))); }));
    const trackImpl      = named('track',      toNative(function(){ return invoke.apply(null, ['track'].concat([].slice.call(arguments))); }));
    const sendImpl       = named('send',       toNative(function(){ return invoke.apply(null, ['send'].concat([].slice.call(arguments))); }));
    const sendEventImpl  = named('sendEvent',  toNative(function(){ return invoke.apply(null, ['sendEvent'].concat([].slice.call(arguments))); }));
    const pageImpl       = named('page',       toNative(function(){ return invoke.apply(null, ['page'].concat([].slice.call(arguments))); }));
    const identifyImpl   = named('identify',   toNative(function(){ return invoke.apply(null, ['identify'].concat([].slice.call(arguments))); }));
    const setImpl        = named('set',        toNative(function(){ return invoke.apply(null, ['set'].concat([].slice.call(arguments))); }));
    const consentImpl    = named('consent',    toNative(function(){ return invoke.apply(null, ['consent'].concat([].slice.call(arguments))); }));
    const resetImpl      = named('reset',      toNative(function(){ return invoke.apply(null, ['reset'].concat([].slice.call(arguments))); }));
    const readyImpl      = named('ready',      toNative(function(cb){ try{ typeof cb==='function' && cb(); }catch{} return invoke('ready'); }));
    const subscribeImpl   = named('subscribe',   toNative(function(cb){ if (typeof cb==='function') _subs.add(cb); }));
    const unsubscribeImpl = named('unsubscribe', toNative(function(cb){ _subs.delete(cb); }));

    // ===== Assemble global function object =====
    const api = invoke; // function

    api.push = pushImpl;
    api.init = initImpl;
    api.track = trackImpl;
    api.send = sendImpl;
    api.sendEvent = sendEventImpl;
    api.page = pageImpl;
    api.identify = identifyImpl;
    api.set = setImpl;
    api.consent = consentImpl;
    api.reset = resetImpl;
    api.ready = readyImpl;
    api.subscribe = subscribeImpl;
    api.unsubscribe = unsubscribeImpl;

    api.__PROTECTO_STUB__ = true;
    api.version = '1.0';
    api.loadedAt = _loadedTs;

    Object.defineProperty(api, 'pixels', { get: function(){ return Array.from(_pixels); } });
    Object.defineProperty(api, 'user', { get: function(){ return Object.assign({}, _user); } });
    Object.defineProperty(api, 'props', { get: function(){ return Object.assign({}, _props); } });
    Object.defineProperty(api, 'consentState', { get: function(){ return { ad_storage:_consent.ad_storage, analytics_storage:_consent.analytics_storage }; } });
    Object.defineProperty(api, 'q', { get: function(){ return _q.slice(); } });
    Object.defineProperty(api, 'queue', { get: function(){ return _q.map(e=>e.a); } });

    // Spoof native‑like toString for function and all methods
    toNative(api); toNative(pushImpl); toNative(initImpl); toNative(trackImpl);
    toNative(sendImpl); toNative(sendEventImpl); toNative(pageImpl);
    toNative(identifyImpl); toNative(setImpl); toNative(consentImpl);
    toNative(resetImpl); toNative(readyImpl); toNative(subscribeImpl); toNative(unsubscribeImpl);

    // Install global, non‑writable qp
    window.qp = api;

    // Flush pre‑existing queue
    if (preQ && preQ.length) {
      try {
        for (let i=0;i<preQ.length;i++) {
          const item = preQ[i];
          if (Array.isArray(item)) { try { api.apply(null, item); } catch{} }
        }
      } catch {}
    }

    // Optional debug: if (window.__PROTECTO_DEBUG__) console.debug('[Protecto][Stub:qp] active, preQ=', preQ.length);
  } catch {}
})();
