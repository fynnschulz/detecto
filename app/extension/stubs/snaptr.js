// Snap Pixel Stub – snaptr (pro‑level, stealth, MV3‑friendly)
// Emulates the public API so sites believe the SDK is loaded.
(function(){
  try {
    if (window.snaptr && window.snaptr.__PROTECTO_STUB__) return; // idempotent

    // ===== Utilities =====
    const NATIVE_TO_STRING = Function.prototype.toString;
    const NATIVE_STR = "function () { [native code] }";
    const now = (typeof performance !== 'undefined' && performance.now) ? ()=>performance.now() : ()=>Date.now();

    function toNative(fn){ try{ fn.toString = NATIVE_TO_STRING.bind(function(){ return NATIVE_STR; }); }catch{} return fn; }
    function named(name, fn){ try{ Object.defineProperty(fn, 'name', { value: name, configurable: true }); }catch{} return fn; }
    function deepFreeze(o){ try{ Object.freeze(o); }catch{} return o; }

    // ===== Pre‑existing bootstrap queue (if any) =====
    const preQ = (window.snaptr && Array.isArray(window.snaptr.queue)) ? window.snaptr.queue.slice() : [];

    // ===== Internal State =====
    const _q = [];                  // full entries {t, a}
    const _subs = new Set();        // subscribers(args...)
    const _pixels = new Set();      // pixel ids after init
    let _userId = null;             // identify
    let _props = {};                // set/consent scoped props
    let _consent = { ad_storage: 'granted', analytics_storage: 'granted' };

    // Snap typical commands seen in the wild: 'init', 'track', 'identify', 'set', 'consent', 'page', 'reset', 'ready'

    // ===== Core invoker (function style) =====
    const invoke = named('snaptr', toNative(function(){
      try {
        const args = Array.prototype.slice.call(arguments);
        if (!args.length) return;
        const cmd = (args[0]||'').toString().toLowerCase();
        const rest = args.slice(1);
        switch (cmd) {
          case 'init':
            // snaptr('init', 'PIXEL_ID', {user_email:..., ...})
            if (rest[0]) _pixels.add(String(rest[0]));
            enqueue(['init'].concat(rest));
            break;
          case 'track':
            // snaptr('track', 'PAGE_VIEW'|..., props)
            enqueue(['track'].concat(rest));
            break;
          case 'identify':
            // snaptr('identify', { user_email:..., user_id:... }) | ('identify', 'uid')
            if (rest && rest[0]) {
              if (typeof rest[0] === 'string') _userId = rest[0];
              else if (typeof rest[0] === 'object') {
                const o = rest[0]||{}; _userId = o.user_id || o.uid || _userId;
              }
            }
            enqueue(['identify'].concat(rest));
            break;
          case 'set':
            // snaptr('set', key,val) or ('set', {..})
            if (rest && typeof rest[0] === 'object' && rest[0]) {
              Object.assign(_props, rest[0]);
            } else if (typeof rest[0] === 'string') {
              _props[rest[0]] = rest[1];
            }
            enqueue(['set'].concat(rest));
            break;
          case 'consent':
            // snaptr('consent', { ad_storage:'denied'|'granted', analytics_storage:'denied'|'granted' })
            if (rest && typeof rest[0]==='object' && rest[0]) {
              const o = rest[0];
              if (o.ad_storage) _consent.ad_storage = String(o.ad_storage);
              if (o.analytics_storage) _consent.analytics_storage = String(o.analytics_storage);
            }
            enqueue(['consent'].concat(rest));
            break;
          case 'page':
            // soft alias for page view snapshot
            enqueue(['page'].concat(rest));
            break;
          case 'reset':
            // Some SDKs provide a reset; keep state minimal
            _props = {}; _userId = null; enqueue(['reset']);
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
    const pushImpl      = named('push',      toNative(function(){ return invoke.apply(null, arguments); }));
    const initImpl      = named('init',      toNative(function(){ return invoke.apply(null, ['init'].concat([].slice.call(arguments))); }));
    const trackImpl     = named('track',     toNative(function(){ return invoke.apply(null, ['track'].concat([].slice.call(arguments))); }));
    const identifyImpl  = named('identify',  toNative(function(){ return invoke.apply(null, ['identify'].concat([].slice.call(arguments))); }));
    const setImpl       = named('set',       toNative(function(){ return invoke.apply(null, ['set'].concat([].slice.call(arguments))); }));
    const consentImpl   = named('consent',   toNative(function(){ return invoke.apply(null, ['consent'].concat([].slice.call(arguments))); }));
    const pageImpl      = named('page',      toNative(function(){ return invoke.apply(null, ['page'].concat([].slice.call(arguments))); }));
    const resetImpl     = named('reset',     toNative(function(){ return invoke.apply(null, ['reset'].concat([].slice.call(arguments))); }));
    const readyImpl     = named('ready',     toNative(function(cb){ try{ typeof cb==='function' && cb(); }catch{} return invoke('ready'); }));
    const subscribeImpl   = named('subscribe',   toNative(function(cb){ if (typeof cb==='function') _subs.add(cb); }));
    const unsubscribeImpl = named('unsubscribe', toNative(function(cb){ _subs.delete(cb); }));

    // ===== Assemble global function object =====
    const api = invoke; // function

    Object.defineProperties(api, {
      push:   { value: pushImpl,   writable:false, configurable:false, enumerable:false },
      init:   { value: initImpl,   writable:false, configurable:false, enumerable:false },
      track:  { value: trackImpl,  writable:false, configurable:false, enumerable:false },
      identify:{value: identifyImpl,writable:false, configurable:false, enumerable:false },
      set:    { value: setImpl,    writable:false, configurable:false, enumerable:false },
      consent:{ value: consentImpl,writable:false, configurable:false, enumerable:false },
      page:   { value: pageImpl,   writable:false, configurable:false, enumerable:false },
      reset:  { value: resetImpl,  writable:false, configurable:false, enumerable:false },
      ready:  { value: readyImpl,  writable:false, configurable:false, enumerable:false },
      subscribe:   { value: subscribeImpl,   writable:false, configurable:false, enumerable:false },
      unsubscribe: { value: unsubscribeImpl, writable:false, configurable:false, enumerable:false },

      __PROTECTO_STUB__: { value: true,  writable:false, configurable:false },
      version:           { value: '1.1', writable:false, configurable:false },
      loaded:            { value: true,  writable:false, configurable:false },
      pixels:            { get: function(){ return Array.from(_pixels); } },
      userId:            { get: function(){ return _userId; } },
      props:             { get: function(){ return Object.assign({}, _props); } },
      consentState:      { get: function(){ return { ad_storage:_consent.ad_storage, analytics_storage:_consent.analytics_storage }; } },
      q:                 { get: function(){ return _q.slice(); } },
      queue:             { get: function(){ return _q.map(e=>e.a); } }
    });

    // Spoof native‑like toString for function and methods
    toNative(api); toNative(pushImpl); toNative(initImpl); toNative(trackImpl);
    toNative(identifyImpl); toNative(setImpl); toNative(consentImpl); toNative(pageImpl);
    toNative(resetImpl); toNative(readyImpl); toNative(subscribeImpl); toNative(unsubscribeImpl);

    // Lock down the API surface
    deepFreeze(api);

    // Install global, non‑writable snaptr
    Object.defineProperty(window, 'snaptr', {
      value: api,
      configurable: false,
      writable: false,
      enumerable: false
    });

    // Flush pre‑queue
    if (preQ && preQ.length) {
      try {
        for (let i=0;i<preQ.length;i++) {
          const item = preQ[i];
          if (Array.isArray(item)) { try { api.apply(null, item); } catch{} }
        }
      } catch {}
    }

    // Optional debug: if (window.__PROTECTO_DEBUG__) console.debug('[Protecto][Stub:snaptr] active, preQ=', preQ.length);
  } catch {}
})();
