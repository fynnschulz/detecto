(() => {
  "use strict";
  // ============================================================
  // Protecto STEALTH — Pro-Level Network Cloak (MAIN world)
  // Scope: Timing jitter, fake responses, dummy cookies, sendBeacon
  // Design goals:
  //  • Act only on suspicious third‑party tracking endpoints
  //  • Return plausible responses (image/json/text/204) with realistic timing
  //  • Be deterministic per domain+UA to avoid detectable randomness
  //  • Never throw; degrade gracefully
  // ============================================================

  // -------------------------
  // Deterministic RNG (seed = host + UA)
  // -------------------------
  function h32(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619);} h+=h<<13; h^=h>>>7; h+=h<<3; h^=h>>>17; h+=h<<5; return h>>>0; }
  function mulberry32(seed){ return function(){ let t=(seed+=0x6D2B79F5); t=Math.imul(t^(t>>>15), t|1); t^=t+Math.imul(t^(t>>>7), t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
  const SEED = h32(location.hostname + "§" + navigator.userAgent);
  const RAND = mulberry32(SEED);
  const randInt = (min,max)=>Math.floor(RAND()*(max-min+1))+min;
  const gauss = (mu=120,sigma=40)=>{ let u=1-RAND(); let v=RAND(); let z=Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); return Math.max(20, Math.round(mu + z*sigma)); };

  // -------------------------
  // Utils
  // -------------------------
  const hostFromUrl = (u)=>{ try{ return new URL(u, location.href).hostname.replace(/^www\./,''); }catch{ return ""; } };
  const sameSite = (a,b)=> a && b && a === b;
  const nowISO = ()=> new Date().toUTCString();

  // -------------------------
  // Classification of suspicious endpoints
  // -------------------------
  const SUSP_PATH = /(?:^|[\/?#])(?:pixel|track|collect|beacon|stats?|metrics?|measure|event|log|g\/collect|r\/collect)(?:[\/?#]|$)/i;
  const SUSP_QUERY = /(utm_[a-z]+|fbclid|gclid|msclkid|dclid|yclid|mc_eid)=/i;
  const IMG_EXT = /\.(gif|png|jpg|jpeg|webp)\b/i;
  const JSON_EXT = /\.(json)\b/i;
  const JS_EXT = /\.(js)\b/i;

  const KNOWN_TRACKER_HOST_PARTS = [
    'google-analytics.com','analytics.google.com','googletagmanager.com','doubleclick.net','g.doubleclick.net',
    'connect.facebook.net','facebook.com','graph.facebook.com','stats.g.doubleclick.net',
    'segment.com','cdn.segment.com','api.segment.io','intercom.io','static.hotjar.com','script.hotjar.com',
    'snap.','ads-twitter.com','t.co','ads.linkedin.com','px.ads.linkedin.com','bat.bing.com','clarity.ms',
    'mixpanel.com','api.mixpanel.com','amplitude.com','api.amplitude.com','app.pendo.io','cdn.pendo.io',
    'matomo.','piwik.','adservice.','pixel.','metrics.','stats.','beacon.'
  ];

  function looksSuspicious(url){
    const h = hostFromUrl(url);
    if (!h) return false;
    const first = location.hostname.replace(/^www\./,'');
    if (sameSite(h, first)) return false; // only third‑party here
    if (KNOWN_TRACKER_HOST_PARTS.some(part => h.includes(part))) return true;
    if (SUSP_PATH.test(url) || SUSP_QUERY.test(url)) return true;
    return false;
  }

  // -------------------------
  // Dummy cookies (domain‑scoped, harmless)
  // -------------------------
  function setDummyCookies() {
    try {
      const attrs = `; path=/; max-age=${60*60*24*365}; SameSite=Lax`;
      document.cookie = `ga=FAKE_${SEED.toString(16).slice(0,8)}${attrs}`;
      document.cookie = `_fbp=fb.1.${Date.now()}.${SEED.toString(16).slice(0,8)}${attrs}`;
      document.cookie = `amplitude_id=${SEED.toString(36)}${attrs}`;
    } catch {}
  }
  setDummyCookies();

  // -------------------------
  // Fake response factories
  // -------------------------
  const PIXEL_BYTES = Uint8Array.from(atob("R0lGODlhAQABAAAAACH5BAEKAAEA"), c => c.charCodeAt(0));
  function fakePixel() {
    return new Response(PIXEL_BYTES, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store",
        "Date": nowISO(),
        "X-Protecto": "pixel"
      }
    });
  }
  function fakeJson(obj = {}) {
    const body = JSON.stringify(obj);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Date": nowISO(),
        "X-Protecto": "json"
      }
    });
  }
  function fake204() {
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store", "Date": nowISO(), "X-Protecto": "no-content" }
    });
  }
  function fakeText(txt = "OK") {
    return new Response(txt, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Date": nowISO(), "X-Protecto": "text" }
    });
  }

  // Endpoint‑aware JSON shapes (plausible minimal schemas)
  function shapeFor(url){
    const h = hostFromUrl(url);
    if (/google-analytics|analytics.google/.test(h)) return { status: "ok" };
    if (/googletagmanager/.test(h)) return { gtm: "ok" };
    if (/facebook\.com|connect\.facebook/.test(h)) return { success: true };
    if (/segment|mixpanel|amplitude/.test(h)) return { received: true };
    if (/clarity\.ms|bing/.test(h)) return { ping: true };
    return {};
  }

  // -------------------------
  // Timing
  // -------------------------
  function delayFor(url){
    // Slightly vary delay by resource type
    if (IMG_EXT.test(url) || /pixel|beacon|collect/.test(url)) return gauss(90, 30);
    if (JSON_EXT.test(url) || /analytics|metrics|event/.test(url)) return gauss(130, 40);
    if (JS_EXT.test(url)) return gauss(110, 35);
    return gauss(120, 40);
  }
  const sleep = (ms)=>new Promise(r=>setTimeout(r, ms));

  // -------------------------
  // fetch() cloak
  // -------------------------
  const origFetch = window.fetch;
  window.fetch = async function(input, init) {
    try {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      if (url && looksSuspicious(url)) {
        await sleep(delayFor(url));
        // Choose plausible reply by method/content
        const method = (init && (init.method||"GET")).toUpperCase();
        if (method === "POST") return fake204();
        if (IMG_EXT.test(url) || /pixel|beacon|collect/.test(url)) return fakePixel();
        if (JSON_EXT.test(url) || /analytics|metrics|event/.test(url)) return fakeJson(shapeFor(url));
        // default fallback minimal text
        return fakeText();
      }
    } catch {}
    return origFetch.apply(this, arguments);
  };

  // -------------------------
  // XMLHttpRequest cloak
  // -------------------------
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  function dataUrlForXHR(url, method){
    const m = (method || 'GET').toUpperCase();
    if (m === 'POST') return 'data:text/plain,OK';
    if (IMG_EXT.test(url) || /pixel|beacon|collect/.test(url)) {
      return 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEA';
    }
    if (JSON_EXT.test(url) || /analytics|metrics|event/.test(url)) {
      // minimal valid JSON
      return 'data:application/json,%7B%7D';
    }
    return 'data:text/plain,OK';
  }

  XMLHttpRequest.prototype.open = function(method, url) {
    try {
      if (url && looksSuspicious(url)) {
        const replacement = dataUrlForXHR(url, method);
        return origOpen.call(this, method, replacement);
      }
    } catch {}
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function(body) {
    return origSend.apply(this, arguments);
  };

  // -------------------------
  // navigator.sendBeacon cloak
  // -------------------------
  if (navigator.sendBeacon) {
    const origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function(url, data) {
      try {
        if (url && looksSuspicious(url)) {
          // Pretend success without network
          return true; // boolean per spec
        }
      } catch {}
      return origBeacon(url, data);
    };
  }

  // Done
})();