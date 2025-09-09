// app/extension/scripts/fix-static.mjs
// Streamt static-rules.json und schreibt eine korrigierte Kopie nach static-rules.fixed.json
// Fixes:
//  - "fetch"  -> "xmlhttprequest"  (nur als Token)
//  - "extensionPath": "/src/..." -> "extensionPath":"..."  (Prefix entfernen)
//  - atomisches Schreiben über Temp-Datei + ausführliches Logging

import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const INPUT  = path.join(__dirname, "../src/static-rules.json");
const OUTPUT = path.join(__dirname, "../src/static-rules.fixed.json");
const OUTTMP = OUTPUT + ".tmp";

// --- Fallback-Regeln (werden am Ende angehängt, idempotent) ---
const FALLBACK_RULES = [
  // Scripts -> Stub (Doubleclick, Googlesyndication, Googleadservices)
  {
    id: 200201,
    priority: 1,
    condition: {
      domainType: "thirdParty",
      resourceTypes: ["script"],
      regexFilter:
        "https?:\\/\\/([^\\/]*\\.)?(doubleclick|googlesyndication|googleadservices)\\.[^\\/]+\\/",
    },
    action: { type: "redirect", redirect: { extensionPath: "/stubs/gtm.js" } },
  },
  // Images/Pings -> 1x1 GIF
  {
    id: 200202,
    priority: 1,
    condition: {
      domainType: "thirdParty",
      resourceTypes: ["image", "ping"],
      regexFilter:
        "https?:\\/\\/([^\\/]*\\.)?(doubleclick|googlesyndication|googleadservices)\\.[^\\/]+\\/",
    },
    action: {
      type: "redirect",
      redirect: {
        url: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEA", // 1x1 transparent
      },
    },
  },
  // Reine XHR/FETCH -> {} JSON
  {
    id: 200203,
    priority: 1,
    condition: {
      domainType: "thirdParty",
      resourceTypes: ["xmlhttprequest"],
      regexFilter:
        "https?:\\/\\/([^\\/]*\\.)?(doubleclick|googlesyndication|googleadservices)\\.[^\\/]+\\/",
    },
    action: { type: "redirect", redirect: { url: "data:application/json,{}" } },
  },
];

function fileContainsId(txt, id) {
  return txt.includes(`"id":${id}`);
}

function appendJsonArrayItems(filePath, items) {
  let txt = fs.readFileSync(filePath, "utf8");

  // Nur IDs einfügen, die noch nicht existieren (idempotent)
  const toAdd = items.filter((r) => !fileContainsId(txt, r.id));
  if (toAdd.length === 0) {
    console.log("• Fallbacks: bereits vorhanden – nichts zu tun.");
    return;
  }

  // Sicherstellen, dass die Datei wie ein Array endet
  const trimmed = txt.trimEnd();
  if (!trimmed.endsWith("]")) throw new Error("static-rules.fixed.json endet nicht mit ]");

  // Schließende Klammer abtrennen
  let base = trimmed.slice(0, trimmed.lastIndexOf("]"));
  // Komma setzen, falls bereits Elemente vorhanden sind
  const hasAnyElement = base.trimEnd().endsWith("[") === false;
  const payload = toAdd.map((o) => JSON.stringify(o)).join(",");

  const nextTxt = base + (hasAnyElement ? "," : "") + payload + "]\n";
  fs.writeFileSync(filePath, nextTxt);
  console.log(`• Fallbacks angehängt: +${toAdd.length} (IDs: ${toAdd.map((r) => r.id).join(", ")})`);
}

function human(n) { return new Intl.NumberFormat("de-DE").format(n); }

(async function main() {
  console.log("🔧 Streaming Fix Static Rules");
  console.log("• Input :", INPUT);
  console.log("• Output:", OUTPUT);

  if (!fs.existsSync(INPUT)) {
    console.error("❌ Input-Datei nicht gefunden:", INPUT);
    process.exit(1);
  }

  const stat = fs.statSync(INPUT);
  console.log("• Input Größe:", human(stat.size), "Bytes");
  console.time("⏱  Fix-Dauer");

  // Reader/Writer vorbereiten (Streaming)
  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  const out = fs.createWriteStream(OUTTMP, { encoding: "utf8" });

  let lineCount = 0;
  let fetchTokenCount = 0;
  let srcFixLineCount = 0;

  rl.on("line", (line) => {
    let fixed = line;

    // Echte Token "fetch" -> "xmlhttprequest"
    if (fixed.includes('"fetch"')) {
      const matches = fixed.match(/\b"fetch"\b/g);
      if (matches) fetchTokenCount += matches.length;
      fixed = fixed.replace(/\b"fetch"\b/g, '"xmlhttprequest"');
    }

    // extensionPath: "/src/..." -> "/..." (Prefix /src/ entfernen, führenden Slash beibehalten/ergänzen)
    const before = fixed;
    // 1) nur das /src/ entfernen, führenden Slash beibehalten
    fixed = fixed.replace(/"extensionPath"\s*:\s*"\/*src\//g, '"extensionPath":"/');
    // 2) falls kein führender Slash vorhanden ist, ergänzen
    fixed = fixed.replace(/"extensionPath"\s*:\s*"(?!\/)/g, '"extensionPath":"/');
    if (fixed !== before) srcFixLineCount++;

    out.write(fixed + "\n");
    lineCount++;
  });

  rl.on("close", () => {
    out.end();
  });

  out.on("close", () => {
    try {
      if (fs.existsSync(OUTPUT)) fs.rmSync(OUTPUT);
      fs.renameSync(OUTTMP, OUTPUT);
    } catch (e) {
      console.error("❌ Konnte Temp-Datei nicht nach Output umbenennen:", e.message);
      process.exit(1);
    }

    // Fallback-Regeln ans Ende anhängen (idempotent)
    appendJsonArrayItems(OUTPUT, FALLBACK_RULES);

    const outStat = fs.statSync(OUTPUT);
    console.timeEnd("⏱  Fix-Dauer");
    console.log(`✅ Fertig.\n• Zeilen verarbeitet: ${human(lineCount)}\n• \"fetch\"-Token ersetzt: ${human(fetchTokenCount)}\n• Zeilen mit extensionPath-/src/-Fix: ${human(srcFixLineCount)}\n• Output-Größe: ${human(outStat.size)} Bytes`);
  });

  rl.on("error", (e) => { console.error("❌ Lese-Fehler:", e.message); process.exit(1); });
  out.on("error", (e) => { console.error("❌ Schreib-Fehler:", e.message); process.exit(1); });
})();