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
      cmp: { hasLegit: false, onlyNecessary: false }
    };
  }
  return self.domainSignals[d];
}
function hostFromUrl(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
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
      condition: { initiatorDomains: [domain], urlFilter: "doubleclick.net", resourceTypes: ["script"] }
    });
    addRules.push({
      id: 2005, priority: 1,
      action: { type: "redirect", redirect: { url: NOOP_JS } },
      condition: { initiatorDomains: [domain], urlFilter: "googlesyndication.com", resourceTypes: ["script"] }
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
      const initiator = hostFromUrl(details.initiator || details.originUrl || "");
      const target = hostFromUrl(url);
      const d = initiator || target;
      if (!d) return;
      const ref = ensureDomain(d);

      // Extra: treat very small transfers (no Content-Length header) as tiny
      if (details.type === "image" || details.type === "xmlhttprequest" || details.type === "ping") {
        if ((details.fromCache === false) && (details.statusCode >= 200 && details.statusCode < 400)) {
          // No size reliably available here; we already counted via headers above.
        }
      }
    } catch (e) {}
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