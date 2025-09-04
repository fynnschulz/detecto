// Hintergrund-Skript von Protecto (MV3)
let pixelBlockerEnabled = false;
let fingerprintInjected = false;
let pixelBlockerListener = null;
let pixelRedirectListener = null;

// --- Risk Engine State ---
importScripts("src/risk/engine.js"); // MV3: via importScripts
importScripts("src/risk/history.js");
let domainSignals = {}; // { [domain]: { thirdPartyHosts, pixelHits, suspiciousUrls, setCookieLong, setCookieNoneSecure, fingerprintCalls, cmp:{...} } }

function ensureDomain(d) {
  if (!domainSignals[d]) domainSignals[d] = {
    thirdPartyHosts: 0, pixelHits: 0, suspiciousUrls: 0,
    setCookieLong: false, setCookieNoneSecure: false,
    fingerprintCalls: 0, cmp: { hasLegit: false, onlyNecessary: false }
  };
  return domainSignals[d];
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log("Protecto Extension installiert!");

  // Kleines Health-Log: Welche statischen Regeln sind aktiv?
  const rules = await chrome.declarativeNetRequest.getEnabledRulesets();
  console.log("[Protecto] Enabled rulesets:", rules);

  // Beispiel (optional) für dynamische Regeln:
  // await chrome.declarativeNetRequest.updateDynamicRules({
  //   addRules: [
  //     {
  //       id: 10001,
  //       priority: 1,
  //       action: { type: "block" },
  //       condition: { urlFilter: "example-tracker.test", resourceTypes: ["xmlhttprequest", "script"] }
  //     }
  //   ],
  //   removeRuleIds: [10001]
  // });
});

// Bei jedem Browser-Start Regeln prüfen
chrome.runtime.onStartup?.addListener(async () => {
  const rules = await chrome.declarativeNetRequest.getEnabledRulesets();
  console.log("[Protecto] Startup rulesets:", rules);
});

// Nachrichten vom Popup empfangen und Regeln setzen
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "policy:apply") {
    const { domain, policy } = msg;
    console.log("[Protecto] Policy für", domain, "→", policy);
    await applyPolicyForDomain(domain, policy);
  }

  if (msg.type === "risk:signal") {
    const d = msg.domain;
    const ref = ensureDomain(d);
    if (typeof msg.fingerprintCalls === "number") {
      ref.fingerprintCalls += msg.fingerprintCalls;
    }
    if (msg.cmp) {
      ref.cmp.hasLegit      = ref.cmp.hasLegit || !!msg.cmp.hasLegit;
      ref.cmp.onlyNecessary = ref.cmp.onlyNecessary || !!msg.cmp.onlyNecessary;
    }
    sendResponse?.({ ok: true });
  }

  if (msg.type === "risk:get") {
    const d = msg.domain;
    const ref = ensureDomain(d);
    try {
      if (self.getHistory) {
        ref.history = await self.getHistory(d);
      }
    } catch {}
    const res = self.computeRisk(ref);
    sendResponse?.(res);
  }

  return true;
});

function getHeader(headers, name) {
  if (!headers) return null;
  const l = name.toLowerCase();
  for (const h of headers) {
    if (h.name && h.name.toLowerCase() === l) return h;
  }
  return null;
}

function hostFromUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function apex(host) {
  try {
    const parts = (host || "").split(".");
    if (parts.length <= 2) return host;
    return parts.slice(-2).join(".");
  } catch { return host; }
}
function hasSuspiciousPathOrQuery(url) {
  try {
    const u = url.toLowerCase();
    const pathMatch = /[\/?#](pixel|track|collect|beacon|stats|metrics|measure|event|log|g\/.?collect|r\/.?collect)([\/?#]|$)/.test(u);
    const qMatch    = /(utm_[a-z]+|fbclid|gclid|msclkid|dclid|yclid|mc_eid)=/.test(u);
    return pathMatch || qMatch;
  } catch { return false; }
}

function isSuspiciousTiny(details) {
  const url = (details.url || "").toLowerCase();
  const targetHost = hostFromUrl(url);
  const initiatorHost = hostFromUrl(details.initiator || details.originUrl || "");

  // nur Third‑Party prüfen
  if (initiatorHost && targetHost && initiatorHost === targetHost) return false;

  const hCL = getHeader(details.responseHeaders, "content-length");
  const hCT = getHeader(details.responseHeaders, "content-type");
  const len = hCL ? parseInt(hCL.value) : NaN;
  const type = hCT?.value ? hCT.value.toLowerCase() : "";

  // eindeutige False‑Positives ausschließen
  if (url.includes("/favicon.ico") || url.includes("apple-touch-icon") || url.endsWith(".webmanifest") || url.endsWith("/robots.txt") || url.endsWith("/sitemap.xml")) return false;

  // Verdächtige URL‑Muster
  const suspiciousPath = /[\/?](pixel|track|collect|beacon|stats|metrics)([/?#]|$)/.test(url);
  const suspiciousQuery = /(utm_[a-z]+|fbclid|gclid|msclkid|dclid|yclid|mc_eid)=/.test(url);

  // Kleine Antworten (typische 1x1 oder Beacon payloads)
  const tiny = Number.isFinite(len) && len > 0 && len < 200; // 200B Schwelle

  // Typische MIME‑Typen für Pixel/Beacon
  const isImageTiny = type.startsWith("image/") && tiny;
  const isPlainTiny = (type.startsWith("text/plain") || type.startsWith("application/json")) && tiny;

  // Blocke nur, wenn Muster + Größe zusammenkommen → präziser, weniger False‑Positives
  if ((isImageTiny || isPlainTiny) && (suspiciousPath || suspiciousQuery)) {
    return true;
  }

  return false;
}

async function applyPolicyForDomain(domain, policy) {
  const removeIds = [2000, 2001, 2002, 2003, 2004, 2005, 2006];
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds });

  const addRules = [];

  if (policy === "strict") {
    addRules.push({
      id: 2000,
      priority: 1,
      action: { type: "block" },
      condition: { initiatorDomains: [domain], urlFilter: "doubleclick.net" }
    });
    addRules.push({
      id: 2001,
      priority: 1,
      action: { type: "block" },
      condition: { initiatorDomains: [domain], urlFilter: "google-analytics.com" }
    });

    if (!pixelBlockerEnabled) {
      pixelBlockerListener = (details) => {
        try {
          if (isSuspiciousTiny(details)) {
            console.log("[Protecto] Blocked suspicious tiny request:", details.url);
            return { cancel: true };
          }
        } catch (e) {
          console.warn("[Protecto] pixel heuristic error", e);
        }
      };
      chrome.webRequest.onHeadersReceived.addListener(
        pixelBlockerListener,
        { urls: ["<all_urls>"] },
        ["blocking", "responseHeaders"]
      );
      pixelBlockerEnabled = true;
    }

    // Redirect suspicious tracker requests to a 1x1 pixel (stealth, no ERR_BLOCKED)
    if (!pixelRedirectListener) {
      pixelRedirectListener = (details) => {
        try {
          const url = details.url || "";
          const targetHost = hostFromUrl(url);
          const initiatorHost = hostFromUrl(details.initiator || details.originUrl || "");
          if (!targetHost || !initiatorHost) return {};
          // third-party only
          if (initiatorHost === targetHost) return {};
          if (!hasSuspiciousPathOrQuery(url)) return {};
          // mark signal for initiator domain
          const d = initiatorHost;
          const ref = ensureDomain(d);
          ref.pixelHits = (ref.pixelHits || 0) + 1;
          ref.pixelRedirects = (ref.pixelRedirects || 0) + 1;
          return { redirectUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEA" };
        } catch (e) { return {}; }
      };
      chrome.webRequest.onBeforeRequest.addListener(
        pixelRedirectListener,
        { urls: ["<all_urls>"] },
        ["blocking"]
      );
    }

    // Inject strict-mode shims only in strict mode (MAIN world)
    if (!fingerprintInjected) {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        for (const tab of tabs) {
          if (tab.id) {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              world: "MAIN",
              files: ["src/shims/fingerprints.js", "src/shims/cloak.js", "src/shims/stealth.js"]
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
    if (pixelBlockerEnabled) {
      try {
        if (pixelBlockerListener) {
          chrome.webRequest.onHeadersReceived.removeListener(pixelBlockerListener);
          pixelBlockerListener = null;
        }
      } catch {}
      pixelBlockerEnabled = false;
    }
    if (pixelRedirectListener) {
      try { chrome.webRequest.onBeforeRequest.removeListener(pixelRedirectListener); } catch {}
      pixelRedirectListener = null;
    }
    // Reset fingerprint injection flag for non-strict
    fingerprintInjected = false;
  }

  if (policy === "standard") {
    addRules.push({
      id: 2002,
      priority: 1,
      action: { type: "block" },
      condition: { initiatorDomains: [domain], urlFilter: "google-analytics.com" }
    });
  }

  if (policy === "soft") {
    console.log("[Protecto] Soft Mode: lockert Schutz für", domain);

    // Bestimmte Login-/Consent-Domains explizit erlauben
    addRules.push({
      id: 2004,
      priority: 1,
      action: { type: "allow" },
      condition: { initiatorDomains: [domain], urlFilter: "accounts.google.com" }
    });
    addRules.push({
      id: 2005,
      priority: 1,
      action: { type: "allow" },
      condition: { initiatorDomains: [domain], urlFilter: "staticxx.facebook.com" }
    });
    addRules.push({
      id: 2006,
      priority: 1,
      action: { type: "allow" },
      condition: { initiatorDomains: [domain], urlFilter: "consent.cookiebot.com" }
    });
  }

  if (policy === "off") {
    addRules.push({
      id: 2003,
      priority: 1,
      action: { type: "allowAllRequests" },
      condition: { initiatorDomains: [domain] }
    });
  }

  if (addRules.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules });
  }
}

// Passiv: zähle Third-Party & verdächtige URLs (für alle Policies)
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    try {
      const url = details.url || "";
      const target = hostFromUrl(url);
      const initiator = hostFromUrl(details.initiator || details.originUrl || "");
      if (!target) return;

      const d = initiator || target;
      const ref = ensureDomain(d);

      if (initiator && target && initiator !== target) {
        ref.thirdPartyHosts = Math.min((ref.thirdPartyHosts || 0) + 1, 999);
      }

      // Heuristic CNAME cloaking: same apex but suspicious subdomain and tracking path/query
      const apexInitiator = apex(initiator);
      const apexTarget = apex(target);
      if (apexInitiator && apexTarget && apexInitiator === apexTarget) {
        const sub = (target || "").split(".").slice(0, -2).join(".");
        if (sub && /(metrics|stats|track|pixel|links|email|news|events)/i.test(sub) && hasSuspiciousPathOrQuery(url)) {
          ref.cnameCloak = true;
        }
      }

      const hasSusp = /[\/?](pixel|track|collect|beacon|stats|metrics)([/?#]|$)/i.test(url) ||
                      /(utm_[a-z]+|fbclid|gclid|msclkid|dclid|yclid|mc_eid)=/i.test(url);
      if (hasSusp) ref.suspiciousUrls = (ref.suspiciousUrls || 0) + 1;

      if (isSuspiciousTiny(details)) ref.pixelHits = (ref.pixelHits || 0) + 1;

      const setCookie = details.responseHeaders?.filter(h => h.name?.toLowerCase() === "set-cookie") || [];
      for (const sc of setCookie) {
        const v = (sc.value || "").toLowerCase();
        if (/max-age=\s*(3\\d{2}|[4-9]\\d{2,})/.test(v) || /expires=/.test(v)) {
          ref.setCookieLong = true;
        }
        if (v.includes("samesite=none") && v.includes("secure")) {
          ref.setCookieNoneSecure = true;
        }
      }
    } catch {}
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);