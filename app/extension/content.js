// Protecto – Early Stub Injection (document_start)
(() => {
  'use strict';

  // idempotent (pro Frame nur einmal)
  if (window.__protectoStubsInjected) return;
  window.__protectoStubsInjected = true;

  // CSP Nonce (falls Seite Nonce auf <script> nutzt)
  function getCspNonce(){
    try {
      const s = document.querySelector('script[nonce]');
      if (!s) return undefined;
      return s.nonce || s.getAttribute('nonce') || undefined;
    } catch { return undefined; }
  }
  const NONCE = getCspNonce();

  // Reihenfolge wichtig: generische APIs zuerst, dann families
  const STUBS = [
    // Core placeholders, die oft synchron erwartet werden:
    'generic.js',     // util helpers
    'gtm.js',         // dataLayer/gtm
    'ga.js',          // ga/gtag
    'fbq.js',         // fbq

    // Weitere Familien – so viel wie du im Projekt hast:
    'ttq.js','lintrk.js','twq.js','uetq.js',
    'pintrk.js','snaptr.js','rdt.js','qp.js',
    'criteo_q.js','_taboola.js','outbrain.js','quantcast.js',
    'segment.js','mixpanel.js','amplitude.js','heap.js','fullstory.js',
    'adobe.js','hubspot.js','intercom.js','yandex.js','newrelic.js','datadog-rum.js','sentry.js',
    'optimizely.js','vwo.js','hotjar.js','matomo.js','clarity.js','crazyegg.js'
  ];

  // robustes Injektionsziel: vor dem ersten <script>, sonst <head>, dann <html>/<body>
  function appendScriptTag(src){
    try {
      const s = document.createElement('script');
      s.src = src;
      s.async = false; // Reihenfolge beibehalten
      if (NONCE) { try { s.setAttribute('nonce', NONCE); } catch {} }

      const firstScript = document.scripts && document.scripts[0];
      if (firstScript && firstScript.parentNode) {
        firstScript.parentNode.insertBefore(s, firstScript);
      } else if (document.head) {
        document.head.appendChild(s);
      } else if (document.documentElement) {
        document.documentElement.appendChild(s);
      } else if (document.body) {
        document.body.appendChild(s);
      } else {
        // Fallback minimal
        (document.head || document.documentElement || document.body)?.appendChild(s);
      }

      // Aufräumen (keine Spuren im DOM lassen)
      const cleanup = () => { try { s.remove(); } catch {} };
      s.addEventListener('load', cleanup, { once: true });
      s.addEventListener('error', cleanup, { once: true });
    } catch {}
  }

  // nacheinander injizieren (sync), damit Abhängigkeiten stimmen
  for (const name of STUBS) {
    try {
      const url = chrome.runtime.getURL(`stubs/${name}`);
      appendScriptTag(url);
    } catch {}
  }

  // optionales Debugging (nur wenn Seite es will)
  try {
    if (window.__PROTECTO_DEBUG__) {
      // eslint-disable-next-line no-console
      console.debug('[Protecto][Stubs] injected', STUBS.length, 'files at document_start');
    }
  } catch {}
})();