(function(){
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const scoreCircle = $('#scoreCircle');
  const scoreText   = $('#scoreText');
  const labelsEl    = $('#labels');
  const reasonsEl   = $('#reasons');
  const redirectsTodayEl = $('#redirToday');
  const redirectsTotalEl = $('#redirTotal');
  const toggleEl    = $('#protectionToggle');
  const neverInput  = $('#neverInput');
  const addNeverBtn = $('#addNeverBtn');
  const neverListEl = $('#neverProtectList');

  function colorForScore(s){
    if (s >= 75) return 'var(--bad)';
    if (s >= 45) return 'var(--warn)';
    return 'var(--ok)';
  }

  function setScore(score){
    const val = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : '—';
    scoreCircle.textContent = String(val);
    if (typeof val === 'number') {
      scoreCircle.style.background = colorForScore(val);
    } else {
      scoreCircle.style.background = '#263042';
    }
    scoreCircle.style.borderColor = 'rgba(255,255,255,.08)';
    scoreText.textContent = 'Live‑Heuristik 1–100 (100 = hoch)';
  }

  function hostnameOf(u){ try { return new URL(u).hostname.replace(/^www\./,''); } catch { return ''; } }

  async function getActiveTab(){
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function initPolicy(domain){
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'policy:get', domain }, (res)=>{
        try{
          const pol = (res && res.policy) || 'on';
          toggleEl.checked = pol === 'on';
          resolve(pol);
        }catch{ resolve('on'); }
      });
    });
  }

  function renderReasons(items){
    reasonsEl.innerHTML = '';
    if (!items || !items.length){
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Noch keine Daten – Seite neu laden.';
      reasonsEl.appendChild(li);
      return;
    }
    for (const it of items){
      const li = document.createElement('li');
      li.textContent = it;
      reasonsEl.appendChild(li);
    }
  }

  function renderLabels(pills){
    labelsEl.innerHTML = '';
    (pills||[]).forEach(txt=>{
      const span = document.createElement('span');
      span.className = 'pill';
      span.textContent = txt;
      labelsEl.appendChild(span);
    });
  }

  async function loadNeverProtect(){
    const { neverProtect = [] } = await chrome.storage.sync.get('neverProtect');
    renderNeverList(neverProtect);
  }

  function renderNeverList(arr){
    neverListEl.innerHTML = '';
    (arr||[]).forEach((d)=>{
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = d;
      const btn = document.createElement('button');
      btn.className = 'npRemove';
      btn.textContent = 'Entfernen';
      btn.addEventListener('click', async ()=>{
        const st = await chrome.storage.sync.get('neverProtect');
        const list = (st.neverProtect||[]).filter(x=>x!==d);
        await chrome.storage.sync.set({ neverProtect: list });
        renderNeverList(list);
      });
      li.appendChild(span); li.appendChild(btn);
      neverListEl.appendChild(li);
    });
  }

  addNeverBtn.addEventListener('click', async ()=>{
    const valRaw = (neverInput.value||'').trim();
    if (!valRaw) return;
    let val = valRaw.toLowerCase();
    try { if (val.startsWith('http')) val = new URL(val).hostname; } catch {}
    val = val.replace(/^www\./,'');
    const st = await chrome.storage.sync.get('neverProtect');
    const list = Array.isArray(st.neverProtect)? st.neverProtect : [];
    if (!list.includes(val)) list.push(val);
    await chrome.storage.sync.set({ neverProtect: list });
    neverInput.value = '';
    renderNeverList(list);
  });

  toggleEl.addEventListener('change', async ()=>{
    const tab = await getActiveTab();
    const domain = hostnameOf(tab?.url||'');
    if (!domain) return;
    // Respect "neverProtect": if domain is listed, force OFF visually
    const { neverProtect = [] } = await chrome.storage.sync.get('neverProtect');
    if (neverProtect.includes(domain)) { toggleEl.checked = false; return; }
    const policy = toggleEl.checked ? 'on' : 'off';
    chrome.runtime.sendMessage({ type: 'policy:set', domain, policy }, ()=>{});
  });

  // Heuristische Score-Schätzung aus gelernten Hosts (Proxy bis Telemetrie live ist)
  function estimateScoreFor(domain, learned){
    const hosts = Object.keys(learned||{});
    const base = Math.min(100, Math.round(hosts.length * 0.6));
    return Math.max(5, base);
  }

  function topFamilies(learned){
    const fams = { GA:0, GTM:0, FB:0, Adobe:0, Other:0 };
    for (const [h, v] of Object.entries(learned||{})){
      const stub = (v&&v.stub)||'generic';
      if (/facebook|fb/.test(stub)) fams.FB++;
      else if (stub==='ga') fams.GA++;
      else if (stub==='gtm') fams.GTM++;
      else if (/adobe|omtrdc/.test(h)) fams.Adobe++;
      else fams.Other++;
    }
    const pills = Object.entries(fams).filter(([,n])=>n>0).map(([k,n])=>`${k}:${n}`);
    return pills;
  }

  async function init(){
    const tab = await getActiveTab();
    const domain = hostnameOf(tab?.url||'');

    // Init toggle (policy)
    chrome.runtime.sendMessage({ type: 'policy:get', domain }, (res)=>{
      try{
        const pol = (res && res.policy) || 'on';
        toggleEl.checked = pol === 'on';
      }catch{}
    });

    await loadNeverProtect();

    chrome.runtime.sendMessage({ type: 'learned:list' }, (res)=>{
      const learned = (res && res.learned) || {};
      const score = estimateScoreFor(domain, learned);
      setScore(score);
      renderLabels(topFamilies(learned));
      const reasons = [];
      const totalHosts = Object.keys(learned).length;
      if (totalHosts>0) reasons.push(`Bereits gelernte Tracker-Hosts: ${totalHosts}`);
      reasons.push(toggleEl.checked ? 'Stealth aktiv: 200 OK + Stub (ohne 307)' : 'Schutz deaktiviert für diese Seite');
      renderReasons(reasons);
    });

    const { protecto_counts = { today: 0, total: 0 } } = await chrome.storage.local.get('protecto_counts');
    redirectsTodayEl.textContent = protecto_counts.today || 0;
    redirectsTotalEl.textContent = protecto_counts.total || 0;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
