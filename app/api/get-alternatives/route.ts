import { NextRequest, NextResponse } from "next/server";

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

  // GPT-Prompt zur Alternativen-Suche
  const prompt = `

Du bist ein Datenschutzexperte. Eine Webseite mit der Domain "${domain}" wurde beim Datenschutz-Scan mit einem Wert unter 60 % bewertet.

Bitte schlage 3 alternative Webseiten vor, die:
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
  }
]

Die Seiten sollen:
- dem gleichen oder ähnlichen Zweck dienen wie ${domain}
- klar bessere Datenschutzpraktiken aufweisen
- funktionierende echte URLs haben
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

    // Versuche, gültiges JSON aus der Antwort zu extrahieren
    const jsonStart = raw.indexOf("[");
    const jsonEnd = raw.lastIndexOf("]") + 1;
    const jsonString = raw.slice(jsonStart, jsonEnd);

    let alternatives = [];

    try {
      alternatives = JSON.parse(jsonString);
    } catch (err) {
      console.error("Fehler beim Parsen der Alternativen:", err);
    }

    return NextResponse.json({ alternatives });
  } catch (error) {
    console.error("Fehler bei OpenAI-Antwort:", error);
    return NextResponse.json(
      { error: "Serverfehler beim Abrufen von Alternativen." },
      { status: 500 }
    );
  }
}