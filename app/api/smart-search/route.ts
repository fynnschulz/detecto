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
  Du bist ein Datenschutz-Experte. Eine Webseite darf nur empfohlen werden, wenn sie:

  - sicher im Umgang mit Daten ist
  - keine übermäßigen Tracker oder aggressive Werbung verwendet
  - HTTPS verwendet und erreichbar ist
  - zum eingegebenen Thema passt

  Ergänze deine Bewertung außerdem um folgende technische Datenschutzaspekte:
  - Cookies & Tracker: Werden möglichst wenige verwendet? Wird klar informiert?
  - Drittanbieter-Tools: Wird auf Google, Meta, Hotjar usw. verzichtet?
  - Security-Header: Sind moderne Sicherheitsheader wie CSP, X-Frame-Options etc. aktiv?
  - SSL-Zertifikat: Wird HTTPS verwendet?
  - Hosting-Standort: Wird in der EU gehostet?
  - Technologien: Kommen datenschutzbedenkliche Dienste wie Google Fonts zum Einsatz?
  - Formulare: Werden Daten sparsam und mit Datenschutzhinweis abgefragt?
  - Cookie-Banner: Gibt es eine echte, funktionierende Einwilligung?
  - IP-Tracking: Wird die IP-Adresse anonymisiert?

  Beachte außerdem folgende Bewertungsrichtlinien:

  1. Berücksichtige die Branche, aber verwende sie nicht als Rechtfertigung für schlechte Praktiken. Eine Seite innerhalb einer risikobehafteten Branche muss besonders positiv abweichen, um empfohlen zu werden.
  2. Rot (kritisch): Intransparente oder aggressive Datennutzung (z. B. kein Opt-out, keine Angabe zu Drittanbietern, weitreichendes Tracking) → solche Seiten dürfen nicht vorgeschlagen werden.
  3. Orange (mittelmäßig): Wenn es Licht und Schatten gibt – z. B. Transparenz vorhanden, aber Kontrolle eingeschränkt oder zu viele unnötige Daten. Diese Seiten dürfen nur vorgeschlagen werden, wenn sie sehr nah an Grün liegen.
  4. Grün (gut oder sehr gut): Der Nutzer wird klar informiert, Daten werden sparsam erhoben und sind kontrollierbar – solche Seiten dürfen bevorzugt vorgeschlagen werden.
  5. Bewerte realistisch im Vergleich zum heutigen Internet-Standard. Idealbedingungen sind selten – aber grobe Mängel bleiben gravierend.
  6. Es dürfen nur Seiten vorgeschlagen werden, die mit einer Datenschutzbewertung von mindestens 65 % (grüner Bereich oder sehr nahe daran) eingestuft würden.
  7. Gib nur dann Webseiten aus, wenn sie diese Kriterien sicher erfüllen.

  Gib exakt dieses JSON zurück (ohne Vorwort, ohne Erklärung, ohne Markdown):

  [
    {
      "name": "Webseitenname",
      "url": "https://...",
      "description": "Warum diese Seite sicher und thematisch passend ist"
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