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

    return NextResponse.json({ alternatives });
  } catch (error) {
    console.error("Fehler bei smart-search:", error);
    return NextResponse.json({ error: "Fehler beim Verarbeiten der Anfrage." }, { status: 500 });
  }
}