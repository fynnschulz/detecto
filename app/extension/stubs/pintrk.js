// Pinterest Tag Stub – pintrk (pro‑level, stealth, MV3‑friendly)
// Emulates the public API so sites think the SDK is present and loaded.
(function(){
  try {
    if (window.pintrk && window.pintrk.__PROTECTO_STUB__) return; // idempotent

    // ===== Internals =====
    const NATIVE_TO_STRING = Function.prototype.toString;
    const NATIVE_STR = "function () { [native code] }";
    const now = (typeof performance !== 'undefined' && performance.now) ? ()=>performance.now() : ()=>Date.now();

    function toNative(fn){ try{ fn.toString = NATIVE_TO_STRING.bind(function(){ return NATIVE_STR; }); }catch{} return fn; }
    function named(name, fn){ try{ Object.defineProperty(fn, 'name', { value: name, configurable: true }); }catch{} return fn; }

    // Adopt pre-existing queue if a bootstrap shim ran before us
    const preQ = (window.pintrk && Array.isArray(window.pintrk.queue)) ? window.pintrk.queue.slice() : [];

    // Internal state
    const _q = [];               // full entries [{t, a, tagId}]
    const _subs = new Set();     // subscriber callbacks(args...)
    let _tagId = null;           // set via load(tagId)
    let _userId = null;          // identify(userId)
    let _props = {};             // set(key,val)/set(obj)

    // ===== Core invoker (function style) =====
    const invoke = named('pintrk', toNative(function(){
      try {
        const args = Array.prototype.slice.call(arguments);
        if (!args.length) return;
        const cmd = (args[0]||'').toString().toLowerCase();
        const rest = args.slice(1);
        switch (cmd) {
          case 'load':
            // pintrk('load', 'YOUR_TAG_ID', { ...opts })
            if (rest[0]) _tagId = String(rest[0]);
            enqueue(['load'].concat(rest));
            break;
          case 'page':
            // pintrk('page') or ('page', props)
            enqueue(['page'].concat(rest));
            break;
          case 'track':
            // pintrk('track', 'event', props)
            enqueue(['track'].concat(rest));
            break;
          case 'identify':
            // pintrk('identify', userId|{uid:...})
            if (rest && rest[0]) {
              const v = rest[0];
              _userId = (typeof v === 'string') ? v : (v && (v.uid||v.userId||v.id)) || _userId;
            }
            enqueue(['identify'].concat(rest));
            break;
          case 'set':
            // pintrk('set', key, val) or ('set', {k:v})
            if (rest && typeof rest[0] === 'object' && rest[0]) {
              Object.assign(_props, rest[0]);
            } else if (typeof rest[0] === 'string') {
              _props[rest[0]] = rest[1];
            }
            enqueue(['set'].concat(rest));
            break;
          case 'ready':
            // pintrk('ready', cb) → call immediately so host code continues
            try { typeof rest[0] === 'function' && rest[0](); } catch {}
            enqueue(['ready']);
            break;
          case 'consent':
            // some sites call consent updates
            enqueue(['consent'].concat(rest));
            break;
          default:
            enqueue([cmd].concat(rest)); // keep unknown cmds to be safe
        }
      } catch {}
    }));

    function enqueue(args){
      const entry = { t: now(), a: args, tagId: _tagId };
      _q.push(entry);
      for (const s of _subs) { try { s.apply(null, args); } catch{} }
    }

    // ===== Method façade (common wrappers use these) =====
    const pushImpl     = named('push',     toNative(function(){ return invoke.apply(null, arguments); }));
    const loadImpl     = named('load',     toNative(function(){ return invoke.apply(null, ['load'].concat([].slice.call(arguments))); }));
    const pageImpl     = named('page',     toNative(function(){ return invoke.apply(null, ['page'].concat([].slice.call(arguments))); }));
    const trackImpl    = named('track',    toNative(function(){ return invoke.apply(null, ['track'].concat([].slice.call(arguments))); }));
    const identifyImpl = named('identify', toNative(function(){ return invoke.apply(null, ['identify'].concat([].slice.call(arguments))); }));
    const setImpl      = named('set',      toNative(function(){ return invoke.apply(null, ['set'].concat([].slice.call(arguments))); }));
    const readyImpl    = named('ready',    toNative(function(cb){ try{ typeof cb==='function' && cb(); }catch{} return invoke('ready'); }));
    const consentImpl  = named('consent',  toNative(function(){ return invoke.apply(null, ['consent'].concat([].slice.call(arguments))); }));

    const subscribeImpl   = named('subscribe',   toNative(function(cb){ if (typeof cb==='function') _subs.add(cb); }));
    const unsubscribeImpl = named('unsubscribe', toNative(function(cb){ _subs.delete(cb); }));

    // ===== Assemble global function object =====
    const api = invoke; // function

    api.push = pushImpl;
    api.load = loadImpl;
    api.page = pageImpl;
    api.track = trackImpl;
    api.identify = identifyImpl;
    api.set = setImpl;
    api.ready = readyImpl;
    api.consent = consentImpl;
    api.subscribe = subscribeImpl;
    api.unsubscribe = unsubscribeImpl;

    api.__PROTECTO_STUB__ = true;
    api.version = '1.2';
    api.loaded = true;

    Object.defineProperty(api, 'tagId', { get: function(){ return _tagId; } });
    Object.defineProperty(api, 'userId', { get: function(){ return _userId; } });
    Object.defineProperty(api, 'props', { get: function(){ return Object.assign({}, _props); } });
    Object.defineProperty(api, 'q', { get: function(){ return _q.slice(); } });
    Object.defineProperty(api, 'queue', { get: function(){ return _q.map(e=>e.a); } });

    // Spoof native‑like toString for function and methods
    toNative(api); toNative(pushImpl); toNative(loadImpl); toNative(pageImpl);
    toNative(trackImpl); toNative(identifyImpl); toNative(setImpl);
    toNative(readyImpl); toNative(consentImpl); toNative(subscribeImpl); toNative(unsubscribeImpl);

    // Install global pintrk
    window.pintrk = api;

    // Flush any pre‑queued calls captured by a bootstrapper
    if (preQ && preQ.length) {
      try {
        for (let i=0;i<preQ.length;i++) {
          const item = preQ[i];
          if (Array.isArray(item)) {
            try { api.apply(null, item); } catch {}
          }
        }
      } catch {}
    }

    // Optional debug hook (no network side‑effects)
    // if (window.__PROTECTO_DEBUG__) console.debug('[Protecto][Stub:pintrk] active, preQ=', preQ.length);
  } catch {}
})();