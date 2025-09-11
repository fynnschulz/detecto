// Twitter/X Pixel Stub – twq (pro‑level, high‑fidelity)
(function(){
  try {
    if (window.twq && window.twq.__PROTECTO_STUB__) return; // idempotent

    // ---------- internals ----------
    const NATIVE = Function.prototype.toString;
    const NATIVE_STR = "function () { [native code] }";
    const now = (typeof performance !== 'undefined' && performance.now) ? ()=>performance.now() : ()=>Date.now();

    function toNative(fn){ try{ fn.toString = NATIVE.bind(function(){ return NATIVE_STR; }); }catch{} return fn; }
    function named(name, fn){ try{ Object.defineProperty(fn, 'name', { value: name, configurable: true }); }catch{} return fn; }
    function deepFreeze(obj){ try { Object.freeze(obj); } catch {} return obj; }

    // ---------- expected API surface ----------
    // • window.twq is a function(queue‑style) with .push → twq('init', id), twq('track', 'PageView', props)
    // • Some bootstraps preload twq.queue = [] before loader arrives
    // • Flags checked in the wild: twq.loaded, twq.version
    // • Some wrappers call twq.push directly; others call twq('set'|"identify"|"ready", ...)

    // Adopt pre‑existing queue content if present (var twq = window.twq; twq.queue = twq.queue || [])
    const pre = (window.twq && Array.isArray(window.twq.queue)) ? window.twq.queue.slice() : [];

    // Internal structures
    const _queue = [];
    const _subs  = new Set();
    let _pixelId = null;

    // Core invoker (function style): twq('cmd', ...args)
    const invoke = named('twq', toNative(function(){
      try {
        const args = Array.prototype.slice.call(arguments);
        if (!args.length) return;
        const cmd = (args[0]||'').toString().toLowerCase();
        const rest = args.slice(1);
        switch (cmd) {
          case 'init':
            _pixelId = (rest && rest[0]) ? String(rest[0]) : _pixelId;
            enqueue(['init'].concat(rest));
            break;
          case 'track':
            enqueue(['track'].concat(rest));
            break;
          case 'identify':
            enqueue(['identify'].concat(rest));
            break;
          case 'set':
            enqueue(['set'].concat(rest));
            break;
          case 'ready':
            // ready(cb) → invoke immediately so host code continues
            try { (typeof rest[0] === 'function') && rest[0](); } catch {}
            enqueue(['ready']);
            break;
          default:
            // Pass‑through for unknown commands; we keep the queue for compatibility
            enqueue([cmd].concat(rest));
        }
      } catch {}
    }));

    function enqueue(args){
      const entry = { t: now(), a: args, pixelId: _pixelId };
      _queue.push(entry);
      for (const s of _subs) { try { s.apply(null, args); } catch {} }
    }

    // Method façade used by some SDK wrappers
    const pushImpl     = named('push',     toNative(function(){ return invoke.apply(null, arguments); }));
    const initImpl     = named('init',     toNative(function(){ return invoke.apply(null, ['init'].concat([].slice.call(arguments))); }));
    const trackImpl    = named('track',    toNative(function(){ return invoke.apply(null, ['track'].concat([].slice.call(arguments))); }));
    const identifyImpl = named('identify', toNative(function(){ return invoke.apply(null, ['identify'].concat([].slice.call(arguments))); }));
    const setImpl      = named('set',      toNative(function(){ return invoke.apply(null, ['set'].concat([].slice.call(arguments))); }));
    const readyImpl    = named('ready',    toNative(function(cb){ try{ typeof cb==='function' && cb(); }catch{} return invoke('ready'); }));

    const subscribeImpl   = named('subscribe',   toNative(function(cb){ if (typeof cb==='function') _subs.add(cb); }));
    const unsubscribeImpl = named('unsubscribe', toNative(function(cb){ _subs.delete(cb); }));

    // Attach façade to invoker function (so typeof twq === 'function')
    const twq = invoke;

    // Flags & readonly views
    Object.defineProperties(twq, {
      push:   { value: pushImpl,   writable: false, configurable: false, enumerable: false },
      init:   { value: initImpl,   writable: false, configurable: false, enumerable: false },
      track:  { value: trackImpl,  writable: false, configurable: false, enumerable: false },
      identify:{ value: identifyImpl,writable: false, configurable: false, enumerable: false },
      set:    { value: setImpl,    writable: false, configurable: false, enumerable: false },
      ready:  { value: readyImpl,  writable: false, configurable: false, enumerable: false },
      subscribe:   { value: subscribeImpl,   writable: false, configurable: false, enumerable: false },
      unsubscribe: { value: unsubscribeImpl, writable: false, configurable: false, enumerable: false },

      __PROTECTO_STUB__: { value: true,  writable: false, configurable: false },
      version:           { value: '1.1', writable: false, configurable: false },
      loaded:            { value: true,  writable: false, configurable: false },
      pixelId:           { get: function(){ return _pixelId; } },
      q:                 { get: function(){ return _queue.slice(); } },
      queue:             { get: function(){ return _queue.map(e=>e.a); } }
    });

    // native‑like toString for all methods
    toNative(twq); toNative(pushImpl); toNative(initImpl); toNative(trackImpl);
    toNative(identifyImpl); toNative(setImpl); toNative(readyImpl);
    toNative(subscribeImpl); toNative(unsubscribeImpl);

    // Deep freeze to prevent tampering
    deepFreeze(twq);

    // Install global (non‑enumerable, non‑writable)
    Object.defineProperty(window, 'twq', {
      value: twq,
      configurable: false,
      writable: false,
      enumerable: false
    });

    // Adopt pre‑queued commands
    if (pre && pre.length) {
      try {
        for (let i=0;i<pre.length;i++) {
          const it = pre[i];
          if (Array.isArray(it)) {
            // Typical shapes: ['init', id, opts], ['track', 'PageView', props]
            try { invoke.apply(null, it); } catch {}
          }
        }
      } catch {}
    }

    // Optional: basic signal (no network)
    // window.__PROTECTO_DEBUG__ && console.debug('[Protecto][Stub:twq] active, preQ=', pre.length);
  } catch {}
})();