// history.js – Cross-Browser Domain-History für Protecto (MV3-kompatibel)

(function(){
  // Storage-Wrapper (nutzt chrome oder browser API, je nach Browser)
  const storage = (typeof browser !== "undefined" ? browser.storage : chrome.storage);

  // Auto-Prune: entferne Domains ohne Aktivität > 90 Tage
  const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 Tage
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
})();