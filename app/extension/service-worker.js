// --- Helper: redirectRule ---
// Cleanup: alte block-Regeln entfernen, bevor neue gesetzt werden
chrome.declarativeNetRequest.getDynamicRules((rules) => {
  if (rules.length > 0) {
    const allIds = rules.map(r => r.id);
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: allIds,
      addRules: [] // wir fügen später neue hinzu
    }, () => {
      console.log("[Protecto][CLEANUP] Alte Regeln entfernt:", allIds);
    });
  }
});
function redirectRule(id, urlFilter, stub = "generic.js") {
  if (!stub.endsWith(".js")) stub += ".js";
  return {
    id,
    priority: 1,
    action: { type: "redirect", redirect: { extensionPath: `/stubs/${stub}` } },
    condition: { urlFilter, resourceTypes: ["script","xmlhttprequest","image","ping"] }
  };
}
// app/extension/service-worker.js — MV3 ES Module
// Stealth: Heuristik/KI → DNR Redirect (Stub-Datei) → Ziel sieht 200 OK
// Learning-Cache: Hosts → Session/Dynamic Rules

import { setExternalSeeds, decide, proposeRulesForUrl, nextRuleId } from './engine/model.js';
import { getLearned, remember, ensureDnrRule, stubToPath, restorePersistedRules } from './engine/learn.js';

// ---------- Config ----------
const LEARN_MIN_SEEN_FOR_DNR = 3;
const SESSION_RULE_ID_BASE = 20000;
const SESSION_RULE_ID_MAX = 20999;


const RT_ALL = ['script', 'xmlhttprequest', 'image', 'ping'];
const RT_JS = ['script', 'xmlhttprequest', 'ping'];

// Only allow these resource types in rules.
function sanitizeResourceTypes(types){
  const ALLOWED = new Set(["script","xmlhttprequest","image","ping"]);
  return (types||[]).map(t => t.toLowerCase()).filter(t => ALLOWED.has(t));
}

// ---------- Utils ----------
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./,''); } catch { return ''; } };

async function isNeverProtected(domain) {
  try {
    if (!domain) return false;
    const { neverProtect = [] } = await chrome.storage.sync.get('neverProtect');
    return Array.isArray(neverProtect) && neverProtect.includes(domain);
  } catch { return false; }
}

async function getEffectivePolicy(domain) {
  try {
    const d = (domain||'').replace(/^www\./,'');
    if (await isNeverProtected(d)) return 'off';
    const st = await chrome.storage.sync.get('policies');
    let pol = (st.policies||{})[d] || (st.policies||{})['*'] || 'on';
    return pol === 'off' ? 'off' : 'on';
  } catch { return 'on'; }
}

// ---------- Seeds Loader ----------
async function loadSeedsIntoModel() {
  try {
    const url = chrome.runtime.getURL('seeds.json');
    const seeds = await fetch(url).then(r => r.json());
    if (typeof setExternalSeeds === 'function') {
      setExternalSeeds(seeds);
      const families = seeds?.families || {};
      console.info('[Protecto][Seeds] Loaded families:', Object.keys(families).length);
    } else if (self && typeof self.setExternalSeeds === 'function') {
      self.setExternalSeeds(seeds);
      const families = seeds?.families || {};
      console.info('[Protecto][Seeds] Loaded families:', Object.keys(families).length);
    }
  } catch (e) {
    console.warn('[Protecto][Seeds] load failed', e);
  }
}
chrome.runtime.onInstalled.addListener(loadSeedsIntoModel);
chrome.runtime.onStartup.addListener(loadSeedsIntoModel);

