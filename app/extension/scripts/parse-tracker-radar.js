#!/usr/bin/env node
// Protecto – Tracker Radar -> MV3 DNR Redirect Rules (compact & prioritized)
"use strict";

const fs = require("fs");
const path = require("path");

// ---- Pfade ----
const INPUT_DIR = path.resolve(__dirname, "../data/tracker-radar/domains");
const OUTPUT    = path.resolve(__dirname, "../src/rules.tracker-radar.json");

// ---- Limits / Konstante ----
const MAX_RULES   = 120000;                 // Chrome-bekömmlich
const PER_HOST    = 2;                      // 1x script, 1x non-script
const MAX_HOSTS   = Math.floor(MAX_RULES / PER_HOST);

const STUB_PATH   = "/src/stubs/gtm.js";
const GIF_1x1     = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEA";
const EMPTY_JSON  = "data:application/json,{}";

function isLikelyHost(h) {
  if (!h || typeof h !== "string") return false;
  if (h.length > 253) return false;
  if (h.endsWith(".")) return false;
  const labels = h.split(".");
  if (labels.length < 2) return false;
  return labels.every(l => /^[a-z0-9-]{1,63}$/i.test(l) && !/^[-]/.test(l) && !/[-]$/.test(l));
}

function collectJsonFiles(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(collectJsonFiles(p));
    else if (e.isFile() && e.name.endsWith(".json")) out.push(p);
  }
  return out;
}

function scoreFromJson(j) {
  const s = Number(j?.sites) || 0;
  const p = Number(j?.prevalence) || 0;
  // stärker auf „sites“ gewichten, Prevalence als feines Signal
  return s * 10 + p;
}

function hostsFromJsonFile(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    const base = (j.domain || path.basename(file).replace(/\.json$/,"")).toLowerCase();
    const subs = Array.isArray(j.subdomains) ? j.subdomains : [];
    const hosts = new Set();
    if (isLikelyHost(base)) hosts.add(base);
    for (const s of subs) {
      const h = `${s}.${base}`.toLowerCase();
      if (isLikelyHost(h)) hosts.add(h);
    }
    return { hosts: [...hosts], score: scoreFromJson(j) };
  } catch {
    return { hosts: [], score: 0 };
  }
}

function buildRulesForHost(idStart, host) {
  // 1) Scripts -> Stub
  const ruleScript = {
    id: idStart,
    priority: 1,
    action: { type: "redirect", redirect: { extensionPath: STUB_PATH } },
    condition: {
      domainType: "thirdParty",
      requestDomains: [host],
      resourceTypes: ["script"]
    }
  };
  // 2) Non-scripts -> Data URLs
  const ruleOther = {
    id: idStart + 1,
    priority: 1,
    action: { type: "redirect", redirect: { url: GIF_1x1 } }, // für image/ping
    condition: {
      domainType: "thirdParty",
      requestDomains: [host],
      resourceTypes: ["image", "xmlhttprequest", "fetch", "ping"]
    }
  };
  return [ruleScript, ruleOther];
}

(function main(){
  const t0 = Date.now();

  if (!fs.existsSync(INPUT_DIR)) {
    console.error("INPUT missing:", INPUT_DIR);
    process.exit(1);
  }

  const files = collectJsonFiles(INPUT_DIR);
  console.log("Gefundene JSON-Dateien:", files.length);

  // Aggregate: host -> max score aus allen Dateien
  const hostScore = new Map();
  for (const f of files) {
    const { hosts, score } = hostsFromJsonFile(f);
    for (const h of hosts) {
      const prev = hostScore.get(h) || 0;
      if (score > prev) hostScore.set(h, score);
    }
  }

  // Hosts nach Score sortieren, Top-N nehmen
  const sorted = [...hostScore.entries()]
    .sort((a,b) => b[1] - a[1])
    .slice(0, MAX_HOSTS)
    .map(([h]) => h);

  console.log("Eindeutige Hosts:", hostScore.size);
  console.log("Hosts für Regeln:", sorted.length, "(Limit:", MAX_HOSTS, ")");

  // Regeln erzeugen (2 je Host), IDs ab 300000
  const rules = [];
  let id = 300000;
  for (const h of sorted) {
    if (rules.length + PER_HOST > MAX_RULES) break;
    rules.push(...buildRulesForHost(id, h));
    id += PER_HOST;
  }

  // Datei schreiben
  fs.writeFileSync(OUTPUT, JSON.stringify(rules, null, 2));
  const mb = (fs.statSync(OUTPUT).size / (1024*1024)).toFixed(1);

  const dt = ((Date.now()-t0)/1000).toFixed(1);
  console.log(`Geschrieben: ${rules.length} Regeln -> ${OUTPUT} (${mb} MB) in ${dt}s`);
})();