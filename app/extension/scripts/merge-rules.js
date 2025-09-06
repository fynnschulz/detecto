#!/usr/bin/env node
// Protecto – merge static rules (Tracker Radar + EasyPrivacy + base) -> static-rules.json
"use strict";
const fs = require("fs");
const path = require("path");

// Eingaben (falls eine fehlt, wird sie einfach übersprungen)
const IN_TR   = path.resolve(__dirname, "../src/rules.tracker-radar.json");
const IN_EP   = path.resolve(__dirname, "../src/rules.easyprivacy.json");
const IN_BASE = path.resolve(__dirname, "../src/rules.json"); // optional

// Ausgabe (minifiziert)
const OUT     = path.resolve(__dirname, "../src/static-rules.json");

// Chrome-safe Obergrenze (Reserve unter dem harten Limit)
const MAX_RULES = 140_000;

function readJsonArray(p) {
  try {
    if (!fs.existsSync(p)) return [];
    const txt = fs.readFileSync(p, "utf8");
    const arr = JSON.parse(txt);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.error("WARN: konnte nicht lesen:", p, e.message);
    return [];
  }
}

// Eindeutigkeits-Schlüssel pro Regel (Condition + Action)
function ruleKey(r) {
  const c = r.condition || {};
  const a = r.action || {};
  // Wir normalisieren Arrays für Stabilität
  const rd = (c.requestDomains || []).slice().sort().join(",");
  const rf = c.regexFilter || "";
  const uf = c.urlFilter || "";
  const dt = c.domainType || "";
  const rt = (c.resourceTypes || []).slice().sort().join(",");
  const at = a.type || "";
  const red = a.redirect || {};
  const ep = red.extensionPath || "";
  const u  = red.url || "";
  return JSON.stringify({ rd, rf, uf, dt, rt, at, ep, u });
}

// IDs neu vergeben (fortlaufend)
function reassignIds(rules, startId = 1000) {
  let id = startId;
  for (const r of rules) r.id = id++;
  return rules;
}

(function main(){
  const parts = [
    readJsonArray(IN_TR),
    readJsonArray(IN_EP),
    readJsonArray(IN_BASE),
  ];
  const counts = parts.map(a => a.length);
  console.log("Eingelesen:",
    `TrackerRadar=${counts[0]}`,
    `EasyPrivacy=${counts[1]}`,
    `Base=${counts[2]}`
  );

  // Merge + Dedupe (stabile Reihenfolge: Base < EP < TR oder anders herum je nach Priorität)
  // Hier: Base zuerst, dann EasyPrivacy, dann Tracker Radar (TR gewinnt bei Konflikt).
  const seen = new Map();
  const merged = [];
  for (const arr of parts) {
    for (const r of arr) {
      if (!r || !r.action || !r.condition) continue;
      const k = ruleKey(r);
      // Bei Konflikt: Neuere Regel ersetzt ältere -> wir löschen die alte
      if (seen.has(k)) {
        const idx = seen.get(k);
        merged[idx] = r;
      } else {
        seen.set(k, merged.length);
        merged.push(r);
      }
    }
  }

  // Kappen auf MAX_RULES (stabil von vorne)
  let final = merged.slice(0, MAX_RULES);
  // IDs neu vergeben
  final = reassignIds(final, 1000);

  // Schreiben (minifiziert)
  fs.writeFileSync(OUT, JSON.stringify(final), "utf8");

  console.log("Zusammengeführt:", merged.length);
  console.log("Abgeschnitten auf:", final.length, "(Limit:", MAX_RULES, ")");
  console.log("Ausgabe:", OUT);
})();