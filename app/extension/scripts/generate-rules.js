#!/usr/bin/env node
/**
 * Generate static MV3 DNR redirect rules from EasyPrivacy.
 * Input : ../data/easyprivacy.txt  (ABP syntax)
 * Output: ../rules.generated.json  (Chrome MV3 declarativeNetRequest rules)
 *
 * Docs:
 * - DNR API & schema: https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
 * - web_accessible_resources needed for extensionPath redirects.
 */

const fs = require("fs");
const path = require("path");

// ---- CONFIG ----
const INPUT = path.resolve(__dirname, "../data/easyprivacy.txt");
const OUTPUT = path.resolve(__dirname, "../src/rules.easyprivacy.json");
const START_ID = 100000;          // IDs nicht mit deinen dynamischen Regeln kollidieren lassen
const MAX_RULES = 30000;         // statisches Budget anpeilen

// Welche Ressourcentypen wir generell erzeugen
const TYPES_ALL = ["script","image","xmlhttprequest","fetch","ping"]; // 'beacon' wird als 'ping' gezählt
// Mapping für Redirect-Ziele je Typ
const REDIRECTS = {
  script: { extensionPath: "/src/stubs/gtm.js" }, // generischer Stub (stelle sicher: web_accessible_resources!)
  image:  { url: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEA" },
  xmlhttprequest: { url: "data:application/json,{}" },
  fetch:  { url: "data:application/json,{}" },
  ping:   { url: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEA" },
};

// Einfache Parser-Helfer für ABP/EasyList-Linien
const isComment = (l) => !l || l.startsWith("!");         // Kommentare
const isException = (l) => l.startsWith("@@");             // Ausnahmen
const hasRegexDelim = (l) => l.startsWith("/") && l.endsWith("/"); // regex -> überspringen (zu teuer/unspezifisch)
const cleanup = (s) => s.trim();

// Host aus Regeln wie "||domain.tld^" oder "||sub.domain.tld^/path$script"
function extractHost(line) {
  // nur Rules mit ||…^ verarbeiten
  const m = line.match(/\|\|([^\/\^\*\|]+)\^/);
  return m ? m[1].toLowerCase() : null;
}

// Typ-Modifier ($script, $image, $ping, $xhr/fetch, …)
function extractTypes(line) {
  const m = line.split("$")[1];
  if (!m) return null; // keine Einschränkung → wir nehmen TYPES_ALL
  const raw = m.split(",").map(s => s.trim().toLowerCase());
  const types = new Set();
  if (raw.includes("script")) types.add("script");
  if (raw.includes("image")) types.add("image");
  if (raw.includes("ping") || raw.includes("beacon")) types.add("ping");
  if (raw.includes("xmlhttprequest") || raw.includes("xhr")) types.add("xmlhttprequest");
  if (raw.includes("fetch")) types.add("fetch");
  // wenn nichts Erkanntes drin: null → fall back auf TYPES_ALL
  return types.size ? Array.from(types) : null;
}

// Einige offensichtliche Ausnahmen überspringen (z. B. first-party-CDNs etc. → minimal halten)
function shouldSkipDomain(host) {
  // Sehr grob – hier kannst du Whitelist ergänzen
  const allow = [
    "accounts.google.com",
    "staticxx.facebook.com",
    "consent.cookiebot.com"
  ];
  return allow.includes(host);
}

function makeRule(id, host, resourceTypes) {
  // Für jeden Typ eine eigene Regel (feineres Matching, besseres Debugging)
  return resourceTypes.map(rt => ({
    id: id++,
    priority: 1,
    condition: {
      // Statisch: requestDomains is effizienter & MV3-freundlich
      requestDomains: [host],
      domainType: "thirdParty",
      resourceTypes: [rt],
    },
    action: {
      type: "redirect",
      redirect: REDIRECTS[rt] || { url: "data:text/plain," }
    }
  }));
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error("Input not found:", INPUT);
    process.exit(1);
  }
  const lines = fs.readFileSync(INPUT, "utf8")
    .split(/\r?\n/)
    .map(cleanup)
    .filter(Boolean);

  let id = START_ID;
  const seen = new Set(); // hosts de-dupe
  const rules = [];

  for (const line of lines) {
    if (isComment(line) || isException(line) || hasRegexDelim(line)) continue;

    // Nur Regeln mit ||…^ nehmen (klassische Host-Regeln)
    const host = extractHost(line);
    if (!host) continue;
    if (shouldSkipDomain(host)) continue;
    if (seen.has(host)) continue;
    seen.add(host);

    // Ressourcentypen aus $-Modifikatoren, sonst alles
    const types = extractTypes(line) || TYPES_ALL;
    const perTypeRules = makeRule(id, host, types);
    id += perTypeRules.length;
    rules.push(...perTypeRules);

    if (rules.length >= MAX_RULES) break;
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(rules, null, 2));
  console.log(`Wrote ${rules.length} redirect rules to ${OUTPUT}`);
}

main();