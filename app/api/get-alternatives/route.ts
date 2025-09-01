import { NextRequest, NextResponse } from "next/server";
import { htmlToText } from "html-to-text";

// Grobe Kategorie-Erkennung aus HTML-Text und Domain
function extractCategoryKeywords(text: string, domain: string): string[] {
  const src = `${domain} ${text}`.toLowerCase();
  const map: Record<string, string[]> = {
    shop: ["shop", "store", "verkauf", "kaufen", "ecommerce"],
    banking: ["bank", "konto", "überweisung", "kredit", "zahlung", "payment"],
    versicherung: ["versicherung", "policy", "schaden", "tarif"],
    gesundheit: ["gesundheit", "arzt", "clinic", "medizin", "pharma"],
    dating: ["dating", "match", "partner", "beziehung"],
    social: ["social", "community", "netzwerk", "forum"],
    cloud: ["cloud", "speicher", "storage", "drive"],
    vpn: ["vpn", "proxy", "privacy"],
    mail: ["mail", "email", "inbox"],
    ai: ["ai", "ki", "gpt", "modell", "chatbot"],
    learning: ["lernen", "kurs", "tutorial", "academy", "udemy"],
  };
  const hits: string[] = [];
  for (const [key, kws] of Object.entries(map)) {
    if (kws.some((k) => src.includes(k))) hits.push(key);
  }
  return hits.slice(0, 3);
}

// Baut vielfältige, DE-fokussierte Query-Varianten für Alternativen
function buildAltQueries(domain: string, categories: string[]): string[] {
  const base = domain.replace(/^www\./, "");
  const brand = base.split(".")[0];
  const cats = categories.length ? categories : ["service", "anbieter", "tool"];

  const q: string[] = [
    `${brand} alternative`,
    `${base} alternative`,
    `ähnliche seiten wie ${brand}`,
    `seriöse alternative zu ${brand}`,
    `${brand} konkurrent`,
    `${brand} competitor`,
    `${brand} review`,
    `${brand} erfahrungen`,
    `${brand} datenschutz`,
  ];

  // Kategorien einbeziehen (deutsch/regionale Varianten)
  for (const c of cats) {
    q.push(
      `${c} alternative seriös`,
      `${c} datenschutzfreundlich deutsch`,
      `${c} anbieter deutschland`,
      `beste ${c} anbieter datenschutz`,
      `${c} vergleich sicher`,
    );
  }
  // Double-check: Ergebnisse auf andere Domains richten
  q.push(`-site:${base} ${brand} alternative`);

  // Einzigartige, auf 20 beschränken
  return Array.from(new Set(q)).slice(0, 20);
}

