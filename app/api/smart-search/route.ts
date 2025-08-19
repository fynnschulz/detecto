import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { query } = body;

  if (!query || typeof query !== "string" || query.length < 2) {
    return NextResponse.json({ error: "Ungültige oder zu kurze Anfrage." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Fehlender API-Key." }, { status: 500 });
  }

  const prompt = `
  Du bist ein Datenschutz- und Sicherheitsprüfer. Liefere nur Webseiten, die **thematisch exakt** zur Suchanfrage passen **und** beim Detecto-Scan gemäß identischer Kriterien mindestens **65 %** erreichen würden.
  
  **Identische Kriterien zum Scan-Tool (unbedingt beachten):**
  - Datenschutzqualität (Datenminimierung, Transparenz, Nutzerkontrolle/Consent)
  - Drittanbieter-/Tracker-Fußabdruck (Google/Meta/Hotjar/Hubspot/LinkedIn/Matomo etc.)
  - Security-Basics (HTTPS, moderne Header wie CSP/HSTS/XFO sofern sinnvoll)
  - Cookie-Banner: echte Einwilligung, keine Zwangs-Opt-in-Dark Patterns
  - Policy-/DSGVO-Prüfung: Privacy/Datenschutz, Cookies, AGB/Terms, Impressum/Legal werden berücksichtigt; erkennbare Lücken/Verstöße (z. B. fehlende Rechtsgrundlagen, keine Betroffenenrechte, kein DPO, unklare Drittlandtransfers) würden die Bewertung unter 65 % drücken
  - Realismus: einfache Info-/Kontaktseiten werden nicht überhart bewertet, sofern transparent und sparsam
  
  **Strenge Themenrelevanz (Präzision):**
  - Interpretiere die Suchanfrage als Schlagwort-AND-Filtern. Alle Kernbegriffe der Anfrage müssen semantisch erfüllt sein.
  - Schlage **keine** Seiten vor, die nur vage passen oder nur Teilaspekte behandeln.
  
  **Ausgaberegeln:**
  - Gib **0 bis 3** Ergebnisse zurück (niemals auf 3 auffüllen, wenn weniger passen).
  - Wenn **keine** Seite die Kriterien erfüllt, gib **eine leere JSON-Liste** [] zurück.
  - Jedes Ergebnis muss die Kriterien (inkl. DSGVO/Policy-Check) voraussichtlich **≥ 65 %** erfüllen.
  - Beschreibung: kurz und präzise, warum **thematisch passend** und **datenschutztechnisch solide** (max. 220 Zeichen).
  
  Gib **exakt** dieses JSON zurück (ohne Vorwort/Erklärung/Markdown):
  [
    {
      "name": "Webseitenname",
      "url": "https://...",
      "description": "Warum diese Seite sicher und thematisch passend ist"
    }
  ]
  
  Suchanfrage: ${query}
  `;

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
      }),
    });

    const data = await openaiRes.json();
    const content = data.choices?.[0]?.message?.content || "";
    console.log("GPT-Response:", content);

    let alternatives: any[] = [];

    try {
      const firstBrace = content.indexOf("[");
      const lastBrace = content.lastIndexOf("]");
      const jsonString = content.slice(firstBrace, lastBrace + 1);
      console.log("Als JSON extrahiert:", jsonString);
      try {
        alternatives = JSON.parse(jsonString);
      } catch (parseError) {
        console.error("Fehler beim Parsen der JSON-Antwort von GPT:", parseError);
      }
    } catch (parseError) {
      console.error("Fehler beim Parsen der JSON-Antwort von GPT:", parseError);
    }

    // --- Präzisions-Filter & Score-Validierung über Scan-API ----------------------
    const tokens = (query || "")
      .toLowerCase()
      .split(/[^a-z0-9äöüß\-+]+/i)
      .filter(t => t && t.length > 1);
    
    // Dedupliziere nach Hostname und filtere nach AND-Match der Tokens
    const seenHosts = new Set<string>();
    const origin = req.nextUrl?.origin || "";
    const scanEndpoint = origin ? origin + "/api/scan" : "/api/scan";
    
    async function getScanScore(u: string, timeoutMs = 12000): Promise<number | null> {
      try {
        const controller = new AbortController();
        const to = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(scanEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: u }),
          signal: controller.signal,
        });
        clearTimeout(to);
        if (!res.ok) return null;
        const data = await res.json();
        const score = typeof data?.score === "number" ? data.score : null;
        return score;
      } catch {
        return null;
      }
    }
    
    // Normalisiere Kandidaten-Struktur
    const normalized = Array.isArray(alternatives) ? alternatives.map((item: any) => ({
      name: String(item?.name || "").trim(),
      url: String(item?.url || "").trim(),
      description: String(item?.description || "").trim(),
    })) : [];
    
    // Präzise Schlagwortprüfung (AND über name+description+url)
    function matchesAllTokens(item: {name: string; url: string; description: string}) {
      const hay = (item.name + " " + item.description + " " + item.url).toLowerCase();
      return tokens.every(tok => hay.includes(tok));
    }
    
    // Filter, dedupe, limit und Scan-Validierung (≥65)
    const filtered = [];
    for (const item of normalized) {
      if (!item.url || !item.name) continue;
      if (!matchesAllTokens(item)) continue;
      try {
        const host = new URL(item.url).hostname.replace(/^www\./, "");
        if (seenHosts.has(host)) continue;
        seenHosts.add(host);
      } catch {
        continue;
      }
      // Score validieren
      const score = await getScanScore(item.url);
      if (score !== null && score >= 65) {
        filtered.push(item);
      }
      if (filtered.length >= 3) break; // Max 3 Ergebnisse
    }
    
    // Wenn keine passenden Seiten, leeres Array zurückgeben (keine Auffüllung)
    return NextResponse.json({ alternatives: filtered });
  } catch (error) {
    console.error("Fehler bei smart-search:", error);
    return NextResponse.json({ error: "Fehler beim Verarbeiten der Anfrage." }, { status: 500 });
  }
}