// ---------- Heuristic Rules ----------
function buildHeuristicRulesForDomain(domain) {
  const id = (n) => SESSION_RULE_ID_BASE + n;
  const init = [domain];
  const rules = [];
  let cursor = 0;

  // Harte Allowlist: keine Session-Regeln erzeugen, wenn der Initiator selbst ein essenzielles CDN ist
  const ALLOWLIST = [
    "cdn.jsdelivr.net","unpkg.com","cdnjs.cloudflare.com","cdn.skypack.dev",
    "static.cloudflareinsights.com",
    "js.stripe.com","maps.googleapis.com","api.mapbox.com",
    "recaptcha.net","www.google.com","www.gstatic.com"
  ];
  if (ALLOWLIST.some(a => (domain||"").endsWith(a))) {
    return [];
  }

  // bekannte Tracker-Domains
  const trackers = [
    'doubleclick.net','googlesyndication.com','googleadservices.com',
    'googletagservices.com','googletagmanager.com','google-analytics.com',
    'analytics.google.com','facebook.net','facebook.com','assets.adobedtm.com',
    'cdn.segment.com','cdn.mxpnl.com','cdn.amplitude.com','cdn.heapanalytics.com',
    'bat.bing.com','static.ads-twitter.com','analytics.tiktok.com','snap.licdn.com',
    's.pinimg.com','sc-static.net','secure.quantserve.com','static.criteo.net',
    'cdn.taboola.com','widgets.outbrain.com','edge.fullstory.com','mc.yandex.ru',
    'js.hs-analytics.net','widget.intercom.io','js-agent.newrelic.com',
    'browser.sentry-cdn.com','www.datadoghq-browser-agent.com'
  ];

  for (const df of trackers) {
    rules.push({
      id: id(cursor++), priority: 1,
      condition: { initiatorDomains: init, urlFilter: df, resourceTypes: sanitizeResourceTypes(RT_JS) },
      action: { type: 'redirect', redirect: { extensionPath: stubToPath(df) || '/stubs/generic.js' } }
    });
  }

  // typische Path-Muster
  const patterns = [
    'gtm.js','fbevents.js','/analytics.js','/gtag/js','/g/collect','/collect',
    '/pixel','/beacon','/events','/event','/track','/tracking',
    '/metrics','/stats','/log','/pagead/','/ads/','/adservice'
  ];
  for (const pf of patterns) {
    rules.push(redirectRule(id(cursor++), pf, "generic.js"));
  }

  const ONE_BY_ONE_GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEA';
  const EMPTY_JSON = 'data:application/json,{}';

  // pixel/ping beacons redirect to 1x1 gif
  const pixelPaths = ['/pixel', '/beacon', '/events', '/event', '/track', '/tracking', '/metrics', '/stats', '/log'];
  for (const path of pixelPaths) {
    rules.push({
      id: id(cursor++), priority: 1,
      condition: { initiatorDomains: init, urlFilter: path, resourceTypes: sanitizeResourceTypes(['image', 'ping']) },
      action: { type: 'redirect', redirect: { url: ONE_BY_ONE_GIF } }
    });
  }

  // xhr beacons redirect to empty json
  const xhrBeaconHints = ['/collect', '/events', '/event', '/track', '/tracking', '/metrics', '/stats', '/log'];
  for (const path of xhrBeaconHints) {
    rules.push({
      id: id(cursor++), priority: 1,
      condition: { initiatorDomains: init, urlFilter: path, resourceTypes: sanitizeResourceTypes(['xmlhttprequest']) },
      action: { type: 'redirect', redirect: { url: EMPTY_JSON } }
    });
  }

  // query parameter hints redirect to 1x1 gif or empty json
  const queryHints = ['gclid', 'fbclid', 'msclkid', 'yclid', 'dclid', 'utm_'];
  for (const hint of queryHints) {
    rules.push({
      id: id(cursor++), priority: 1,
      condition: { initiatorDomains: init, urlFilter: hint, resourceTypes: sanitizeResourceTypes(['image', 'ping']) },
      action: { type: 'redirect', redirect: { url: ONE_BY_ONE_GIF } }
    });
    rules.push({
      id: id(cursor++), priority: 1,
      condition: { initiatorDomains: init, urlFilter: hint, resourceTypes: sanitizeResourceTypes(['xmlhttprequest']) },
      action: { type: 'redirect', redirect: { url: EMPTY_JSON } }
    });
  }

  const maxCount = SESSION_RULE_ID_MAX - SESSION_RULE_ID_BASE + 1;
  return rules.slice(0, maxCount);
}

