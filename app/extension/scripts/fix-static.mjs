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

    const outStat = fs.statSync(OUTPUT);
    console.timeEnd("⏱  Fix-Dauer");
    console.log(`✅ Fertig.\n• Zeilen verarbeitet: ${human(lineCount)}\n• \"fetch\"-Token ersetzt: ${human(fetchTokenCount)}\n• Zeilen mit extensionPath-/src/-Fix: ${human(srcFixLineCount)}\n• Output-Größe: ${human(outStat.size)} Bytes`);
  });

  rl.on("error", (e) => { console.error("❌ Lese-Fehler:", e.message); process.exit(1); });
  out.on("error", (e) => { console.error("❌ Schreib-Fehler:", e.message); process.exit(1); });
})();