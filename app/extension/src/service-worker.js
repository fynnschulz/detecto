// --- Protecto Risk Engine bootstrap ---
try {
  importScripts("risk/engine.js");
  importScripts("risk/history.js");
  importScripts("engine/adaptive.js"); // NEW: adaptive learning redirect engine
  console.log("[Protecto] Risk engine loaded:", typeof self.computeRisk);
} catch (e) {
  console.error("[Protecto] Risk engine failed to load", e);
  self.computeRisk = () => ({ score: 0, level: "low", recommend: "soft", reasons: ["engine-not-loaded"] });
}

// Track whether strict shims were injected for the current active tab
let fingerprintInjected = false;

// --- Adaptive Cleanup Scheduler (every 30 days) ---
const CLEANUP_ALARM = "protecto-cleanup";
const THIRTY_DAYS_MIN = 30 * 24 * 60; // 43,200 minutes

async function scheduleCleanupAlarm() {
  try {
    // Create or update repeating alarm (Chrome replaces if same name)
    await chrome.alarms.create(CLEANUP_ALARM, { periodInMinutes: THIRTY_DAYS_MIN });
    console.log("[Protecto][Adaptive] cleanup alarm scheduled (every 30 days)");
  } catch (e) {
    console.warn("[Protecto][Adaptive] failed to schedule alarm", e);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleCleanupAlarm();
  // Optional: run one initial cleanup on install
  if (self.adaptive?.cleanupLearned) {
    self.adaptive.cleanupLearned({ maxAgeDays: 30, maxEntries: 5000 }).catch(()=>{});
  }
});

chrome.runtime.onStartup.addListener(() => {
  scheduleCleanupAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm?.name !== CLEANUP_ALARM) return;
  if (!self.adaptive?.cleanupLearned) return;
  self.adaptive.cleanupLearned({ maxAgeDays: 30, maxEntries: 5000 })
    .then(({ removed, remaining }) => {
      console.log(`[Protecto][Adaptive] cleanup done – removed:${removed}, remaining:${remaining}`);
    })
    .catch((e) => console.warn("[Protecto][Adaptive] cleanup error", e));
});

// Shared signal storage per domain
self.domainSignals = self.domainSignals || {};
function ensureDomain(d) {
  if (!self.domainSignals[d]) {
    self.domainSignals[d] = {
      thirdPartyHosts: 0,
      pixelHits: 0,
      suspiciousUrls: 0,
      setCookieLong: false,
      setCookieNoneSecure: false,
      fingerprintCalls: 0,
      suspiciousHeaders: 0,
      tinyResponses: 0,
      // NEW: telemetry counters
      riskyRequests: 0,        // all 3rd‑party requests of risky types
      redirectedRequests: 0,   // matched DNR redirects
      cmp: { hasLegit: false, onlyNecessary: false }
    };
  }
  return self.domainSignals[d];
}

// --- Auto‑Tuning (miss detection) -----------------------------------------
// We mark which requests were redirected (via onRuleMatchedDebug). Any risky
// 3rd‑party request that completes without a redirect counts as a "miss" for
// its host. When a host exceeds a threshold within a rolling window, we
// auto‑learn a dynamic redirect rule for that host.
const matchedRequestIds = new Set();
/**
 * missStats.byHost[host] = { hits: number, times: number[] }
 *  - times is a list of timestamps (ms) of recent misses for rolling window
 */
const missStats = {
  byHost: {},
  windowMs: 24 * 60 * 60 * 1000, // 24h window
  threshold: 10,                 // learn host after >=10 misses in window
};

function pruneMissTimes(arr, now, windowMs) {
  while (arr.length && (now - arr[0]) > windowMs) arr.shift();
  return arr;
}

