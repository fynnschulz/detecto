// === Helpers ===
function sendMessage(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (reply) => {
        if (chrome.runtime.lastError) return resolve(null);
        resolve(reply);
      });
    } catch {
      resolve(null);
    }
  });
}

async function getActiveTabDomain() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return null;
    const u = new URL(tab.url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function scoreColor(score) {
  if (score == null) return '#9ca3af'; // muted gray
  if (score >= 80) return '#c62828'; // bad (red)
  if (score >= 50) return '#f9a825'; // warn (yellow)
  return '#2e7d32'; // ok (green)
}

function setScoreUI(score) {
  const circle = document.getElementById('scoreCircle');
  const text = document.getElementById('scoreText');
  if (!circle || !text) return;
  const s = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : '—';
  circle.textContent = s;
  circle.style.background = scoreColor(Number(s));
  text.textContent = 'Bewertung 1–100 (100 = sehr schlecht)';
}

function setReasonsUI(reasons) {
  const ul = document.getElementById('reasons');
  if (!ul) return;
  ul.innerHTML = '';
  const list = Array.isArray(reasons) ? reasons : [];
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Keine Daten verfügbar.';
    ul.appendChild(li);
    return;
  }
  list.forEach((r) => {
    const li = document.createElement('li');
    li.textContent = r;
    ul.appendChild(li);
  });
}

function setRedirectsUI(count) {
  const el = document.getElementById('redirects');
  if (!el) return;
  const n = Number(count || 0);
  el.textContent = `Tracker umgeleitet: ${n}`;
}

async function getNeverProtect() {
  const { neverProtect = [] } = await chrome.storage.sync.get('neverProtect');
  return Array.isArray(neverProtect) ? neverProtect : [];
}

async function setNeverProtect(list) {
  await chrome.storage.sync.set({ neverProtect: list });
}

async function isDomainNeverProtected(domain) {
  const list = await getNeverProtect();
  return list.includes(domain);
}

function renderNeverList(list) {
  const ul = document.getElementById('neverProtectList');
  if (!ul) return;
  ul.innerHTML = '';
  list.forEach((domain) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = domain;
    const btn = document.createElement('button');
    btn.className = 'npRemove';
    btn.textContent = 'Entfernen';
    btn.addEventListener('click', async () => {
      const updated = (await getNeverProtect()).filter((d) => d !== domain);
      await setNeverProtect(updated);
      renderNeverList(updated);
      // Re-evaluate toggle state for current domain
      const active = await getActiveTabDomain();
      if (active && active === domain) updateToggleUIForDomain(active);
    });
    li.appendChild(span);
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function normalizeDomainInput(v) {
  try {
    v = (v || '').trim().toLowerCase();
    if (!v) return '';
    // strip protocol & path if pasted URL
    if (v.startsWith('http://') || v.startsWith('https://')) {
      const u = new URL(v);
      v = u.hostname;
    }
    return v.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function updateToggleUIForDomain(domain) {
  const toggle = document.getElementById('protectionToggle');
  if (!toggle) return;

  // If domain is in neverProtect, force OFF + disable toggle
  const never = domain ? await isDomainNeverProtected(domain) : false;
  toggle.disabled = !!never;

  // Ask worker for current policy (optional; fallback to OFF if unknown)
  let current = null;
  try {
    // Many workers keep policies in storage; if you expose getter, use it.
    // We infer via a risk call or a dedicated message if implemented.
    const reply = await sendMessage({ type: 'policy:get', domain });
    if (reply && typeof reply.policy === 'string') current = reply.policy;
  } catch {}

  // Fallback: if disabled by neverProtect → OFF visually
  if (never) {
    toggle.checked = false;
    return;
  }

  // Default to ON (standard) if no policy set
  const on = current ? current !== 'off' : true;
  toggle.checked = !!on;
}

async function applyProtectionState(domain, on) {
  // Respect neverProtect: if domain is on the list, never enable redirects.
  if (await isDomainNeverProtected(domain)) return;
  const policy = on ? 'standard' : 'off';
  await sendMessage({ type: 'policy:apply', domain, policy });
}

async function loadRiskAndStats() {
  const domain = await getActiveTabDomain();
  if (!domain) {
    setScoreUI(null);
    setReasonsUI([]);
    setRedirectsUI(0);
    return;
  }

  // risk:get should return { score, reasons: [], ... }
  const risk = (await sendMessage({ type: 'risk:get', domain })) || {};
  setScoreUI(risk.score ?? 0);
  setReasonsUI(Array.isArray(risk.reasons) ? risk.reasons : []);

  // adaptive:stats could return shape { riskyRequests, redirectedRequests } or nested per-domain
  const stats = (await sendMessage({ type: 'adaptive:stats', domain })) || {};
  let redirected = 0;
  if (typeof stats.redirectedRequests === 'number') redirected = stats.redirectedRequests;
  else if (stats.stats && stats.stats.domain && typeof stats.stats.domain.redirectedRequests === 'number') redirected = stats.stats.domain.redirectedRequests;
  setRedirectsUI(redirected);

  // Reflect toggle state
  await updateToggleUIForDomain(domain);
}

async function initNeverSection() {
  const list = await getNeverProtect();
  renderNeverList(list);

  const addBtn = document.getElementById('addNeverBtn');
  const input = document.getElementById('neverInput');
  if (addBtn && input) {
    addBtn.addEventListener('click', async () => {
      const val = normalizeDomainInput(input.value);
      if (!val) return;
      const current = await getNeverProtect();
      if (!current.includes(val)) {
        current.push(val);
        await setNeverProtect(current);
        renderNeverList(current);
        input.value = '';
        // If we just added current domain, update toggle
        const active = await getActiveTabDomain();
        if (active && active === val) updateToggleUIForDomain(active);
      }
    });
  }
}

function attachToggleHandler() {
  const toggle = document.getElementById('protectionToggle');
  if (!toggle) return;
  toggle.addEventListener('change', async () => {
    const domain = await getActiveTabDomain();
    if (!domain) return;
    // If domain is never-protected, revert UI and exit
    if (await isDomainNeverProtected(domain)) {
      toggle.checked = false;
      toggle.disabled = true;
      return;
    }
    await applyProtectionState(domain, toggle.checked);
  });
}

// === Init ===
document.addEventListener('DOMContentLoaded', async () => {
  attachToggleHandler();
  await initNeverSection();
  await loadRiskAndStats();

  // Optional: refresh when tab changes focus
  chrome.tabs.onActivated?.addListener(() => loadRiskAndStats());
  chrome.tabs.onUpdated?.addListener((tabId, info, tab) => {
    if (info.status === 'complete') loadRiskAndStats();
  });
});
