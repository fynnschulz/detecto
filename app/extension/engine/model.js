// app/extension/engine/model.js — ES Module
// KI-basierte Entscheider- und Regelgenerator-Logik

// ---- Config (Schwellenwerte) ----
const T_SCRIPT = 4;
const T_BEACON = 3; // image|ping|xhr

// ---- Allowlist (eTLD+1 only, never stub) ----
const ALLOW_ETLD1 = [
  "jsdelivr.net", "unpkg.com", "cloudflare.com", "skypack.dev",
  "cloudflareinsights.com",
  "stripe.com", "googleapis.com", "mapbox.com",
  "recaptcha.net", "google.com", "gstatic.com"
];

// ---- Familien (built-ins) ----
const FAMILY = {
  gtm: ["googletagmanager.com"],
  ga:  ["google-analytics.com", "analytics.google.com"],
  fbq: ["facebook.net", "facebook.com", "connect.facebook.net"],
  genericSeeds: [
    // Ads/Adtech
    "doubleclick.net","googlesyndication.com","googleadservices.com","googletagservices.com",
    "adservice.google.com","adform.net","pubmatic.com","rubiconproject.com","moatads.com",
    "criteo.net","criteo.com","taboola.com","outbrain.com","quantserve.com","scorecardresearch.com",
    // Analytics/Behavior
    "hotjar.com","hotjar.io","clarity.ms","mxpnl.com","segment.com","amplitude.com",
    "heapanalytics.com","fullstory.com","newrelic.com","datadoghq-browser-agent.com",
    "sentry-cdn.com","sentry.io","intercom.io","adobedtm.com","assets.adobedtm.com",
    "matomo.cloud","piwik.pro","matomo.org",
    // Social/Marketing Pixels
    "bat.bing.com","analytics.tiktok.com","ads-twitter.com","licdn.com","pinimg.com","ads.linkedin.com"
  ]
};

// ---- Path & Query hints (built-ins) ----
const PATH_HINTS = [
  'gtm.js','/gtag/js','/analytics.js','/analytics.min.js','/ga.js',
  '/g/collect','/collect','/events','/event','/track','/tracking',
  '/pixel','/px/','/beacon','/telemetry','/metrics','/stats','/stat','/measure',
  '/pagead/','/ads/','/adservice','fbevents.js','uetcookie','uet.js','lintrk','twq.js','ttq','snaptr','pintrk'
];
const STANDARD_QUERY_HINTS = ['gclid','fbclid','msclkid','yclid','dclid']; // plus utm_

// ---- Externe Seeds (werden zur Laufzeit gemerged) ----
let EXTERNAL = { domains: [], patterns: [], queryHints: [] };

// ---- Caches für O(1)-Checks ----
let SEED_HOSTS = new Set();     // exakte Hostmatches
let SEED_ETLD1 = new Set();     // Basis-Domain Matches
let PATH_HINTS_MERGED = [];     // gemergte & kleingeschriebene Pfad-Hints
let QUERY_HINTS = [];           // gemergte & kleingeschriebene Query-Hints

// Hilfsfunktionen
function etld1(host) {
  try {
    const parts = (host||"").toLowerCase().split('.');
    if(parts.length < 2) return host.toLowerCase();
    return parts.slice(-2).join('.');
  } catch {
    return "";
  }
}

function suffixMatch(host, etld) {
  return host === etld || host.endsWith('.' + etld);
}

