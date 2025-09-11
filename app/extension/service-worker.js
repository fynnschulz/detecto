// app/extension/service-worker.js — MV3 ES Module
// Stealth: Heuristik/KI → DNR Redirect (Stub-Datei) → Ziel sieht 200 OK
// Learning-Cache: Hosts → Session/Dynamic Rules

import { classify, setExternalSeeds } from './engine/model.js';
import { getLearned, remember, ensureDnrRule, stubToPath, restorePersistedRules } from './engine/learn.js';

// ---------- Config ----------
const LEARN_MIN_SEEN_FOR_DNR = 3;
const SESSION_RULE_ID_BASE = 20000;
const SESSION_RULE_ID_MAX = 20999;

const RT_ALL = ['script', 'xmlhttprequest', 'image', 'ping'];
const RT_JS = ['script', 'xmlhttprequest', 'ping'];

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
    const url = chrome.runtime.getURL('data/seeds.json');
    const seeds = await fetch(url).then(r => r.json());
    if (typeof setExternalSeeds === 'function') {
      setExternalSeeds(seeds);
    } else if (self && typeof self.setExternalSeeds === 'function') {
      self.setExternalSeeds(seeds);
    }
  } catch (e) {
    console.warn('[Protecto][Seeds] load failed', e);
  }
}

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
      condition: { initiatorDomains: init, urlFilter: df, resourceTypes: RT_JS },
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
    rules.push({
      id: id(cursor++), priority: 1,
      condition: { initiatorDomains: init, urlFilter: pf, resourceTypes: RT_JS },
      action: { type: 'redirect', redirect: { extensionPath: '/stubs/generic.js' } }
    });
  }

  const ONE_BY_ONE_GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEA';
  const EMPTY_JSON = 'data:application/json,{}';

  // pixel/ping beacons redirect to 1x1 gif
  const pixelPaths = ['/pixel', '/beacon', '/events', '/event', '/track', '/tracking', '/metrics', '/stats', '/log'];
  for (const path of pixelPaths) {
    rules.push({
      id: id(cursor++), priority: 1,
      condition: { initiatorDomains: init, urlFilter: path, resourceTypes: ['image', 'ping'] },
      action: { type: 'redirect', redirect: { url: ONE_BY_ONE_GIF } }
    });
  }

  // xhr beacons redirect to empty json
  const xhrBeaconHints = ['/collect', '/events', '/event', '/track', '/tracking', '/metrics', '/stats', '/log'];
  for (const path of xhrBeaconHints) {
    rules.push({
      id: id(cursor++), priority: 1,
      condition: { initiatorDomains: init, urlFilter: path, resourceTypes: ['xmlhttprequest'] },
      action: { type: 'redirect', redirect: { url: EMPTY_JSON } }
    });
  }

  // query parameter hints redirect to 1x1 gif or empty json
  const queryHints = ['gclid', 'fbclid', 'msclkid', 'yclid', 'dclid', 'utm_'];
  for (const hint of queryHints) {
    rules.push({
      id: id(cursor++), priority: 1,
      condition: { initiatorDomains: init, urlFilter: hint, resourceTypes: ['image', 'ping'] },
      action: { type: 'redirect', redirect: { url: ONE_BY_ONE_GIF } }
    });
    rules.push({
      id: id(cursor++), priority: 1,
      condition: { initiatorDomains: init, urlFilter: hint, resourceTypes: ['xmlhttprequest'] },
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
        condition: { initiatorDomains: [pageHost], urlFilter: host, resourceTypes: RT_ALL },
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
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) applySessionRulesForTab(tabs[0]);
  } catch {}
});
chrome.runtime.onInstalled.addListener(async () => {
  try {
    await loadSeedsIntoModel();
    await restorePersistedRules();
  } catch {}
});

// ---------- Lernen über DNR-Feedback ----------
if (chrome.declarativeNetRequest?.onRuleMatchedDebug) {
  try {
    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async (info) => {
      try {
        const req = info?.request;
        if (!req?.url) return;
        const initiator = hostOf(req.initiator || '');
        const reqHost = hostOf(req.url);
        if (!initiator || !reqHost || initiator === reqHost) return;

        const t = String(req.resourceType || '').toLowerCase();
        const res = classify(req.url, t, initiator) || {};
        const stub = res.stub || 'generic';

        await remember(reqHost, stub);
        await ensureDnrRule(reqHost, stub, LEARN_MIN_SEEN_FOR_DNR);
      } catch {}
    });
  } catch {}
}

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