// Hilfsfunktion: vollständige URL prüfen (nur mit https:// erlaubt)
function isValidFullUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /^https?:\/\//i.test(parsed.href);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url } = body;

  if (!url || typeof url !== "string" || !isValidFullUrl(url)) {
    return NextResponse.json(
      { error: "Ungültige oder unvollständige URL (z. B. https://example.com)" },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Kein API-Key gesetzt" }, { status: 500 });
  }

  // Domain aus URL extrahieren
  const domain = new URL(url).hostname.replace(/^www\./, "");

  let htmlText = "";
  try {
    const resp = await fetch(url, { redirect: "follow" });
    const html = await resp.text();
    htmlText = htmlToText(html, { wordwrap: 130 }).slice(0, 3000);
  } catch {
    htmlText = "";
  }

  // OSINT-Suche nach ähnlichen/alternativen Seiten
  const baseUrl = `${req.headers.get("x-forwarded-proto") || "https"}://${req.headers.get("x-forwarded-host") || req.headers.get("host")}`;
  let webHits: any[] = [];
  try {
    const categories = extractCategoryKeywords(htmlText, domain);
    const extraQueries = buildAltQueries(domain, categories);
    const osintRes = await fetch(`${baseUrl}/api/osint/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extraQueries }),
      cache: "no-store",
    });
    if (osintRes.ok) {
      const data = await osintRes.json();
      webHits = Array.isArray(data?.hits) ? data.hits.slice(0, 20) : [];
    }
  } catch {
    // ignore errors
  }

  const rawHitsForPrompt = webHits.length > 0 ? JSON.stringify(webHits) : "[] (keine Treffer, nutze eigenes Wissen)";

  // GPT-Prompt zur Alternativen-Suche
  const prompt = `

Du bist ein Datenschutzexperte. Eine Webseite mit der Domain "${domain}" wurde beim Datenschutz-Scan mit einem Wert unter 60 % bewertet.

Bitte schlage 5 alternative Webseiten vor, die:
- dem gleichen oder ähnlichen Zweck dienen wie "${domain}",
- deutlich bessere Datenschutzpraktiken aufweisen,
- vertrauenswürdig sind und echte, funktionierende URLs besitzen.

Gib exakt dieses JSON zurück (ohne Vorwort, ohne Erklärung, ohne Markdown):

[
  {
    "name": "Name der Website 1",
    "url": "https://...",
    "description": "Kurze Erklärung mit Datenschutzbezug (max. 20 Wörter)"
  },
  {
    "name": "Name der Website 2",
    "url": "https://...",
    "description": "Kurze Erklärung mit Datenschutzbezug (max. 20 Wörter)"
  },
  {
    "name": "Name der Website 3",
    "url": "https://...",
    "description": "Kurze Erklärung mit Datenschutzbezug (max. 20 Wörter)"
  },
  {
    "name": "Name der Website 4",
    "url": "https://...",
    "description": "Kurze Erklärung mit Datenschutzbezug (max. 20 Wörter)"
  },
  {
    "name": "Name der Website 5",
    "url": "https://...",
    "description": "Kurze Erklärung mit Datenschutzbezug (max. 20 Wörter)"
  }
]

Die Seiten sollen:
- dem gleichen oder ähnlichen Zweck dienen wie ${domain}
- klar bessere Datenschutzpraktiken aufweisen
- funktionierende echte URLs haben
RawHits: ${rawHitsForPrompt}
HTML_SNIPPET: ${htmlText}
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
    const raw = data.choices?.[0]?.message?.content || "";

    let alternatives: any[] = [];
    try {
      const direct = JSON.parse(raw);
      if (Array.isArray(direct)) {
        alternatives = direct;
      } else if (Array.isArray(direct?.alternatives)) {
        alternatives = direct.alternatives;
      }
    } catch {
      try {
        const jsonStart = raw.indexOf("[");
        const jsonEnd = raw.lastIndexOf("]") + 1;
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonString = raw.slice(jsonStart, jsonEnd);
          alternatives = JSON.parse(jsonString);
        }
      } catch (err) {
        console.error("Fehler beim Parsen der Alternativen:", err);
      }
    }

    // === Score-Konsistenz mit Scan-Tool: gleiche Bewertungslogik nutzen ===
    // Wir rufen die bestehende Scan-API auf, damit exakt dieselbe Bewertung gilt.
    try {
      const scored = await Promise.all(
        (alternatives || []).map(async (alt) => {
          try {
            const scanRes = await fetch(`${baseUrl}/api/scan`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: alt.url }),
              cache: "no-store",
            });
            if (!scanRes.ok) return null;
            const scanData = await scanRes.json();
            const altScore = typeof scanData?.score === "number" ? scanData.score : null;
            if (altScore === null) return null;
            return { ...alt, score: altScore };
          } catch {
            return null;
          }
        })
      );

      let filtered = (scored.filter(Boolean) as any[])
        .filter((a) => typeof a.score === "number" && a.score >= 60);

      // Bevorzugt >=75, aber nicht leer
      const highQuality = filtered.filter((a) => a.score >= 75);
      if (highQuality.length >= 3) {
        filtered = highQuality;
      }

      // Sortieren nach Score
      filtered.sort((a, b) => b.score - a.score);

      // Mindestens 3 zurückgeben, wenn vorhanden
      return NextResponse.json({ alternatives: filtered.slice(0, 3) });
    } catch (e) {
      // Fallback: wenn Scoring fehlschlägt, liefere die rohen Alternativen
      return NextResponse.json({ alternatives });
    }
  } catch (error) {
    console.error("Fehler bei OpenAI-Antwort:", error);
    return NextResponse.json(
      { error: "Serverfehler beim Abrufen von Alternativen." },
      { status: 500 }
    );
  }
}