function sendMessageP(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (reply) => {
        if (chrome.runtime.lastError || typeof reply === 'undefined') return resolve(null);
        resolve(reply);
      });
    } catch {
      resolve(null);
    }
  });
}

async function getCurrentPolicyForActiveTab(){
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => [null]);
  if (!tab?.url) return null;
  const domain = new URL(tab.url).hostname.replace(/^www\./, "");
  const { policies = {} } = await chrome.storage.sync.get("policies");
  return policies[domain] || policies["*"] || null;
}

async function setPolicy(policy) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => [null]);
  if (!tab?.url) return;
  const domain = new URL(tab.url).hostname.replace(/^www\./, "");

  // send to SW
  const res = await sendMessageP({ type: "policy:apply", domain, policy });

  // UI markieren, egal ob reply null ist (SW kann async sein)
  document.querySelectorAll("button").forEach(b => b.classList.remove("active"));
  const btn = document.getElementById(`policy-${policy}`);
  if (btn) btn.classList.add("active");

  const modeNameEl = document.getElementById("modeName");
  if (modeNameEl) modeNameEl.textContent = policy.toUpperCase();

  // Empfehlung neu laden (zeigt aktuelle Policy-Empfehlung/Gründe)
  try { await loadRecommendation(); } catch {}

  // Seite sanft neu laden, damit DNR-Redirects sofort wirken
  try { if (tab.id) await chrome.tabs.reload(tab.id); } catch {}
}

let domainInput, whitelistEl;

async function renderWhitelist(whitelist) {
  if (!whitelistEl) return;
  whitelistEl.innerHTML = "";
  (whitelist || []).forEach((domain) => {
    const li = document.createElement("li");
    li.textContent = domain;
    whitelistEl.appendChild(li);
  });
}

// Load recommendation for the current tab and update UI
async function loadRecommendation() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => [null]);
  if (!tab?.url) return;
  const domain = new URL(tab.url).hostname.replace(/^www\./, "");

  let res = await sendMessageP({ type: "risk:get", domain });
  if (!res) res = { score: 0, level: "low", recommend: "soft", reasons: [] };

  const box = document.getElementById("recBox");
  if (box) {
    box.innerHTML = `
      <div><b>Bewertung:</b> ${res.score}/100</div>
      <div><b>Risiko-Level:</b> ${res.level.toUpperCase()}</div>
      <div><b>Empfehlung:</b> ${res.recommend.toUpperCase()}</div>
      ${Array.isArray(res.reasons) && res.reasons.length ? `<div style="margin-top:6px"><b>Gründe:</b><br>${res.reasons.map(r=>`• ${r}`).join("<br>")}</div>` : ""}
    `;
    const modeNameEl = document.getElementById("modeName");
    if (modeNameEl) modeNameEl.textContent = (await getCurrentPolicyForActiveTab()) || "—";
  }
}

// Init after DOM is ready
window.addEventListener("DOMContentLoaded", async () => {
  domainInput = document.getElementById("domainInput");
  whitelistEl = document.getElementById("whitelist");

  const addBtn = document.getElementById("addWhitelist");
  if (addBtn) {
    addBtn.addEventListener("click", async () => {
      const domain = (domainInput?.value || "").trim();
      if (!domain) return;
      let { whitelist = [] } = await chrome.storage.sync.get("whitelist");
      if (!whitelist.includes(domain)) whitelist.push(domain);
      await chrome.storage.sync.set({ whitelist });
      renderWhitelist(whitelist);
      if (domainInput) domainInput.value = "";
    });
  }

  // Policy Buttons
  document.getElementById("policy-strict")?.addEventListener("click", () => setPolicy("strict"));
  document.getElementById("policy-standard")?.addEventListener("click", () => setPolicy("standard"));
  document.getElementById("policy-soft")?.addEventListener("click", () => setPolicy("soft"));
  document.getElementById("policy-off")?.addEventListener("click", () => setPolicy("off"));

  // Initial Whitelist render
  const { whitelist = [] } = await chrome.storage.sync.get("whitelist");
  renderWhitelist(whitelist);

  // Mark currently stored policy
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => [null]);
  if (tab?.url) {
    const domain = new URL(tab.url).hostname.replace(/^www\./, "");
    const { policies = {} } = await chrome.storage.sync.get("policies");
    const currentPolicy = policies[domain];
    if (currentPolicy) {
      const btn = document.getElementById(`policy-${currentPolicy}`);
      if (btn) btn.classList.add("active");
    }
    const modeNameEl = document.getElementById("modeName");
    if (modeNameEl) modeNameEl.textContent = (currentPolicy || policies["*"] || "—").toUpperCase();
  }

  // Empfehlung laden
  await loadRecommendation();
});