import { NextRequest, NextResponse } from "next/server";

// --- Utilities -------------------------------------------------------------

// Strip HTML tags to get readable text
function htmlToText(html: string): string {
  return html
    .replace(/&nbsp;/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

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
    policyLinks: [] as string[],
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
    if (/(datenschutz|privacy|privacy-policy|impressum|terms|agb|cookies?|cookie-policy|legal|rechtliches|bedingungen)/i.test(href)) {
      try {
        const u = new URL(href, baseUrl);
        // Avoid mailto/tel
        if (u.protocol.startsWith("http")) {
          signals.policyLinks.push(u.toString());
        }
      } catch {}
    }
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

// Prioritize same-origin policy links first, then others; keep unique and cap
function prioritizePolicyLinks(links: string[], baseHost: string, cap = 5): string[] {
  const seen = new Set<string>();
  const same: string[] = [];
  const other: string[] = [];
  for (const l of links) {
    try {
      const u = new URL(l);
      if (seen.has(u.toString())) continue;
      seen.add(u.toString());
      if (u.hostname === baseHost) same.push(u.toString());
      else other.push(u.toString());
    } catch {}
  }
  return [...same, ...other].slice(0, cap);
}

// Fetch text with timeout
async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal, headers: { "User-Agent": "Detecto/1.0 (+https://detecto.example)", Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" } });
    clearTimeout(to);
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 400_000);
  } catch {
    return null;
  }
}

// Extract quick, low-cost policy signals from plain text
function extractPolicySignals(txt: string) {
  const lower = txt.toLowerCase();
  const find = (rx: RegExp) => rx.test(lower);
  const excerpt = (rx: RegExp) => {
    const m = lower.match(rx);
    if (!m) return null;
    const i = m.index ?? 0;
    const start = Math.max(0, i - 140);
    const end = Math.min(lower.length, i + 260);
    return txt.slice(start, end).trim();
  };

  const signals = {
    mentionsGDPR: find(/dsgvo|gdpr|general data protection/i),
    legalBasis: find(/rechtsgrundlage|legal basis|art\.?\s*6\s*abs\.?\s*1/i),
    dataSubjectRights: find(/auskunft|löschung|berichtigung|einschränkung|widerspruch|data subject rights|erasure|rectification/i),
    dpoContact: find(/datenschutzbeauftragte|data protection officer|dpo|datenschutz@|privacy@/i),
    processorsListLikely: find(/auftragsverarbeiter|processors?|sub-?processors?|dienstleister/i),
    retentionMentioned: find(/speicherdauer|aufbewahrung|retention/i),
    thirdCountryTransfers: find(/drittland|third[-\s]?country|usa|vereinbarte standardvertragsklauseln|standard contractual clauses/i),
    cookiesMentioned: find(/cookies?|cookiebot|consent/i),
    analyticsVendors: {
      google: find(/google analytics|gtag|ga4|google tag manager/i),
      meta: find(/facebook|meta|pixel/i),
      hotjar: find(/hotjar/i),
      matomo: find(/matomo/i),
      hubspot: find(/hubspot/i),
      linkedin: find(/linkedin|insight tag/i),
    },
    contactPresent: find(/kontakt|impressum|contact/i),
    addressPresent: find(/\b\d{4,5}\s+[a-zäöüß\- ]+|straße|str\./i),
    sampleExcerpts: {
      legalBasis: excerpt(/rechtsgrundlage|legal basis|art\.?\s*6\s*abs\.?\s*1/i),
      rights: excerpt(/auskunft|löschung|erasure|rectification|widerspruch/i),
      dpo: excerpt(/datenschutzbeauftragte|data protection officer|dpo|datenschutz@|privacy@/i),
      transfers: excerpt(/drittland|third[-\s]?country|standard contractual clauses/i),
    },
  };
  return signals;
}

// Collect policy evidence by fetching likely policy pages and summarizing signals
async function collectPolicyEvidence(baseUrl: URL, candidateLinks: string[]) {
  const prioritized = prioritizePolicyLinks(candidateLinks, baseUrl.hostname, 5);
  const results: Array<{ url: string; textPreview: string; signals: any }> = [];
  for (const link of prioritized) {
    const html = await fetchText(link, 8000);
    if (!html) continue;
    const text = htmlToText(html);
    const signals = extractPolicySignals(text);
    results.push({
      url: link,
      textPreview: text.slice(0, 1200),
      signals,
    });
  }
  return { candidates: prioritized, pages: results };
}

