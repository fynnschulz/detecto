// Helper to get the base URL from request headers
async function getBaseUrl(req: Request) {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return `${proto}://${host}`;
}
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

// Standardized blocked response
function blockedResponse() {
  return NextResponse.json(
    { error: "Der Scan wurde von der Zielseite blockiert.\nGrund: Bot-/Zugriffsschutz\nTipp: Versuche es später erneut oder scanne eine andere Seite." },
    { status: 400 }
  );
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

// --- Cookie Analysis -------------------------------------------------------

// Parse an individual Set-Cookie line into a summary
function parseSetCookie(line: string) {
  const [nameValue, ...attrs] = line.split(/;\s*/);
  const [name] = nameValue.split("=");
  const attrSet = new Set(attrs.map((a) => a.toLowerCase()));
  return {
    name: name?.trim() || "",
    hasSecure: attrSet.has("secure"),
    hasHttpOnly: attrSet.has("httponly"),
    sameSite: attrs.find((a) => /^samesite=/i.test(a))?.split("=")[1]?.toLowerCase() || null,
  };
}

// Summarize all Set-Cookie headers
function summarizeCookies(headers: Headers, isHttps: boolean) {
  const raw = headers.get("set-cookie");
  if (!raw) {
    return { total: 0, insecureOnHttps: 0, noHttpOnly: 0, sameSiteNoneInsecure: 0, sample: [] as any[] };
  }
  // Split multiple cookies; some runtimes merge them
  const parts = raw.split(/,(?=[^;]+?=)/);
  const parsed = parts.map(parseSetCookie);
  return {
    total: parsed.length,
    insecureOnHttps: isHttps ? parsed.filter((c) => !c.hasSecure).length : 0,
    noHttpOnly: parsed.filter((c) => !c.hasHttpOnly).length,
    sameSiteNoneInsecure: parsed.filter((c) => c.sameSite === "none" && !c.hasSecure).length,
    sample: parsed.slice(0, 5),
  };
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
function buildPrompt(url: string, evidence: any, headMeta: any, policyEvidence: any, htmlText: string) {
  return `
  Du bist ein unabhängiger Datenschutz- **und** Risiko-Analyst. Analysiere die Webseite: ${url}
  
  Ziel: Eine **faire, kontextbezogene** Bewertung, die **Datenschutzqualität**, **Gefährdungspotenzial** und **Policy-Konformität** (DSGVO/GDPR) berücksichtigt. Kleine, schlichte Seiten (z. B. reine Kontakt-/Info-Seiten ohne Tracking) sollen **nicht übermäßig streng** bewertet werden.
  
  DIR VORLIEGENDE BELEGE (aus einem technischen Schnell-Scan):
  EVIDENCE_JSON:
  ${JSON.stringify({ headMeta, evidence, policyEvidence }, null, 2)}

  HTML_SNIPPET (erste ca. 3000 Zeichen der Seite, lesbarer Textauszug):
  ${htmlText.slice(0, 3000)}
  
  Bitte nutze diese Hinweise **aktiv** (prüfe Plausibilität, identifiziere Lücken), statt nur Vermutungen anzustellen.
  
  Bewertungslogik (bitte genau befolgen):
A) Rechne einen **Gesamtscore (0–100)** als **Summe fester Teil-Scores**. Keine Heuristik, keine Standardwerte.
   **Nutze jeden ganzzahligen Wert (nicht runden auf 5er/10er).**

   1) Transport & TLS (0–10)
      - HTTPS aktiv: +6
      - HSTS vorhanden: +4
   2) Security-Header (0–15)
      - CSP vorhanden: +6
      - X-Frame-Options vorhanden: +3
      - X-Content-Type-Options vorhanden: +2
      - Referrer-Policy gesetzt: +2
      - Permissions-Policy gesetzt: +2
   3) Cookies (0–15) – nutze headMeta.cookies
      - Startwert 15
      - Abzug −2 je Cookie ohne \`Secure\` bei HTTPS
      - Abzug −1 je Cookie ohne \`HttpOnly\`
      - Abzug −2 je \`SameSite=None\` **ohne** \`Secure\`
      - Clampen auf [0,15]
   4) Drittanbieter/Tracker (0–15)
      - Startwert 15
      - Abzug −3 pro erkanntem Tracker (Google Analytics, Meta, Hotjar, HubSpot, LinkedIn Insight, Matomo)
      - Zusatzabzug −1 wenn Google Fonts geladen werden
      - Clampen auf [0,15]
   5) Policy-Transparenz (0–20)
      - Privacy/Datenschutz-Seite gefunden: +10
      - Impressum/Legal vorhanden: +4
      - Cookie-Policy vorhanden: +3
      - In den Policy-Texten klare DSGVO-Signale (Rechtsgrundlage **und** Betroffenenrechte **und** DPO/Kontakt): +3
      - Clampen auf [0,20]
   6) Datenerhebung & Consent (0–10)
      - Startwert 10
      - Abzug −2, wenn Login-Formular vorhanden
      - Abzug −3, wenn Kontaktformular vorhanden **und** keine sichtbare Privacy/Impressum-Verlinkung
      - Abzug −2, wenn Tracker vorhanden **und** kein Cookie-Banner erkennbar
      - Clampen auf [0,10]
   7) OSINT-Red Flags (0–15) – nutze \`webHits\`
      - Startwert 15
      - Abzug −5, wenn Treffer auf Scam/Betrug-Hinweise deuten (Titel/URL enthält "scam" oder "betrug")
      - Abzug −5, wenn Treffer auf Datenleaks deuten ("leak", "dump", "paste")
      - Mehrfache Kategorien können kumulieren; Clampen auf [0,15]

   **Gesamtscore = Summe (1–7), auf [0,100] clampen.**

B) Setze BEWERTUNG aus dem Score ab:
   - <40 → "kritisch"
   - 40–64 → "mittelmäßig"
   - 65–79 → "gut"
   - 80–100 → "sehr gut"

C) Erkläre die **GRÜNDE** belegbasiert und kurz. Nenne konkret, was du gefunden hast.
D) Liste **VERSTÖSSE/LÜCKEN (Policy)** mit kurzer Evidenz (oder schreibe „keine konkreten Verstöße identifizierbar“).
E) **HINWEISE**: praxisnahe Tipps, einfach formuliert.

Gib **genau** dieses Format (ohne Markdown, ohne Vorwort):
---
Datenschutz-Score: <Zahl 1–100>%
BEWERTUNG: <"kritisch"|"mittelmäßig"|"gut"|"sehr gut">
GEFÄHRDUNG: <"niedrig"|"mittel"|"hoch">
GRÜNDE:
- <Grund 1>
- <Grund 2>
- <…>
VERSTÖSSE/LÜCKEN (Policy):
- <…>
HINWEISE:
- <…>
`;
}

async function analyzePrivacyScore(
  url: string,
  evidence: any,
  headMeta: any,
  policyEvidence: any,
  htmlText: string
): Promise<{ score: number | null; result: string; judgement: string }> {
  const prompt = buildPrompt(url, evidence, headMeta, policyEvidence, htmlText);

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

  // --- Web search hits (osint) -------------------------------------------------
  const base = await getBaseUrl(req as any);
  let webHits: any[] = [];
  try {
    const host = new URL(url).hostname;
    const bare = host.replace(/^www\./, "");
    const extraQueries = [
      `site:${host} privacy OR datenschutz OR impressum`,
      `"${bare}" scam OR betrug OR review OR forum`,
      `"${bare}" leak OR dump OR paste`,
    ];

    const wsRes = await fetch(`${base}/api/osint/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extraQueries }),
      cache: "no-store",
    });
    if (wsRes.ok) {
      const ws = await wsRes.json();
      webHits = Array.isArray(ws.hits) ? ws.hits.slice(0, 20) : [];
    }
  } catch {
    // ignore errors
  }

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
      referrerPolicy: getHeader(headRes.headers, "referrer-policy"),
      xContentType: !!getHeader(headRes.headers, "x-content-type-options"),
      permissionsPolicy: getHeader(headRes.headers, "permissions-policy"),
      cors: getHeader(headRes.headers, "access-control-allow-origin"),
      server: getHeader(headRes.headers, "server"),
    };
    // Add cookie analysis
    headMeta.cookies = summarizeCookies(headRes.headers, url.startsWith("https://"));
    if (!headOk) {
      return blockedResponse();
    }
  } catch (err) {
    // continue – we'll still try a GET
  }

  // --- GET HTML to "look behind the scenes" -------------------------------------
  let html = "";
  let evidence: any = {};
  let htmlText = "";
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
      // convert to readable text for model analysis
      htmlText = htmlToText(html);
    }
  } catch (err) {
    // ignore – model will work with headMeta only
  }

  // --- Policy pages: discover and fetch for deeper analysis ----------------------
  let policyEvidence: any = { candidates: [], pages: [] };
  try {
    if (html) {
      const base = new URL(url);
      const extraCandidates = [
        "/impressum",
        "/datenschutz",
        "/datenschutzrichtlinie",
        "/datenschutzrichtlinien",
        "/privacy",
        "/privacy-policy",
        "/terms",
        "/agb",
        "/cookies",
        "/cookie-policy",
        "/legal",
        "/rechtliches",
        "/about",
        "/ueber-uns",
        "/uber-uns"
      ].map((p) => new URL(p, base).toString());
      const combinedLinks = [...(evidence.policyLinks || []), ...extraCandidates];
      policyEvidence = await collectPolicyEvidence(base, combinedLinks);
    }
  } catch {
    // non-fatal
  }

  // If we have neither usable HEAD nor HTML content, treat as blocked
  if (!headOk && (!html || html.length === 0)) {
    return blockedResponse();
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Kein API-Key gesetzt" }, { status: 500 });
  }

  const { score, result, judgement } = await analyzePrivacyScore(
    url,
    { ...evidence, webHits },
    headMeta,
    policyEvidence,
    htmlText
  );

  if (score === null) {
    return blockedResponse();
  }

  // Compute recommendations based on score
  let recommendations: string[] = [];
  if (score !== null) {
    if (score < 40) {
      recommendations = [
        "Nicht nutzen. Keine persönlichen Daten eingeben.",
        "Cookies und Tracker blockieren oder Seite meiden.",
        "Falls schon Daten eingegeben: Konten überprüfen, Passwörter ändern."
      ];
    } else if (score < 65) {
      recommendations = [
        "Nutzung nur mit Vorsicht.",
        "Nur notwendige Cookies akzeptieren.",
        "Keine sensiblen Daten (Kreditkarten, Gesundheitsdaten) eingeben.",
        "VPN oder privaten Modus nutzen."
      ];
    } else if (score < 80) {
      recommendations = [
        "Seite grundsätzlich nutzbar, aber Datenschutzniveau nicht optimal.",
        "Cookies überprüfen und einschränken.",
        "Keine langfristigen Accounts anlegen, falls nicht nötig."
      ];
    } else {
      recommendations = [
        "Seite weist gute Datenschutz- und Sicherheitseinstellungen auf.",
        "Kann im Normalfall sicher genutzt werden.",
        "Trotzdem auf individuelle Einstellungen achten (z. B. Cookie-Banner)."
      ];
    }
  }

  return NextResponse.json({
    result,
    judgement,
    score,
    policy: policyEvidence,
    headMeta,
    evidence,
    recommendations
  });
}
