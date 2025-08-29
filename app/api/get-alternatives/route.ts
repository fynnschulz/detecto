import { NextRequest, NextResponse } from "next/server";
import { htmlToText } from "html-to-text";

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
    const osintRes = await fetch(`${baseUrl}/api/osint/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extraQueries: [`${domain} alternative` , `${domain} competitor`, `${domain} review`] }),
      cache: "no-store",
    });
    if (osintRes.ok) {
      const data = await osintRes.json();
      webHits = Array.isArray(data?.hits) ? data.hits.slice(0, 20) : [];
    }
  } catch {
    // ignore errors
  }

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

    return NextResponse.json({ alternatives });
  } catch (error) {
    console.error("Fehler bei OpenAI-Antwort:", error);
    return NextResponse.json(
      { error: "Serverfehler beim Abrufen von Alternativen." },
      { status: 500 }
    );
  }
}