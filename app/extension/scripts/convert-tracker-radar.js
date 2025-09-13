#!/usr/bin/env node
// Convert & merge tracker datasets → seeds.json
//
// Sources:
//  - DuckDuckGo Tracker Radar:   domains/**/*.json
//  - Disconnect:                 services.json + entities.json
//  - EasyPrivacy (text filter):  easyprivacy.txt
//
// Usage (mit Defaults):
//   node app/extension/scripts/convert-tracker-radar.js \
//     app/resources/data/domains \
//     app/resources/data/seeds.json \
//     --disconnect-dir app/resources/data/disconnect \
//     --easyprivacy app/resources/data/easyprivacy/easyprivacy.txt
//
// Falls die Default-Pfade stimmen, reichen die ersten beiden Argumente.
const fs = require('fs');
const path = require('path');

// ---------- CLI ----------
if (process.argv.length < 4) {
  console.error('Usage: node convert-tracker-radar.js <duckduckgo_domains_dir> <output_json> [--disconnect-dir <dir>] [--easyprivacy <file>]');
  process.exit(1);
}
const INPUT_DIR = path.resolve(process.argv[2]);
const OUTPUT = path.resolve(process.argv[3]);

let DISC_DIR = null;
let EP_FILE = null;
for (let i = 4; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--disconnect-dir') {
    DISC_DIR = path.resolve(process.argv[++i]);
  } else if (a === '--easyprivacy') {
    EP_FILE = path.resolve(process.argv[++i]);
  }
}
// Defaults, wenn vorhanden
if (!DISC_DIR) {
  const def = path.resolve(INPUT_DIR, '..', 'disconnect');
  if (fs.existsSync(path.join(def, 'services.json')) && fs.existsSync(path.join(def, 'entities.json'))) {
    DISC_DIR = def;
  }
}
if (!EP_FILE) {
  const def = path.resolve(INPUT_DIR, '..', 'easyprivacy', 'easyprivacy.txt');
  if (fs.existsSync(def)) EP_FILE = def;
}

// ---------- Utils ----------
const walk = (dir) => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
};
const add = (set, v) => { if (v && typeof v === 'string') set.add(v.toLowerCase()); };
const saneDomain = (d) => (d || '')
  .toLowerCase()
  .replace(/^\*\./, '')
  .replace(/^\./, '')
  .trim();

const domainsSet   = new Set();
const patternsSet  = new Set([
  // Basis-Patterns (nützlich für Heuristik)
  '/gtm.js', '/analytics.js', '/fbevents.js',
  '/collect', '/g/collect', '/events', '/track',
  '/pixel', '/px', '/beacon', '/telemetry',
  '/metrics', '/stats', '/log', '/ads', '/adservice',
]);
const queryHintsSet = new Set(['gclid','fbclid','msclkid','yclid','dclid','utm_']);

// ---------- 1) DuckDuckGo Tracker Radar ----------
const ingestDuck = (dir) => {
  let count = 0, pattInc = 0;
  const files = walk(dir).filter(p => p.endsWith('.json'));
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (j && j.domain) {
        add(domainsSet, saneDomain(j.domain));
        count++;
      }
      if (Array.isArray(j?.resources)) {
        for (const r of j.resources) {
          const rule = r?.rule || '';
          // Grobe Extraktion von erkennbaren Pfad-Snippets
          const m = rule.match(/\/(gtm\.js|analytics\.js|fbevents\.js|collect|pixel|beacon|events|track|metrics|stats|log)(?=\/|\\b|$)/i);
          if (m) { add(patternsSet, `/${m[1].toLowerCase()}`); pattInc++; }
        }
      }
    } catch {}
  }
  return { count, pattInc };
};

// ---------- 2) Disconnect ----------
const ingestDisconnect = (dir) => {
  if (!dir) return { ents: 0, doms: 0, families: {} };
  const entsPath = path.join(dir, 'entities.json');
  const servPath = path.join(dir, 'services.json');
  if (!fs.existsSync(entsPath) || !fs.existsSync(servPath)) return { ents: 0, doms: 0, families: {} };

  let ents = 0, doms = 0;
  const families = {};

  try {
    const entsJson = JSON.parse(fs.readFileSync(entsPath, 'utf8'));
    if (entsJson && entsJson.entities && typeof entsJson.entities === 'object') {
      for (const [entityName, obj] of Object.entries(entsJson.entities)) {
        ents++;
        const familyDomains = new Set();
        if (Array.isArray(obj.properties)) {
          for (const d of obj.properties) { add(domainsSet, saneDomain(d)); doms++; familyDomains.add(saneDomain(d)); }
        }
        if (Array.isArray(obj.resources)) {
          for (const d of obj.resources) { add(domainsSet, saneDomain(d)); doms++; familyDomains.add(saneDomain(d)); }
        }
        families[entityName] = Array.from(familyDomains).sort();
      }
    }
  } catch { /* ignore */ }

  try {
    const srvJson = JSON.parse(fs.readFileSync(servPath, 'utf8'));
    // services.json hat teils domain-Arrays in Kategorien → versuchen wir mitzunehmen
    if (srvJson && typeof srvJson === 'object') {
      for (const [, cat] of Object.entries(srvJson)) {
        if (cat && typeof cat === 'object') {
          for (const [, svc] of Object.entries(cat)) {
            // Manchmal "domain": "...", manchmal "domains": [...]
            if (typeof svc?.domain === 'string') {
              add(domainsSet, saneDomain(svc.domain)); doms++;
            }
            if (Array.isArray(svc?.domains)) {
              for (const d of svc.domains) { add(domainsSet, saneDomain(d)); doms++; }
            }
          }
        }
      }
    }
  } catch { /* ignore */ }

  return { ents, doms, families };
};

