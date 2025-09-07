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

      // Lesezugriff auf aktuellen Snapshot
      Object.defineProperty(proxy, '__dump', {
        configurable: false,
        enumerable: false,
        get: () => buffer.slice()
      });

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
    MAX_EVENTS
  }));

  // Sofort sinnvolle Defaults vorbereiten
  exposeDataLayer();
})();