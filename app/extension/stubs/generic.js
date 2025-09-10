/* Protecto Stub Toolkit – generic.js
   Gemeinsame Helfer für alle Stubs (GTM/GA/FBQ etc.)
   - jitter(min,max): kleine, realistische Verzögerung
   - safeGlobal(name,value): nur setzen, wenn nicht vorhanden
   - noop / noopPromise: sichere No-ops
   - exposeDataLayer(): dataLayer + push bereitstellen (mit Ringpuffer)
   - consentSignal(): optionales „granted“-Signal für GTag/ConsentMode
*/

(function () {
  'use strict';

  // Idempotenz & Stealth-Helpers
  if (window.__PROTECTO_GENERIC__) return;
  window.__PROTECTO_GENERIC__ = true;
  function nativeFn(name){ return function(){ return `function ${name}() { [native code] }`; }; }
  function defGlobal(obj, key, value){
    try { Object.defineProperty(obj, key, { value, writable:false, configurable:false, enumerable:false }); }
    catch { obj[key] = value; }
  }

  // ==== Mini-Utils ===========================================================
  function randInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  // Winzige Verzögerung (z. B. 15–60 ms), um echte Netzlatenzen zu simulieren
  function jitter(min = 15, max = 60) {
    return new Promise((resolve) => setTimeout(resolve, randInt(min, max)));
  }

  // Sichere No-ops (schlucken Fehler)
  function noop() { /* no-op */ }
  function noopPromise(value = true) { return Promise.resolve(value); }

  // Global nur setzen, wenn nicht vorhanden
  function safeGlobal(name, valueFactory) {
    try {
      if (!(name in window) || typeof window[name] === 'undefined') {
        const value = (typeof valueFactory === 'function') ? valueFactory() : valueFactory;
        Object.defineProperty(window, name, { configurable: true, enumerable: false, writable: true, value });
      }
    } catch { /* ignore */ }
  }

  // ==== dataLayer bereitstellen =============================================
  // Ringpuffer, damit Speicher nicht explodiert
  const MAX_EVENTS = 200;

  function exposeDataLayer() {
    try {
      const existing = Array.isArray(window.dataLayer) ? window.dataLayer.slice() : [];
      let buffer = existing.slice(-MAX_EVENTS);

      function dlPush() {
        try {
          for (let i = 0; i < arguments.length; i++) {
            if (buffer.length >= MAX_EVENTS) buffer.shift();
            buffer.push(arguments[i]);
          }
        } catch { /* ignore */ }
        return buffer.length;
      }

      const proxy = [];
      proxy.push = dlPush;
      try { proxy.push.toString = nativeFn('push'); } catch {}
      try {
        const desc = Object.getOwnPropertyDescriptor(proxy, 'push') || { value: proxy.push };
        Object.defineProperty(proxy, 'push', { value: desc.value, writable:false, configurable:false, enumerable:false });
      } catch {}

      // Lesezugriff auf aktuellen Snapshot
      Object.defineProperty(proxy, '__dump', {
        configurable: false,
        enumerable: false,
        get: () => buffer.slice()
      });
      try {
        Object.defineProperty(proxy, 'length', { get: () => buffer.length, enumerable:false, configurable:false });
      } catch {}

      safeGlobal('dataLayer', () => proxy);
    } catch { /* ignore */ }
  }

  // ==== (Optional) Consent-Signal für Google Consent Mode ====================
  async function consentSignal() {
    try {
      // Wenn gtag vorhanden ist: Consent „granted“ signalisieren (ohne echte Wirkung)
      if (typeof window.gtag === 'function') {
        await jitter(10, 35);
        window.gtag('consent', 'update', {
          ad_storage: 'granted',
          analytics_storage: 'granted',
          personalization_storage: 'granted',
          functionality_storage: 'granted',
          security_storage: 'granted'
        });
      } else {
        // ansonsten per dataLayer-Event
        exposeDataLayer();
        await jitter(10, 35);
        window.dataLayer.push({ event: 'protecto_consent_granted', ts: Date.now() });
      }
    } catch { /* ignore */ }
  }

  // ==== Leichte Global-Shims (generisch) – keine Netzaktivität =================
  // gtag Boot-Stub (falls GTM/GA-Stubs nicht geladen wurden)
  if (typeof window.gtag !== 'function') {
    const q = [];
    function gtag(){ q.push([].slice.call(arguments)); }
    gtag.q = q;
    try { gtag.toString = nativeFn('gtag'); } catch {}
    defGlobal(window, 'gtag', gtag);

  // Minimaler GA-Stub (nur wenn nicht vorhanden) – Queue + API-Fassade
  if (typeof window.ga !== 'function') {
    function ga(){ (ga.q || (ga.q = [])).push([].slice.call(arguments)); }
    try { ga.toString = nativeFn('ga'); } catch {}
    ga.create  = noop;
    ga.getAll  = function(){ return []; };
    ga.getByName = function(){ return null; };
    ga.require = noop;
    ga.remove  = noop;
    try { Object.defineProperty(ga, 'q', { value: [], writable:false, configurable:false, enumerable:false }); }
    catch { ga.q = []; }
    defGlobal(window, 'ga', ga);
    // Echte Seiten erwarten oft dieses Flag/Name
    defGlobal(window, 'GoogleAnalyticsObject', 'ga');
  }

  // Minimaler FBQ-Stub (nur wenn nicht vorhanden) – Queue + API-Fassade
  if (typeof window.fbq !== 'function') {
    const pre = [];
    function fbq(){ pre.push([].slice.call(arguments)); return 'fbq-stub'; }
    fbq.callMethod = function(){ return; };
    fbq.push = function(){ return; };
    fbq.disablePushState = true;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = pre;
    try {
      fbq.toString = nativeFn('fbq');
      fbq.callMethod.toString = nativeFn('callMethod');
      fbq.push.toString = nativeFn('push');
    } catch {}
    try { Object.defineProperty(fbq, 'queue', { value: pre, writable:false, configurable:false, enumerable:false }); } catch {}
    defGlobal(window, 'fbq', fbq);
    defGlobal(window, '_fbq', fbq);
  }

  // Minimalobjekt für google_tag_manager – verhindert Fingerprinting-Fehler
  if (typeof window.google_tag_manager !== 'object') {
    const gtm = new Proxy({}, {
      get(target, key){
        if (key === 'toString') return nativeFn('Object');
        if (!(key in target)) target[key] = {};
        return target[key];
      }
    });
    defGlobal(window, 'google_tag_manager', gtm);
  }
  }

  // _gaq / _paq – alte Tracker-Queues, nur No-Op push
  if (!Array.isArray(window._gaq)) {
    defGlobal(window, '_gaq', []);
  }
  try { Object.defineProperty(window._gaq, 'push', { value: function(){ return true; }, writable:false, configurable:false }); } catch { window._gaq.push = function(){ return true; }; }

  if (!Array.isArray(window._paq)) {
    defGlobal(window, '_paq', []);
  }
  try { Object.defineProperty(window._paq, 'push', { value: function(){ return true; }, writable:false, configurable:false }); } catch { window._paq.push = function(){ return true; }; }

  // Häufige Namespace-Objekte
  if (typeof window.adservice !== 'object') defGlobal(window, 'adservice', {});

  // ==== Dummy-Cookie (nur in-memory, kein echter Cookie) =====================
  // Für Themes/Skripte, die nur „existiert ga“ etc. prüfen – KEIN echtes Set-Cookie.
  const fakeCookieJar = new Map();
  function setFakeCookie(name, value) {
    try { fakeCookieJar.set(name, String(value)); } catch {}
  }
  function getFakeCookie(name) {
    try { return fakeCookieJar.get(name) || null; } catch { return null; }
  }

  // ==== Public API exportieren ==============================================
  // Wir hängen alles unter window.__protectoStub, damit andere Stubs darauf zugreifen.
  safeGlobal('__protectoStub', () => ({
    jitter,
    noop,
    noopPromise,
    safeGlobal,
    exposeDataLayer,
    consentSignal,
    setFakeCookie,
    getFakeCookie,
    MAX_EVENTS,
    nativeFn,
    defGlobal
  }));

  // Sofort sinnvolle Defaults vorbereiten
  exposeDataLayer();
  try { window.__protectoStub.toString = nativeFn('__protectoStub'); } catch {}
})();