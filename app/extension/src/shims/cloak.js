(() => {
  "use strict";
  // ============================================================
  // Protecto CLOAK — Pro‑Level Global Stubs (MAIN world)
  // Goal: Make pages believe trackers are present & working,
  //       without leaking data or breaking UX.
  // Notes:
  //  • Deterministic, silent (no console logs)
  //  • Only defines globals if missing
  //  • Keeps signatures & basic behaviors expected by libs
  // ============================================================

  // ---------- Deterministic seed (per domain + UA) ----------
  function h32(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619);} h+=h<<13; h^=h>>>7; h+=h<<3; h^=h>>>17; h+=h<<5; return h>>>0; }
  function mulberry32(seed){ return function(){ let t=(seed+=0x6D2B79F5); t=Math.imul(t^(t>>>15), t|1); t^=t+Math.imul(t^(t>>>7), t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
  const SEED = h32(location.hostname + "§" + navigator.userAgent);
  const RAND = mulberry32(SEED);
  const nowTs = () => Date.now ? Date.now() : +new Date();

  // ---------- Helpers ----------
  function defineIfMissing(obj, key, value){ try{ if (!(key in obj)) Object.defineProperty(obj, key, { configurable:true, enumerable:false, writable:true, value }); }catch{} }
  function noop(){}
  function arrPush(arr, args){ try{ return Array.prototype.push.apply(arr, args); }catch{ return (arr.length||0)+1; } }

  // ---------- Anti‑Adblock bait ----------
  try {
    const bait = document.createElement("div");
    bait.className = "adsbygoogle ad-banner ad_container ad ads banner ad-slot gpt-unit";
    bait.id = "ad-banner";
    bait.style.cssText = "position:absolute;left:-9999px;width:300px;height:250px;display:block;";
    document.documentElement.appendChild(bait);
  } catch {}

  // ============================================================
  // Google Analytics (analytics.js, ga)
  // ============================================================
  if (typeof window.ga !== "function") {
    const trackers = [];
    function makeTracker(){
      const fields = {};
      return {
        get: k => fields[k],
        set: (k,v) => { fields[k]=v; },
        send: noop,
        // For some integrations
        getAll: () => trackers
      };
    }
    function ga(){
      const args = Array.from(arguments);
      const cmd = args[0];
      if (typeof cmd === "function") { try { cmd(); } catch {} return; }
      if (cmd === "create") { trackers.push(makeTracker()); return; }
      if (cmd === "getAll") { return trackers.slice(); }
      // e.g. ga('send','pageview') → no‑op
      return; 
    }
    ga.q = [];
    ga.l = nowTs();
    ga.getAll = () => trackers.slice();
    defineIfMissing(window, "ga", ga);
  }

  // ============================================================
  // gtag (gtag.js)
  // ============================================================
  if (typeof window.dataLayer === "undefined" || !Array.isArray(window.dataLayer)) {
    defineIfMissing(window, "dataLayer", []);
  }
  // Minimal google_tag_manager object (häufige Existenzprüfung)
  if (typeof window.google_tag_manager !== "object") {
    defineIfMissing(window, "google_tag_manager", { dataLayer: window.dataLayer });
  }
  if (!window.dataLayer._patched) {
    const originalPush = window.dataLayer.push || function(){ return 1; };
    Object.defineProperty(window.dataLayer, "push", { configurable:true, writable:true, value: function(){ return originalPush.apply(window.dataLayer, arguments); } });
    Object.defineProperty(window.dataLayer, "_patched", { value: true });
  }
  if (typeof window.gtag !== "function") {
    function gtag(){
      const args = arguments;
      const delay = Math.floor(15 + RAND()*45);
      setTimeout(() => { try { arrPush(window.dataLayer, [args]); } catch {} }, delay);
    }
    defineIfMissing(window, "gtag", gtag);
    try { window.gtag("js", new Date()); } catch {}
  }

  // ============================================================
  // Google Tag (googletag / GPT)
  // ============================================================
  if (typeof window.googletag !== "object") {
    const g = { cmd: [] };
    // Basic slot object
    function makeSlot(){
      return {
        addService(){ return this; },
        setTargeting(){ return this; },
        defineSizeMapping(){ return this; },
        getSlotElementId(){ return "protecto-slot"; }
      };
    }
    g.pubads = function(){
      return {
        enableSingleRequest: noop,
        enableLazyLoad: noop,
        setRequestNonPersonalizedAds: noop,
        addEventListener: noop,
        setTargeting: noop,
        refresh: noop,
        collapseEmptyDivs: noop,
        getSlots: () => [],
      };
    };
    g.sizeMapping = function(){ return { addSize(){return this;}, build(){return {}; } }; };
    g.defineSlot = function(){ return makeSlot(); };
    g.defineOutOfPageSlot = function(){ return makeSlot(); };
    g.display = noop;
    g.destroySlots = noop;

    // Process queued cmd callbacks in next tick
    const q = g.cmd;
    Object.defineProperty(g, "cmd", { value: { push: fn => setTimeout(() => { try { fn(); } catch {} }, 0) } });
    q.forEach(fn => { try { setTimeout(fn, 0); } catch {} });

    defineIfMissing(window, "googletag", g);
  }

  // ============================================================
  // Facebook Pixel (fbq)
  // ============================================================
  if (typeof window.fbq !== "function") {
    (function(){
      function FBQ(){ FBQ.callMethod ? FBQ.callMethod.apply(FBQ, arguments) : FBQ.queue.push(arguments); }
      FBQ.push = function(){ FBQ.queue.push(arguments); };
      FBQ.loaded = true; FBQ.version = "2.0"; FBQ.queue = []; FBQ.callMethod = noop;
      defineIfMissing(window, "fbq", FBQ);
      defineIfMissing(window, "_fbq", FBQ);
    })();
  }

  // ============================================================
  // Segment (analytics.js)
  // ============================================================
  if (!window.analytics || !Array.isArray(window.analytics)) {
    const analytics = [];
    const methods = [
      "identify","track","page","group","alias","ready","on","once","off",
      "trackLink","trackForm","trackClick","trackSubmit","setAnonymousId","addSourceMiddleware",
      "addIntegrationMiddleware","setVersionName","debug","timeout"
    ];
    function factory(method){ return function(){ const args=[method].concat([].slice.call(arguments)); analytics.push(args); }; }
    methods.forEach(m => analytics[m] = factory(m));
    analytics.load = noop; analytics._loadOptions = {};
    defineIfMissing(window, "analytics", analytics);
  }

  // ============================================================
  // Matomo / Piwik (_paq)
  // ============================================================
  if (!Array.isArray(window._paq)) {
    const _paq = [];
    _paq.push = function(){ return arrPush(_paq, arguments); };
    defineIfMissing(window, "_paq", _paq);
  }

  // ============================================================
  // Legacy GA (_gaq)
  // ============================================================
  if (!Array.isArray(window._gaq)) {
    const _gaq = [];
    _gaq.push = function(){ return arrPush(_gaq, arguments); };
    defineIfMissing(window, "_gaq", _gaq);
  }

  // ============================================================
  // Amplitude
  // ============================================================
  if (!window.amplitude) {
    const instance = {
      init: noop, logEvent: noop, setUserId: noop, setUserProperties: noop,
      reset: noop, identify: noop, revenue: noop
    };
    defineIfMissing(window, "amplitude", { getInstance: () => instance });
  }

  // ============================================================
  // Mixpanel
  // ============================================================
  if (!window.mixpanel) {
    const people = { set: noop, set_once: noop, increment: noop, append: noop };
    const mixpanel = {
      init: noop, track: noop, identify: noop, alias: noop, register: noop, register_once: noop,
      time_event: noop, people
    };
    defineIfMissing(window, "mixpanel", mixpanel);
  }

  // ============================================================
  // Hotjar
  // ============================================================
  if (typeof window.hj !== "function") {
    function hj(){ (hj.q = hj.q || []).push(arguments); }
    hj.q = hj.q || []; hj.version = "6";
    defineIfMissing(window, "hj", hj);
  }

  // ============================================================
  // Intercom
  // ============================================================
  if (typeof window.Intercom !== "function") {
    function Intercom(){ (Intercom.q = Intercom.q || []).push(arguments); }
    Intercom.q = Intercom.q || [];
    defineIfMissing(window, "Intercom", Intercom);
  }

  // ============================================================
  // Twitter Pixel (twq)
  // ============================================================
  if (typeof window.twq !== "function") {
    function twq(){ (twq.q = twq.q || []).push(arguments); }
    twq.q = twq.q || []; twq.version = "1.1"; twq.load = noop;
    defineIfMissing(window, "twq", twq);
  }

  // ============================================================
  // LinkedIn Pixel (lintrk)
  // ============================================================
  if (typeof window.lintrk !== "function") {
    function lintrk(){ (lintrk.q = lintrk.q || []).push(arguments); }
    lintrk.q = lintrk.q || [];
    defineIfMissing(window, "lintrk", lintrk);
  }

  // ============================================================
  // Pinterest (pintrk)
  // ============================================================
  if (typeof window.pintrk !== "function") {
    function pintrk(){ (pintrk.queue = pintrk.queue || []).push(arguments); }
    pintrk.queue = pintrk.queue || []; pintrk.version = "3.0";
    defineIfMissing(window, "pintrk", pintrk);
  }

  // ============================================================
  // Snap Pixel (snaptr)
  // ============================================================
  if (typeof window.snaptr !== "function") {
    function snaptr(){ (snaptr.queue = snaptr.queue || []).push(arguments); }
    snaptr.queue = snaptr.queue || [];
    defineIfMissing(window, "snaptr", snaptr);
  }

  // ============================================================
  // Yandex Metrica (ym)
  // ============================================================
  if (typeof window.ym !== "function") {
    function ym(){ (ym.a = ym.a || []).push(arguments); }
    ym.a = ym.a || []; ym.l = nowTs();
    defineIfMissing(window, "ym", ym);
  }

  // ============================================================
  // Adobe Launch/DTM (_satellite)
  // ============================================================
  if (!window._satellite) {
    defineIfMissing(window, "_satellite", { track: noop, getVar: noop, setVar: noop, pushAsyncScript: noop });
  }

  // ============================================================
  // Tealium (utag)
  // ============================================================
  if (!window.utag) {
    defineIfMissing(window, "utag", { link: noop, view: noop, data: {} });
  }

  // ============================================================
  // Google Ads (adsbygoogle)
  // ============================================================
  if (!Array.isArray(window.adsbygoogle)) {
    const ads = [];
    ads.push = function(){ return arrPush(ads, arguments); };
    defineIfMissing(window, "adsbygoogle", ads);
  }

  // Done
})();