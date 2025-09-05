// Protecto Content Script – CMP (Cookie Banner) Shim
// Ziel: Cookie-Banner automatisch auf "Ablehnen/Nur notwendig" stellen (wenn möglich)
// Stealth: keine sichtbaren Fehler, vorsichtige DOM-Interaktion, nur 1x pro Seite

(function () {
  'use strict';

  // Nur im Top-Frame ausführen (nicht in eingebetteten iframes)
  try { if (window.top !== window) return; } catch { /* cross-origin, sicherheitshalber beenden */ return; }

  const LOG_PREFIX = '[Protecto][CMP]';
  const doneKey = 'protecto_cmp_done';
  if (sessionStorage.getItem(doneKey)) {
    // Bereits erledigt in dieser Tab-Session
    return;
  }

  const hostname = location.hostname.replace(/^www\./, '');

  // Whitelist-Check: Domains überspringen, die der Nutzer ausgenommen hat
  async function isWhitelisted(host){
    try {
      const { whitelist = [] } = await chrome.storage.sync.get('whitelist');
      return Array.isArray(whitelist) && whitelist.includes(host);
    } catch { return false; }
  }

  let didAct = false;

  function safeLog(...args) {
    try { console.debug(LOG_PREFIX, ...args); } catch {}
  }

  // Utility: kleines Delay
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Utility: Button anklicken, ohne Scroll-Jumps/Side-Effects
  function clickSilently(btn) {
    try {
      if (!btn || typeof btn.click !== 'function') return false;
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    } catch { return false; }
  }

  // Negative Muster (niemals klicken)
  const AVOID_PATTERNS = [
    /alle\s*akzeptieren|accept\s*all|agree\s*all|zustimmen|einwilligen|akzeptieren/i,
    /allow\s*all|permit\s*all|consent/i
  ];

  // Positive Muster (gezielt ablehnen/nur notwendig)
  const REJECT_PATTERNS = [
    /nur\s*(notwendig|essentials|erforderlich)/i,
    /ablehnen|reject\s*all|decline|refuse|deny/i,
    /funktional(e)?\s*(cookies)?\s*(zulassen|erlauben)/i
  ];

  // Häufige CMP-Selektoren
  const SELECTORS = [
    // OneTrust
    '#onetrust-reject-all-handler',
    '.onetrust-reject-all-handler',
    '.ot-sdk-container .ot-pc-refuse-all-handler',
    '.ot-sdk-row .ot-pc-refuse-all-handler',
    // Didomi
    'button[data-action="reject"]',
    'button.didomi-components-button--decline',
    // Cookiebot
    '#CybotCookiebotDialogBodyButtonDecline',
    '#CybotCookiebotDialogBodyButtonOnlyNecessary',
    // Quantcast / Sourcepoint (häufige Klassen)
    'button[mode="reject_all"]',
    'button[aria-label*="reject" i]',
    'button[aria-label*="decline" i]',
    'button.sp_choice_type_11', // decline
    'button[title*="reject" i]'
  ];

  // Shadow-DOM aware Suche: traversiert offene ShadowRoots
  function* allNodesWithShadow(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
      const el = /** @type {HTMLElement} */ (walker.currentNode);
      yield el;
      if (el.shadowRoot) {
        yield* allNodesWithShadow(el.shadowRoot);
      }
    }
  }

  function findByText(root) {
    for (const el of allNodesWithShadow(root)) {
      if (!(el instanceof HTMLElement)) continue;
      const tag = el.tagName.toLowerCase();
      if (tag !== 'button' && tag !== 'a' && tag !== 'div') continue;
      const txt = (el.innerText || el.textContent || '').trim();
      if (!txt) continue;
      if (AVOID_PATTERNS.some(re => re.test(txt))) continue; // niemals auf "Accept" klicken
      if (REJECT_PATTERNS.some(re => re.test(txt))) return el;
    }
    return null;
  }

  function findBySelectors(root) {
    for (const sel of SELECTORS) {
      try {
        const direct = root.querySelector(sel);
        if (direct) return direct;
        // Shadow DOM breit durchsuchen
        for (const el of allNodesWithShadow(root)) {
          if (el.shadowRoot) {
            const hit = el.shadowRoot.querySelector(sel);
            if (hit) return hit;
          }
        }
      } catch {}
    }
    return null;
  }

  async function tryRejectOnce(stage) {
    try {
      // 1) Schnelle Selektor-Suche
      let btn = findBySelectors(document);
      if (!btn) {
        // 2) Fallback: Textbasierte Suche
        btn = findByText(document);
      }
      if (btn) {
        const ok = clickSilently(btn);
        if (ok) {
          didAct = true;
          safeLog(`Reject via ${stage}:`, btn);
          return true;
        }
      }
    } catch {}
    return false;
  }

  // MutationObserver: wartet kurz auf nachträglich eingefügte Banner
  function observeShortWindow(ms = 2500) {
    return new Promise((resolve) => {
      const to = setTimeout(() => { try { mo.disconnect(); } catch {} resolve(false); }, ms);
      const mo = new MutationObserver(() => {
        tryRejectOnce('observer').then(hit => {
          if (hit) {
            clearTimeout(to);
            try { mo.disconnect(); } catch {}
            resolve(true);
          }
        });
      });
      try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch {}
    });
  }

  async function run() {
    // Phase 1: sofort probieren
    if (await tryRejectOnce('instant')) return finish(true);

    // Phase 2: kurz nach DOMContentLoaded
    if (document.readyState === 'loading') {
      await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
    }
    if (await tryRejectOnce('domcontent')) return finish(true);

    // Phase 3: kurze Beobachtung (CMPs bauen oft asynchron)
    const observed = await observeShortWindow(3000);
    if (observed) return finish(true);

    // Phase 4: Small retry after a tiny wait
    await sleep(500);
    if (await tryRejectOnce('retry')) return finish(true);

    finish(false);
  }

  function finish(success) {
    try {
      sessionStorage.setItem(doneKey, '1');
      const msg = { type: 'risk:signal', domain: hostname, cmp: { hasLegit: false, onlyNecessary: !!success } };
      try { chrome.runtime?.sendMessage?.(msg, () => {}); } catch {}
      safeLog(success ? 'Banner rejected (or set to essentials).' : 'No banner action taken.');
    } catch {}
  }

  // Safeguard-Timer: nicht ewig hängen bleiben
  setTimeout(() => { if (!didAct) finish(false); }, 8000);

  // Start nur, wenn Domain nicht auf Whitelist steht
  (async () => {
    try {
      if (await isWhitelisted(hostname)) {
        sessionStorage.setItem(doneKey, '1');
        return;
      }
      run();
    } catch { run(); }
  })();
  return; // verhindert doppelten Start weiter unten

  // Start wird oben über den Whitelist-Guard getriggert
})();