async function noteMissForHost(pageHost, reqHost, type) {
  try {
    if (!reqHost || !pageHost || reqHost === pageHost) return;
    if (!isRiskyType(type)) return;

    // Respect user policy: only when not "off"
    if (self.adaptive) {
      const active = await self.adaptive.isPolicyActiveFor(pageHost);
      if (!active) return;
    }

    const now = Date.now();
    const entry = (missStats.byHost[reqHost] ||= { hits: 0, times: [] });
    pruneMissTimes(entry.times, now, missStats.windowMs);
    entry.times.push(now);
    entry.hits = entry.times.length;

    if (entry.hits >= missStats.threshold && self.adaptive?.maybeLearnAndRedirectHost) {
      // Learn dynamic redirect rule for this host (type determines stub vs data URL)
      try {
        await self.adaptive.maybeLearnAndRedirectHost(reqHost, type);
        // reset window for this host after learning to prevent thrashing
        entry.times = [];
        entry.hits = 0;
        console.log("[Protecto][AutoTune] Learned host:", reqHost, "type:", type);
      } catch (e) {
        console.warn("[Protecto][AutoTune] learn failed for", reqHost, e);
      }
    }
  } catch (e) {
    console.warn("[Protecto][AutoTune] noteMissForHost error", e);
  }
}
function hostFromUrl(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function isRiskyType(t) {
  const k = String(t || "").toLowerCase();
  return k === "image" || k === "xmlhttprequest" || k === "fetch" || k === "ping" || k === "script";
}

// Increment selected domain signals in a safe way
function bumpSignalsFor(domain, inc = {}) {
  const ref = ensureDomain(domain);
  if (inc.suspiciousUrls) ref.suspiciousUrls = (ref.suspiciousUrls || 0) + inc.suspiciousUrls;
  if (inc.pixelHits)      ref.pixelHits      = (ref.pixelHits || 0)      + inc.pixelHits;
  if (inc.tinyResponses)  ref.tinyResponses  = (ref.tinyResponses || 0)  + inc.tinyResponses;
}

// Detect tiny responses using headers (fallback heuristic for beacons/pixels)
function isSuspiciousTinyFromHeaders(details) {
  try {
    const headers = details.responseHeaders || [];
    const cl = headers.find(h => (h.name||"").toLowerCase() === "content-length");
    if (cl && Number(cl.value) > 0 && Number(cl.value) < 256) return true;
    const ct = headers.find(h => (h.name||"").toLowerCase() === "content-type");
    if (ct && /image\/gif/i.test(ct.value || "")) return true;
  } catch {}
  return false;
}

async function applyPolicyForDomain(domain, policy) {
  // Clear previous dynamic rules for this policy scope
  const removeIds = [];
  for (let i = 2000; i <= 2050; i++) removeIds.push(i);
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds });

  const addRules = [];

  // Helpers for common redirects
  const ONE_BY_ONE = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEA";
  const NOOP_JS   = "data:text/javascript,/*noop*/";

  // Trackers → Stubs (scripts)
  const GA_STUB   = "/src/stubs/ga.js";   // google-analytics
  const GTM_STUB  = "/src/stubs/gtm.js";  // googletagmanager
  const FBQ_STUB  = "/src/stubs/fbq.js";  // facebook pixel

  // ---- Allowlist: echte Framework/CDN-Libs nicht umleiten (höhere Priorität gewinnt) ----
  const ALLOWLIST = [
    { urlFilter: "cdn.jsdelivr.net/npm/react" },
    { urlFilter: "cdn.jsdelivr.net/npm/react-dom" },
    { urlFilter: "cdn.jsdelivr.net/npm/vue" },
    { urlFilter: "cdn.jsdelivr.net/npm/angular" },
    { urlFilter: "cdn.jsdelivr.net/npm/stripe" },
    { urlFilter: "cdn.jsdelivr.net/npm/mapbox-gl" },
    { urlFilter: "unpkg.com/react" },
    { urlFilter: "unpkg.com/vue" },
    { urlFilter: "kit.fontawesome.com" },
    { urlFilter: "cdn.tailwindcss.com" }
  ];
  for (const a of ALLOWLIST) {
    addRules.push({
      id: 20090 + addRules.length % 10, // deterministic enough per domain apply
      priority: 10, // höher als Redirects
      action: { type: "allow" },
      condition: { initiatorDomains: [domain], urlFilter: a.urlFilter, resourceTypes: ["script"] }
    });
  }

  // --- STRICT: aggressiv + generisch ---
  if (policy === "strict") {
    // Google Analytics (analytics.js, gtag.js)
    addRules.push({
      id: 2000, priority: 1,
      action: { type: "redirect", redirect: { extensionPath: GA_STUB } },
      condition: { initiatorDomains: [domain], urlFilter: "google-analytics.com", resourceTypes: ["script"] }
    });
    // Google Tag Manager
    addRules.push({
      id: 2001, priority: 1,
      action: { type: "redirect", redirect: { extensionPath: GTM_STUB } },
      condition: { initiatorDomains: [domain], urlFilter: "googletagmanager.com", resourceTypes: ["script"] }
    });
    // Facebook Pixel
    addRules.push({
      id: 2002, priority: 1,
      action: { type: "redirect", redirect: { extensionPath: FBQ_STUB } },
      condition: { initiatorDomains: [domain], urlFilter: "connect.facebook.net", resourceTypes: ["script"] }
    });
    // Doubleclick / Syndication scripts → noop JS (keine Stubs nötig)
    addRules.push({
      id: 2004, priority: 1,
      action: { type: "redirect", redirect: { url: NOOP_JS } },
      condition: { initiatorDomains: [domain], urlFilter: "doubleclick.net", resourceTypes: ["script","xmlhttprequest","fetch","ping","image"] }
    });
    addRules.push({
      id: 2005, priority: 1,
      action: { type: "redirect", redirect: { url: NOOP_JS } },
      condition: { initiatorDomains: [domain], urlFilter: "googlesyndication.com", resourceTypes: ["script","xmlhttprequest","fetch","ping","image"] }
    });

    // Adservice & Tagservices – schließen weitere JS/XHR Lücken (STRICT)
    addRules.push({
      id: 2006, priority: 1,
      action: { type: "redirect", redirect: { url: NOOP_JS } },
      condition: { initiatorDomains: [domain], urlFilter: "adservice.google.com", resourceTypes: ["script","xmlhttprequest","fetch","ping","image"] }
    });
    addRules.push({
      id: 2007, priority: 1,
      action: { type: "redirect", redirect: { url: NOOP_JS } },
      condition: { initiatorDomains: [domain], urlFilter: "googletagservices.com", resourceTypes: ["script","xmlhttprequest","fetch","ping","image"] }
    });

    // NOOP-Fallback für Loader, die SRI/Integrität o.ä. erzwingen (überstimmt Stubs)
    addRules.push({
      id: 2015, priority: 2,
      action: { type: "redirect", redirect: { url: NOOP_JS } },
      condition: {
        initiatorDomains: [domain],
        regexFilter: "(adsbygoogle\\.js|fbevents\\.js|gtag\\/js)(\\?|/|$)",
        resourceTypes: ["script"]
      }
    });

    // Generische Pixel/Collect/Beacon (image/xhr/ping) → 1x1
    addRules.push({
      id: 2010, priority: 1,
      action: { type: "redirect", redirect: { url: ONE_BY_ONE } },
      condition: { initiatorDomains: [domain], urlFilter: "/collect", resourceTypes: ["image","xmlhttprequest","ping"] }
    });
    addRules.push({
      id: 2011, priority: 1,
      action: { type: "redirect", redirect: { url: ONE_BY_ONE } },
      condition: { initiatorDomains: [domain], urlFilter: "/pixel", resourceTypes: ["image","xmlhttprequest","ping"] }
    });
    addRules.push({
      id: 2012, priority: 1,
      action: { type: "redirect", redirect: { url: ONE_BY_ONE } },
      condition: { initiatorDomains: [domain], urlFilter: "/beacon", resourceTypes: ["image","xmlhttprequest","ping"] }
    });

    // Inject strict-mode shims only in strict mode (MAIN world)
    if (!fingerprintInjected) {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        for (const tab of tabs) {
          if (tab.id) {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id, allFrames: true },
              world: "MAIN",
              files: [
                "src/shims/cmp.js",
                "src/shims/fingerprints.js",
                "src/shims/cloak.js",
                "src/shims/stealth.js",
                "src/shims/netpatch.js"
              ]
            });
            console.log("[Protecto] Injected fingerprints+cloak+stealth shims into", tab.url);
          }
        }
        fingerprintInjected = true;
      } catch (e) {
        console.warn("[Protecto] Failed to inject strict shims:", e);
      }
    }
  } else {
    // Reset fingerprint injection flag for non-strict
    fingerprintInjected = false;
  }

  // Inject CMP shim for STANDARD as well (MAIN world, all frames)
  if (policy === "standard") {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      for (const tab of tabs) {
        if (!tab.id) continue;
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          world: "MAIN",
          files: [
            "src/shims/cmp.js",
            "src/shims/netpatch.js"
          ]
        });
      }
      console.log("[Protecto] Injected CMP shim (standard) into active tab(s)");
    } catch (e) {
      console.warn("[Protecto] Failed to inject CMP shim (standard):", e);
    }
  }

  // --- STANDARD: Kern-Tracker + collect/pixel/beacon ---
  if (policy === "standard") {
    addRules.push({
      id: 2020, priority: 1,
      action: { type: "redirect", redirect: { extensionPath: GA_STUB } },
      condition: { initiatorDomains: [domain], urlFilter: "google-analytics.com", resourceTypes: ["script"] }
    });
    addRules.push({
      id: 2021, priority: 1,
      action: { type: "redirect", redirect: { extensionPath: GTM_STUB } },
      condition: { initiatorDomains: [domain], urlFilter: "googletagmanager.com", resourceTypes: ["script"] }
    });
    addRules.push({
      id: 2022, priority: 1,
      action: { type: "redirect", redirect: { extensionPath: FBQ_STUB } },
      condition: { initiatorDomains: [domain], urlFilter: "connect.facebook.net", resourceTypes: ["script"] }
    });
    addRules.push({
      id: 2023, priority: 1,
      action: { type: "redirect", redirect: { url: ONE_BY_ONE } },
      condition: { initiatorDomains: [domain], urlFilter: "/collect", resourceTypes: ["image","xmlhttprequest","ping"] }
    });
    addRules.push({
      id: 2024, priority: 1,
      action: { type: "redirect", redirect: { url: ONE_BY_ONE } },
      condition: { initiatorDomains: [domain], urlFilter: "/pixel", resourceTypes: ["image","xmlhttprequest","ping"] }
    });
    addRules.push({
      id: 2025, priority: 1,
      action: { type: "redirect", redirect: { url: ONE_BY_ONE } },
      condition: { initiatorDomains: [domain], urlFilter: "/beacon", resourceTypes: ["image","xmlhttprequest","ping"] }
    });

    // Doubleclick & Googlesyndication scripts → hard NOOP (close "Durchläufer" gap)
    addRules.push({
      id: 2026, priority: 1,
      action: { type: "redirect", redirect: { url: NOOP_JS } },
      condition: { initiatorDomains: [domain], urlFilter: "doubleclick.net", resourceTypes: ["script","xmlhttprequest","fetch","ping","image"] }
    });
    addRules.push({
      id: 2027, priority: 1,
      action: { type: "redirect", redirect: { url: NOOP_JS } },
      condition: { initiatorDomains: [domain], urlFilter: "googlesyndication.com", resourceTypes: ["script","xmlhttprequest","fetch","ping","image"] }
    });

    // Zusätzliche generische Beacons (einige Anbieter weichen /collect aus)
    addRules.push({
      id: 2028, priority: 1,
      action: { type: "redirect", redirect: { url: ONE_BY_ONE } },
      condition: { initiatorDomains: [domain], urlFilter: "/track", resourceTypes: ["image","xmlhttprequest","ping"] }
    });
    addRules.push({
      id: 2029, priority: 1,
      action: { type: "redirect", redirect: { url: ONE_BY_ONE } },
      condition: { initiatorDomains: [domain], urlFilter: "/event", resourceTypes: ["image","xmlhttprequest","ping"] }
    });

    // NOOP-Fallback (STANDARD) – überstimmt Stubs für knifflige Loader
    addRules.push({
      id: 2033, priority: 2,
      action: { type: "redirect", redirect: { url: NOOP_JS } },
      condition: {
        initiatorDomains: [domain],
        regexFilter: "(adsbygoogle\\.js|fbevents\\.js|gtag\\/js)(\\?|/|$)",
        resourceTypes: ["script"]
      }
    });

    // Adservice & Tagservices – schließen weitere JS/XHR Lücken (STANDARD)
    addRules.push({
      id: 2037, priority: 1,
      action: { type: "redirect", redirect: { url: NOOP_JS } },
      condition: { initiatorDomains: [domain], urlFilter: "adservice.google.com", resourceTypes: ["script","xmlhttprequest","fetch","ping","image"] }
    });
    addRules.push({
      id: 2038, priority: 1,
      action: { type: "redirect", redirect: { url: NOOP_JS } },
      condition: { initiatorDomains: [domain], urlFilter: "googletagservices.com", resourceTypes: ["script","xmlhttprequest","fetch","ping","image"] }
    });
  }

  // --- SOFT: nur GA/FBQ; Logins/Consent erlauben ---
  if (policy === "soft") {
    // High-risk scripts
    addRules.push({
      id: 2030, priority: 1,
      action: { type: "redirect", redirect: { extensionPath: GA_STUB } },
      condition: { initiatorDomains: [domain], urlFilter: "google-analytics.com", resourceTypes: ["script"] }
    });
    addRules.push({
      id: 2031, priority: 1,
      action: { type: "redirect", redirect: { extensionPath: FBQ_STUB } },
      condition: { initiatorDomains: [domain], urlFilter: "connect.facebook.net", resourceTypes: ["script"] }
    });

    // Whitelisted essentials (Login/Consent)
    addRules.push({
      id: 2034, priority: 1,
      action: { type: "allow" },
      condition: { initiatorDomains: [domain], urlFilter: "accounts.google.com" }
    });
    addRules.push({
      id: 2035, priority: 1,
      action: { type: "allow" },
      condition: { initiatorDomains: [domain], urlFilter: "staticxx.facebook.com" }
    });
    addRules.push({
      id: 2036, priority: 1,
      action: { type: "allow" },
      condition: { initiatorDomains: [domain], urlFilter: "consent.cookiebot.com" }
    });
  }

  // --- OFF: alles erlauben (nur Frames, wie MV3 verlangt) ---
  if (policy === "off") {
    addRules.push({
      id: 2003,
      priority: 1,
      action: { type: "allowAllRequests" },
      condition: { initiatorDomains: [domain], resourceTypes: ["main_frame", "sub_frame"] }
    });
  }

  if (addRules.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules });
  }
}

