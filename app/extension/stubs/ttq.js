// TikTok Pixel Robust Stub – ttq
// Expanded, stealthy, and feature-complete stub for analytics-safe environments.
(function ttqStub() {
  // Prevent double-stub
  if (window.ttq && window.ttq.__PROTECTO_STUB__) return;

  // --- Native function spoofing helpers ---
  const NATIVE_FN_STR = "function () { [native code] }";
  const NATIVE_CALL = Function.prototype.toString;
  function toNative(fn) {
    try {
      Object.defineProperty(fn, "toString", {
        configurable: true,
        enumerable: false,
        writable: false,
        value: function() { return NATIVE_FN_STR; }
      });
    } catch (e) {}
    return fn;
  }


  // --- Internal state ---
  const _queue = [];
  const _subs = new Set();
  let _flushed = false;
  let _instanceId = "ttq_stub_" + Math.random().toString(36).slice(2,10);
  const _version = "stub-1.0.0";
  const _createdAt = Date.now();
  let _pixelId = null;
  let _userId = null;
  let _props = {};

  // --- Pre-queue flush logic ---
  // If pre-existing queue, flush to new stub
  if (window.ttq && Array.isArray(window.ttq.q)) {
    window.ttq.q.forEach(function(args) {
      _queue.push(args);
    });
    _flushed = true;
  }

  // --- Core dispatcher ---
  function ttq() {
    const args = Array.prototype.slice.call(arguments);
    _queue.push(args);
    // Event bus for subscribers
    for (const cb of _subs) {
      try { cb.apply(null, args); } catch(e){}
    }
    // Native-like return value
    return undefined;
  }

  // --- API Methods ---
  // .init(pixelId, opts)
  function init(pixelId, opts) {
    _pixelId = pixelId;
    if (opts && typeof opts === "object") {
      _props = Object.assign({}, _props, opts);
    }
    _queue.push(["init", pixelId, opts]);
    return undefined;
  }

  // .track(event, props)
  function track(event, props) {
    _queue.push(["track", event, props]);
    return undefined;
  }

  // .identify(userId, traits)
  function identify(userId, traits) {
    _userId = userId;
    if (traits && typeof traits === "object") {
      _props = Object.assign({}, _props, traits);
    }
    _queue.push(["identify", userId, traits]);
    return undefined;
  }

  // .set(props)
  function set(props) {
    if (props && typeof props === "object") {
      _props = Object.assign({}, _props, props);
    }
    _queue.push(["set", props]);
    return undefined;
  }

  // .page(name, props)
  function page(name, props) {
    _queue.push(["page", name, props]);
    return undefined;
  }

  // .ready(callback)
  function ready(cb) {
    if (typeof cb === "function") {
      try { cb(); } catch(e){}
    }
    return undefined;
  }

  // .instance() returns the stub itself
  function instance() {
    return ttq;
  }

  // .subscribe(cb)
  function subscribe(cb) {
    if (typeof cb === "function") _subs.add(cb);
    return undefined;
  }

  // .unsubscribe(cb)
  function unsubscribe(cb) {
    _subs.delete(cb);
    return undefined;
  }

  // --- Properties for version, timestamp, ids, queue (writable, extensible) ---
  Object.defineProperties(ttq, {
    version: { value: _version, writable: true, enumerable: true, configurable: true },
    createdAt: { value: _createdAt, writable: true, enumerable: true, configurable: true },
    pixelId: { 
      get: function() { return _pixelId; }, 
      enumerable: true, configurable: true 
    },
    userId: { 
      get: function() { return _userId; }, 
      enumerable: true, configurable: true 
    },
    props: { 
      get: function() { return Object.assign({}, _props); }, 
      enumerable: true, configurable: true 
    },
    queue: { 
      get: function() { return _queue.slice(); }, 
      enumerable: true, configurable: true 
    },
    length: { 
      get: function() { return _queue.length; }, 
      enumerable: true, configurable: true 
    }
  });

  // --- API surface ---
  ttq.init = toNative(init);
  ttq.track = toNative(track);
  ttq.identify = toNative(identify);
  ttq.set = toNative(set);
  ttq.page = toNative(page);
  ttq.ready = toNative(ready);
  ttq.instance = toNative(instance);
  ttq.subscribe = toNative(subscribe);
  ttq.unsubscribe = toNative(unsubscribe);
  ttq.push = function() {
    // Allow ttq.push(args...) for compatibility
    return ttq.apply(null, arguments);
  };

  // --- Internal flags ---
  ttq._loaded = true;
  ttq._flushed = _flushed;
  ttq._events = _queue;
  ttq._subs = _subs;
  ttq._instanceId = _instanceId;
  ttq.__PROTECTO_STUB__ = true;

  // --- Spoof native-like toString for stealth ---
  toNative(ttq);
  // Also spoof for all methods
  [
    "init","track","identify","set","page",
    "ready","instance","subscribe","unsubscribe","push"
  ].forEach(function(k){ toNative(ttq[k]); });


  // --- Expose as window.ttq (soft, extensible, writable) ---
  window.ttq = ttq;

  // --- Optionally, flush any pre-stub queue (ttq.q) ---
  if (Array.isArray(window.ttq.q)) {
    window.ttq.q.forEach(function(args) {
      try { ttq.apply(null, args); } catch(e){}
    });
    window.ttq.q.length = 0;
  }

  // --- Add spoofed toString for window.ttq ---
  try {
    Object.defineProperty(window.ttq, "toString", {
      configurable: true,
      enumerable: false,
      writable: false,
      value: function() { return NATIVE_FN_STR; }
    });
  } catch(e){}

  // --- End of TikTok Pixel Robust Stub ---
})();