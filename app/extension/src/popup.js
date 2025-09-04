async function setPolicy(policy) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;

  const domain = new URL(tab.url).hostname.replace(/^www\./, "");

  // Policy speichern
  let { policies = {} } = await chrome.storage.sync.get("policies");
  policies[domain] = policy;
  await chrome.storage.sync.set({ policies });

  // Service Worker informieren
  await chrome.runtime.sendMessage({ type: "policy:apply", domain, policy });
  console.log("[Protecto] Policy gesetzt:", domain, policy);

  // Buttons visuell aktualisieren
  document.querySelectorAll("button").forEach(btn => btn.classList.remove("active"));
  const btn = document.getElementById(`policy-${policy}`);
  if (btn) btn.classList.add("active");
}

document.getElementById("policy-strict").onclick = () => setPolicy("strict");
document.getElementById("policy-standard").onclick = () => setPolicy("standard");
document.getElementById("policy-soft").onclick = () => setPolicy("soft");
document.getElementById("policy-off").onclick = () => setPolicy("off");

const domainInput = document.getElementById("domainInput");
const whitelistEl = document.getElementById("whitelist");

document.getElementById("addWhitelist").onclick = async () => {
  const domain = domainInput.value.trim();
  if (!domain) return;
  let { whitelist = [] } = await chrome.storage.sync.get("whitelist");
  if (!whitelist.includes(domain)) whitelist.push(domain);
  await chrome.storage.sync.set({ whitelist });
  renderWhitelist(whitelist);
  domainInput.value = "";
};

async function renderWhitelist(whitelist) {
  whitelistEl.innerHTML = "";
  whitelist.forEach((domain) => {
    const li = document.createElement("li");
    li.textContent = domain;
    whitelistEl.appendChild(li);
  });
}

// Load recommendation for the current tab and update UI
async function loadRecommendation() {
  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  if (!tab?.url) return;
  const domain = new URL(tab.url).hostname.replace(/^www\./,"");

  const res = await chrome.runtime.sendMessage({ type:"risk:get", domain });
  // res = { score, level: "low|mid|high", recommend: "soft|standard|strict", reasons: [...] }

  const box = document.getElementById("recBox");
  if (box) {
    box.innerHTML = `
      <div><b>Bewertung:</b> ${res.score}/100</div>
      <div><b>Risiko-Level:</b> ${res.level.toUpperCase()}</div>
      <div><b>Empfehlung:</b> ${res.recommend.toUpperCase()}</div>
      <div><b>Gründe:</b><ul>${(res.reasons||[]).map(r=>`<li>${r}</li>`).join("")}</ul></div>
    `;
    document.querySelectorAll("button").forEach(b => b.classList.remove("active"));
    const btn = document.getElementById(`policy-${res.recommend}`);
    if (btn) btn.classList.add("active");
  }
}

// Initiales Laden
(async () => {
  const { whitelist = [] } = await chrome.storage.sync.get("whitelist");
  renderWhitelist(whitelist);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    const domain = new URL(tab.url).hostname.replace(/^www\./, "");
    const { policies = {} } = await chrome.storage.sync.get("policies");
    const currentPolicy = policies[domain];
    if (currentPolicy) {
      const btn = document.getElementById(`policy-${currentPolicy}`);
      if (btn) btn.classList.add("active");
    }
  }
  // NEU: Empfehlung laden
  await loadRecommendation();
})();