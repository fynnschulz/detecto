import { NextRequest, NextResponse } from "next/server";

// Hilfsfunktion zum Validieren vollständiger URLs
function isValidFullUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /^https?:\/\//i.test(parsed.href);
  } catch {
    return false;
  }
}

export async function analyzePrivacyScore(
  url: string
): Promise<{ score: number | null; result: string; judgement: string }> {
  const prompt = `
Du bist ein Datenschutzexperte. Analysiere die Datenschutzpraktiken der folgenden Webseite: ${url}

Gib eine Bewertung, die auf **Transparenz**, **Nutzerkontrolle** und dem **Zweck der Datennutzung** basiert – nicht nur darauf, ob überhaupt Daten erhoben werden.

Am Anfang der Antwort soll eine Datenschutz-Sicherheitsbewertung in Prozent (1–100 %) stehen – z. B. „Datenschutz-Score: 82 %“. Diese Zahl soll möglichst realistisch und nachvollziehbar sein.

⚠️ Hinweis: Diese Domain ist **nicht automatisch mit großen Marken wie z. B. PayPal, Amazon oder Google gleichzusetzen**. Es kann sich um eine **kritische oder nachgeahmte Seite** handeln.

Gib exakt dieses JSON zurück (ohne Vorwort, ohne Erklärung, ohne Markdown):

Einordnung:
- 90–100 % = sehr sicher
- 70–89 % = gut
- 45–69 % = mittelmäßig
- unter 45 % = kritisch

### Hinweise zur Bewertung:
1. **Berücksichtige die Branche**, aber:
   - Verwende sie **nicht als Rechtfertigung** für schlechte Praktiken.
   - Schlechte Praktiken bleiben schlecht – **auch wenn sie branchenüblich** sind.
   - Eine Seite innerhalb einer risikobehafteten Branche muss **besonders positiv abweichen**, um besser bewertet zu werden.
2. **Rot (kritisch)**: bei intransparenter oder aggressiver Datennutzung (z. B. kein Opt-out, keine Angabe zu Drittanbietern, weitreichendes Tracking).
3. **Orange (mittelmäßig)**: wenn es Licht und Schatten gibt – z. B. Transparenz vorhanden, aber Kontrolle eingeschränkt oder zu viele unnötige Daten.
4. **Grün (gut oder sehr gut)**: wenn der Nutzer klar informiert wird, Daten sparsam erhoben und kontrollierbar sind – **auch innerhalb kritischer Branchen** möglich, wenn herausragend gut.
5. **Bewerte realistisch** im Vergleich zum heutigen Internet-Standard. Idealbedingungen sind selten – aber grobe Mängel bleiben gravierend.
6. Achte darauf, dass **keine leeren, vagen oder irrelevanten Stichpunkte entstehen.** Jeder Grund muss klar, verständlich und konkret sein.

Antwortformat:
---
Datenschutz-Score: <Zahl>%
BEWERTUNG: <z. B. „kritisch“, „mittelmäßig“, „gut“, „sehr gut“>
GRÜNDE:
- <Grund 1>
- <Grund 2>
- …
---
Nutze eine **nutzernah verständliche Sprache**, damit Laien die Risiken verstehen.
`;

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

  const openaiData = await openaiRes.json();
  const content = openaiData.choices?.[0]?.message?.content || "Keine Antwort von GPT.";

  const scoreMatch = content.match(/Datenschutz-Score:\s*(\d{1,3})\s*%/i);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : null;

  const resultMatch = content.match(/BEWERTUNG:\s*(.+)/i);
  const result = resultMatch && typeof resultMatch[1] === "string" ? resultMatch[1].trim() : "Keine Bewertung gefunden.";

  const lines: string[] = content.split("\n").map((line) => line.trim());
  const filtered = lines.filter(
    (line) =>
      line.startsWith("-") &&
      !line.includes("BEWERTUNG") &&
      line.length > 3 &&
      !["--", "- -", "-"].includes(line)
  );
  const uniqueJudgements = [...new Set(filtered.map((line: string) => line.slice(1).trim()))];
  const judgement = uniqueJudgements.length
    ? "• " + uniqueJudgements.join("\n• ")
    : "Keine detaillierte Begründung verfügbar.";

  return { score, result, judgement };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url } = body;

  if (!url || typeof url !== "string" || !isValidFullUrl(url)) {
    return NextResponse.json<{ error: string }>(
      { error: "Ungültige oder unvollständige URL (z. B. https://example.com)" },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Kein API-Key gesetzt" }, { status: 500 });
  }

  const { score, result, judgement } = await analyzePrivacyScore(url);
  return NextResponse.json({ result, judgement, score });
}
