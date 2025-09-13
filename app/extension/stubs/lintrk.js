// LinkedIn Insight Tag Professional Stub – lintrk
// (c) 2024 Protecto. Professional-level, stealthy, robust stub for LinkedIn Insight Tag API.
// Simulates full API surface, queueing, partner id logic, and internal state.
(function() {
  // Double-load protection: idempotent
  if (window.lintrk && window.lintrk.__PROTECTO_STUB__) return;

  // --- Native code spoofing helpers ---
  const NATIVE_FN = Function.prototype.toString;
  const NATIVE_STR = "function () { [native code] }";
  function spoofNative(fn) {
    try {
      Object.defineProperty(fn, "toString", {
        value: function() { return NATIVE_STR; },
        writable: false, configurable: true, enumerable: false
      });
    } catch {}
    return fn;
  }

  // --- Internal state ---
  const _VERSION = "2.0.0-pro-stub";
  const _calls = [];
  const _subscribers = {};
  let _ready = false;
  let _flushed = false;
  let _partnerIds = window._linkedin_data_partner_ids || [];
  let _identity = null;
  let _settings = {};
  let _pageMeta = {};
  let _queue = [];
  let _flushTimeout = null;
  let _lastFlush = 0;
  const _flushDelay = 0; // synchronous flush

  // --- Queue management ---
  function enqueue(call) {
    _queue.push(call);
    _calls.push(call);
    if (_flushDelay === 0) flush();
    else if (!_flushTimeout) {
      _flushTimeout = setTimeout(flush, _flushDelay);
    }
  }
  function flush() {
    _flushed = true;
    _lastFlush = Date.now();
    while (_queue.length) {
      const call = _queue.shift();
      // No-op: in real implementation would send to LinkedIn endpoint
      notifySubscribers(call);
    }
    _flushTimeout = null;
  }
  function notifySubscribers(call) {
    Object.keys(_subscribers).forEach(function(key) {
      try { _subscribers[key](call); } catch(e){}
    });
  }

  // --- Partner IDs array spoof ---
  function ensurePartnerIds() {
    if (!Array.isArray(window._linkedin_data_partner_ids)) {
      try {
        Object.defineProperty(window, "_linkedin_data_partner_ids", {
          value: _partnerIds,
          writable: true, configurable: true, enumerable: false
        });
      } catch {
        window._linkedin_data_partner_ids = _partnerIds;
      }
    }
  }
  ensurePartnerIds();
  // Safe mutation helpers
  function addPartnerId(id) {
    if (_partnerIds.indexOf(id) === -1) _partnerIds.push(id);
    ensurePartnerIds();
  }
  function removePartnerId(id) {
    const idx = _partnerIds.indexOf(id);
    if (idx > -1) _partnerIds.splice(idx, 1);
    ensurePartnerIds();
  }
  function getPartnerIds() {
    return _partnerIds.slice();
  }

  // --- Main API: lintrk(action, eventId, payload) ---
  function lintrk(action, eventId, payload) {
    // Defensive: support legacy signature lintrk(eventId, payload)
    let a = action, e = eventId, p = payload;
    if (typeof eventId === "object" && payload === undefined) {
      // lintrk(eventId, payload)
      p = eventId;
      e = action;
      a = "track";
    }
    enqueue([a, e, p]);
    return true;
  }

  // --- API helpers ---
  lintrk.init = function(config) {
    _settings = Object.assign({}, _settings, config);
    enqueue(["init", null, config]);
    if (config && config.partnerId) addPartnerId(config.partnerId);
    return true;
  };

  lintrk.track = function(eventId, payload) {
    enqueue(["track", eventId, payload]);
    return true;
  };

  lintrk.set = function(key, value) {
    _settings[key] = value;
    enqueue(["set", key, value]);
    return true;
  };

  lintrk.identify = function(identity) {
    _identity = Object.assign({}, identity);
    enqueue(["identify", null, identity]);
    return true;
  };

  lintrk.page = function(meta) {
    _pageMeta = Object.assign({}, meta);
    enqueue(["page", null, meta]);
    return true;
  };

  lintrk.ready = function(cb) {
    _ready = true;
    if (typeof cb === "function") {
      try { cb(); } catch {}
    }
    enqueue(["ready", null, null]);
    return true;
  };

  lintrk.subscribe = function(key, fn) {
    if (typeof key === "function") {
      // lintrk.subscribe(fn)
      fn = key;
      key = String(Math.random());
    }
    if (typeof fn === "function") _subscribers[key] = fn;
    return key;
  };

  lintrk.unsubscribe = function(key) {
    delete _subscribers[key];
    return true;
  };

  lintrk.push = function() {
    // Legacy push API (array of args)
    var args = Array.prototype.slice.call(arguments);
    enqueue(["push", null, args]);
    return true;
  };

  // --- Spoofed properties, getters, and constants ---
  Object.defineProperties(lintrk, {
    "version": {
      get: function() { return _VERSION; },
      enumerable: false, configurable: false
    },
    "partnerIds": {
      get: getPartnerIds,
      enumerable: false, configurable: false
    },
    "calls": {
      get: function() { return _calls.slice(); },
      enumerable: false, configurable: false
    },
    "settings": {
      get: function() { return Object.assign({}, _settings); },
      enumerable: false, configurable: false
    },
    "identity": {
      get: function() { return _identity ? Object.assign({}, _identity) : null; },
      enumerable: false, configurable: false
    },
    "pageMeta": {
      get: function() { return Object.assign({}, _pageMeta); },
      enumerable: false, configurable: false
    },
    "readyState": {
      get: function() { return _ready; },
      enumerable: false, configurable: false
    },
    "flushed": {
      get: function() { return _flushed; },
      enumerable: false, configurable: false
    },
    "lastFlush": {
      get: function() { return _lastFlush; },
      enumerable: false, configurable: false
    }
  });

  // --- Partner ID helpers (hidden) ---
  Object.defineProperties(lintrk, {
    "_addPartnerId": { value: addPartnerId, enumerable: false },
    "_removePartnerId": { value: removePartnerId, enumerable: false }
  });

  // --- Queue & state exposure (read-only) ---
  lintrk.queue = _queue;
  lintrk.__PROTECTO_STUB__ = true;

  // --- Native code spoofing ---
  spoofNative(lintrk);
  [
    lintrk.init, lintrk.track, lintrk.set, lintrk.identify, lintrk.page,
    lintrk.ready, lintrk.subscribe, lintrk.unsubscribe, lintrk.push
  ].forEach(spoofNative);

  // --- Install global ---
  window.lintrk = lintrk;

  // --- LinkedIn partner IDs global spoof ---
  window._linkedin_data_partner_ids = _partnerIds;

  // --- End of stub ---
})();