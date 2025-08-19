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
  - Falls du **keine Live-Websuche** machen kannst: Nutze dein vorhandenes Wissen und gib die **besten dir bekannten** seriösen Quellen aus, sofern sie die Kriterien voraussichtlich erfüllen. Nur wenn wirklich nichts passt, gib eine **leere Liste** zurück.
  
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
    const oaController = new AbortController();
    const oaTimeout = setTimeout(() => oaController.abort(), 15000);
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
      signal: oaController.signal,
    }).catch((e) => {
      console.error("OpenAI fetch error:", e);
      throw e;
    });
    clearTimeout(oaTimeout);
    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => "");
      console.error("OpenAI response not ok:", openaiRes.status, errText);
      return NextResponse.json({ error: "LLM-Antwort fehlgeschlagen", status: openaiRes.status }, { status: 502 });
    }

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
        console.log("Kandidaten vor Server-Filtern:", alternatives);
      } catch (parseError) {
        console.error("Fehler beim Parsen der JSON-Antwort von GPT:", parseError);
      }
    } catch (parseError) {
      console.error("Fehler beim Parsen der JSON-Antwort von GPT:", parseError);
    }

    // --- Präzisions-Filter & Score-Validierung über Scan-API ----------------------
    // Tokenisierung mit Stopwords (de/en) und Mindestlänge
    const stopwords = new Set([
      "und","oder","the","and","for","für","mit","ohne","ein","eine","einer","eines","einem","einen","zu","zum","zur","von","im","in","auf","an",
      "bei","am","der","die","das","den","des","dem","it","is","are","of","to","on","at","by","about","über","etc","et","als","wie","was","ist",
      "www","http","https","de","en","com"
    ]);
    function normalize(s: string) {
      return s
        .toLowerCase()
        .replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss");
    }
    const rawTokens = normalize(query || "")
      .split(/[^a-z0-9\-+]+/i)
      .map(t => t.trim())
      .filter(Boolean);
    const tokens = rawTokens.filter(t => {
      if (stopwords.has(t)) return false;
      if (/^\d+$/.test(t)) return true; // Zahlen zulassen
      return t.length >= 3;
    });

    // Dedupliziere nach Hostname und filtere nach AND-Match der Tokens
    const seenHosts = new Set<string>();
    const origin = req.nextUrl?.origin || "";
    const scanEndpoint = origin ? origin + "/api/scan" : "/api/scan";

    const scanCache = new Map<string, number | null>();

    async function getScanScore(u: string, timeoutMs = 12000): Promise<number | null> {
      if (scanCache.has(u)) return scanCache.get(u)!;
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
        if (!res.ok) {
          scanCache.set(u, null);
          return null;
        }
        const data = await res.json();
        const score = typeof data?.score === "number" ? data.score : null;
        scanCache.set(u, score);
        return score;
      } catch {
        scanCache.set(u, null);
        return null;
      }
    }

    // Normalisiere Kandidaten-Struktur
    const normalized = Array.isArray(alternatives) ? alternatives.map((item: any) => ({
      name: String(item?.name || "").trim(),
      url: String(item?.url || "").trim(),
      description: String(item?.description || "").trim(),
    })) : [];

    // Scoring-basierte Schlagwortprüfung (über name+description+url+Hostname)
    function matchScore(item: {name: string; url: string; description: string}) {
      const hay = normalize(item.name + " " + item.description + " " + item.url);
      let host = "";
      try { host = normalize(new URL(item.url).hostname.replace(/^www\./,"")); } catch {}
      const hayFull = hay + " " + host + " " + host.replace(/\./g," ");
      let score = 0;
      for (const tok of tokens) {
        if (!tok) continue;
        if (hayFull.includes(tok)) score += 1;
      }
      return score;
    }

    // Filter, dedupe, limit und Scan-Validierung (≥65)
    async function filterAndValidate(candidates: any[]) {
      const results: any[] = [];
      for (const item of candidates) {
        if (!item.url || !item.name) continue;
        // Host-Dedupe
        let host = "";
        try {
          host = new URL(item.url).hostname.replace(/^www\./, "");
          if (seenHosts.has(host)) continue;
        } catch { continue; }
        // Score-basierte Tokenprüfung
        const nTok = tokens.length;
        const score = matchScore(item);
        // Benötigte Treffer: alle bei wenigen Tokens, sonst 60% Rundung auf
        const needed = nTok <= 2 ? nTok : Math.ceil(nTok * 0.6);
        if (nTok > 0 && score < needed) continue;
        // Scan validieren
        const scanScore = await getScanScore(item.url);
        if (scanScore !== null && scanScore >= 65) {
          seenHosts.add(host);
          results.push(item);
        }
        if (results.length >= 3) break;
      }
      return results;
    }
    
    // Pass 1: strenger Modus
    let filtered = await filterAndValidate(normalized);
    
    // Pass 2 (Fallback): wenn nichts gefunden, reduziere Anforderung auf mind. 1 Token-Treffer
    if (filtered.length === 0 && tokens.length > 0) {
      async function filterRelaxed(candidates: any[]) {
        const results: any[] = [];
        for (const item of candidates) {
          if (!item.url || !item.name) continue;
          let host = "";
          try {
            host = new URL(item.url).hostname.replace(/^www\./, "");
            if (seenHosts.has(host)) continue;
          } catch { continue; }
          const score = matchScore(item);
          if (score < 1) continue; // Mind. ein Token muss matchen
          const scanScore = await getScanScore(item.url);
          if (scanScore !== null && scanScore >= 65) {
            seenHosts.add(host);
            results.push(item);
          }
          if (results.length >= 3) break;
        }
        return results;
      }
      filtered = await filterRelaxed(normalized);
    }
    
    // Wenn weiterhin keine passenden Seiten, leeres Array (keine Auffüllung)
    return NextResponse.json({ alternatives: filtered });
  } catch (error) {
    console.error("Fehler bei smart-search:", error);
    return NextResponse.json({ error: "Fehler beim Verarbeiten der Anfrage." }, { status: 500 });
  }
}