// --- Adaptive learning (passive) ---
chrome.webRequest.onBeforeRequest.addListener((details) => {
  // Run async without blocking
  (async () => {
    try {
      const { url, initiator, type } = details;
      if (!url || !/^https?:/i.test(url)) return;
      const pageHost = hostFromUrl(initiator || "");
      const reqHost  = hostFromUrl(url);
      if (!reqHost || !pageHost || reqHost === pageHost) return; // only 3rd-party
      // Count all 3rd‑party requests of risky types
      if (isRiskyType(type)) {
        const ref = ensureDomain(pageHost);
        ref.riskyRequests = (ref.riskyRequests || 0) + 1;
      }
      if (!self.adaptive) return;
      const active = await self.adaptive.isPolicyActiveFor(pageHost);
      if (!active) return; // only when Standard/Strict

      if (self.adaptive.looksLikeTrackerUrl(url, type)) {
        await self.adaptive.maybeLearnAndRedirectHost(reqHost, type);
        bumpSignalsFor(pageHost, { suspiciousUrls: 1 });
      }
    } catch (e) {
      console.warn("[Protecto][Adaptive] onBeforeRequest error", e);
    }
  })();
}, { urls: ["<all_urls>"] }, []);
// --- DNR feedback: count redirects matched (requires declarativeNetRequestFeedback) ---
if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
  try {
    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
      try {
        const req = info.request || {};
        const action = info.rule && info.rule.action || {};
        // Only count redirects
        if ((action.type || "").toLowerCase() !== "redirect") return;

        // Identify page (initiator) domain; fall back to request domain
        const pageHost = hostFromUrl(req.initiator || req.documentUrl || "");
        const reqHost  = hostFromUrl(req.url || "");
        const d = pageHost || reqHost;
        if (!d) return;

        // Mark this request as redirected (used to detect misses)
        if (req.requestId) matchedRequestIds.add(req.requestId);

        const ref = ensureDomain(d);
        ref.redirectedRequests = (ref.redirectedRequests || 0) + 1;
      } catch (e) {
        console.warn("[Protecto][Telemetry] onRuleMatchedDebug error", e);
      }
    });
  } catch (e) {
    console.warn("[Protecto] onRuleMatchedDebug not available", e);
  }
}

