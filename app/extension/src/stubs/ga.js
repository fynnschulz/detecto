// Google Analytics (analytics.js) – Pro Stub
// Ziel: Seiten glauben, GA läuft; es werden aber keine Daten gesendet.
(function(){
  "use strict";

  // Wenn bereits ein kompatibles ga vorhanden ist, nichts überschreiben
  if (typeof window.ga === 'function' && window.GoogleAnalyticsObject === 'ga') return;

  const DEBUG = false; // bei Bedarf true schalten für lokale Logs

  // Marker wie im Original
  window.GoogleAnalyticsObject = 'ga';

  // Interner Zustand
  const state = {
    trackers: new Map(),      // name -> tracker
    hits: [],                 // gespeicherte Hits (kein Netzwerk)
    callbacks: [],            // ga(function(){ ... })
    defaultName: 't0',
    startedAt: Date.now()
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
        // Varianten: tr.send('pageview'|'event'|..., fields) oder ga('send', { hitType: 'event', ... })
        const extra = (hitFields && typeof hitFields === 'object') ? hitFields : {};
        const payload = {
          t: hitType || (extra.hitType || 'pageview'),
          ts: now(),
          tracker: this.name,
          tid: this.trackingId,
          cid: this.fieldsObject.clientId || '555.0',
          dl: document.location.href,
          dt: document.title,
          ...this.fieldsObject,
          ...extra
        };
        state.hits.push(payload);
        if (DEBUG) console.log('[Protecto GA Stub] hit', payload);
        await jitter(); // so tun, als würde ein Beacon gesendet
        this._lastSend = payload.ts;
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

  // Exponieren
  window.ga = ga;
})();