// Compose a richer prompt including observed evidence and a fairer rubric
function buildPrompt(url: string, evidence: any, headMeta: any, policyEvidence: any) {
  return `
  Du bist ein unabhängiger Datenschutz- **und** Risiko-Analyst. Analysiere die Webseite: ${url}
  
  Ziel: Eine **faire, kontextbezogene** Bewertung, die **Datenschutzqualität**, **Gefährdungspotenzial** und **Policy-Konformität** (DSGVO/GDPR) berücksichtigt. Kleine, schlichte Seiten (z. B. reine Kontakt-/Info-Seiten ohne Tracking) sollen **nicht übermäßig streng** bewertet werden.
  
  DIR VORLIEGENDE BELEGE (aus einem technischen Schnell-Scan):
  EVIDENCE_JSON:
  ${JSON.stringify({ headMeta, evidence, policyEvidence }, null, 2)}
  
  Bitte nutze diese Hinweise **aktiv** (prüfe Plausibilität, identifiziere Lücken), statt nur Vermutungen anzustellen.
  
  Bewertungslogik (bitte genau befolgen):
  1) **Zweck & Angriffsfläche** klassifizieren: { 
     Art: (Broschüre/Kontakt, Blog, Community, Shop, SaaS/App, Login-Bereich, Behörde/Klinik/Finanzen, Sonstiges),
     Datenarten: (keine, Kontakt, Login, Zahlungsdaten, Gesundheits-/Finanzdaten, Trackingprofile),
     Third-Party-Footprint: gering/mittel/hoch
  }
  2) **Privatsphäre-Qualität (Datenschutz)** gewichten nach: Datenminimierung, Transparenz (Privacy-/Impressum-/Cookie-Infos vorhanden und verständlich?), Nutzerkontrolle (Consent), Drittanbieter-Nutzung, Security-Header (CSP/HSTS/XFO), HTTPS.
  3) **Gefährdungsgrad (Risiko)** einschätzen: Wie **wahrscheinlich** und **schadensreich** wären Missbrauch/Tracking/Phishing für einen durchschnittlichen Nutzer? Kleine statische Visitenkarten-Seiten mit nur Kontaktformular und wenigen Drittanbietern bekommen **Bonus** (mildernde Gewichtung) – solange transparent.
  4) **Policy-Prüfung (DSGVO/GDPR)**: Identifiziere **konkrete Lücken oder mögliche Verstöße** in den Policy-Seiten (Privacy/Datenschutz, Cookies, AGB/Terms, Impressum/Legal). Nenne Artikel/Paragrafen, **falls ableitbar**, und belege sie mit kurzen Zitaten/Indizien (z. B. fehlende Rechtsgrundlage, kein Hinweis auf Betroffenenrechte, kein DPO-Kontakt, unzulässige Drittlandübermittlung ohne geeignete Garantien, fehlerhafte/zwanghafte Cookie-Einwilligung, fehlende Widerrufsmöglichkeit etc.). Wenn unklar: als **„Indizien, unsicher“** kennzeichnen.
  5) **Realismus**: Branchenübliches ist kein Freifahrtschein, aber fehle keine Enterprise-Header, wenn die Seite nur minimal Daten verarbeitet und sonst solide ist.
  
  Gib **genau** dieses Format (ohne Markdown, ohne Vorwort):
  ---
  Datenschutz-Score: <Zahl 1–100>%
  BEWERTUNG: <"kritisch"|"mittelmäßig"|"gut"|"sehr gut">
  GEFÄHRDUNG: <"niedrig"|"mittel"|"hoch">  // basiert auf der realistischen Gefahr für Nutzer
  GRÜNDE:
  - <konkreter, beleggestützter Grund 1>
  - <konkreter, beleggestützter Grund 2>
  - <…>
  VERSTÖSSE/LÜCKEN (Policy):
  - <möglicher DSGVO-Verstoß oder Lücke | Relevante Norm (z. B. Art. 6, 12–14, 30, 32, 44–49 DSGVO) | kurzer Beleg/Zitat | Einschätzung: "klar" / "Indizien, unsicher" | Auswirkung: niedrig/mittel/hoch>
  - <… oder „keine konkreten Verstöße identifizierbar“>
  HINWEISE:
  - <lästige, aber geringe Risiken>
  - <schnelle Verbesserungen (max. 3 Bulletpoints)>
  ---
  
  Wichtige Regeln:
  - Nenne konkrete Evidenz (z. B. "CSP fehlt", "externe Skripte: gtm, hotjar", "Kontaktformular mit E-Mail, keine Passwörter", "Policy nennt keine Rechtsgrundlagen").
  - Keine vagen Phrasen. Vermeide Spekulationen; wenn etwas nicht belegt ist, markiere es als **„Indizien, unsicher“**.
  - **Nicht** kleinliche Abwertung, wenn nur eine einfache Kontaktseite ohne Tracking vorliegt.
  - Hohe Risiken nur bei sensiblen Daten, aggressivem Tracking oder täuschenden Mustern.
  - Formuliere das abschließende Urteil bitte **kurz und einfach verständlich**, ohne Fachchinesisch. Maximal wenige Sätze, klare Alltagssprache.
  `;
}

async function analyzePrivacyScore(
  url: string,
  evidence: any,
  headMeta: any,
  policyEvidence: any
): Promise<{ score: number | null; result: string; judgement: string }> {
  const prompt = buildPrompt(url, evidence, headMeta, policyEvidence);

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

  // --- Policy pages: discover and fetch for deeper analysis ----------------------
  let policyEvidence: any = { candidates: [], pages: [] };
  try {
    if (html && evidence.policyLinks && evidence.policyLinks.length) {
      const base = new URL(url);
      policyEvidence = await collectPolicyEvidence(base, evidence.policyLinks);
    }
  } catch {
    // non-fatal
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Kein API-Key gesetzt" }, { status: 500 });
  }

  const { score, result, judgement } = await analyzePrivacyScore(url, evidence, headMeta, policyEvidence);
  return NextResponse.json({ result, judgement, score, policy: policyEvidence });
}
