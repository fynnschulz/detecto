// history.js – Cross-Browser Domain-History für Protecto

// Storage-Wrapper (nutzt chrome oder browser API, je nach Browser)
const storage = (typeof browser !== "undefined" ? browser.storage : chrome.storage);

export async function getHistory(domain) {
  return new Promise((resolve) => {
    storage.local.get(["protecto_history"], (res) => {
      const all = res.protecto_history || {};
      resolve(all[domain] || { hits: 0, lastSeen: 0 });
    });
  });
}

export async function bumpHistory(domain, weight = 1) {
  return new Promise((resolve) => {
    storage.local.get(["protecto_history"], (res) => {
      const all = res.protecto_history || {};
      const now = Date.now();
      if (!all[domain]) {
        all[domain] = { hits: 0, lastSeen: 0 };
      }
      all[domain].hits += weight;
      all[domain].lastSeen = now;
      storage.local.set({ protecto_history: all }, () => resolve(all[domain]));
    });
  });
}

export async function clearHistory() {
  return new Promise((resolve) => {
    storage.local.remove("protecto_history", () => resolve(true));
  });
}

export async function getAllHistory() {
  return new Promise((resolve) => {
    storage.local.get(["protecto_history"], (res) => {
      resolve(res.protecto_history || {});
    });
  });
}