// --- Passive webRequest Logger (no blocking, only signals) ---
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    try {
      const url = details.url || "";
      const initiator = hostFromUrl(details.initiator || details.originUrl || "");
      const target = hostFromUrl(url);
      const d = initiator || target;
      if (!d) return;
      const ref = ensureDomain(d);

      // Third-party host count
      if (initiator && target && initiator !== target) {
        ref.thirdPartyHosts = Math.min((ref.thirdPartyHosts || 0) + 1, 999);
      }

      // Suspicious paths / query params typical for tracking
      if (/[\/?](pixel|track|collect|beacon|stats|metrics)([\/?#]|$)/i.test(url) ||
          /(utm_[a-z]+|fbclid|gclid|msclkid|dclid|yclid|mc_eid)=/i.test(url)) {
        ref.suspiciousUrls = (ref.suspiciousUrls || 0) + 1;
      }

      // Tiny beacons → trigger adaptive learning (no blocking)
      const tiny = isSuspiciousTinyFromHeaders(details);
      if (tiny) {
        ref.pixelHits = (ref.pixelHits || 0) + 1;
        ref.tinyResponses = (ref.tinyResponses || 0) + 1;
        if (self.adaptive) {
          const activeCheck = self.adaptive.isPolicyActiveFor(initiator);
          Promise.resolve(activeCheck).then((active) => {
            if (!active) return;
            const t = (details.type || '').toLowerCase();
            const reqHost = target;
            if (reqHost && initiator && reqHost !== initiator) {
              self.adaptive.maybeLearnAndRedirectHost(reqHost, t).catch(() => {});
            }
          }).catch(() => {});
        }
      }

      // Set-Cookie indicators
      const setCookie = (details.responseHeaders || []).filter(h => (h.name||"").toLowerCase() === "set-cookie");
      for (const sc of setCookie) {
        const v = (sc.value || "").toLowerCase();
        if (/max-age=\s*(3\d{2}|[4-9]\d{2,})/.test(v) || /expires=/.test(v)) ref.setCookieLong = true;
        if (v.includes("samesite=none") && v.includes("secure")) ref.setCookieNoneSecure = true;
        if (/domain=\./.test(v)) ref.suspiciousHeaders = (ref.suspiciousHeaders || 0) + 1;
      }
    } catch (e) {
      console.warn("[Protecto][Logger] error onHeadersReceived", e);
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    try {
      const url = details.url || "";
      const type = (details.type || "").toLowerCase();
      if (!url || !/^https?:/i.test(url)) return;

      const pageHost = hostFromUrl(details.initiator || details.originUrl || "");
      const reqHost  = hostFromUrl(url);

      // If this request matched a redirect rule, remove the marker and do nothing
      if (details.requestId && matchedRequestIds.has(details.requestId)) {
        matchedRequestIds.delete(details.requestId);
        return;
      }

      // Count as a "miss" only for risky 3rd‑party types
      if (reqHost && pageHost && reqHost !== pageHost && isRiskyType(type)) {
        noteMissForHost(pageHost, reqHost, type);
      }

      // Maintain per‑domain ref (optional: for future use)
      const d = pageHost || reqHost;
      if (!d) return;
      ensureDomain(d); // touch

    } catch (e) {
      console.warn("[Protecto][AutoTune] onCompleted error", e);
    }
  },
  { urls: ["<all_urls>"] }
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    try {
      const url = details.url || "";
      const type = (details.type || "").toLowerCase();
      if (!url || !/^https?:/i.test(url)) return;

      const pageHost = hostFromUrl(details.initiator || details.originUrl || "");
      const reqHost  = hostFromUrl(url);

      // If a redirect rule matched, it's not a miss
      if (details.requestId && matchedRequestIds.has(details.requestId)) {
        matchedRequestIds.delete(details.requestId);
        return;
      }

      if (reqHost && pageHost && reqHost !== pageHost && isRiskyType(type)) {
        noteMissForHost(pageHost, reqHost, type);
      }
    } catch (e) {
      console.warn("[Protecto][AutoTune] onErrorOccurred error", e);
    }
  },
  { urls: ["<all_urls>"] }
);

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  try {
    if (msg.type === "risk:get") {
      const d = (msg.domain || "").replace(/^www\./, "");
      const ref = ensureDomain(d);
      const res = self.computeRisk(ref);
      sendResponse(res || { score: 0, level: "low", recommend: "soft", reasons: [] });
      return true;
    }

    if (msg.type === "risk:signal") {
      const d = (msg.domain || "").replace(/^www\./, "");
      const ref = ensureDomain(d);
      if (typeof msg.fingerprintCalls === "number") {
        ref.fingerprintCalls += msg.fingerprintCalls;
      }
      if (msg.cmp) {
        ref.cmp = ref.cmp || { hasLegit: false, onlyNecessary: false };
        if (typeof msg.cmp.hasLegit === "boolean") ref.cmp.hasLegit = ref.cmp.hasLegit || msg.cmp.hasLegit;
        if (typeof msg.cmp.onlyNecessary === "boolean") ref.cmp.onlyNecessary = ref.cmp.onlyNecessary || msg.cmp.onlyNecessary;
      }
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === "policy:apply") {
      const d = (msg.domain || "").replace(/^www\./, "");
      const pol = msg.policy;
      const st = await chrome.storage.sync.get("policies");
      const policies = st.policies || {};
      policies[d] = pol;
      await chrome.storage.sync.set({ policies });
      await applyPolicyForDomain(d, pol);
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === "adaptive:cleanup") {
      const opts = msg.opts || { maxAgeDays: 30, maxEntries: 5000 };
      if (!self.adaptive?.cleanupLearned) {
        sendResponse({ ok:false, error:"adaptive not loaded" });
        return true;
      }
      try {
        const res = await self.adaptive.cleanupLearned(opts);
        sendResponse({ ok:true, ...res });
      } catch (e) {
        sendResponse({ ok:false, error:String(e) });
      }
      return true;
    }

    if (msg.type === "adaptive:stats") {
      if (!self.adaptive?.getStats) {
        sendResponse({ ok:false, error:"adaptive not loaded" });
        return true;
      }
      try {
        const stats = await self.adaptive.getStats();
        // also attach per-domain counters if a domain was requested
        if (msg.domain) {
          const d = (msg.domain || "").replace(/^www\./, "");
          const ref = ensureDomain(d);
          stats.domain = {
            riskyRequests: ref.riskyRequests || 0,
            redirectedRequests: ref.redirectedRequests || 0
          };
        }
        // Attach local Auto‑Tuning miss stats
        try {
          const totalMissHosts = Object.keys(missStats.byHost || {}).length;
          let totalMisses = 0;
          for (const h in missStats.byHost) totalMisses += (missStats.byHost[h]?.times?.length || 0);
          stats.autoTuning = {
            threshold: missStats.threshold,
            windowMs: missStats.windowMs,
            totalMissHosts,
            totalMisses
          };
        } catch {}
        sendResponse({ ok:true, stats });
      } catch (e) {
        sendResponse({ ok:false, error:String(e) });
      }
      return true;
    }
  } catch (e) {
    console.warn("[Protecto] onMessage error", e);
    try { sendResponse({ ok:false, error: String(e) }); } catch {}
    return true;
  }
});