// ---------- 3) EasyPrivacy ----------
const ingestEasyPrivacy = (file) => {
  if (!file || !fs.existsSync(file)) return { lines: 0, addedDomains: 0, addedPatterns: 0, addedHints: 0 };
  const txt = fs.readFileSync(file, 'utf8');
  const lines = txt.split(/\r?\n/);

  let addedDomains = 0, addedPatterns = 0, addedHints = 0;

  const isComment = (l) => !l || l.startsWith('!') || l.startsWith('[');
  const stripOptions = (l) => l.replace(/\$[^$]+$/, ''); // alles nach $… weg (Filter-Optionen)

  for (let raw of lines) {
    const line = stripOptions(raw.trim());
    if (isComment(line)) continue;

    // ||domain.tld^  (rein domain-basiert)
    let m = line.match(/^\|\|([a-z0-9._-]+\.[a-z]{2,})(?:\^|$)/i);
    if (m) {
      add(domainsSet, saneDomain(m[1])); addedDomains++;
      // Falls noch ein Pfad dahinter ist (||dom.tld/path)
      const pathPart = line.replace(/^\|\|[^\^/]+/, '');
      if (pathPart && pathPart.startsWith('/')) {
        // Nehme nur kurze, generische Segmente als Pattern
        const p = pathPart.split(/[?^]/)[0].toLowerCase();
        const pick = p.match(/\/(gtm\.js|analytics\.js|fbevents\.js|collect|pixel|beacon|events|track|metrics|stats|log|telemetry|adservice|ads)(?![a-z])/);
        if (pick) { add(patternsSet, pick[0]); addedPatterns++; }
      }
      continue;
    }

    // |https://domain.tld/path  → eher strikt, versuchen wir mild zu extrahieren
    m = line.match(/^\|https?:\/\/([a-z0-9._-]+\.[a-z]{2,})(\/[^\^$]*)?/i);
    if (m) {
      add(domainsSet, saneDomain(m[1])); addedDomains++;
      if (m[2]) {
        const p = (m[2] || '').toLowerCase();
        const pick = p.match(/\/(gtm\.js|analytics\.js|fbevents\.js|collect|pixel|beacon|events|track|metrics|stats|log|telemetry|adservice|ads)(?![a-z])/);
        if (pick) { add(patternsSet, pick[0]); addedPatterns++; }
      }
      continue;
    }

    // Query-Hints in Filtern (utm_, gclid etc.)
    if (/[\?&](utm_[a-z]+|gclid|fbclid|msclkid|yclid|dclid)/i.test(line)) {
      const q = RegExp.$1.toLowerCase();
      if (q.startsWith('utm_')) { add(queryHintsSet, 'utm_'); addedHints++; }
      else { add(queryHintsSet, q); addedHints++; }
      continue;
    }

    // reine Pfad-Shortcuts (ohne Domain), z. B. /collect
    if (/^\/(collect|pixel|beacon|events|track|metrics|stats|log|telemetry|adservice|ads)(?:[\/\.\?]|$)/i.test(line)) {
      const p = line.split(/[?^$]/)[0].toLowerCase();
      add(patternsSet, p.startsWith('/') ? p : `/${p}`);
      addedPatterns++;
      continue;
    }
  }

  return { lines: lines.length, addedDomains, addedPatterns, addedHints };
};

// ---------- Run ----------
const duck = ingestDuck(INPUT_DIR);
const disc = ingestDisconnect(DISC_DIR);
const easy = ingestEasyPrivacy(EP_FILE);

// Basis-Seed-Objekt
const seeds = {
  domains: Array.from(domainsSet).sort(),
  patterns: Array.from(patternsSet).sort(),
  queryHints: Array.from(queryHintsSet).sort(),
  families: disc.families || {}, // include families map from Disconnect
};

// Write
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(seeds, null, 2));
console.log('[convert-tracker-radar] wrote', OUTPUT);
console.log(`  duck domains : ${duck.count}`);
console.log(`  disc domains : ${disc.doms}`);
console.log(`  easy lines   : ${easy.lines}`);
console.log(`  total domains: ${seeds.domains.length}`);
console.log(`  patterns     : ${seeds.patterns.length}  queryHints: ${seeds.queryHints.length}`);