/*
 * Protecto – Adaptive Redirect Engine (MV3-safe)
 *
 * Zweck:
 *  - Neue/obskure Tracker automatisch erkennen (heuristisch)
 *  - Für erkannte Third-Party-Hosts zur Laufzeit DNR-Redirect-Regeln anlegen
 *  - Gelernte Hosts und Rule-IDs in chrome.storage.local persistieren
 *
 * Integration:
 *  - In service-worker.js via: importScripts("engine/adaptive.js")
 *  - Danach stehen globale Funktionen zur Verfügung:
 *      - adaptive.hostFromUrl(url)
 *      - adaptive.looksLikeTrackerUrl(url, type)
 *      - adaptive.isPolicyActiveFor(pageHost)
 *      - adaptive.maybeLearnAndRedirectHost(host, type)
 *      - adaptive.resetLearned(optionalHost)
 */
(function(){
  'use strict';

  // Data URLs
  const GIF_1x1 = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEA";
  const NOOP_JS = "data:text/javascript,/*noop*/"; // Fallback, meist nutzen wir Stubs

  // Script-Fallback-Stub, wenn unklar (GTM-Stub ist robust genug für viele Tracker-APIs)
  const GENERIC_SCRIPT_STUB = "/src/stubs/gtm.js";

  // Startbereich für dynamische Regeln – bewusst hoch, um mit statischen IDs nicht zu kollidieren
  const DYN_ID_START = 50000;

  // Heuristik-Muster
  const RE_PATH = /(collect|g\/collect|pixel|beacon|track|event|analytics|log|metrics|stats)\b/i;
  const RE_QUERY = /(utm_[a-z]+|fbclid|gclid|msclkid|yclid|dclid)=/i;
  const RE_SUB   = /(^|\.)(stats|metrics|pixel|track|beacon|tag|ads|analytic)\./i;

  // Hilfsfunktionen
  function hostFromUrl(url){
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
  }

  function looksLikeTrackerUrl(url, type){
    try {
      const u = new URL(url);
      if (RE_PATH.test(u.pathname)) return true;
      if (RE_QUERY.test(u.search)) return true;
      if (RE_SUB.test(u.hostname)) return true;
      // Tiny beacons: häufig image/gif, aber das prüfen wir im SW via headers
      return false;
    } catch { return false; }
  }

  // Persistente Zähler/Tabellen (überlebt Neustarts/Reloads)
  async function getNextRuleId(){
    const { dynRuleCounter = DYN_ID_START } = await chrome.storage.local.get('dynRuleCounter');
    const next = dynRuleCounter + 1;
    await chrome.storage.local.set({ dynRuleCounter: next });
    return next;
  }

  async function getLearnedMap(){
    const { learned = {} } = await chrome.storage.local.get('learned');
    return learned; // { host: { ruleId, ts, types:{script:true,img:true,xhr:true} } }
  }

  async function isAlreadyLearned(host, type){
    if (!host) return false;
    const learned = await getLearnedMap();
    const entry = learned[host];
    if (!entry) return false;
    if (!type) return true;
    const t = (type||'').toLowerCase();
    return !!(entry.types && (entry.types[t] || (t === 'xmlhttprequest' && entry.types['xhr'])));
  }

  async function markLearned(host, ruleId, type){
    const learned = await getLearnedMap();
    const t = (type||'').toLowerCase();
    const key = (t === 'xmlhttprequest') ? 'xhr' : t || 'any';
    if (!learned[host]) learned[host] = { ruleId, ts: Date.now(), types: {} };
    learned[host].ruleId = ruleId; // letzte zugewiesene Regel
    learned[host].ts = Date.now();
    learned[host].types[key] = true;
    await chrome.storage.local.set({ learned });
  }

  async function resetLearned(optionalHost){
    if (optionalHost) {
      const learned = await getLearnedMap();
      delete learned[optionalHost];
      await chrome.storage.local.set({ learned });
      return;
    }
    await chrome.storage.local.set({ learned: {}, dynRuleCounter: DYN_ID_START });
  }

  // Policy prüfen (Soft → keine Adapt-Regeln; Standard/Strict → aktiv)
  async function isPolicyActiveFor(pageHost){
    try {
      const { policies = {} } = await chrome.storage.sync.get('policies');
      const mode = policies[pageHost] || policies['*'] || 'standard';
      return (mode !== 'off');
    } catch { return true; }
  }

  // Dynamische Redirect-Regel für Host hinzufügen
  async function addRedirectRuleForHost(host, type){
    if (!host) return null;
    const t = (type||'').toLowerCase();
    const isScript = (t === 'script');

    const action = isScript
      ? { type: 'redirect', redirect: { extensionPath: GENERIC_SCRIPT_STUB } }
      : { type: 'redirect', redirect: { url: GIF_1x1 } };

    // Ressourcentypen passend setzen
    const resourceTypes = isScript
      ? ['script']
      : ['image','xmlhttprequest','ping'];

    const rule = {
      id: await getNextRuleId(),
      priority: 1,
      action,
      condition: {
        requestDomains: [host],
        domainType: 'thirdParty',
        resourceTypes
      }
    };

    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [rule] });
    await markLearned(host, rule.id, t);
    return rule.id;
  }

  // Haupt-Entry: ggf. neue Rule für Host anlegen, wenn Heuristik anschlägt
  async function maybeLearnAndRedirectHost(host, type){
    try {
      if (!host) return false;
      if (await isAlreadyLearned(host, type)) return false;

      // Whitelist berücksichtigen
      const { whitelist = [] } = await chrome.storage.sync.get('whitelist');
      if (whitelist.includes(host)) return false;

      // Regel hinzufügen
      await addRedirectRuleForHost(host, type);
      return true;
    } catch (e) {
      console.warn('[Protecto][Adaptive] failed to learn host', host, e);
      return false;
    }
  }

  // --- Cleanup & Stats ------------------------------------------------------
  // Entfernt alte gelernte Hosts und die zugehörigen Dynamic Rules.
  // Optionen:
  //   maxAgeDays: Alter in Tagen, ab dem Einträge gelöscht werden (Default 30)
  //   maxEntries: Hartes Limit für Anzahl gelernter Hosts (älteste zuerst löschen)
  async function cleanupLearned(options = {}){
    const maxAgeDays = Number(options.maxAgeDays ?? 30);
    const maxEntries = Number(options.maxEntries ?? 5000);
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    const learned = await getLearnedMap();
    const hosts = Object.keys(learned);
    if (!hosts.length) return { removed: 0, remaining: 0 };

    // 1) Nach Alter filtern → Rule-IDs zum Entfernen sammeln
    const toRemoveByAge = [];
    for (const h of hosts) {
      const ts = learned[h]?.ts || 0;
      if (ts && (now - ts) > maxAgeMs) {
        const rid = learned[h]?.ruleId;
        if (typeof rid === 'number') toRemoveByAge.push(rid);
        delete learned[h];
      }
    }

    // 2) Wenn zu viele Einträge → älteste zusätzlich entfernen
    let removedForLimit = 0;
    let extraRuleIds = [];
    const remainingHosts = Object.keys(learned);
    if (remainingHosts.length > maxEntries) {
      const sorted = remainingHosts.sort((a,b) => (learned[a].ts||0) - (learned[b].ts||0));
      const overshoot = remainingHosts.length - maxEntries;
      const cut = sorted.slice(0, overshoot);
      for (const h of cut) {
        const rid = learned[h]?.ruleId;
        if (typeof rid === 'number') extraRuleIds.push(rid);
        delete learned[h];
      }
      removedForLimit = cut.length;
    }

    // 3) Dynamic Rules entfernen (falls vorhanden)
    const allRuleIds = [...toRemoveByAge, ...extraRuleIds];
    if (allRuleIds.length) {
      try {
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: allRuleIds });
      } catch (e) {
        console.warn('[Protecto][Adaptive] cleanup removeRuleIds error', e);
      }
    }

    await chrome.storage.local.set({ learned });
    return { removed: toRemoveByAge.length + removedForLimit, remaining: Object.keys(learned).length };
  }

  // Gibt aggregierte Kennzahlen zurück, z. B. fürs Popup/Debug
  async function getStats(){
    const { dynRuleCounter = DYN_ID_START } = await chrome.storage.local.get('dynRuleCounter');
    const learned = await getLearnedMap();
    const hosts = Object.keys(learned);
    const count = hosts.length;
    let oldest = null, newest = null;
    for (const h of hosts) {
      const ts = learned[h]?.ts || 0;
      if (!oldest || ts < oldest) oldest = ts;
      if (!newest || ts > newest) newest = ts;
    }
    return {
      learnedCount: count,
      dynRuleCounter,
      oldestTs: oldest,
      newestTs: newest,
    };
  }

  // Export in globalen Namespace
  self.adaptive = {
    hostFromUrl,
    looksLikeTrackerUrl,
    isPolicyActiveFor,
    maybeLearnAndRedirectHost,
    addRedirectRuleForHost,
    resetLearned,
    cleanupLearned,
    getStats,
    // Konstanten (falls im SW benötigt)
    GIF_1x1,
    NOOP_JS,
    GENERIC_SCRIPT_STUB
  };
})();
