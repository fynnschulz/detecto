// Google Analytics (analytics.js) – Pro Stub
// Ziel: Seiten glauben, GA läuft; es werden aber keine Daten gesendet.
(function(){
  "use strict";

  // Idempotenz & Stealth-Helpers
  if (window.__PROTECTO_GA__) return; 
  window.__PROTECTO_GA__ = true;
  function nativeFn(name){ return function(){ return `function ${name}() { [native code] }`; }; }
  function defGlobal(obj, key, value){
    try { Object.defineProperty(obj, key, { value, writable:false, configurable:false, enumerable:false }); }
    catch { obj[key] = value; }
  }

  // Echte analytics.js nicht überschreiben – aber Boot-Snippet (ga.q) sehr wohl
  if (typeof window.ga === 'function' && typeof window.ga.getAll === 'function' && Array.isArray(window.ga.getAll())) {
    return; // echtes GA geladen
  }

  const DEBUG = false; // bei Bedarf true schalten für lokale Logs

  // Marker wie im Original
  window.GoogleAnalyticsObject = 'ga';

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
      async send(hitType, hitFields){
        const extra = (hitFields && typeof hitFields === 'object') ? hitFields : {};
        const payload = {
          t: hitType || (extra.hitType || 'pageview'),
          ts: now(),
          tracker: this.name,
          tid: this.trackingId,
          cid: this.fieldsObject.clientId || '555.0',
          dl: document.location && document.location.href || '',
          dt: document.title || '',
          ...this.fieldsObject,
          ...extra
        };
        state.hits.push(payload);
        if (DEBUG) console.log('[Protecto GA Stub] hit', payload);
        await jitter();
        this._lastSend = payload.ts;
        try { if (typeof extra.hitCallback === 'function') extra.hitCallback(); } catch {}
        return true;
      }
    };

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
  async function ga(command, a1, a2, a3){
    try {
      // ga(function(){ ... }) – Callback-Style
      if (typeof command === 'function') {
        state.callbacks.push(command);
        await jitter(5,25);
        try { command(); } catch {}
        return Promise.resolve(true);
      }

      if (typeof command !== 'string') return Promise.resolve(true);

      // t0.send / t0.set / t0.get Syntax
      if (command.indexOf('.') > -1) {
        const [trackerName, method] = command.split('.', 2);
        const tr = getTrackerByName(trackerName);
        if (!tr) return Promise.resolve(false);
        if (method === 'send') return Promise.resolve(tr.send(a1, a2));
        if (method === 'set')  return Promise.resolve(tr.set(a1, a2));
        if (method === 'get')  return Promise.resolve(tr.get(a1));
        if (method === 'require') { state.plugins.add(a1); return Promise.resolve(true); }
        return Promise.resolve(true);
      }

      // create / send / set / get (global auf defaultTracker)
      switch (command) {
        case 'create':
          // ga('create', trackingId, cookieDomain, nameOrFields)
          createTracker(a1, a2, a3);
          return Promise.resolve(true);
        case 'send': {
          const tr = getTrackerByName(state.defaultName) || createTracker();
          if (typeof a1 === 'object') {
            const hf = a1 || {}; // { hitType: 'event', ... }
            return Promise.resolve(tr.send(hf.hitType || 'pageview', hf));
          }
          return Promise.resolve(tr.send(a1, a2));
        }
        case 'set': {
          const tr = getTrackerByName(state.defaultName) || createTracker();
          return Promise.resolve(tr.set(a1, a2));
        }
        case 'get': {
          const tr = getTrackerByName(state.defaultName) || createTracker();
          return Promise.resolve(tr.get(a1));
        }
        case 'remove':
          return Promise.resolve(true); // no-op
        case 'provide': // ga('provide', 'pluginName', fn)
          if (typeof a1 === 'string') state.plugins.add(a1);
          return Promise.resolve(true);
        case 'require': // ga('require', 'pluginName' [, options])
          if (typeof a1 === 'string') state.plugins.add(a1);
          if (a1 === 'linker' && a2 && a2.autoLink) state.linker.autoLink = [].concat(a2.autoLink);
          return Promise.resolve(true);
        default:
          if (DEBUG) console.log('[Protecto GA Stub] unknown command:', command, a1, a2, a3);
          return Promise.resolve(true);
      }
    } catch (e) {
      if (DEBUG) console.warn('[Protecto GA Stub] error', e);
      return Promise.resolve(false);
    }
  }

  // Zusätzliche Kurzformen wie im Original
  ga.l = Date.now();
  ga.loaded = true;
  ga.create = (tid, cd, nameOrFields) => createTracker(tid, cd, nameOrFields);
  ga.getAll = () => getAllTrackers();
  ga.getByName = (n) => getTrackerByName(n);

  try { ga.toString = nativeFn('ga'); } catch {}
  defGlobal(window, 'ga', ga);

  // Zusätzliche No-Ops für Kompatibilität
  ga.require = function() { return true; };
  ga.remove = function() { return true; };

  // Exponieren
  window.ga = ga;

  // Kompatibilität: ga.q als leeres Array bereitstellen (einige Themes checken das)
  try { window.ga.q = []; } catch {}

  if (!Array.isArray(window._gaq)) window._gaq = [];
  try { Object.defineProperty(window._gaq, 'push', { value: function(){ return true; }, writable:false, configurable:false }); } catch { window._gaq.push = function(){ return true; }; }

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

  try { ga.getAll.toString = nativeFn('getAll'); } catch {}
})();