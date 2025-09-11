

/**
 * Datadog RUM Stub (datadogRum)
 * Professional stub for Datadog RUM Browser SDK.
 * Covers: queueing, all major API methods, deep freeze, debug, ready-callbacks, toString, context, and more.
 */

;(function(global) {
  'use strict';

  var STUB_VERSION = 'STUB_v1.0.0';
  var QUEUE_LIMIT = 100;
  var DEBUG = !!global.__PROTECTO_DEBUG__;
  var RUM_GLOBAL_CONTEXT = {};
  var USER_CONTEXT = {};
  var READY_CALLBACKS = [];
  var INITIALIZED = false;
  var QUEUE = [];
  var RUM_VERSION = STUB_VERSION;
  var REPLAY_RECORDING = false;
  var CURRENT_VIEW = null;
  var CURRENT_ACTION = null;

  function noop() {}

  function logDebug() {
    if (DEBUG && typeof console !== 'undefined' && console.log) {
      console.log.apply(console, ['[datadogRum STUB]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function deepFreeze(obj) {
    if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
      Object.freeze(obj);
      Object.getOwnPropertyNames(obj).forEach(function(prop) {
        if (obj[prop] && typeof obj[prop] === 'object') {
          deepFreeze(obj[prop]);
        }
      });
    }
    return obj;
  }

  function enqueueCall(method, args) {
    if (QUEUE.length >= QUEUE_LIMIT) {
      if (DEBUG) logDebug('Queue limit reached, dropping call:', method, args);
      return;
    }
    QUEUE.push({ method: method, arguments: Array.prototype.slice.call(args) });
    if (DEBUG) logDebug('Enqueued:', method, args);
  }

  function processQueue(target) {
    for (var i = 0; i < QUEUE.length; ++i) {
      var q = QUEUE[i];
      if (typeof target[q.method] === 'function') {
        try {
          target[q.method].apply(target, q.arguments);
        } catch (e) {
          if (DEBUG) logDebug('Error processing queued method:', q.method, e);
        }
      } else if (DEBUG) {
        logDebug('Unknown method in queue:', q.method);
      }
    }
    QUEUE.length = 0;
  }

  function runReadyCallbacks() {
    var cbs = READY_CALLBACKS.slice();
    READY_CALLBACKS.length = 0;
    Promise.resolve().then(function() {
      cbs.forEach(function(cb) {
        try { cb(); } catch (e) { if (DEBUG) logDebug('onReady callback error', e); }
      });
    });
  }

  // API Methods
  function init(config) {
    if (INITIALIZED) {
      if (DEBUG) logDebug('Already initialized');
      return;
    }
    INITIALIZED = true;
    if (DEBUG) logDebug('Init called with', config);
    processQueue(datadogRum);
    runReadyCallbacks();
  }

  function startSessionReplayRecording() {
    REPLAY_RECORDING = true;
    if (DEBUG) logDebug('Session replay recording started');
  }

  function stopSessionReplayRecording() {
    REPLAY_RECORDING = false;
    if (DEBUG) logDebug('Session replay recording stopped');
  }

  function addAction(name, context) {
    if (DEBUG) logDebug('addAction', name, context);
  }

  function addError(error, context) {
    if (DEBUG) logDebug('addError', error, context);
  }

  function addTiming(name) {
    if (DEBUG) logDebug('addTiming', name);
  }

  function setUser(user) {
    USER_CONTEXT = user ? JSON.parse(JSON.stringify(user)) : {};
    if (DEBUG) logDebug('setUser', user);
  }

  function clearUser() {
    USER_CONTEXT = {};
    if (DEBUG) logDebug('clearUser');
  }

  function getRumGlobalContext() {
    return JSON.parse(JSON.stringify(RUM_GLOBAL_CONTEXT));
  }

  function setRumGlobalContext(ctx) {
    RUM_GLOBAL_CONTEXT = ctx ? JSON.parse(JSON.stringify(ctx)) : {};
    if (DEBUG) logDebug('setRumGlobalContext', ctx);
  }

  function addRumGlobalContext(key, value) {
    RUM_GLOBAL_CONTEXT[key] = value;
    if (DEBUG) logDebug('addRumGlobalContext', key, value);
  }

  function startView(name, context) {
    CURRENT_VIEW = { name: name, context: context };
    if (DEBUG) logDebug('startView', name, context);
  }

  function stopView() {
    if (DEBUG) logDebug('stopView', CURRENT_VIEW);
    CURRENT_VIEW = null;
  }

  function startAction(name, context) {
    CURRENT_ACTION = { name: name, context: context };
    if (DEBUG) logDebug('startAction', name, context);
  }

  function stopAction() {
    if (DEBUG) logDebug('stopAction', CURRENT_ACTION);
    CURRENT_ACTION = null;
  }

  function onReady(cb) {
    if (typeof cb !== 'function') return;
    if (INITIALIZED) {
      Promise.resolve().then(cb);
    } else {
      READY_CALLBACKS.push(cb);
    }
  }

  // Fallback for unknown methods
  function unknownMethod(name) {
    return function() {
      if (DEBUG) logDebug('Unknown datadogRum method called:', name, arguments);
    };
  }

  // Main stub: queueing wrapper
  function makeStub() {
    var api = function() {
      if (!INITIALIZED) return enqueueCall('default', arguments);
      if (DEBUG) logDebug('datadogRum called as function', arguments);
    };
    api.toString = function() { return 'function datadogRum() { [native code stub] }'; };
    // Attach API methods
    var methods = {
      init: init,
      startSessionReplayRecording: startSessionReplayRecording,
      stopSessionReplayRecording: stopSessionReplayRecording,
      addAction: addAction,
      addError: addError,
      addTiming: addTiming,
      setUser: setUser,
      clearUser: clearUser,
      getRumGlobalContext: getRumGlobalContext,
      setRumGlobalContext: setRumGlobalContext,
      addRumGlobalContext: addRumGlobalContext,
      startView: startView,
      stopView: stopView,
      startAction: startAction,
      stopAction: stopAction,
      onReady: onReady
    };
    Object.keys(methods).forEach(function(k) {
      var fn = function() {
        if (!INITIALIZED && k !== 'init' && k !== 'onReady') return enqueueCall(k, arguments);
        return methods[k].apply(api, arguments);
      };
      fn.toString = function() { return 'function ' + k + '() { [native code stub] }'; };
      Object.defineProperty(api, k, {
        value: fn,
        writable: false,
        configurable: false,
        enumerable: true
      });
    });
    // Fallback for unknown methods
    api.__STUB_VERSION = RUM_VERSION;
    Object.defineProperty(api, 'toString', {
      value: api.toString,
      writable: false,
      configurable: false,
      enumerable: false
    });
    // Defensive: catch all unknown properties
    return new Proxy(api, {
      get: function(target, prop, receiver) {
        if (prop in target) return target[prop];
        if (prop === 'STUB_VERSION') return RUM_VERSION;
        if (typeof prop === 'string') {
          return unknownMethod(prop);
        }
        return undefined;
      },
      set: function() {
        if (DEBUG) logDebug('Attempt to overwrite datadogRum property denied');
        return false;
      },
      defineProperty: function() { return false; },
      deleteProperty: function() { return false; }
    });
  }

  var datadogRum = makeStub();
  deepFreeze(datadogRum);

  // Attach to global
  Object.defineProperty(global, 'datadogRum', {
    value: datadogRum,
    writable: false,
    configurable: false,
    enumerable: true
  });

  // For debugging
  if (DEBUG) logDebug('datadogRum stub loaded', RUM_VERSION);

})(typeof window !== 'undefined' ? window : this);