// ---------- Session Rules ----------
async function applySessionRulesForTab(tab) {
  try {
    const url = tab.url || '';
    const pageHost = hostOf(url);
    if (!pageHost) return;

    const pol = await getEffectivePolicy(pageHost);
    if (pol === 'off') {
      await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: rangeIds() });
      return;
    }

    // Build heuristic rules first
    const heuristicRules = buildHeuristicRulesForDomain(pageHost);

    // Learned rules start AFTER heuristic rules to avoid ID collisions
    const learned = await getLearned();
    const learnedRules = [];
    let baseOffset = heuristicRules.length + 10; // small buffer
    let nextId = SESSION_RULE_ID_BASE + baseOffset;
    const maxId = SESSION_RULE_ID_MAX;

    for (const [host, ent] of Object.entries(learned || {})) {
      if (!ent?.stub) continue;
      if (nextId > maxId) break; // stop if we run out of ID space
      learnedRules.push({
        id: nextId++, priority: 1,
        condition: { initiatorDomains: [pageHost], urlFilter: host, resourceTypes: sanitizeResourceTypes(RT_ALL) },
        action: { type: 'redirect', redirect: { extensionPath: stubToPath(ent.stub) || '/stubs/generic.js' } }
      });
    }

    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: rangeIds(),
      addRules: [...heuristicRules, ...learnedRules]
    });
  } catch {}
}

function rangeIds() {
  return Array.from({length: (SESSION_RULE_ID_MAX - SESSION_RULE_ID_BASE + 1)}, (_,i)=>SESSION_RULE_ID_BASE+i);
}

// ---------- Lifecycle ----------
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if ((changeInfo.status === 'loading' || changeInfo.status === 'complete') && tab.active && tab.url) {
    applySessionRulesForTab(tab);
  }
});
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try { const tab = await chrome.tabs.get(tabId); if (tab?.url) applySessionRulesForTab(tab); } catch {}
});
chrome.runtime.onStartup.addListener(async () => {
  try {
    await loadSeedsIntoModel();
    await restorePersistedRules();
    await ensureBaselineDynamicRules();     // falls etwas fehlte
    await ensureStartupSessionCatchalls();  // universelle Sofort-Abdeckung
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab?.url) applySessionRulesForTab(tab);
    }
  } catch {}
});
chrome.runtime.onInstalled.addListener(async () => {
  try {
    await loadSeedsIntoModel();
    await restorePersistedRules();
    await ensureBaselineDynamicRules(); // persistenter First-Millisecond-Schutz
  } catch {}
});

// ---------- Lernen über DNR-Feedback ----------

// ---------- Popup IPC ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'policy:get') {
        const pol = await getEffectivePolicy(msg.domain||'');
        sendResponse({ ok:true, policy: pol }); return;
      }
      if (msg?.type === 'policy:set') {
        const d = (msg.domain||'').replace(/^www\./,'');
        const pol = (msg.policy==='off')?'off':'on';
        const st = await chrome.storage.sync.get('policies');
        const policies = st.policies || {}; policies[d] = pol;
        await chrome.storage.sync.set({ policies });
        sendResponse({ ok:true }); return;
      }
      if (msg?.type === 'learned:list') {
        const data = await getLearned();
        sendResponse({ ok:true, learned: data }); return;
      }
      if (msg?.type === 'neverProtect:add') {
        const d = (msg.domain||'').replace(/^www\./,'');
        const st = await chrome.storage.sync.get('neverProtect');
        const arr = Array.isArray(st.neverProtect)? st.neverProtect : [];
        if (!arr.includes(d)) arr.push(d);
        await chrome.storage.sync.set({ neverProtect: arr });
        sendResponse({ ok:true }); return;
      }
      if (msg?.type === 'neverProtect:remove') {
        const d = (msg.domain||'').replace(/^www\./,'');
        const st = await chrome.storage.sync.get('neverProtect');
        const arr = (Array.isArray(st.neverProtect)? st.neverProtect : []).filter(x=>x!==d);
        await chrome.storage.sync.set({ neverProtect: arr });
        sendResponse({ ok:true }); return;
      }
    } catch(e) { sendResponse({ ok:false, error:String(e) }); }
  })();
  return true;
});

// ===== Baseline First-Millisecond Protection =====

// Known stubs available in /stubs. If a requested stub is not in this set, we fall back to "generic".
const KNOWN_STUBS = new Set([
  "generic","gtm","ga","fbq",
  "clarity","hotjar","yandex","matomo",
  "criteo_q","_taboola","outbrain","quantcast",
  "segment","mixpanel","amplitude","heap",
  "fullstory","adobe","hubspot","intercom",
  "newrelic","datadog-rum","sentry","optimizely","vwo",
  "pintrk","snaptr","rdt","qp","ttq","twq","lintrk","uetq"
]);

