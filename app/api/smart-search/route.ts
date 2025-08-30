import { htmlToText } from "html-to-text";
import { NextRequest, NextResponse } from "next/server";
import { buildQueryVariants } from "@/app/lib/osint/connectors";

function getBaseUrl() {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { query } = body || {};

  if (!query || typeof query !== "string" || query.trim().length < 2) {
    return NextResponse.json({ error: "Ungültige oder zu kurze Anfrage." }, { status: 400 });
  }

  // 1) Query-Varianten für OSINT/CSE erzeugen (verbessert die Trefferqualität)
  const variants = buildQueryVariants(query).slice(0, 8).map(v => v.q);
  // Query immer an erster Stelle lassen
  const extraQueries = Array.from(new Set([query, ...variants]));

  // 2) OSINT-Suche (Google CSE + GitHub) anstoßen
  const baseUrl = getBaseUrl();
  const osintRes = await fetch(`${baseUrl}/api/osint/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extraQueries }),
    cache: "no-store",
  });

  let webHits: any[] = [];
  if (osintRes.ok) {
    try {
      const data = await osintRes.json();
      webHits = Array.isArray(data?.hits) ? data.hits.slice(0, 20) : [];
    } catch {
      webHits = [];
    }
  }

  // 3) Falls Query wie URL aussieht, HTML einlesen und auf 3000 Zeichen kürzen
  let htmlText = "";
  if (
    typeof query === "string" &&
    (
      query.startsWith("http://") ||
      query.startsWith("https://") ||
      (query.includes(".") && !query.includes(" "))
    )
  ) {
    try {
      const res = await fetch(query, { method: "GET" });
      if (res.ok) {
        const html = await res.text();
        htmlText = htmlToText(html, {
          wordwrap: false,
          selectors: [
            { selector: 'script', format: 'skip' },
            { selector: 'style', format: 'skip' }
          ]
        }).slice(0, 3000);
      }
    } catch (e) {
      htmlText = "";
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Fehlender API-Key." }, { status: 500 });
  }

  // 4) Ranking/Empfehlung durch KI (nutzt Webhits + optional HTML-Snippet)
  const prompt = `
  Du bist ein unabhängiger Datenschutz- und Risiko-Analyst. Eine Webseite darf nur empfohlen werden, wenn sie zum Thema passt **und** beim Detecto-Scan nach denselben Kriterien wie das Scan-Tool voraussichtlich **mindestens 65 %** erreichen würde.

  Beachte für deine Bewertung **exakt** die Bedingungen des Scan-Tools:

  1) Zweck & Angriffsfläche
     - Art: Broschüre/Kontakt, Blog, Community, Shop, SaaS/App, Login-Bereich, Behörde/Klinik/Finanzen, Sonstiges
     - Datenarten: keine, Kontakt, Login, Zahlungsdaten, Gesundheits-/Finanzdaten, Trackingprofile
     - Third-Party-Footprint: gering/mittel/hoch

  2) Privatsphäre-Qualität (Datenschutz)
     - Datenminimierung, Transparenz (Privacy-/Impressum-/Cookie-Infos vorhanden und verständlich?)
     - Nutzerkontrolle (Consent), Drittanbieter-Nutzung
     - Security-Header (CSP/HSTS/XFO), HTTPS

  3) Gefährdungsgrad (Risiko)
     - realistisch einschätzen (Wahrscheinlichkeit × Schaden)
     - kleine, statische Info-/Kontaktseiten mit wenigen Drittanbietern **nicht überhart** bestrafen, wenn transparent

  4) Policy-/DSGVO-Prüfung
     - Privacy/Datenschutz, Cookies, AGB/Terms, Impressum/Legal berücksichtigen
     - mögliche Lücken/Verstöße (z. B. fehlende Rechtsgrundlage, keine Betroffenenrechte, kein DPO-Kontakt, unklare Drittlandtransfers, zwangsartige Cookie-Einwilligung, fehlende Widerrufsmöglichkeit)
     - solche Lücken/Verstöße würden die Bewertung **unter 65 %** drücken

  5) Realismus
     - Branchenübliches ist kein Freifahrtschein, aber keine Abwertung nur wegen fehlender Enterprise-Header, wenn die Seite insgesamt solide ist

  Zusätzliche Grundkriterien:
  - sicherer Umgang mit Daten
  - keine übermäßigen Tracker oder aggressive Werbung
  - HTTPS erreichbar
  - thematisch passend zur Suchanfrage

  Wichtige Regeln:
  - Nenne konkrete Evidenz (z. B. "CSP fehlt", "externe Skripte: gtm, hotjar", "Kontaktformular mit E-Mail, keine Passwörter", "Policy nennt keine Rechtsgrundlagen").
  - Keine vagen Phrasen. Vermeide Spekulationen; wenn etwas nicht belegt ist, markiere es als **„Indizien, unsicher“**.
  - **Nicht** kleinliche Abwertung, wenn nur eine einfache Kontaktseite ohne Tracking vorliegt.
  - Hohe Risiken nur bei sensiblen Daten, aggressivem Tracking oder täuschenden Mustern.
  - Formuliere das abschließende Urteil bitte **kurz und einfach verständlich**, ohne Fachchinesisch. Maximal wenige Sätze, klare Alltagssprache.

  Sprachstil für das **Urteil** (nur der Schlussabsatz):
  - Schreibe 5-10 kurze Sätze in Alltagssprache (Niveau B1). Max. 300 Zeichen.
  - **Vermeide Fachbegriffe** wie: DSGVO, Auftragsverarbeitung, berechtigtes Interesse, personenbezogene Daten, Drittlandtransfer, Profiling, Third-Party, Retention, Consent-Banner, Security-Header, HSTS, CSP.
  - Wenn ein Fachwort unbedingt nötig ist, setze **eine** kurze Erklärung in Klammerndahinter, z. B. "Profilbildung (es wird ein Nutzungsprofil erstellt)".
  - Keine Schachtelsätze, keine Passivketten, kein Behördendeutsch.

  Gib exakt dieses JSON zurück (ohne Vorwort, ohne Erklärung, ohne Markdown):

  [
    {
      "name": "Webseitenname",
      "url": "https://...",
      "description": "Warum diese Seite thematisch passt und datenschutztechnisch voraussichtlich ≥65% erreicht"
    },
    {
      "name": "...",
      "url": "https://...",
      "description": "..."
    },
    {
      "name": "...",
      "url": "https://...",
      "description": "..."
    }
  ]

  Thema: ${query}
  UsedVariants: ${JSON.stringify(extraQueries.slice(0, 8))}
  RawHits: ${JSON.stringify(webHits)}
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
    const content = data.choices?.[0]?.message?.content || "";
    console.log("GPT-Response:", content);

    let alternatives: any[] = [];
    try {
      const direct = JSON.parse(content);
      if (Array.isArray(direct)) {
        alternatives = direct;
      } else if (Array.isArray(direct?.items)) {
        alternatives = direct.items;
      } else if (Array.isArray(direct?.alternatives)) {
        alternatives = direct.alternatives;
      }
    } catch {
      try {
        const first = content.indexOf('[');
        const last = content.lastIndexOf(']');
        if (first !== -1 && last !== -1 && last > first) {
          const jsonString = content.slice(first, last + 1);
          alternatives = JSON.parse(jsonString);
        }
      } catch (e) {
        console.error('JSON-Fallback-Parse fehlgeschlagen:', e);
      }
    }

    return NextResponse.json({ alternatives, usedVariants: extraQueries.slice(0, 8) });
  } catch (error) {
    console.error("Fehler bei smart-search:", error);
    return NextResponse.json({ error: "Fehler beim Verarbeiten der Anfrage." }, { status: 500 });
  }
}