// app/extension/engine/model.js — ES Module
// classify(url, type, initiatorHost) -> { isTracker: boolean, stub: "gtm"|"ga"|"fbq"|"generic"|null }

// ---- Config (tunable thresholds) ----
const T_SCRIPT = 4;
const T_BEACON = 3; // image|ping|xhr

// ---- Allowlist (eTLD+1 only, never stub) ----
const ALLOW_ETLD1 = [
  "jsdelivr.net", "unpkg.com", "cloudflare.com", "skypack.dev",
  "cloudflareinsights.com",
  "stripe.com", "googleapis.com", "mapbox.com",
  "recaptcha.net", "google.com", "gstatic.com"
];

function etld1(h) { const p=(h||"").toLowerCase().split('.'); return p.slice(-2).join('.'); }
function suffixMatch(host, etld) { return host===etld || host.endsWith('.'+etld); }
function isAllowedHost(h){ if(!h) return false; const e=etld1(h); return ALLOW_ETLD1.some(d => e===d || suffixMatch(h,d)); }
function hostOf(u){ try { return new URL(u).hostname.replace(/^www\./,'').toLowerCase(); } catch { return ''; } }

// ---- Families (built-ins) ----
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

function familyOfHost(h){
  const host=(h||'').toLowerCase();
  if(!host) return null;
  for(const f of FAMILY.gtm){ if(suffixMatch(host,f)) return 'gtm'; }
  for(const f of FAMILY.ga){ if(suffixMatch(host,f)) return 'ga'; }
  for(const f of FAMILY.fbq){ if(suffixMatch(host,f)) return 'fbq'; }
  for(const f of FAMILY.genericSeeds){ if(suffixMatch(host,f)) return 'generic'; }
  return null;
}

function stubFromUrlOrHost(url, host){
  const u=(url||'').toLowerCase();
  if(u.includes('gtm.js') || (host && host.includes('googletagmanager'))) return 'gtm';
  if(u.includes('/gtag/') || u.includes('/analytics.js') || (host && (host.includes('google-analytics') || host==='analytics.google.com'))) return 'ga';
  if(u.includes('fbevents.js') || (host && host.includes('facebook'))) return 'fbq';
  return 'generic';
}

// ---- Path & Query hints (built-ins) ----
const PATH_HINTS = [
  'gtm.js','/gtag/js','/analytics.js','/analytics.min.js','/ga.js',
  '/g/collect','/collect','/events','/event','/track','/tracking',
  '/pixel','/px/','/beacon','/telemetry','/metrics','/stats','/stat','/measure',
  '/pagead/','/ads/','/adservice','fbevents.js','uetcookie','uet.js','lintrk','twq.js','ttq','snaptr','pintrk'
];
const STANDARD_QUERY_HINTS = ['gclid','fbclid','msclkid','yclid','dclid']; // plus utm_

// ---- External seeds (merged at runtime) ----
let EXTERNAL = { domains: [], patterns: [], queryHints: [] };

// Cached/derived structures for O(1) checks
let SEED_HOSTS = new Set();     // exact host matches
let SEED_ETLD1 = new Set();     // base-domain matches
let PATH_HINTS_MERGED = [];     // merged & lowercased path hints
let QUERY_HINTS = [];           // merged & lowercased query hints

export function setExternalSeeds(seeds){
  try{
    if(!seeds || typeof seeds !== 'object') return;
    EXTERNAL.domains    = Array.isArray(seeds.domains)    ? seeds.domains    : [];
    EXTERNAL.patterns   = Array.isArray(seeds.patterns)   ? seeds.patterns   : [];
    EXTERNAL.queryHints = Array.isArray(seeds.queryHints) ? seeds.queryHints : [];

    // Build fast lookup sets
    SEED_HOSTS = new Set();
    SEED_ETLD1 = new Set();
    for (const raw of EXTERNAL.domains){
      const h = String(raw||'').toLowerCase().replace(/^www\./,'');
      if(!h) continue;
      SEED_HOSTS.add(h);
      SEED_ETLD1.add(etld1(h));
    }

    // Merge path hints (built-in + external patterns), lowercased & de-duplicated
    const ph = new Set(PATH_HINTS.map(p=>String(p).toLowerCase()));
    for (const p of (EXTERNAL.patterns||[])) ph.add(String(p).toLowerCase());
    PATH_HINTS_MERGED = Array.from(ph);

    // Merge query hints (standard + external), lowercased & de-duplicated
    const qh = new Set(STANDARD_QUERY_HINTS.map(q=>String(q).toLowerCase()));
    for (const q of (EXTERNAL.queryHints||[])) qh.add(String(q).toLowerCase());
    QUERY_HINTS = Array.from(qh);
  }catch{}
}

function urlHasSeedQueryHint(u){
  const url = String(u||'').toLowerCase();
  if(/([?&]utm_[^=&]+|[?&](gclid|fbclid|msclkid|yclid|dclid)=)/i.test(url)) return true;
  for(const key of QUERY_HINTS){
    if(key && url.includes(key+'=')) return true;
  }
  return false;
}

function isSeedTrackerHost(host){
  if(!host) return false;
  if (SEED_HOSTS.has(host)) return true;
  return SEED_ETLD1.has(etld1(host));
}

export function classify(url, type, initiatorHost){
  const h = hostOf(url);
  const u = String(url||'').toLowerCase();
  const t = String(type||'').toLowerCase();
  const init = (initiatorHost||'').toLowerCase();
  const is3p = (init && h) ? etld1(init) !== etld1(h) : true;

  // Never touch allowlisted eTLD+1
  if(isAllowedHost(h)) return { isTracker:false, stub:null };

  let score = 0;

  // +3: known tracker entity/domain (merged seeds)
  if (isSeedTrackerHost(h)) score += 3;

  // +2: path pattern (merged, lowercased)
  if (PATH_HINTS_MERGED.some(p => u.includes(p))) score += 2;

  // +1: query keys
  if(urlHasSeedQueryHint(u)) score += 1;

  // +1: resource type
  if(["script","image","ping","xmlhttprequest"].includes(t)) score += 1;

  // +1: third‑party
  if(is3p) score += 1;

  const isJsLike = (t === 'script' || t === 'xmlhttprequest' || t === 'ping');
  const isTracker = (isJsLike && score >= T_SCRIPT) || (!isJsLike && score >= T_BEACON);
  if(!isTracker) return { isTracker:false, stub:null };

  const fam = familyOfHost(h);
  const stub = fam || stubFromUrlOrHost(u,h) || 'generic';
  return { isTracker:true, stub };
}