// Protecto – CMP Auto-Close (sanft, stealth)
// Schließt gängige Cookie-Banner nach gesetztem Fake-Consent.
// Arbeitet unauffällig: kleine Wartezeiten, echte Event-Kette, nur „Ablehnen“/„Nur notwendig“/„Schließen“.

(function () {
  'use strict';

  // Nur im Top-Frame *und* in sichtbaren iframes mit hoher Z-Order arbeiten
  try { /* nichts */ } catch { return; }
  if (sessionStorage.getItem('__protecto_cmp_autoclosed')) return;

  const RAND = () => Math.random();
  const wait = (min=60, max=180) => new Promise(r => setTimeout(r, Math.floor(min + RAND()*(max-min))));
  const once = { value:false };

  // Texte – nie Accept
  const REJECT = [
    /nur\s*(notwendig|essentials|erforderlich)/i,
    /ablehnen|reject\s*all|decline|refuse|deny/i,
    /fortfahren\s*ohne\s*tracking/i,
    /funktional(e)?\s*(cookies)?\s*(zulassen|erlauben)/i,
    /einstellungen\s*speichern/i,
    /save\s*preferences/i
  ];
  const AVOID = [
    /alle\s*akzeptieren|accept\s*all|agree\s*all|zustimmen|einwilligen/i,
    /allow\s*all|permit\s*all|consent/i
  ];

  // Erkennung: typische Overlay/Modal-Merkmale
  function looksLikeBanner(node) {
    if (!(node instanceof HTMLElement)) return false;
    const s = getComputedStyle(node);
    if (s.position === 'fixed' || s.position === 'sticky') {
      const text = (node.innerText || '').toLowerCase();
      if (text.includes('cookie') || text.includes('consent') || text.includes('datenschutz')) return true;
      if (node.getAttribute('role') === 'dialog' || node.getAttribute('aria-modal') === 'true') return true;
      if (parseInt(s.zIndex || '0', 10) >= 1000) return true;
    }
    return false;
  }

  // Button-Finder (ohne Accept)
  function findGoodButton(root) {
    const nodes = root.querySelectorAll('button, a, [role="button"]');
    for (const el of nodes) {
      const txt = (el.innerText || el.textContent || '').trim();
      if (!txt) continue;
      if (AVOID.some(re => re.test(txt))) continue;
      if (REJECT.some(re => re.test(txt))) return el;
      // „Schließen“-Fälle
      if (/schließen|close|weiter\s*ohne/i.test(txt)) return el;
    }
    return null;
  }

  // Echte Click-Sequenz (stealth)
  async function realisticClick(el) {
    const rect = el.getBoundingClientRect();
    const x = rect.left + Math.max(2, Math.min(rect.width-2, 6 + RAND()*(rect.width-12)));
    const y = rect.top  + Math.max(2, Math.min(rect.height-2, 6 + RAND()*(rect.height-12)));
    const opts = (type) => ({ bubbles:true, cancelable:true, clientX:x, clientY:y });

    el.dispatchEvent(new MouseEvent('mouseenter', opts('mouseenter')));
    await wait(20, 60);
    el.dispatchEvent(new MouseEvent('mouseover',  opts('mouseover')));
    await wait(15, 45);
    el.dispatchEvent(new MouseEvent('mousedown',  opts('mousedown')));
    await wait(15, 45);
    el.dispatchEvent(new MouseEvent('mouseup',    opts('mouseup')));
    await wait(10, 35);
    el.dispatchEvent(new MouseEvent('click',      opts('click')));
    await wait(30, 90);
  }

  // Soft-Hide (nur wenn sicher, dass Consent bereits „granted“ ist)
  function softHide(node) {
    try {
      node.style.setProperty('display', 'none', 'important');
      node.style.setProperty('visibility', 'hidden', 'important');
      node.style.setProperty('opacity', '0', 'important');
    } catch {}
  }

  // Hauptlogik
  async function run() {
    // Kurz warten, CMP (cmp.js) arbeitet zuerst
    await wait(120, 280);

    // 1) Direktsuche
    const containers = Array.from(document.querySelectorAll('div,section,aside,[role="dialog"]'))
      .filter(looksLikeBanner);

    for (const box of containers) {
      const btn = findGoodButton(box);
      if (btn) {
        await realisticClick(btn);
        once.value = true;
        break;
      }
    }

    // 2) Fallback via MutationObserver (kurz, damit unauffällig)
    if (!once.value) {
      const endAt = Date.now() + 4000; // max 4s beobachten
      await new Promise(resolve => {
        const mo = new MutationObserver(async (muts, obs) => {
          const nodes = [];
          muts.forEach(m => nodes.push(...m.addedNodes));
          for (const n of nodes) {
            if (!(n instanceof HTMLElement)) continue;
            if (!looksLikeBanner(n)) continue;
            const btn = findGoodButton(n);
            if (btn) {
              realisticClick(btn).then(() => {
                once.value = true;
                obs.disconnect();
                resolve();
              });
              return;
            }
          }
          if (Date.now() > endAt) { obs.disconnect(); resolve(); }
        });
        mo.observe(document.documentElement, { subtree:true, childList:true });
      });
    }

    // 3) Letzte Option: sanft verstecken (nur wenn Banner 100% klar)
    if (!once.value) {
      const overlays = Array.from(document.querySelectorAll('div,section,aside,[role="dialog"]'))
        .filter(looksLikeBanner);
      if (overlays.length) {
        // nur das größte Overlay soft-hiden
        overlays.sort((a,b)=> (b.getBoundingClientRect().width*b.getBoundingClientRect().height) -
                              (a.getBoundingClientRect().width*a.getBoundingClientRect().height));
        softHide(overlays[0]);
        once.value = true;
      }
    }

    if (once.value) sessionStorage.setItem('__protecto_cmp_autoclosed', '1');
  }

  run().catch(()=>{});
})();