import { NextRequest, NextResponse } from "next/server";

// --- Utilities -------------------------------------------------------------

// Validate full URLs (must include protocol)
function isValidFullUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /^https?:\/\//i.test(parsed.href);
  } catch {
    return false;
  }
}

// Normalize header names to lower-case for easier lookups
function getHeader(headers: Headers, name: string): string | null {
  for (const [k, v] of headers.entries()) {
    if (k.toLowerCase() === name.toLowerCase()) return v;
  }
  return null;
}

// Extract quick, low-cost signals from HTML to give the model more context
function extractHtmlSignals(html: string, baseUrl: URL) {
  const signals = {
    formsTotal: 0,
    hasContactForm: false,
    hasLoginForm: false,
    hasSearchForm: false,
    inputs: [] as string[],
    mailtoLinks: 0,
    telLinks: 0,
    externalScripts: [] as string[],
    thirdPartyVendors: [] as string[],
    loadsGoogleFonts: false,
    cookieBannerLikely: false,
    trackersLikely: [] as string[],
    hasPrivacyLink: false,
  };

  // crude parsing via regex to avoid heavy deps on serverless
  const formRegex = /<form[\s\S]*?<\/form>/gi;
  const inputRegex = /<input[^>]*type=["']?([a-zA-Z0-9_-]+)["']?[^>]*>/gi;
  const scriptSrcRegex = /<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi;
  const anchorRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;

  const forms = html.match(formRegex) || [];
  signals.formsTotal = forms.length;
  for (const f of forms) {
    const inputs = Array.from(f.matchAll(inputRegex)).map((m) => (m[1] || "").toLowerCase());
    signals.inputs.push(...inputs);
    const hasEmail = inputs.includes("email");
    const hasPassword = inputs.includes("password");
    const hasTextArea = /<textarea/gi.test(f);

    if (hasPassword) signals.hasLoginForm = true;
    if (hasEmail || hasTextArea) signals.hasContactForm = true;
    if (inputs.includes("search")) signals.hasSearchForm = true;
  }

  // links
  const anchors = html.match(anchorRegex) || [];
  for (const a of anchors) {
    const href = a.replace(/^[\s\S]*href=["']/, "").replace(/["'][\s\S]*$/, "");
    if (href.startsWith("mailto:")) signals.mailtoLinks += 1;
    if (href.startsWith("tel:")) signals.telLinks += 1;
    if (/datenschutz|privacy|privacy-policy|impressum/i.test(href)) signals.hasPrivacyLink = true;
  }

  // scripts
  const scripts = Array.from(html.matchAll(scriptSrcRegex)).map((m) => m[1]);
  const thirdPartyHosts: string[] = [];
  for (const src of scripts) {
    try {
      const u = new URL(src, baseUrl);
      if (u.host !== baseUrl.host) {
        signals.externalScripts.push(u.origin);
        thirdPartyHosts.push(u.hostname);
      }
    } catch {}
  }

  const vendors = [
    { key: "Google Analytics", rx: /(googletagmanager\.com|google-analytics\.com|gtag\()/i },
    { key: "Meta/Facebook", rx: /(facebook\.net|connect\.facebook\.net)/i },
    { key: "Hotjar", rx: /hotjar\.com|static\.hotjar\.com/i },
    { key: "HubSpot", rx: /hs-scripts\.com|hubspot\.com/i },
    { key: "LinkedIn Insight", rx: /snap\.licdn\.com/i },
    { key: "Matomo", rx: /matomo\.|\/matomo\.js/i },
  ];
  const trackers: string[] = [];
  for (const v of vendors) {
    if (v.rx.test(html)) trackers.push(v.key);
  }
  signals.trackersLikely = trackers;

  signals.loadsGoogleFonts = /fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(html);
  signals.cookieBannerLikely = /(cookie|consent)(banner|notice|bot|modal|consent)/i.test(html);

  // simple third-party vendor extraction from host list
  const uniq = Array.from(new Set(thirdPartyHosts));
  signals.thirdPartyVendors = uniq.slice(0, 25);

  return signals;
}

// Compose a richer prompt including observed evidence and a fairer rubric
function buildPrompt(url: string, evidence: any, headMeta: any) {
  return `
Du bist ein unabhängiger Datenschutz- **und** Risiko-Analyst. Analysiere die Webseite: ${url}

Ziel: Eine **faire, kontextbezogene** Bewertung, die **Datenschutzqualität** und **Gefährdungspotenzial** (Risiko für Nutzer) berücksichtigt. Kleine, schlichte Seiten (z. B. reine Kontakt-/Info-Seiten ohne Tracking) sollen **nicht übermäßig streng** bewertet werden.

DIR VORLIEGENDE BELEGE (aus einem technischen Schnell-Scan):
EVIDENCE_JSON:
${JSON.stringify({ headMeta, evidence }, null, 2)}

Bitte nutze diese Hinweise **aktiv** (prüfe Plausibilität, identifiziere Lücken), statt nur Vermutungen anzustellen.

Bewertungslogik (bitte genau befolgen):
1) **Zweck & Angriffsfläche** klassifizieren: { \n  Art: (Broschüre/Kontakt, Blog, Community, Shop, SaaS/App, Login-Bereich, Behörde/Klinik/Finanzen, Sonstiges), \n  Datenarten: (keine, Kontakt, Login, Zahlungsdaten, Gesundheits-/Finanzdaten, Trackingprofile), \n  Third-Party-Footprint: gering/mittel/hoch }
2) **Privatsphäre-Qualität (Datenschutz)** gewichten nach: Datenminimierung, Transparenz (Privacy-Link vorhanden?), Nutzerkontrolle (Consent), Drittanbieter-Nutzung, Security-Header (CSP/HSTS/XFO), HTTPS.
3) **Gefährdungsgrad (Risiko)** einschätzen: Wie **wahrscheinlich** und **schadensreich** wären Missbrauch/Tracking/Phishing für einen durchschnittlichen Nutzer? Kleine statische Visitenkarten-Seiten mit nur Kontaktformular und wenigen Drittanbietern bekommen **Bonus** (mildernde Gewichtung) – solange transparent.
4) **Realismus**: Branchenübliches ist kein Freifahrtschein, aber fehle keine Enterprise-Header, wenn die Seite nur minimal Daten verarbeitet und sonst solide ist.

Gib **genau** dieses Format (ohne Markdown, ohne Vorwort):
---
Datenschutz-Score: <Zahl 1–100>%
BEWERTUNG: <"kritisch"|"mittelmäßig"|"gut"|"sehr gut">
GEFÄHRDUNG: <"niedrig"|"mittel"|"hoch">  // basiert auf der realistischen Gefahr für Nutzer
GRÜNDE:
- <konkreter, beleggestützter Grund 1>
- <konkreter, beleggestützter Grund 2>
- <…>
HINWEISE:
- <lästige, aber geringe Risiken>
- <schnelle Verbesserungen (max. 3 Bulletpoints)>
---

Wichtige Regeln:
- Nenne konkrete Evidenz (z. B. "CSP fehlt", "externe Skripte: gtm, hotjar", "Kontaktformular mit E-Mail, keine Passwörter").
- Keine vagen Phrasen. Vermeide Spekulationen, wenn die Evidenz fehlt.
- **Nicht** kleinliche Abwertung, wenn nur eine einfache Kontaktseite ohne Tracking vorliegt.
- Hohe Risiken nur bei sensiblen Daten, aggressivem Tracking oder täuschenden Mustern.
`;
}

async function analyzePrivacyScore(
  url: string,
  evidence: any,
  headMeta: any
): Promise<{ score: number | null; result: string; judgement: string }> {
  const prompt = buildPrompt(url, evidence, headMeta);

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

  const lines: string[] = content.split("\n").map((line: string) => line.trim());
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

  // --- Existence + HEAD metadata -------------------------------------------------
  let headOk = false;
  let headStatus = 0;
  let headMeta: Record<string, any> = {};

  try {
    const headRes = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      // Some servers block HEAD; allow fallback later
    });
    headOk = headRes.ok;
    headStatus = headRes.status;
    headMeta = {
      status: headStatus,
      https: url.startsWith("https://"),
      csp: !!getHeader(headRes.headers, "content-security-policy"),
      xfo: !!getHeader(headRes.headers, "x-frame-options"),
      hsts: !!getHeader(headRes.headers, "strict-transport-security"),
      server: getHeader(headRes.headers, "server"),
    };
    if (!headOk) {
      return NextResponse.json(
        { error: `Diese Webseite antwortet nicht (Status ${headStatus}).` },
        { status: 400 }
      );
    }
  } catch (err) {
    // continue – we'll still try a GET
  }

  // --- GET HTML to "look behind the scenes" -------------------------------------
  let html = "";
  let evidence: any = {};
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const getRes = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Detecto/1.0 (+https://detecto.example)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (getRes.ok) {
      const text = await getRes.text();
      // cap to first 500k to limit token size
      html = text.slice(0, 500_000);
      const base = new URL(url);
      const signals = extractHtmlSignals(html, base);
      evidence = signals;
    }
  } catch (err) {
    // ignore – model will work with headMeta only
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Kein API-Key gesetzt" }, { status: 500 });
  }

  const { score, result, judgement } = await analyzePrivacyScore(url, evidence, headMeta);
  return NextResponse.json({ result, judgement, score });
}
