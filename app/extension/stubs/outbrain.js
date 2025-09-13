/* eslint-disable no-var, no-undef */
/**
 * Protecto Outbrain Stub (outbrain.js)
 * Goal: Emulate enough of Outbrain's widget + pixel surface so sites "think"
 * the library loaded and behave normally — while no real tracking/network
 * happens. 200 OK is served via MV3 redirect to this stub.
 *
 * References:
 * - JS Widget guides & behavior (container scan, async load). See Outbrain dev docs. 
 * - OBREvents external callbacks API (widgetDataReturned etc.).
 * - obApi pixel examples (PAGE_VIEW / CONVERSION events).
 *
 * Stealth design:
 * - Idempotent (loads once), no external requests, synchronous API presence.
 * - Native-like toString on functions, read-only public surface, deep-freeze.
 * - Pre-queue takeover for window.OBREvents and window._obApiQ if present.
 * - Minimal but realistic timing (microtask) to avoid races.
 */

/* ---------- utilities ---------- */
(function () {
  'use strict';

  if (window.__PROTECTO_OUTBRAIN_STUB__) return;
  Object.defineProperty(window, '__PROTECTO_OUTBRAIN_STUB__', {
    value: true, configurable: false, enumerable: false, writable: false
  });

  var __DEBUG__ = !!window.__PROTECTO_DEBUG__;
  function dlog() { try { if (__DEBUG__) console.debug.apply(console, ['[Protecto][Outbrain]'].concat([].slice.call(arguments))); } catch (_) {} }

  function nativeToString(name) {
    return 'function ' + name + '() { [native code] }';
  }

  function cloneJSON(x) {
    try { return x == null ? x : JSON.parse(JSON.stringify(x)); } catch (_) { return x; }
  }

  function nextTick(fn) { try { Promise.resolve().then(fn); } catch (_) { setTimeout(fn, 0); } }

  /* ---------- OBREvents facade (external callbacks) ---------- */
  // Official docs mention a global OBREvents array of {event, widgetId, func}
  // We implement a small event bus and process any pre-pushed entries.
  var EventBus = (function () {
    var handlers = {}; // eventName -> [{idFilter:Array|undefined, fn}]
    function on(event, widgetIdOrFn, maybeFn) {
      var fn = typeof widgetIdOrFn === 'function' ? widgetIdOrFn : maybeFn;
      var ids = typeof widgetIdOrFn === 'function' ? undefined : widgetIdOrFn;
      if (!fn) return;
      (handlers[event] = handlers[event] || []).push({ ids: ids, fn: fn });
    }
    function off(event, fn) {
      if (!handlers[event]) return;
      if (!fn) { handlers[event] = []; return; }
      handlers[event] = handlers[event].filter(function (h) { return h.fn !== fn; });
    }
    function emit(event, payload) {
      var list = handlers[event] || [];
      list.forEach(function (h) {
        try {
          if (!h.ids) return h.fn(payload);
          var w = payload && payload.widgetId;
          var ids = Array.isArray(h.ids) ? h.ids : [h.ids];
          if (w && ids.indexOf(w) !== -1) h.fn(payload);
        } catch (e) { /* swallow */ }
      });
    }
    return { on: on, off: off, emit: emit, _handlers: handlers };
  })();

  // Take over pre-queued OBREvents items if the site pushed before script load.
  // Spec sample:
  //   window.OBREvents = window.OBREvents || [];
  //   OBREvents.push({ event:'widgetDataReturned', widgetId:['AR_1'], func: cb })
  var pre = window.OBREvents;
  var OBREventsFacade = [];
  window.OBREvents = OBREventsFacade;
  OBREventsFacade.push = function push(item) {
    try {
      if (!item || typeof item !== 'object') return 0;
      var ev = String(item.event || '').trim();
      var ids = item.widgetId;
      var fn = item.func;
      if (ev && typeof fn === 'function') EventBus.on(ev, ids, fn);
      dlog('OBREvents.push', ev, ids);
    } catch (_) {}
    return EventBus._handlers ? (EventBus._handlers.length || 1) : 1;
  };
  OBREventsFacade.push.toString = function () { return nativeToString('push'); };

  if (Array.isArray(pre) && pre.length) {
    pre.slice().forEach(function (x) { try { OBREventsFacade.push(x); } catch (_) {} });
  }

  /* ---------- Widget facade (window.OBR) ---------- */
  // Outbrain's script scans DOM for containers and renders recommendations.
  // We emulate presence & lifecycle without network calls.
  var OBR = {};
  var _state = {
    initialized: true,
    widgets: {},          // id -> meta
    containersMarked: false
  };

  function markContainers() {
    // emulate DOM scan for [data-widget-type] containers (simplified)
    try {
      var nodes = document.querySelectorAll('[data-ob-widget], [data-widget-type], .OUTBRAIN');
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var wid = n.getAttribute('data-ob-widget') || n.getAttribute('id') || ('OB_' + (i + 1));
        _state.widgets[wid] = _state.widgets[wid] || { id: wid, node: n, rendered: false };
      }
      _state.containersMarked = true;
      dlog('containers marked', Object.keys(_state.widgets).length);
    } catch (_) {}
  }

  function fakeRender(w) {
    // Instead of network, we insert a tiny shadow element to emulate a card list.
    try {
      if (!w || !w.node || w.rendered) return;
      var holder = document.createElement('div');
      holder.setAttribute('data-ob-rendered', 'true');
      holder.style.cssText = 'min-height:24px;opacity:.001;pointer-events:none;';
      holder.innerHTML = '<!-- Outbrain stubbed -->';
      w.node.appendChild(holder);
      w.rendered = true;
      EventBus.emit('widgetDataReturned', { widgetId: w.id, items: [], status: 'ok' });
    } catch (_) {}
  }

  function refresh(ids) {
    try {
      if (!_state.containersMarked) markContainers();
      var keys = ids ? (Array.isArray(ids) ? ids : [ids]) : Object.keys(_state.widgets);
      keys.forEach(function (k) { fakeRender(_state.widgets[k]); });
      dlog('refresh', keys);
    } catch (_) {}
  }

  function getState() {
    return cloneJSON({
      initialized: _state.initialized,
      widgets: Object.keys(_state.widgets),
      containersMarked: _state.containersMarked
    });
  }

  // public OBR surface (subset)
  OBR.refresh = refresh;
  OBR.markContainers = markContainers;
  OBR.getState = getState;
  OBR.on = EventBus.on;
  OBR.off = EventBus.off;
  OBR.toString = function () { return '[object OBR]'; };
  // Native-like method strings
  OBR.refresh.toString = function () { return nativeToString('refresh'); };
  OBR.markContainers.toString = function () { return nativeToString('markContainers'); };
  OBR.getState.toString = function () { return nativeToString('getState'); };
  OBR.on.toString = function () { return nativeToString('on'); };
  OBR.off.toString = function () { return nativeToString('off'); };

  // Attach globally (read-only)
  window.OBR = OBR;

  // Perform an initial async pass similar to the real script
  nextTick(function () {
    markContainers();
    refresh();
  });

  /* ---------- Pixel facade (window.obApi) ---------- */
  // Some sites install Outbrain pixel and call obApi('track', 'PAGE_VIEW') etc.
  // We emulate a very small API to avoid runtime errors and to provide believable state.
  var _obState = {
    q: [],                  // queued calls (bounded)
    bounded: 200,
    consent: null,
    user: {},
    version: 'stub-1.0.0'
  };

  function obApi() {
    var args = Array.prototype.slice.call(arguments);
    try {
      var cmd = (args[0] || '').toString().toLowerCase();
      var ev = (args[1] || '').toString().toUpperCase();
      var payload = cloneJSON(args[2]);

      switch (cmd) {
        case 'init':
          _obState.user = payload && typeof payload === 'object' ? payload : (_obState.user || {});
          dlog('obApi init', _obState.user);
          break;
        case 'track':
        case 'event':
          // Accept PAGE_VIEW / CONVERSION / CUSTOM
          _obState.q.push({ t: Date.now(), ev: ev || 'PAGE_VIEW', data: payload || {} });
          if (_obState.q.length > _obState.bounded) _obState.q.shift();
          dlog('obApi track', ev, payload);
          break;
        case 'consent':
          _obState.consent = payload || 'unknown';
          dlog('obApi consent', _obState.consent);
          break;
        case 'set':
          if (payload && typeof payload === 'object') {
            Object.keys(payload).forEach(function (k) { _obState.user[k] = payload[k]; });
          }
          dlog('obApi set', _obState.user);
          break;
        default:
          dlog('obApi noop', cmd, ev);
      }
    } catch (_) {}
    return obApi;
  }
  obApi.toString = function () { return nativeToString('obApi'); };
  obApi.version = _obState.version;
  obApi.queue = _obState.q;

  // Pre-queue takeover if page declared window._obApiQ or obApi before load
  var pq = window._obApiQ;
  window.obApi = obApi;
  if (Array.isArray(pq) && pq.length) {
    pq.slice().forEach(function (entry) {
      try {
        if (Array.isArray(entry)) obApi.apply(null, entry);
        else if (entry && entry.command) obApi(entry.command, entry.event, entry.data);
      } catch (_) {}
    });
  }

  /* ---------- Compliance hints (no-ops) ---------- */
  // Outbrain widget can auto-read TCF/CCPA consent; we store if provided manually.
  try {
    var consentStr = document.querySelector('[data-consent-string]')?.getAttribute('data-consent-string');
    var ccpaStr = document.querySelector('[data-ccpa-string]')?.getAttribute('data-ccpa-string');
    if (consentStr) _obState.consent = consentStr;
    if (ccpaStr) _obState.consent = ccpaStr;
  } catch (_) {}

  /* ---------- Final harden ---------- */
  dlog('stub ready');
})();
