// history.js – Cross-Browser Domain-History für Protecto (MV3-kompatibel)

(function(){
  // Storage-Wrapper (nutzt chrome oder browser API, je nach Browser)
  const storage = (typeof browser !== "undefined" ? browser.storage : chrome.storage);

  // Auto-Prune: entferne Domains ohne Aktivität > 90 Tage
  const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 Tage

  // --- Local Telemetry (nur lokal; keine externen Calls) -------------------
  const DYN_LIMIT_DEFAULT = 5000; // MV3: sinnvolles Soft-Limit für dyn. Redirects

  async function _telemetryLoad() {
    return new Promise((resolve) => {
      storage.local.get(["protecto_telemetry"], (res) => {
        const t = res.protecto_telemetry || { hist:{}, dynRulesCount:0, dynLimit:DYN_LIMIT_DEFAULT };
        if (!t.hist) t.hist = {};
        if (typeof t.dynRulesCount !== 'number') t.dynRulesCount = 0;
        if (typeof t.dynLimit !== 'number') t.dynLimit = DYN_LIMIT_DEFAULT;
        resolve(t);
      });
    });
  }

  async function _telemetrySave(next) {
    return new Promise((resolve) => {
      storage.local.set({ protecto_telemetry: next }, () => resolve(true));
    });
  }

  // Zähler erhöhen, wenn Adaptive neue Hosts lernt
  async function bumpLearned(pageHost){
    const t = await _telemetryLoad();
    const key = pageHost || "_global";
    const rec = t.hist[key] || { learned:0, pruned:0 };
    rec.learned += 1;
    t.hist[key] = rec;
    await _telemetrySave(t);
  }

  // Zähler für bereinigte (geprunte) Regeln
  async function bumpPruned(pageHost, n = 1){
    const t = await _telemetryLoad();
    if (pageHost) {
      const rec = t.hist[pageHost] || { learned:0, pruned:0 };
      rec.pruned += (Number(n) || 0);
      t.hist[pageHost] = rec;
    }
    await _telemetrySave(t);
  }

  // Aktuelle Anzahl dynamischer Regeln (Cache fürs Popup)
  async function setDynamicRulesCount(n){
    const t = await _telemetryLoad();
    t.dynRulesCount = Number(n) || 0;
    if (typeof t.dynLimit !== 'number') t.dynLimit = DYN_LIMIT_DEFAULT;
    await _telemetrySave(t);
  }

  // Zusammenfassung fürs Popup (gesamt + pro aktuelle Domain)
  async function getSummary(currentHost){
    const t = await _telemetryLoad();
    const perHost = currentHost ? (t.hist[currentHost] || { learned:0, pruned:0 }) : null;
    const totals = Object.values(t.hist).reduce((acc, r) => ({
      learned: acc.learned + (r.learned || 0),
      pruned:  acc.pruned  + (r.pruned  || 0),
    }), { learned:0, pruned:0 });
    return {
      dynRulesCount: t.dynRulesCount,
      dynLimit: t.dynLimit,
      totals,
      perHost
    };
  }
  function pruneOldEntries(all, cutoffTs){
    let removed = 0;
    try {
      for (const d of Object.keys(all)) {
        const v = all[d];
        const last = (v && typeof v.lastSeen === 'number') ? v.lastSeen : 0;
        if (last && last < cutoffTs) { delete all[d]; removed++; }
      }
    } catch {}
    return removed;
  }

  self.getHistory = function(domain){
    return new Promise((resolve) => {
      storage.local.get(["protecto_history"], (res) => {
        const all = res.protecto_history || {};
        const entry = all[domain] || { hits: 0, lastSeen: 0, signals: {} };
        // Ensure signals object exists for backward compatibility
        if (!entry.signals) {
          entry.signals = {};
        }
        resolve(entry);
      });
    });
  };

  self.bumpHistory = function(domain, weight = 1, signals = {}){
    return new Promise((resolve) => {
      storage.local.get(["protecto_history"], (res) => {
        const all = res.protecto_history || {};
        const now = Date.now();
        if (!all[domain]) {
          all[domain] = { hits: 0, lastSeen: 0, signals: {} };
        }
        all[domain].hits += weight;
        all[domain].lastSeen = now;

        if (!all[domain].signals) {
          all[domain].signals = {};
        }
        for (const [signal, present] of Object.entries(signals)) {
          if (present) {
            if (!all[domain].signals[signal]) {
              all[domain].signals[signal] = 0;
            }
            all[domain].signals[signal] += 1;
          }
        }

        // Alte Einträge (>90 Tage) automatisch entfernen
        const cutoff = now - MAX_AGE_MS;
        pruneOldEntries(all, cutoff);

        storage.local.set({ protecto_history: all }, () => resolve(all[domain]));
      });
    });
  };

  self.clearHistory = function(){
    return new Promise((resolve) => {
      storage.local.remove("protecto_history", () => resolve(true));
    });
  };

  self.getAllHistory = function(){
    return new Promise((resolve) => {
      storage.local.get(["protecto_history"], (res) => {
        const all = res.protecto_history || {};
        // Ensure all entries have signals object for backward compatibility
        for (const domain in all) {
          if (!all[domain].signals) {
            all[domain].signals = {};
          }
        }
        // Auto-Prune bei Aufruf: lösche Einträge älter als 90 Tage
        const removed = pruneOldEntries(all, Date.now() - MAX_AGE_MS);
        if (removed > 0) {
          storage.local.set({ protecto_history: all }, () => resolve(all));
          return;
        }
        resolve(all);
      });
    });
  };

  self.clearOldHistory = function(days = 90){
    return new Promise((resolve) => {
      storage.local.get(["protecto_history"], (res) => {
        const all = res.protecto_history || {};
        const cutoff = Date.now() - Math.max(0, days) * 24 * 60 * 60 * 1000;
        const removed = pruneOldEntries(all, cutoff);
        storage.local.set({ protecto_history: all }, () => resolve({ removed, remaining: Object.keys(all).length }));
      });
    });
  };

  // Öffentliche Telemetrie-API (nur lokal)
  self.historyTelemetry = {
    bumpLearned,
    bumpPruned,
    setDynamicRulesCount,
    getSummary,
  };
})();