function ensureStub(name){ return KNOWN_STUBS.has(String(name||"").trim()) ? name : "generic"; }

// Eindeutige ID-Bereiche nur für Baseline:
const BASELINE_RULE_IDS = {
  dynamicStart: 40000, // persistente Dynamic Rules
  sessionStart: 41000  // Session Catchalls
};

// Baseline-Domains → bevorzugter Stub
const BASELINE_FAMILIES = [
  // Google family
  { host: "googletagmanager.com",     stub: "gtm",      types: ["script"] },
  { host: "google-analytics.com",     stub: "ga",       types: ["script","xmlhttprequest"] },
  { host: "analytics.google.com",     stub: "ga",       types: ["script"] },
  { host: "doubleclick.net",          stub: "generic",  types: ["script","image","xmlhttprequest","ping"] },
  { host: "googlesyndication.com",    stub: "generic",  types: ["script","image","xmlhttprequest","ping"] },
  { host: "googleadservices.com",     stub: "generic",  types: ["script","image","xmlhttprequest","ping"] },
  { host: "googletagservices.com",    stub: "generic",  types: ["script","image","xmlhttprequest","ping"] },
  { host: "adservice.google.com",     stub: "generic",  types: ["script","image","xmlhttprequest","ping"] },

  // Meta / Facebook
  { host: "connect.facebook.net",     stub: "fbq",      types: ["script"] },
  { host: "facebook.com",             stub: "fbq",      types: ["image","xmlhttprequest","ping"] },

  // Microsoft Clarity
  { host: "clarity.ms",               stub: "clarity",  types: ["script","xmlhttprequest"] },

  // Hotjar / Yandex / Matomo
  { host: "static.hotjar.com",        stub: "hotjar",   types: ["script"] },
  { host: "script.hotjar.com",        stub: "hotjar",   types: ["script"] },
  { host: "mc.yandex.ru",             stub: "yandex",   types: ["script","image","xmlhttprequest","ping"] },
  { host: "matomo.cloud",             stub: "matomo",   types: ["script","image","xmlhttprequest","ping"] },

  // Ad-Tech verbreitet
  { host: "criteo.net",               stub: "criteo_q", types: ["script","image","xmlhttprequest","ping"] },
  { host: "taboola.com",              stub: "_taboola", types: ["script"] },
  { host: "outbrain.com",             stub: "outbrain", types: ["script"] },
  { host: "quantserve.com",           stub: "quantcast",types: ["script","image","xmlhttprequest","ping"] },
  { host: "scorecardresearch.com",    stub: "generic",  types: ["script","image","xmlhttprequest","ping"] },
  { host: "moatads.com",              stub: "generic",  types: ["script","image","xmlhttprequest","ping"] },
  { host: "pubmatic.com",             stub: "generic",  types: ["script","image","xmlhttprequest","ping"] },
  { host: "rubiconproject.com",       stub: "generic",  types: ["script","image","xmlhttprequest","ping"] },
  { host: "adform.net",               stub: "generic",  types: ["script","image","xmlhttprequest","ping"] },
  { host: "adsrvr.org",               stub: "generic",  types: ["script","image","xmlhttprequest","ping"] },

  // Social / Performance
  { host: "tiktok.com",               stub: "ttq",      types: ["script","image","xmlhttprequest","ping"] },
  { host: "snapchat.com",             stub: "snaptr",   types: ["script","image","xmlhttprequest","ping"] },
  { host: "pinterest.com",            stub: "pintrk",   types: ["script","image","xmlhttprequest","ping"] },
  { host: "twitter.com",              stub: "twq",      types: ["script","image","xmlhttprequest","ping"] },
  { host: "linkedin.com",             stub: "lintrk",   types: ["image","ping","xmlhttprequest"] },
  { host: "bing.com",                 stub: "uetq",     types: ["image","ping","xmlhttprequest"] },

  // Product Analytics / RUM / Error tracking
  { host: "segment.com",              stub: "segment",      types: ["script","xmlhttprequest"] },
  { host: "mixpanel.com",             stub: "mixpanel",     types: ["script","xmlhttprequest"] },
  { host: "amplitude.com",            stub: "amplitude",    types: ["script","xmlhttprequest"] },
  { host: "heapanalytics.com",        stub: "heap",         types: ["script","xmlhttprequest"] },
  { host: "fullstory.com",            stub: "fullstory",    types: ["script","xmlhttprequest"] },
  { host: "adobedtm.com",             stub: "adobe",        types: ["script","xmlhttprequest"] },
  { host: "hs-analytics.net",         stub: "hubspot",      types: ["script","xmlhttprequest"] },
  { host: "intercom.io",              stub: "intercom",     types: ["script","xmlhttprequest"] },
  { host: "nr-data.net",              stub: "newrelic",     types: ["script","xmlhttprequest","image","ping"] },
  { host: "datadoghq-browser-agent.com", stub: "datadog-rum", types: ["script","xmlhttprequest"] },
  { host: "sentry-cdn.com",           stub: "sentry",       types: ["script","xmlhttprequest"] },
  { host: "optimizely.com",           stub: "optimizely",   types: ["script","xmlhttprequest"] },
  { host: "visualwebsiteoptimizer.com", stub:"vwo",         types: ["script","xmlhttprequest"] },
];