function isAllowedHost(host) {
  if (!host) return false;
  const e = etld1(host);
  return ALLOW_ETLD1.some(d => e === d || suffixMatch(host, d));
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function familyOfHost(host) {
  const h = (host||'').toLowerCase();
  if (!h) return null;
  for (const f of FAMILY.gtm) if (suffixMatch(h, f)) return 'gtm';
  for (const f of FAMILY.ga) if (suffixMatch(h, f)) return 'ga';
  for (const f of FAMILY.fbq) if (suffixMatch(h, f)) return 'fbq';
  for (const f of FAMILY.genericSeeds) if (suffixMatch(h, f)) return 'generic';
  return null;
}

function stubForFamily(fam) {
  if (!fam) return null;
  if (['gtm', 'ga', 'fbq', 'generic'].includes(fam)) return fam;
  return 'generic';
}

function ensureStub(stub) {
  if (!stub) return 'generic';
  if (['gtm', 'ga', 'fbq', 'generic'].includes(stub)) return stub;
  return 'generic';
}

// Setzt externe Seeds und baut Caches auf
export function setExternalSeeds(seeds) {
  try {
    if (!seeds || typeof seeds !== 'object') return;
    EXTERNAL.domains = Array.isArray(seeds.domains) ? seeds.domains : [];
    EXTERNAL.patterns = Array.isArray(seeds.patterns) ? seeds.patterns : [];
    EXTERNAL.queryHints = Array.isArray(seeds.queryHints) ? seeds.queryHints : [];

    SEED_HOSTS = new Set();
    SEED_ETLD1 = new Set();
    for (const raw of EXTERNAL.domains) {
      const h = String(raw||'').toLowerCase().replace(/^www\./,'');
      if (!h) continue;
      SEED_HOSTS.add(h);
      SEED_ETLD1.add(etld1(h));
    }

    const ph = new Set(PATH_HINTS.map(p => String(p).toLowerCase()));
    for (const p of (EXTERNAL.patterns||[])) ph.add(String(p).toLowerCase());
    PATH_HINTS_MERGED = Array.from(ph);

    const qh = new Set(STANDARD_QUERY_HINTS.map(q => String(q).toLowerCase()));
    for (const q of (EXTERNAL.queryHints||[])) qh.add(String(q).toLowerCase());
    QUERY_HINTS = Array.from(qh);
  } catch {}
}

// Prüft, ob URL Query-Parameter aus den Seeds oder Standard-Parametern enthält
function urlHasSeedQueryHint(url) {
  const u = String(url||'').toLowerCase();
  if (/([?&]utm_[^=&]+|[?&](gclid|fbclid|msclkid|yclid|dclid)=)/i.test(u)) return true;
  for (const key of QUERY_HINTS) {
    if (key && u.includes(key + '=')) return true;
  }
  return false;
}

// Prüft, ob Host in Seeds enthalten ist (exakt oder eTLD+1)
function isSeedTrackerHost(host) {
  if (!host) return false;
  if (SEED_HOSTS.has(host)) return true;
  return SEED_ETLD1.has(etld1(host));
}

// Entscheidet, ob URL/Request Tracker ist und liefert Stub zurück
export function decide(url, type, initiatorHost) {
  const h = hostOf(url);
  const u = String(url||'').toLowerCase();
  const t = String(type||'').toLowerCase();
  const init = (initiatorHost||'').toLowerCase();
  const is3p = (init && h) ? etld1(init) !== etld1(h) : true;

  if (isAllowedHost(h)) return { isTracker: false, stub: null };

  let score = 0;

  if (isSeedTrackerHost(h)) score += 3;
  if (PATH_HINTS_MERGED.some(p => u.includes(p))) score += 2;
  if (urlHasSeedQueryHint(u)) score += 1;
  if (["script","image","ping","xmlhttprequest"].includes(t)) score += 1;
  if (is3p) score += 1;

  // Additional scoring for external seeds explicitly
  // Check if host matches any external family domain
  if (EXTERNAL.domains.some(d => suffixMatch(h, d))) score += 3;
  // Check if path contains any external pattern
  if (EXTERNAL.patterns.some(pat => u.includes(pat.toLowerCase()))) score += 2;
  // Check if query contains any external query hint
  if (EXTERNAL.queryHints.some(qh => qh && u.includes(qh.toLowerCase() + '='))) score += 1;

  const isJsLike = (t === 'script' || t === 'xmlhttprequest' || t === 'ping');
  const isTracker = (isJsLike && score >= T_SCRIPT) || (!isJsLike && score >= T_BEACON);
  if (!isTracker) return { isTracker: false, stub: null };

  const fam = familyOfHost(h);
  const stub = ensureStub(fam) || 'generic';
  return { isTracker: true, stub };
}

// Generiert eine eindeutige ID für neue Regeln
export async function nextRuleId() {
  try {
    const result = await chrome.storage.local.get(['nextRuleId']);
    let currentId = result.nextRuleId;
    if (typeof currentId !== 'number' || currentId < 2000) {
      currentId = 2000;
    }
    const nextId = currentId;
    await chrome.storage.local.set({ nextRuleId: nextId + 1 });
    return nextId;
  } catch {
    // Fallback if chrome.storage is not available
    if (!globalThis._fallbackRuleId) {
      globalThis._fallbackRuleId = 2000;
    }
    return globalThis._fallbackRuleId++;
  }
}

const ALLOWED_TYPES = ["script","xmlhttprequest","image","ping"];

// Propose blocking rules für eine URL basierend auf der Entscheidung
export async function proposeRulesForUrl(url, type, initiatorHost) {
  const decision = decide(url, type, initiatorHost);
  if (!decision.isTracker) return [];

  const h = hostOf(url);
  const stub = decision.stub || 'generic';

  const safeType = (typeof type === 'string' && ALLOWED_TYPES.includes(type.toLowerCase())) ? type.toLowerCase() : "script";

  // Beispiel-Regel: redirect to stub script
  const rule = {
    id: await nextRuleId(),
    action: { type: 'redirect', redirect: { extensionPath: `stubs/${stub}.js` } },
    condition: {
      urlFilter: `||${h}^`,
      resourceTypes: [safeType]
    },
    stub
  };
  console.info("[Protecto][Rule] New rule persisted:", rule.condition?.regexFilter || rule.condition?.urlFilter);
  return [rule];
}

export function debugSeedsCheck(url) {
  const u = String(url||'').toLowerCase();
  const h = hostOf(url);
  const matchedFamilies = [];
  const matchedPatterns = [];
  const matchedQueryHints = [];

  // Check external families (domains)
  for (const d of EXTERNAL.domains) {
    if (suffixMatch(h, d.toLowerCase())) {
      matchedFamilies.push(d);
    }
  }

  // Check external patterns
  for (const p of EXTERNAL.patterns) {
    if (u.includes(p.toLowerCase())) {
      matchedPatterns.push(p);
    }
  }

  // Check external query hints
  for (const qh of EXTERNAL.queryHints) {
    if (qh && u.includes(qh.toLowerCase() + '=')) {
      matchedQueryHints.push(qh);
    }
  }

  return {
    url: url,
    host: h,
    matchedFamilies,
    matchedPatterns,
    matchedQueryHints
  };
}