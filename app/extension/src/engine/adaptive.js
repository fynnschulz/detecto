/*
 * Protecto – Adaptive Redirect Engine (MV3-safe)
 *
 * Zweck:
 *  - Neue/obskure Tracker automatisch erkennen (heuristisch)
 *  - Für erkannte Third-Party-Hosts zur Laufzeit DNR-Redirect-Regeln anlegen
 *  - Gelernte Hosts und Rule-IDs in chrome.storage.local persistieren
 *  - LRU/TTL-Pruning: alte/zu viele dynamische Redirect-Regeln automatisch abbauen
 *
 * Integration:
 *  - In service-worker.js via: importScripts("engine/adaptive.js")
 *  - Danach stehen globale Funktionen unter self.adaptive zur Verfügung:
 *      - adaptive.hostFromUrl(url)
 *      - adaptive.looksLikeTrackerUrl(url, type)
 *      - adaptive.isPolicyActiveFor(pageHost)
 *      - adaptive.maybeLearnAndRedirectHost(host, type)
 *      - adaptive.addRedirectRuleForHost(host, type)
 *      - adaptive.pruneLearned()
 *      - adaptive.cleanupLearned(opts)
 *      - adaptive.resetLearned(optionalHost)
 *      - adaptive.getStats()
 */
(function(){
  'use strict';

  /* eslint-disable no-undef */

  // --- Data URLs -----------------------------------------------------------
  const GIF_1x1   = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEA";
  const JSON_EMPTY = "data:application/json,{}";     // für XHR/fetch
  const NOOP_JS   = "data:text/javascript,/*noop*/"; // Fallback (selten genutzt)

  // --- Script-Stub ---------------------------------------------------------
  // GTM-Stub ist robust und emuliert viele gängige Tracker-Globals
  const GENERIC_STUB = "/src/stubs/gtm.js";
  const GENERIC_SCRIPT_STUB = GENERIC_STUB; // alias für ältere Referenzen

  // --- IDs & Limits --------------------------------------------------------
  const DYN_ID_START        = 50000;                 // Startbereich für dyn. Regeln
  const DYN_REDIRECT_LIMIT  = 5000;                  // sicheres Limit (MV3)
  const TTL_MS              = 30 * 24 * 60 * 60 * 1000; // 30 Tage

  // --- Heuristik-Muster ----------------------------------------------------
  const RE_SUB = /(^|\.)(ads|adserver|adservice|advertising|doubleclick|googlesyndication|googleadservices|analytics|metrics|stats|pixel|track|beacon|tag|clarity|hotjar|criteo|taboola|outbrain|adform|quantserve|scorecardresearch|moatads|rubiconproject|pubmatic|openx|spotx|zedo|mathtag)\./i;
  const RE_PATH = /(collect|g\/collect|pixel|beacon|track|event|measure|metrics|stats|analytics|fbevents|tr\/|t\/collect|log)(\?|\/|$)/i;
  const RE_QUERY= /(utm_[a-z]+|fbclid|gclid|msclkid|yclid|dclid)=/i;

  // --- Hilfsfunktionen -----------------------------------------------------
  function hostFromUrl(url){
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
  }

  function looksLikeTrackerUrl(url, type){
    try {
      const u = new URL(url);
      return RE_SUB.test(u.hostname) || RE_PATH.test(u.pathname) || RE_QUERY.test(u.search);
    } catch { return false; }
  }

  // --- Persistenz (State) --------------------------------------------------
  async function loadState(){
    const { dynRuleCounter = DYN_ID_START, learned = {} } = await chrome.storage.local.get([ 'dynRuleCounter', 'learned' ]);
    return { dynRuleCounter, learned };
  }

  async function saveState(st){
    await chrome.storage.local.set(st);
  }

  async function getNextRuleId(){
    const st = await loadState();
    const next = st.dynRuleCounter + 1;
    st.dynRuleCounter = next;
    await saveState(st);
    return next;
  }

  async function getLearnedMap(){
    const { learned = {} } = await chrome.storage.local.get('learned');
    return learned; // { host: { ruleId, ts, types:{script:true,img:true,xhr:true,fetch:true,ping:true} } }
  }

  async function isAlreadyLearned(host, type){
    if (!host) return false;
    const learned = await getLearnedMap();
    const entry = learned[host];
    if (!entry) return false;
    if (!type) return true;
    const t = (type||'').toLowerCase();
    const key = (t === 'xmlhttprequest') ? 'xhr' : t;
    return !!(entry.types && entry.types[key]);
  }

  async function markLearned(host, ruleId, type){
    const st = await loadState();
    const t = (type||'').toLowerCase();
    const key = (t === 'xmlhttprequest') ? 'xhr' : (t || 'any');
    if (!st.learned[host]) st.learned[host] = { ruleId, ts: Date.now(), types: {} };
    st.learned[host].ruleId = ruleId;
    st.learned[host].ts = Date.now();
    st.learned[host].types[key] = true;
    await saveState(st);
  }

  async function touchLearned(host, type){
    if (!host) return;
    const st = await loadState();
    const entry = st.learned[host];
    if (!entry) return;
    const t = (type||'').toLowerCase();
    const key = (t === 'xmlhttprequest') ? 'xhr' : (t || 'any');
    entry.ts = Date.now();
    entry.types = entry.types || {};
    entry.types[key] = true;
    await saveState(st);
  }

  async function resetLearned(optionalHost){
    if (optionalHost) {
      const st = await loadState();
      delete st.learned[optionalHost];
      await saveState(st);
      return;
    }
    await chrome.storage.local.set({ learned: {}, dynRuleCounter: DYN_ID_START });
  }

  // --- Policy prüfen -------------------------------------------------------
  async function isPolicyActiveFor(pageHost){
    try {
      const { policies = {} } = await chrome.storage.sync.get('policies');
      const mode = policies[pageHost] || policies['*'] || 'standard';
      return (mode !== 'off'); // Adaptive überall außer bei "Aus"
    } catch { return true; }
  }

  // --- LRU/TTL-Pruning -----------------------------------------------------
  async function pruneLearned(){
    const st = await loadState();
    const now = Date.now();

    // 1) TTL
    const toRemoveTTL = [];
    for (const [h, meta] of Object.entries(st.learned)) {
      const ts = meta?.ts || 0;
      if (!ts || (ts + TTL_MS) < now) {
        if (typeof meta?.ruleId === 'number') toRemoveTTL.push(meta.ruleId);
        delete st.learned[h];
      }
    }
    if (toRemoveTTL.length) {
      try { await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: toRemoveTTL }); } catch {}
    }

    // 2) LRU wenn über Limit
    const keys = Object.keys(st.learned);
    if (keys.length > DYN_REDIRECT_LIMIT) {
      const sorted = keys.sort((a,b) => (st.learned[a].ts||0) - (st.learned[b].ts||0));
      const removeCount = keys.length - DYN_REDIRECT_LIMIT;
      const cut = sorted.slice(0, removeCount);
      const toRemoveLRU = [];
      for (const h of cut) {
        const id = st.learned[h]?.ruleId;
        if (typeof id === 'number') toRemoveLRU.push(id);
        delete st.learned[h];
      }
      if (toRemoveLRU.length) {
        try { await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: toRemoveLRU }); } catch {}
      }
    }

    await saveState(st);
    return { count: Object.keys(st.learned).length };
  }

  // --- Dynamische Redirect-Regel anlegen (pro Ressourcentyp passend) ------
  async function addRedirectRuleForHost(host, type) {
  if (!host) return;

  const id = await getNextRuleId();
  const t = String(type || "").toLowerCase();

  // Script → Stub; sonst → Data-URL (GIF/JSON)
  let action;
  if (t === "script") {
    action = { type: "redirect", redirect: { extensionPath: "/src/stubs/gtm.js" } };
  } else if (t === "image" || t === "ping") {
    action = { type: "redirect", redirect: { url: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEA" } };
  } else {
    // xhr/fetch/sonstiges → leeres JSON
    action = { type: "redirect", redirect: { url: "data:application/json,{}" } };
  }

  // Resource-Typen komplett abdecken (Script separat)
  const rtypes = (t === "script")
    ? ["script"]
    : ["image", "xmlhttprequest", "ping", "fetch"];

  const rule = {
    id,
    priority: 1,
    action,
    condition: {
      requestDomains: [host],
      domainType: "thirdParty",
      resourceTypes: rtypes
    }
  };

  await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [rule] });
  await markLearned(host, id); // { ruleId, ts } kommt aus deiner Persistenz
}

  // --- Haupt-Entry: ggf. neue Rule für Host anlegen -----------------------
  async function maybeLearnAndRedirectHost(host, type){
    try {
      if (!host) return false;

      // Whitelist respektieren
      const { whitelist = [] } = await chrome.storage.sync.get('whitelist');
      if (Array.isArray(whitelist) && whitelist.includes(host)) return false;

      // Bereits gelernt (inkl. Ressourcentyp)? → nur Timestamp/Typ aktualisieren
      if (await isAlreadyLearned(host, type)) { await touchLearned(host, type); return false; }

      // Vor jeder neuen Regel: aufräumen (TTL/LRU)
      await pruneLearned();

      // Regel passend zum Typ anlegen
      await addRedirectRuleForHost(host, type);
      return true;
    } catch (e) {
      console.warn('[Protecto][Adaptive] failed to learn host', host, e);
      return false;
    }
  }

  // --- Aufräumen (öffentliche API) ----------------------------------------
  async function cleanupLearned(options = {}){
    // Delegiert an pruneLearned; Optionen werden aktuell nicht parametriert,
    // da TTL/LIMIT konstant festgelegt sind. Struktur bleibt für spätere
    // Erweiterungen erhalten.
    return pruneLearned();
  }

  // --- Stats für Popup/Debug ----------------------------------------------
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
    return { learnedCount: count, dynRuleCounter, oldestTs: oldest, newestTs: newest };
  }

  // --- Export --------------------------------------------------------------
  self.adaptive = {
    // Heuristik/Utils
    hostFromUrl,
    looksLikeTrackerUrl,
    isPolicyActiveFor,
    // Lernen & Regeln
    maybeLearnAndRedirectHost,
    addRedirectRuleForHost,
    pruneLearned,
    cleanupLearned,
    resetLearned,
    getStats,
    // Konstanten (optional verwendet)
    GIF_1x1,
    JSON_EMPTY,
    NOOP_JS,
    GENERIC_SCRIPT_STUB
  };
})();