// Typische Loader-/Tracking-Pfade → spezifischer Stub (wenn Script)
const BASELINE_PATHS = [
  { path: "/gtm.js",       stub: "gtm"     },
  { path: "/analytics.js", stub: "ga"      },
  { path: "/gtag/js",      stub: "ga"      },
  { path: "/fbevents.js",  stub: "fbq"     },
  // generische Tracker-Pfade → generic
  { path: "/collect",      stub: "generic" },
  { path: "/events",       stub: "generic" },
  { path: "/event",        stub: "generic" },
  { path: "/track",        stub: "generic" },
  { path: "/tracking",     stub: "generic" },
  { path: "/pixel",        stub: "generic" },
  { path: "/beacon",       stub: "generic" },
  { path: "/stats",        stub: "generic" },
  { path: "/metrics",      stub: "generic" },
  { path: "/measure",      stub: "generic" },
  { path: "/log",          stub: "generic" },
];

// 1×1 GIF & leeres JSON
const ONE_BY_ONE_GIF = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEA";
const EMPTY_JSON = "data:application/json,{}";

// --- Build Dynamic Baseline Rules (persistieren) ---
async function ensureBaselineDynamicRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const have = new Set(existing.map(r => r.id));
  const rules = [];
  let id = BASELINE_RULE_IDS.dynamicStart;

  // Domain-Familien
  for (const f of BASELINE_FAMILIES) {
    id++;
    if (have.has(id)) continue;
    const stub = ensureStub(f.stub);
    rules.push({
      id, priority: 1,
      action: { type: "redirect", redirect: { extensionPath: `/stubs/${stub}.js` } },
      condition: {
        regexFilter: `^https?:\\/\\/([^\\/]*\\.)?${f.host.replace(/\./g,"\\.")}\\/.*`,
        resourceTypes: sanitizeResourceTypes(f.types)
      }
    });
  }

  // Loader-/Tracking-Pfade (script-spezifisch)
  for (const p of BASELINE_PATHS) {
    id++;
    if (have.has(id)) continue;
    const stub = ensureStub(p.stub);
    rules.push({
      id, priority: 1,
      action: { type: "redirect", redirect: { extensionPath: `/stubs/${stub}.js` } },
      condition: {
        urlFilter: p.path,
        resourceTypes: sanitizeResourceTypes(["script"])
      }
    });
  }

  if (rules.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: rules,
      removeRuleIds: [] // nichts löschen
    });
  }
}

// --- Build Session Catchalls (bei jedem Startup frisch setzen) ---
async function ensureStartupSessionCatchalls() {
  const base = BASELINE_RULE_IDS.sessionStart;
  const rules = [
    // Universelle Beacon/Pixel → 1×1 GIF (image/ping/xhr)
    {
      id: base + 1, priority: 1,
      action: { type: "redirect", redirect: { url: ONE_BY_ONE_GIF } },
      condition: {
        regexFilter: "https?:\\/\\/[^\\/]+\\/(collect|pixel|beacon|stats|metrics|track|tracking|measure|log)(\\?|\\/|$)",
        resourceTypes: sanitizeResourceTypes(["image","ping","xmlhttprequest"])
      }
    },
    // Sicherheitsnetz für Script-Pfade (falls Domain-Familie nicht griff)
    {
      id: base + 2, priority: 1,
      action: { type: "redirect", redirect: { extensionPath: "/stubs/generic.js" } },
      condition: { urlFilter: "/pixel",   resourceTypes: sanitizeResourceTypes(["script"]) }
    },
    {
      id: base + 3, priority: 1,
      action: { type: "redirect", redirect: { extensionPath: "/stubs/generic.js" } },
      condition: { urlFilter: "/collect", resourceTypes: sanitizeResourceTypes(["script"]) }
    }
  ];

  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: rules.map(r => r.id),
    addRules: rules
  });
}
// === Live-KI: beobachtet Requests, setzt sofort Session-Rules, persistiert nach N Treffern ===

