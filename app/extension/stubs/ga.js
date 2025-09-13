// Google Analytics (analytics.js) – Pro Stub
// Ziel: Seiten glauben, GA läuft; es werden aber keine Daten gesendet.
(function(){
  "use strict";

  // Idempotenz & Stealth-Helpers
  if (window.__PROTECTO_GA__) return; 
  window.__PROTECTO_GA__ = true;
  function nativeFn(name){ return function(){ return `function ${name}() { [native code] }`; }; }
  function defGlobal(obj, key, value){
    try { Object.defineProperty(obj, key, { value, writable:true, configurable:true, enumerable:false }); }
    catch { obj[key] = value; }
  }

  // Provide GA4 gtag() noop if missing (some sites mix GA/gtag)
  if (typeof window.gtag !== 'function') {
    function gtag(){ return true; }
    try { gtag.toString = nativeFn('gtag'); } catch {}
    defGlobal(window, 'gtag', gtag);
  }

  // Echte analytics.js nicht überschreiben – aber Boot-Snippet (ga.q) sehr wohl
  if (typeof window.ga === 'function' && window.ga.loaded === true) {
    return; // echtes GA geladen
  }

  const DEBUG = false; // bei Bedarf true schalten für lokale Logs

  // Marker wie im Original
  defGlobal(window, 'GoogleAnalyticsObject', 'ga');

  // Bereits vorhandene Queue-Aufrufe vom GA-Snippet abgreifen
  const preQueuedCalls = [];
  try { if (window.ga && Array.isArray(window.ga.q)) preQueuedCalls.push(...window.ga.q); } catch {}
  try { if (window[window.GoogleAnalyticsObject] && Array.isArray(window[window.GoogleAnalyticsObject].q)) preQueuedCalls.push(...window[window.GoogleAnalyticsObject].q); } catch {}
  try { if (Array.isArray(window._gaq)) preQueuedCalls.push(...window._gaq); } catch {}

  // Interner Zustand
  const state = {
    trackers: new Map(),      // name -> tracker
    hits: [],                 // gespeicherte Hits (kein Netzwerk)
    callbacks: [],            // ga(function(){ ... })
    defaultName: 't0',
    startedAt: Date.now()
    , plugins: new Set()
    , linker: { autoLink: [] }
  };

  // kleine zufällige Verzögerung für realistischeres Timing
  function jitter(min=25, max=90){
    return new Promise(res => setTimeout(res, Math.floor(min + Math.random()*(max-min))));
  }
  const now = () => Date.now();

  // Tracker-Objekt (vereinfachte, aber kompatible API)
  function createTracker(trackingId, cookieDomain, nameOrFields){
    let name = state.defaultName;
    let fields = {};

    if (typeof nameOrFields === 'string') {
      name = nameOrFields || state.defaultName;
    } else if (nameOrFields && typeof nameOrFields === 'object') {
      fields = { ...nameOrFields };
      if (typeof fields.name === 'string') name = fields.name;
    }

    const tracker = {
      name,
      trackingId: trackingId || 'UA-000000-0',
      cookieDomain: cookieDomain || 'auto',
      fieldsObject: { ...fields },
      _lastSend: 0,
      set(fieldName, value){
        if (typeof fieldName === 'object') {
          Object.assign(this.fieldsObject, fieldName);
        } else if (typeof fieldName === 'string') {
          this.fieldsObject[fieldName] = value;
        }
        return true;
      },
      get(fieldName){
        return this.fieldsObject[fieldName];
      },
      send(hitType, hitFields){
        const extra = (hitFields && typeof hitFields === 'object') ? hitFields : {};
        const payload = {
          t: hitType || (extra.hitType || 'pageview'),
          ts: now(),
          tracker: this.name,
          tid: this.trackingId,
          cid: this.fieldsObject.clientId || '555.0',
          dl: (document.location && document.location.href) || '',
          dt: document.title || '',
          ...this.fieldsObject,
          ...extra
        };
        // keep bounded history to avoid leaks
        state.hits.push(payload);
        if (state.hits.length > 200) state.hits.shift();
        if (DEBUG) console.log('[Protecto GA Stub] hit', payload);
        // simulate network delay without making ga() async
        setTimeout(() => {
          this._lastSend = payload.ts;
          try { if (typeof extra.hitCallback === 'function') extra.hitCallback(); } catch {}
        }, Math.floor(25 + Math.random()*65));
        return true;
      }
    };
    try {
      tracker.set.toString = nativeFn('set');
      tracker.get.toString = nativeFn('get');
      tracker.send.toString = nativeFn('send');
    } catch {}
    state.trackers.set(name, tracker);
    return tracker;
  }

  function getTrackerByName(name){
    return state.trackers.get(name || state.defaultName);
  }

  function getAllTrackers(){
    return Array.from(state.trackers.values());
  }

  // Hauptfunktion ga(...)
  function ga(command, a1, a2, a3){
    try {
      // ga(function(){ ... }) – Callback-Style (exec later, but return true now)
      if (typeof command === 'function') {
        state.callbacks.push(command);
        setTimeout(() => { try { command(); } catch {} }, Math.floor(5 + Math.random()*20));
        return true;
      }

      if (typeof command !== 'string') return true;

      // t0.send / t0.set / t0.get Syntax
      if (command.indexOf('.') > -1) {
        const [trackerName, method] = command.split('.', 2);
        const tr = getTrackerByName(trackerName);
        if (!tr) return false;
        if (method === 'send') return tr.send(a1, a2);
        if (method === 'set')  return tr.set(a1, a2);
        if (method === 'get')  return tr.get(a1);
        if (method === 'require') { state.plugins.add(a1); return true; }
        return true;
      }

      // create / send / set / get (global auf defaultTracker)
      switch (command) {
        case 'create':
          // ga('create', trackingId, cookieDomain, nameOrFields)
          createTracker(a1, a2, a3);
          return true;
        case 'send': {
          const tr = getTrackerByName(state.defaultName) || createTracker();
          if (typeof a1 === 'object') {
            const hf = a1 || {}; // { hitType: 'event', ... }
            return tr.send(hf.hitType || 'pageview', hf);
          }
          return tr.send(a1, a2);
        }
        case 'set': {
          const tr = getTrackerByName(state.defaultName) || createTracker();
          return tr.set(a1, a2);
        }
        case 'get': {
          const tr = getTrackerByName(state.defaultName) || createTracker();
          return tr.get(a1);
        }
        case 'remove':
          return true; // no-op
        case 'provide': // ga('provide', 'pluginName', fn)
          if (typeof a1 === 'string') state.plugins.add(a1);
          return true;
        case 'require': // ga('require', 'pluginName' [, options])
          if (typeof a1 === 'string') state.plugins.add(a1);
          if (a1 === 'linker' && a2 && a2.autoLink) state.linker.autoLink = [].concat(a2.autoLink);
          return true;
        default:
          if (DEBUG) console.log('[Protecto GA Stub] unknown command:', command, a1, a2, a3);
          return true;
      }
    } catch (e) {
      if (DEBUG) console.warn('[Protecto GA Stub] error', e);
      return false;
    }
  }

  // Exponieren (einmal, read-only)
  defGlobal(window, 'ga', ga);

  // Zusätzliche No-Ops für Kompatibilität (synchron)
  ga.require = function() { return true; };
  ga.remove  = function() { return true; };

  // Native-like Fingerprints NACH der Zuweisung
  try {
    ga.toString        = nativeFn('ga');
    ga.create.toString = nativeFn('create');
    ga.getAll.toString = nativeFn('getAll');
    ga.getByName.toString = nativeFn('getByName');
    ga.require.toString   = nativeFn('require');
    ga.remove.toString    = nativeFn('remove');
  } catch {}

  // Kompatibilität: ga.q als leeres Array bereitstellen (einige Themes checken das)
  window.ga.q = [];

  if (!Array.isArray(window._gaq)) window._gaq = [];
  window._gaq.push = function(){ return true; };

  // Legacy _gat compatibility (_getTracker)
  if (!window._gat) {
    const legacyTracker = {
      _trackPageview: function(){ return true; },
      _trackEvent: function(){ return true; }
    };
    window._gat = { _getTracker: function(){ return legacyTracker; } };
  }

  // Vorher gequeue’te Aufrufe (vom Bootstrap-Snippet) nachträglich abarbeiten
  (async () => {
    if (preQueuedCalls && preQueuedCalls.length) {
      for (const args of preQueuedCalls) {
        try { await ga.apply(null, args); } catch {}
      }
      try { if (window.ga && Array.isArray(window.ga.q)) window.ga.q.length = 0; } catch {}
      try { if (Array.isArray(window._gaq)) window._gaq.length = 0; } catch {}
    }
  })();

})();