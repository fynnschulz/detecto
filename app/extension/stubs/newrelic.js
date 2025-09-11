

/**
 * New Relic Browser Stub
 * Simulates the New Relic Browser Agent for local/dev/test environments.
 * Provides API surface and queuing for pre-init events.
 * (c) 2024 Simulated New Relic Browser Agent
 */

/* global window, self */
(function(root) {
  'use strict';

  // Prevent multiple loads
  if (root.NREUM && root.NREUM.__stubLoaded) {
    if (root.NREUM.__debugStub) {
      root.console && root.console.warn && root.console.warn('[NREUM] Stub already loaded');
    }
    return;
  }

  // Adopt pre-existing NREUM, or create it
  var NREUM = root.NREUM = root.NREUM || {};

  // Debug flag (set NREUM.__debugStub = true to enable)
  var DEBUG = !!NREUM.__debugStub;

  // Internal event queue for buffering calls before "init"
  var _queue = NREUM.oQueue = NREUM.oQueue || [];
  var _buffering = true;

  // Deep freeze utility
  function deepFreeze(obj) {
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach(function(prop) {
      if (
        obj[prop] !== null &&
        (typeof obj[prop] === 'object' || typeof obj[prop] === 'function') &&
        !Object.isFrozen(obj[prop])
      ) {
        deepFreeze(obj[prop]);
      }
    });
    return obj;
  }

  // Logging
  function log() {
    if (DEBUG) {
      try {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[NREUM stub]');
        root.console && root.console.log && root.console.log.apply(root.console, args);
      } catch (e) {}
    }
  }

  // Internal: push to queue
  function queueEvent(api, args) {
    log('Queueing:', api, args);
    _queue.push({ api: api, args: args, ts: Date.now() });
  }

  // Internal: flush queue (simulate "agent ready")
  function flushQueue() {
    if (!_buffering) return;
    _buffering = false;
    log('Flushing', _queue.length, 'queued events');
    while (_queue.length) {
      var evt = _queue.shift();
      log('Flushed event:', evt.api, evt.args);
      // No-op: In real agent, would process event
    }
  }

  // API methods
  function setPageViewName(name, host) {
    if (_buffering) return queueEvent('setPageViewName', arguments);
    log('setPageViewName:', name, host);
  }
  function addPageAction(name, attributes) {
    if (_buffering) return queueEvent('addPageAction', arguments);
    log('addPageAction:', name, attributes);
  }
  function noticeError(error, customAttributes) {
    if (_buffering) return queueEvent('noticeError', arguments);
    log('noticeError:', error, customAttributes);
  }
  function interact() {
    if (_buffering) return queueEvent('interact', arguments);
    log('interact:', arguments);
    return Math.random().toString(36).substring(2, 12); // Simulate interaction id
  }
  function setCustomAttribute(name, value) {
    if (_buffering) return queueEvent('setCustomAttribute', arguments);
    log('setCustomAttribute:', name, value);
  }
  function setUserId(id) {
    if (_buffering) return queueEvent('setUserId', arguments);
    log('setUserId:', id);
  }
  function finished() {
    if (_buffering) return queueEvent('finished', arguments);
    log('finished');
  }
  function setCurrentRouteName(name) {
    if (_buffering) return queueEvent('setCurrentRouteName', arguments);
    log('setCurrentRouteName:', name);
  }
  function addRelease(name, id) {
    if (_buffering) return queueEvent('addRelease', arguments);
    log('addRelease:', name, id);
  }
  function noticeNetworkRequest(url, options) {
    if (_buffering) return queueEvent('noticeNetworkRequest', arguments);
    log('noticeNetworkRequest:', url, options);
  }
  // Simulate finished loading after a tick (or call NREUM.init() to flush)
  function init() {
    flushQueue();
    log('NREUM stub initialized');
  }

  // Expose API methods (immutable)
  var api = {
    setPageViewName: setPageViewName,
    addPageAction: addPageAction,
    noticeError: noticeError,
    interact: interact,
    setCustomAttribute: setCustomAttribute,
    setUserId: setUserId,
    finished: finished,
    setCurrentRouteName: setCurrentRouteName,
    addRelease: addRelease,
    noticeNetworkRequest: noticeNetworkRequest,
    init: init,
    // For compatibility
    version: 'stub-1.0.0',
    __stub: true
  };
  deepFreeze(api);

  // Merge API onto NREUM object, immutably
  Object.keys(api).forEach(function(k) {
    if (!Object.prototype.hasOwnProperty.call(NREUM, k)) {
      Object.defineProperty(NREUM, k, {
        configurable: false,
        enumerable: true,
        writable: false,
        value: api[k]
      });
    }
  });

  // Mark stub loaded
  Object.defineProperty(NREUM, '__stubLoaded', {
    value: true,
    writable: false,
    configurable: false,
    enumerable: false
  });

  // Prevent mutation of NREUM
  deepFreeze(NREUM);

  // Compatibility: expose NREUM globally
  if (typeof window !== 'undefined') window.NREUM = NREUM;
  if (typeof self !== 'undefined') self.NREUM = NREUM;

  // Compatibility: simulate loader (for integrations)
  if (!NREUM.loader_config) {
    NREUM.loader_config = deepFreeze({
      licenseKey: 'STUB-KEY',
      applicationID: 'STUB-APP'
    });
  }
  if (!NREUM.info) {
    NREUM.info = deepFreeze({
      beacon: '',
      errorBeacon: '',
      licenseKey: 'STUB-KEY',
      applicationID: 'STUB-APP',
      sa: 1
    });
  }

  // Simulate agent ready after a short delay (or call NREUM.init())
  setTimeout(function() {
    if (_buffering) {
      log('Auto-initializing NREUM stub after delay');
      flushQueue();
    }
  }, 100);

  log('NREUM stub loaded');

})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));