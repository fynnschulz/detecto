// Sentry Browser SDK Professional Stub
// Copyright (c) 2024. This is a stub implementation for environments where Sentry is not available.
// This file simulates the global Sentry object and its key methods, including pre-init queueing,
// immutability, debug logging, and preventing multiple loads.
// It is intended for development or build environments where the real Sentry SDK is not present.

(() => {
  if (typeof window === "undefined") return;
  if (window.Sentry && window.Sentry.__STUB__) return;
  if (window.Sentry && !window.Sentry.__STUB__) {
    // Adopt pre-existing Sentry, do not overwrite.
    return;
  }

  // Utility: Debug logger
  const debug = (() => {
    let enabled = false;
    return {
      enable: () => { enabled = true; },
      disable: () => { enabled = false; },
      log: (...args) => { if (enabled) { console.debug("[SentryStub]", ...args); } },
      isEnabled: () => enabled,
    };
  })();

  // Queue for pre-init calls
  const _queue = [];
  let _initCalled = false;
  let _client = null;
  let _lastEventId = null;
  let _scope = {
    user: null,
    tags: Object.create(null),
    extras: Object.create(null),
    context: Object.create(null),
  };

  // Simple clone helper (no freezing)
  function clone(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return obj;
    }
  }

  // Minimal DSN client stub
  class StubClient {
    constructor(options) {
      this.options = clone(options || {});
      this._dsn = options && options.dsn ? options.dsn : null;
      debug.log("StubClient created with options:", this.options);
    }
    captureException(exception, scope) {
      const eventId = _generateEventId();
      debug.log("captureException:", exception, scope);
      _lastEventId = eventId;
      return eventId;
    }
    captureMessage(message, level, scope) {
      const eventId = _generateEventId();
      debug.log("captureMessage:", message, level, scope);
      _lastEventId = eventId;
      return eventId;
    }
    captureEvent(event, scope) {
      const eventId = _generateEventId();
      debug.log("captureEvent:", event, scope);
      _lastEventId = eventId;
      return eventId;
    }
    flush(timeout) {
      debug.log("flush called with timeout:", timeout);
      return Promise.resolve(true);
    }
    close(timeout) {
      debug.log("close called with timeout:", timeout);
      return Promise.resolve(true);
    }
  }

  // Event ID generator
  function _generateEventId() {
    // RFC4122 version 4 UUID, simplified for stub
    return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      var r = (Math.random() * 16) | 0,
        v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Scope management
  function withScope(callback) {
    debug.log("withScope called");
    const previousScope = clone(_scope);
    const tempScope = clone(_scope);
    try {
      callback({
        setUser: user => { tempScope.user = clone(user); },
        setTag: (key, value) => { tempScope.tags[key] = value; },
        setExtra: (key, value) => { tempScope.extras[key] = value; },
        setContext: (key, ctx) => { tempScope.context[key] = clone(ctx); },
      });
    } catch (e) {
      debug.log("Error in withScope callback:", e);
    }
    // Restore previous scope (stub does not persist tempScope)
    _scope = previousScope;
  }

  function configureScope(callback) {
    debug.log("configureScope called");
    callback({
      setUser: user => { _scope.user = clone(user); },
      setTag: (key, value) => { _scope.tags[key] = value; },
      setExtra: (key, value) => { _scope.extras[key] = value; },
      setContext: (key, ctx) => { _scope.context[key] = clone(ctx); },
    });
  }

  function setUser(user) {
    debug.log("setUser:", user);
    _scope.user = clone(user);
  }
  function setTag(key, value) {
    debug.log("setTag:", key, value);
    _scope.tags[key] = value;
  }
  function setExtra(key, value) {
    debug.log("setExtra:", key, value);
    _scope.extras[key] = value;
  }
  function setContext(key, ctx) {
    debug.log("setContext:", key, ctx);
    _scope.context[key] = clone(ctx);
  }

  // Pre-init queueing wrapper
  function queueOrCall(fn) {
    return function(...args) {
      if (!_initCalled) {
        debug.log("Queuing call:", fn.name, args);
        _queue.push({ fn, args });
        return;
      }
      return fn(...args);
    };
  }

  // Sentry global object
  const Sentry = {
    __STUB__: true,
    init: function(options) {
      if (_initCalled) {
        debug.log("Sentry.init called multiple times; ignoring.");
        return;
      }
      debug.log("Sentry.init called with options:", options);
      _client = new StubClient(options || {});
      _initCalled = true;
      // Drain queue
      while (_queue.length) {
        const { fn, args } = _queue.shift();
        try { fn(...args); } catch (e) { debug.log("Error draining queue:", e); }
      }
    },
    captureException: queueOrCall(function(exception, captureContext) {
      return _client.captureException(exception, captureContext || _scope);
    }),
    captureMessage: queueOrCall(function(message, level, captureContext) {
      return _client.captureMessage(message, level, captureContext || _scope);
    }),
    captureEvent: queueOrCall(function(event, captureContext) {
      return _client.captureEvent(event, captureContext || _scope);
    }),
    withScope: queueOrCall(withScope),
    configureScope: queueOrCall(configureScope),
    setUser: queueOrCall(setUser),
    setTag: queueOrCall(setTag),
    setExtra: queueOrCall(setExtra),
    setContext: queueOrCall(setContext),
    flush: queueOrCall(function(timeout) {
      return _client.flush(timeout);
    }),
    close: queueOrCall(function(timeout) {
      return _client.close(timeout);
    }),
    lastEventId: function() {
      debug.log("lastEventId called:", _lastEventId);
      return _lastEventId;
    },
    // Debug utilities
    __debug__: debug,
    // Get current scope (non-frozen)
    getScope: function() {
      return clone(_scope);
    },
    // Prevent multiple loads
    __preventMultipleLoads: true,
  };

  // Attach to window as a normal writable property
  window.Sentry = Sentry;
})();