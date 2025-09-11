// Reddit Pixel Stub – rdt (pro‑level, stealth, MV3‑friendly)
// Emulates the public API so sites believe the SDK is loaded.
(function(){
  try {
    if (window.rdt && window.rdt.__PROTECTO_STUB__) return; // idempotent

    // ===== Utilities =====
    const NATIVE_TO_STRING = Function.prototype.toString;
    const NATIVE_STR = "function () { [native code] }";
    const now = (typeof performance !== 'undefined' && performance.now) ? ()=>performance.now() : ()=>Date.now();

    function toNative(fn){ try{ fn.toString = NATIVE_TO_STRING.bind(function(){ return NATIVE_STR; }); }catch{} return fn; }
    function named(name, fn){ try{ Object.defineProperty(fn, 'name', { value: name, configurable: true }); }catch{} return fn; }
    function deepFreeze(o){ try{ Object.freeze(o); }catch{} return o; }

    // ===== Pre‑existing bootstrap queue (if any) =====
    // Some pages declare a lightweight shim: window.rdt = window.rdt || function(){ (window.rdt.q=window.rdt.q||[]).push(arguments) }
    const preQ = (window.rdt && (Array.isArray(window.rdt.q) || Array.isArray(window.rdt.queue)))
      ? (window.rdt.q || window.rdt.queue).slice() : [];

    // ===== Internal State =====
    const _q = [];                    // full entries {t, a}
    const _subs = new Set();          // subscribers(args...)
    const _pixels = new Set();        // pixel IDs after init
    let _user = {};                   // identify info
    let _props = {};                  // set/consent scoped props
    let _consent = { ad_storage: 'granted', analytics_storage: 'granted' };
    let _loadedTs = now();

    // Known commands seen in the wild: 'init', 'track', 'send', 'sendEvent', 'page', 'identify', 'set', 'consent', 'reset', 'ready'

    // ===== Core invoker (function style) =====
    const invoke = named('rdt', toNative(function(){
      try {
        const args = Array.prototype.slice.call(arguments);
        if (!args.length) return;
        const cmd = (args[0]||'').toString().toLowerCase();
        const rest = args.slice(1);
        switch (cmd) {
          case 'init':
            // rdt('init', 'PIXEL_ID', options)
            if (rest[0]) _pixels.add(String(rest[0]));
            enqueue(['init'].concat(rest));
            break;
          case 'track':
            // rdt('track', 'PageVisit'|'ViewContent'|..., props)
            enqueue(['track'].concat(rest));
            break;
          case 'sendevent':
          case 'send':
            // alias to track
            enqueue(['track'].concat(rest));
            break;
          case 'page':
            enqueue(['page'].concat(rest));
            break;
          case 'identify':
            // rdt('identify', { id:..., email:..., ... }) | ('identify', 'uid')
            if (rest && rest[0]) {
              if (typeof rest[0] === 'string') _user.id = rest[0];
              else if (typeof rest[0] === 'object') Object.assign(_user, rest[0]);
            }
            enqueue(['identify'].concat(rest));
            break;
          case 'set':
            // rdt('set', key,val) or ('set', {..})
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
            enqueue([cmd].concat(rest)); // keep unknown for compatibility
        }
      } catch {}
    }));

    function enqueue(args){
      const entry = { t: now(), a: args };
      _q.push(entry);
      for (const s of _subs) { try { s.apply(null, args); } catch{} }
    }

    // ===== Method surface (façade) =====
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

    Object.defineProperties(api, {
      push:   { value: pushImpl,   writable:false, configurable:false, enumerable:false },
      init:   { value: initImpl,   writable:false, configurable:false, enumerable:false },
      track:  { value: trackImpl,  writable:false, configurable:false, enumerable:false },
      send:   { value: sendImpl,   writable:false, configurable:false, enumerable:false },
      sendEvent: { value: sendEventImpl, writable:false, configurable:false, enumerable:false },
      page:   { value: pageImpl,   writable:false, configurable:false, enumerable:false },
      identify:{value: identifyImpl,writable:false, configurable:false, enumerable:false },
      set:    { value: setImpl,    writable:false, configurable:false, enumerable:false },
      consent:{ value: consentImpl,writable:false, configurable:false, enumerable:false },
      reset:  { value: resetImpl,  writable:false, configurable:false, enumerable:false },
      ready:  { value: readyImpl,  writable:false, configurable:false, enumerable:false },
      subscribe:   { value: subscribeImpl,   writable:false, configurable:false, enumerable:false },
      unsubscribe: { value: unsubscribeImpl, writable:false, configurable:false, enumerable:false },

      __PROTECTO_STUB__: { value: true,  writable:false, configurable:false },
      version:           { value: '1.0', writable:false, configurable:false },
      loadedAt:          { value: _loadedTs, writable:false, configurable:false },
      pixels:            { get: function(){ return Array.from(_pixels); } },
      user:              { get: function(){ return Object.assign({}, _user); } },
      props:             { get: function(){ return Object.assign({}, _props); } },
      consentState:      { get: function(){ return { ad_storage:_consent.ad_storage, analytics_storage:_consent.analytics_storage }; } },
      q:                 { get: function(){ return _q.slice(); } },
      queue:             { get: function(){ return _q.map(e=>e.a); } }
    });

    // Spoof native‑like toString for function and methods
    toNative(api); toNative(pushImpl); toNative(initImpl); toNative(trackImpl);
    toNative(sendImpl); toNative(sendEventImpl); toNative(pageImpl);
    toNative(identifyImpl); toNative(setImpl); toNative(consentImpl);
    toNative(resetImpl); toNative(readyImpl); toNative(subscribeImpl); toNative(unsubscribeImpl);

    // Lock down the API surface
    deepFreeze(api);

    // Install global, non‑writable rdt
    Object.defineProperty(window, 'rdt', {
      value: api,
      configurable: false,
      writable: false,
      enumerable: false
    });

    // Flush pre‑queue from any shim
    if (preQ && preQ.length) {
      try {
        for (let i=0;i<preQ.length;i++) {
          const item = preQ[i];
          if (Array.isArray(item)) { try { api.apply(null, item); } catch{} }
        }
      } catch {}
    }

    // Optional debug: if (window.__PROTECTO_DEBUG__) console.debug('[Protecto][Stub:rdt] active, preQ=', preQ.length);
  } catch {}
})();
