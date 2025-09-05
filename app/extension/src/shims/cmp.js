// Protecto – CMP Pro Shim (IAB TCF v2, Legacy __cmp, US Privacy, Consent Mode)
(function () {
  'use strict';

  // Nichts tun, wenn echte CMP schon vorhanden
  if (window.__tcfapi && typeof window.__tcfapi === 'function') return;

  const jitter = (min=10,max=40)=>new Promise(r=>setTimeout(r,Math.floor(min+Math.random()*(max-min))));
  const nowISO = () => new Date().toISOString();

  // Minimaler, plausibler TC-String (Dummy)
  const TC_STRING = "CPXxXxAPXxXxAAGABBDEBICgAAAAAAAAAAAEYAAAAAAAA";
  const PURPOSES = {1:true,2:true,3:true,4:true,5:true,6:true,7:true,8:true,9:true,10:true};

  const state = {
    gdprApplies: true,
    tcfapiVersion: 2,
    tcString: TC_STRING,
    eventListeners: new Map(),
    nextId: 1,
  };

  // ===== TCF v2: __tcfapi(command, version, callback, parameter)
  function buildTCData() {
    return {
      tcfPolicyVersion: 2,
      publisherCC: 'DE',
      cmpId: 0, cmpVersion: 1,
      gdprApplies: state.gdprApplies,
      tcString: state.tcString,
      isServiceSpecific: true, useNonStandardStacks: false,
      purpose: { consents:{...PURPOSES}, legitimateInterests:{} },
      publisher: { consents:{...PURPOSES}, legitimateInterests:{}, customPurpose:{consents:{},legitimateInterests:{}} },
      vendor: { consents:{}, legitimateInterests:{} },
      addtlConsent: "", outOfBand:{ allowedVendors:{}, disclosedVendors:{} },
      specialFeatureOptins:{1:true,2:true},
      purposeOneTreatment:false
    };
  }

  function __tcfapi(command, version, callback, parameter) {
    if (typeof callback !== 'function') return;
    const cb = (data, ok=true)=>{ try { callback(data, ok); } catch {} };

    switch (String(command||'').toLowerCase()) {
      case 'ping':
        cb({ gdprApplies: state.gdprApplies, cmpLoaded:true, cmpStatus:'loaded',
             displayStatus:'disabled', apiVersion:'2.0', cmpVersion:1, tcfPolicyVersion:2, gvlVersion:0 }, true);
        break;
      case 'gettcdata':
        jitter().then(()=>cb(buildTCData(), true));
        break;
      case 'addlistener': {
        const id = state.nextId++;
        const listener = (evt)=>{ try { callback(evt,true); } catch {} };
        state.eventListeners.set(id, listener);
        // Rückgabe des Listener-IDs an den Caller (manche CMP-Wrapper erwarten das)
        try { callback({ listenerId: id }, true); } catch {}
        // Erstes Event nach kurzer Verzögerung
        jitter().then(()=>listener({ eventStatus:'tcloaded', gdprApplies:state.gdprApplies, tcData:buildTCData(), listenerId:id }));
        break;
      }
      case 'removelistener': {
        const lid = parameter && (parameter.listenerId || parameter);
        if (lid && state.eventListeners.has(lid)) state.eventListeners.delete(lid);
        cb(true,true);
        break;
      }
      case 'setconsent':
      case 'updataconsentdata':
      case 'updataconsent':
        cb(true,true);
        break;
      default:
        cb(null,false);
    }
  }

  // __tcfapiLocator (für postMessage-Proxys)
  (function ensureLocator(){
    try {
      if (window.frames && window.frames['__tcfapiLocator']) return;
      const f = document.createElement('iframe');
      f.style.cssText = 'display:none !important'; f.name = '__tcfapiLocator';
      document.documentElement.appendChild(f);
    } catch {}
  })();

  // postMessage-Bridge
  window.addEventListener('message', (event) => {
    try {
      const data = event.data || {};
      // Optional: einfache Origin-Prüfung (nicht zu strikt, damit Iframes funktionieren)
      const sameOrigin = (event.origin === self.location.origin) || (event.origin === 'null' || event.origin === '');
      if (data.__tcfapiCall && sameOrigin || data.__tcfapiCall) {
        const { command, version, parameter, callId } = data.__tcfapiCall;
        __tcfapi(command, version, (retValue, success) => {
          event.source && event.source.postMessage({ __tcfapiReturn:{ returnValue:retValue, success, callId } }, '*');
        }, parameter);
      }
    } catch {}
  });

  Object.defineProperty(window, '__tcfapi', { configurable:true, get:()=>__tcfapi });

  // ===== Legacy __cmp
  if (typeof window.__cmp !== 'function') {
    function __cmp(cmd,arg,cb){
      const done=(resp,ok=true)=>{ try { cb && cb(resp,ok); } catch {} };
      switch (String(cmd||'').toLowerCase()){
        case 'getconsentdata':
        case 'getvendorconsents':
          jitter().then(()=>done({ gdprApplies:state.gdprApplies, hasGlobalScope:false, consentData:state.tcString }, true));
          break;
        case 'ping':
          done({ gdprApplies:state.gdprApplies, cmpLoaded:true }, true);
          break;
        default: done(null,false);
      }
    }
    Object.defineProperty(window,'__cmp',{ configurable:true, get:()=>__cmp });
  }

  // ===== US Privacy / CCPA: __uspapi
  if (typeof window.__uspapi !== 'function') {
    function __uspapi(cmd,version,cb){
      const done=(resp,ok=true)=>{ try { cb && cb(resp,ok); } catch {} };
      if (String(cmd||'').toLowerCase()==='getuspdata') {
        jitter().then(()=>done({ version:1, uspString:'1YNN' }, true));
      } else { done(null,false); }
    }
    Object.defineProperty(window,'__uspapi',{ configurable:true, get:()=>__uspapi });
  }

  // ===== Google Consent Mode (standardmäßig granted)
  try {
    if (typeof window.gtag === 'function') {
      window.gtag('consent','update',{
        ad_storage:'granted', analytics_storage:'granted',
        personalization_storage:'granted', functionality_storage:'granted',
        security_storage:'granted'
      });
    } else {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ 'gtm.consentGranted':true, event:'protecto_consent_granted', ts:nowISO() });
    }
  } catch {}

  // ===== IAB GPP (__gpp) – minimal shim
  try {
    if (typeof window.__gpp !== 'function') {
      const gppState = { nextId: 1, listeners: new Map() };
      function __gpp(command, callback) {
        const done = (resp, ok=true) => { try { callback && callback(resp, ok); } catch {} };
        switch (String(command||'').toLowerCase()) {
          case 'getgppdata':
            // minimal gültige Struktur
            jitter().then(()=>done({
              gppString: '',
              applicableSections: [],
              sectionList: [],
              pingData: { gppVersion: '1.0', cmpStatus: 'loaded' }
            }, true));
            break;
          case 'addlistener': {
            const id = gppState.nextId++;
            gppState.listeners.set(id, callback);
            try { callback && callback({ eventName: 'sectionChange', listenerId: id }, true); } catch {}
            break;
          }
          case 'removelistener': {
            const id = (arguments[2] && arguments[2].listenerId) || 0;
            if (id && gppState.listeners.has(id)) gppState.listeners.delete(id);
            done(true, true);
            break;
          }
          default:
            done(null, false);
        }
      }
      Object.defineProperty(window, '__gpp', { configurable: true, get: () => __gpp });
    }
  } catch {}

  // ===== Auto-Close for common CMP banners (stealthy)
  try {
    const ACCEPT_SELECTORS = [
      // OneTrust
      '#onetrust-accept-btn-handler',
      'button#onetrust-accept-btn-handler',
      // Didomi
      'button.didomi-components-button--allow',
      '.didomi-allow-button',
      // Sourcepoint / Quantcast
      'button[mode="primary"][data-cm-action="accept-all"]',
      'button[aria-label*="accept" i][data-testid*="accept" i]',
      '.sp_choice_type_11',
      '[data-testid="uc-accept-all-button"]',
      // TCF-Generics
      'button[aria-label*="akzeptieren" i]',
      'button[title*="akzeptieren" i]',
      'button:where([data-action*="accept" i],[data-accept],[data-testid*="accept" i])',
      // Fallbacks (German labels)
      'button:where(:-webkit-any(.accept,.ok,.primary))',
      'button:where([aria-label*="alle akzept" i],[title*="alle akzept" i])',
    ];

    function simulateClick(el) {
      if (!el) return false;
      try {
        const rect = el.getBoundingClientRect();
        const opts = { bubbles: true, cancelable: true, view: window, clientX: rect.left + 5, clientY: rect.top + 5 };
        el.dispatchEvent(new MouseEvent('pointerdown', opts));
        el.dispatchEvent(new MouseEvent('mousedown', opts));
        el.dispatchEvent(new MouseEvent('mouseup', opts));
        el.dispatchEvent(new MouseEvent('click', opts));
        return true;
      } catch { return false; }
    }

    function findAcceptButton() {
      for (const sel of ACCEPT_SELECTORS) {
        const btn = document.querySelector(sel);
        if (btn) return btn;
      }
      return null;
    }

    async function tryAutoCloseOnce() {
      // 1) Falls CMP-API vorhanden: pseudo-Consent signalisieren
      try {
        if (typeof window.__tcfapi === 'function') {
          // Triggere Listener-Event, viele CMPs schließen dann selbst
          window.__tcfapi('addEventListener', 2, () => {}, { eventStatus: 'useractioncomplete' });
        }
        if (typeof window.gtag === 'function') {
          window.gtag('consent','update',{ ad_storage:'granted', analytics_storage:'granted', personalization_storage:'granted', functionality_storage:'granted', security_storage:'granted' });
        }
      } catch {}

      // 2) Sichtbares Banner aktiv wegklicken (so unauffällig wie möglich)
      const btn = findAcceptButton();
      if (btn) {
        // Leichter Jitter, um echte Nutzeraktion zu imitieren
        await jitter(120, 260);
        simulateClick(btn);
        return true;
      }
      return false;
    }

    // Mehrfach versuchen + Beobachter, da viele CMPs asynchron laden
    const attempts = [350, 1200, 2500, 4000];
    attempts.forEach((ms) => setTimeout(() => { tryAutoCloseOnce(); }, ms));

    const mo = new MutationObserver(() => { tryAutoCloseOnce(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    // Sicherheits-Stopp nach 20s
    setTimeout(() => { try { mo.disconnect(); } catch {} }, 20000);
  } catch {}

  // Listener-Aufräumen bei Unload
  try {
    const cleanup = () => { try { state.eventListeners.clear(); } catch {} };
    window.addEventListener('pagehide', cleanup);
    window.addEventListener('beforeunload', cleanup);
  } catch {}
})();