

(function(){
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  async function getSync(keys){
    try { return await chrome.storage.sync.get(keys); } catch { return {}; }
  }
  async function setSync(obj){
    try { await chrome.storage.sync.set(obj); } catch {}
  }

  function normHost(v){
    try {
      return (v||'')
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//,'')
        .replace(/\/.*/, '')
        .replace(/^www\./,'');
    } catch { return ''; }
  }

  function renderPolicyLabel(mode){
    const el = $('#currentPolicyInfo');
    if (!el) return;
    const m = (mode ? String(mode).toUpperCase() : '—');
    el.textContent = `Aktueller Standard‑Modus: ${m}`;
    $$('.mode-btn').forEach(b => b.classList.remove('active'));
    if (mode) {
      const map = { soft:'#opt-soft', standard:'#opt-standard', strict:'#opt-strict' };
      const hit = $(map[mode]); if (hit) hit.classList.add('active');
    }
  }

  async function loadPolicy(){
    const { policies = {} } = await getSync('policies');
    const mode = policies['*'] || 'standard';
    renderPolicyLabel(mode);
  }

  async function setDefaultPolicy(mode){
    if (!['soft','standard','strict'].includes(mode)) return;
    const { policies = {} } = await getSync('policies');
    policies['*'] = mode; // Default für alle Domains ohne spezifische Policy
    await setSync({ policies });
    renderPolicyLabel(mode);
  }

  function renderWhitelist(list){
    const ul = $('#wl-list');
    if (!ul) return;
    ul.innerHTML = '';
    (list||[]).forEach((host) => {
      const li = document.createElement('li');
      const left = document.createElement('span'); left.className = 'domain'; left.textContent = host;
      const btn = document.createElement('button'); btn.textContent = 'Entfernen';
      btn.addEventListener('click', async () => {
        const { whitelist = [] } = await getSync('whitelist');
        const next = whitelist.filter(h => h !== host);
        await setSync({ whitelist: next });
        renderWhitelist(next);
      });
      li.append(left); li.append(btn); ul.append(li);
    });
  }

  async function loadWhitelist(){
    const { whitelist = [] } = await getSync('whitelist');
    renderWhitelist(whitelist);
  }

  async function addWhitelist(){
    const input = $('#wl-input'); if (!input) return;
    const host = normHost(input.value);
    if (!host) return;
    const { whitelist = [] } = await getSync('whitelist');
    if (!whitelist.includes(host)) {
      whitelist.push(host);
      await setSync({ whitelist });
      renderWhitelist(whitelist);
    }
    input.value = '';
  }

  async function showStats(){
    const log = $('#maint-log'); if (log) log.textContent = '…';
    try {
      chrome.runtime.sendMessage({ type: 'adaptive:stats' }, (reply) => {
        if (!reply || !reply.ok) { if (log) log.textContent = 'Keine Daten'; return; }
        const s = reply.stats || {};
        const oldest = s.oldestTs ? new Date(s.oldestTs).toLocaleString() : '—';
        const newest = s.newestTs ? new Date(s.newestTs).toLocaleString() : '—';
        if (log) log.textContent = `Gelernt: ${s.learnedCount||0} Hosts · Counter: ${s.dynRuleCounter||0} · Ältester: ${oldest} · Neuester: ${newest}`;
      });
    } catch {
      if (log) log.textContent = 'Keine Daten';
    }
  }

  async function runCleanup(){
    const log = $('#maint-log'); if (log) log.textContent = 'Bereinige…';
    try {
      chrome.runtime.sendMessage({ type: 'adaptive:cleanup', opts: { maxAgeDays: 30, maxEntries: 5000 } }, (reply) => {
        if (!reply || !reply.ok) { if (log) log.textContent = 'Cleanup fehlgeschlagen'; return; }
        if (log) log.textContent = `Cleanup ok – entfernt: ${reply.removed}, verbleibend: ${reply.remaining}`;
      });
    } catch {
      if (log) log.textContent = 'Cleanup fehlgeschlagen';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Policy-Buttons
    $('#opt-soft')?.addEventListener('click', () => setDefaultPolicy('soft'));
    $('#opt-standard')?.addEventListener('click', () => setDefaultPolicy('standard'));
    $('#opt-strict')?.addEventListener('click', () => setDefaultPolicy('strict'));

    // Whitelist
    $('#wl-add')?.addEventListener('click', addWhitelist);
    $('#wl-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addWhitelist(); });

    // Maintenance
    $('#btn-stats')?.addEventListener('click', showStats);
    $('#btn-clean')?.addEventListener('click', runCleanup);

    // Initial load
    loadPolicy();
    loadWhitelist();
  });
})();