// Zähler & Persistenz-Parameter
const LEARN_KEY = "protecto_learned_counters";
const LEARN_MIN_FOR_PERSIST = 3;

function ruleKeyFromRule(r){
  // robust: nutze regexFilter als Schlüssel, sonst ID
  return r?.condition?.regexFilter || String(r?.id);
}

async function bumpLearnCounters(rules){
  const st = await chrome.storage.local.get(LEARN_KEY);
  const m = st[LEARN_KEY] || {};
  for (const r of (rules||[])) {
    const k = ruleKeyFromRule(r);
    m[k] = (m[k] || 0) + 1;
  }
  await chrome.storage.local.set({ [LEARN_KEY]: m });
  return m;
}

async function addSessionRules(rules){
  if (!rules || !rules.length) return;
  // Ensure every rule has a unique ID using nextRuleId if missing
  for (let r of rules) {
    if (typeof r.id === "undefined" || r.id === null) {
      r.id = await nextRuleId();
    }
  }
  // Only allow these properties: id, priority, action, condition
  const allowedFields = ['id', 'priority', 'action', 'condition'];
  const sanitizedRules = rules.map(rule => {
    const sanitized = {};
    for (const key of allowedFields) {
      if (key in rule) sanitized[key] = rule[key];
    }
    // Fix invalid redirect keys
    if (sanitized.action?.type === 'redirect' && sanitized.action.redirect?.extensionPath) {
      let p = sanitized.action.redirect.extensionPath;
      if (!p.startsWith('/stubs/')) p = '/stubs/' + p.replace(/^\/+/, '');
      if (!p.endsWith('.js')) p = p + '.js';
      sanitized.action.redirect.extensionPath = p;
    }
    return sanitized;
  });
  const ids = sanitizedRules.map(r => r.id);
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ids, addRules: sanitizedRules });
}

async function addDynamicRules(rules){
  if (!rules || !rules.length) return;
  const ids = rules.map(r => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids, addRules: rules });
  // Log each persisted rule
  for (const r of rules) {
    console.info("[Protecto][Rule] New rule persisted:", r.condition?.regexFilter || r.condition?.urlFilter);
  }
}

// Non-blocking (MV3-konform): entscheidet & lernt, ohne den Request zu blockieren via DNR debug events
if (chrome.declarativeNetRequest?.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async (info) => {
    try {
      console.info("[Protecto][DEBUG] Matched rule for", info.request?.url, "type:", info.request?.resourceType);
      const { request } = info;
      const url = request?.url || "";
      if (!/^https?:/i.test(url)) return;
      const initiatorHost = hostOf(request.initiator||"");
      const reqHost = hostOf(url);
      if (!initiatorHost || !reqHost || initiatorHost === reqHost) return;

      const d = decide(url, String(request.resourceType||"").toLowerCase(), initiatorHost);
      console.info("[Protecto][AI] Decision:", d);
      if (!d.isTracker) return;

      const rules = await proposeRulesForUrl(url, request.resourceType, initiatorHost);
      console.info("[Protecto][AI] Proposed rules:", rules);
      if (!rules.length) return;

      for (let r of rules) {
        if (typeof r.id === "undefined" || r.id === null) {
          r.id = await nextRuleId();
        }
      }
      await addSessionRules(rules);
      console.info("[Protecto][AI] Session rule added:", rules);

      const counters = await bumpLearnCounters(rules);
      for (const r of rules){
        const k = ruleKeyFromRule(r);
        if (counters[k] >= LEARN_MIN_FOR_PERSIST) {
          if (typeof r.id === "undefined" || r.id === null) {
            r.id = await nextRuleId();
          }
          await addDynamicRules([r]);
        }
      }
    } catch(e) {
      console.warn("[Protecto][Learn] onRuleMatchedDebug error", e);
    }
  });
}