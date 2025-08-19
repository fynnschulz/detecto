import { NextRequest, NextResponse } from "next/server";

/**
 * Improved privacy scan route
 * - Deterministic signal analysis (no LLM) for scoring
 * - LLM only for concise explanations based on hard evidence
 * - Preserves existing response fields: score (0–100 % = Datenschutz-Score), result, judgement
 * - Adds rich fields: risk_score, confidence, findings, timing_ms, finalUrl
 */

// --- Utilities --------------------------------------------------------------

// Validate full URL (http/https)
function isValidFullUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /^https?:\/\//i.test(parsed.href);
  } catch {
    return false;
  }
}

// Timeout-capable fetch
async function fetchWithTimeout(resource: string, options: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 7000, ...rest } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(resource, { ...(rest as RequestInit), signal: controller.signal, redirect: "follow" });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// Fetch HTML + headers (GET)
async function fetchPage(url: string) {
  const res = await fetchWithTimeout(url, { method: "GET", timeoutMs: 8000 });
  const html = await res.text();
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  return { html, headers, finalUrl: res.url, ok: res.ok, status: res.status };
}

// --- Signal extraction (no external deps) ----------------------------------

type ScanSignals = {
  https: boolean;
  headers: Record<string, string | undefined>;
  thirdPartyRequests: number;
  trackerHits: string[];
  hasImpressumLink: boolean;
  hasDatenschutzLink: boolean;
  overlayLikely: boolean;
  sensitiveForms: boolean;
};

function extractSignals(inputUrl: string, html: string, headers: Record<string, string | undefined>): ScanSignals {
  const url = new URL(inputUrl);
  const domain = url.hostname.replace(/^www\./, "");
  const htmlLower = html.toLowerCase();

  // Links
  const linkHrefRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  const links: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkHrefRegex.exec(htmlLower))) links.push(m[1]);
  const hasImpressum = links.some((h) => h.includes("impressum"));
  const hasPrivacy = links.some((h) => h.includes("datenschutz") || h.includes("privacy"));

  // Resources (script/img/link/iframe)
  const srcHrefRegex = /<(script|img|link|iframe)[^>]+(?:src|href)=["']([^"']+)["'][^>]*>/gi;
  const thirdPartyHosts = new Set<string>();
  while ((m = srcHrefRegex.exec(html))) {
    const ref = m[2];
    try {
      const u = new URL(ref, url);
      const host = u.hostname.replace(/^www\./, "");
      if (host !== domain) thirdPartyHosts.add(host);
    } catch {
      // ignore invalid URLs
    }
  }

  // Trackers — keyword heuristics
  const trackerPatterns = [
    "gtag(",
    "ga(",
    "googletagmanager.com",
    "google-analytics",
    "facebook.net",
    "fbq(",
    "tiktok",
    "ttq",
    "hotjar",
    "adservice.google",
    "doubleclick.net",
    "bing.com/tag.js",
    "clarity",
    "pixel",
  ];
  const trackerHits = trackerPatterns.filter((p) => htmlLower.includes(p.toLowerCase()));

  // Cookie/Consent overlays
  const overlayLikely = /cookie|consent|overlay|modal/.test(htmlLower) && (htmlLower.match(/cookie|consent/g)?.length || 0) > 2;

  // Sensitive forms (very rough)
  const sensitiveForms = /<form[\s\S]*?(password|iban|credit|cardnumber|konto)/i.test(htmlLower);

  return {
    https: url.protocol === "https:",
    headers,
    thirdPartyRequests: thirdPartyHosts.size,
    trackerHits,
    hasImpressumLink: hasImpressum,
    hasDatenschutzLink: hasPrivacy,
    overlayLikely,
    sensitiveForms,
  };
}

// --- Scoring (deterministic) -----------------------------------------------

type Evidence = {
  id: string;
  label: string;
  severity: "low" | "med" | "high";
  value: number | string | boolean;
  details?: string;
};

function computeRisk(signals: ScanSignals) {
  let score = 0; // risk score 0–100 (higher = worse)
  const ev: Evidence[] = [];

  if (!signals.https) {
    score += 8;
    ev.push({ id: "no_https", label: "Kein HTTPS", severity: "high", value: false });
  }

  const secHeaders = ["content-security-policy", "strict-transport-security", "x-frame-options", "referrer-policy"];
  let missing = 0;
  for (const h of secHeaders) if (!signals.headers[h]) missing++;
  if (missing > 0) {
    score += 3 * missing;
    ev.push({ id: "missing_headers", label: `Fehlende Security-Header (${missing})`, severity: missing >= 3 ? "high" : "med", value: missing });
  }

  if (signals.thirdPartyRequests > 20) score += 15; else if (signals.thirdPartyRequests > 10) score += 8;
  ev.push({ id: "third_party_requests", label: "Drittanbieter-Requests", severity: signals.thirdPartyRequests > 20 ? "high" : signals.thirdPartyRequests > 10 ? "med" : "low", value: signals.thirdPartyRequests, details: ">10 erhöht, >20 hoch" });

  if (signals.trackerHits.length) {
    const add = Math.min(16, signals.trackerHits.length * 4);
    score += add;
    ev.push({ id: "trackers", label: "Tracker-Muster erkannt", severity: add >= 12 ? "high" : "med", value: signals.trackerHits.length, details: signals.trackerHits.join(", ") });
  }

  if (!signals.hasImpressumLink) { score += 8; ev.push({ id: "no_impressum", label: "Kein Impressum verlinkt", severity: "med", value: false }); }
  if (!signals.hasDatenschutzLink) { score += 8; ev.push({ id: "no_privacy", label: "Keine Datenschutzerklärung verlinkt", severity: "med", value: false }); }

  if (signals.overlayLikely) { score += 5; ev.push({ id: "overlay", label: "Aufdringliches Cookie-Overlay", severity: "low", value: true }); }
  if (signals.sensitiveForms) { score += 10; ev.push({ id: "sensitive_forms", label: "Sensible Formulare potenziell unsicher", severity: "high", value: true }); }

  const clamped = Math.max(0, Math.min(100, score));
  return { risk_score: clamped, evidence: ev };
}

// Map Datenschutz-Score to label
function mapResultLabel(scorePercent: number): string {
  if (scorePercent >= 90) return "sehr gut";
  if (scorePercent >= 70) return "gut";
  if (scorePercent >= 45) return "mittelmäßig";
  return "kritisch";
}

// --- LLM explanation (optional, concise) -----------------------------------

async function explainWithLLM({ url, risk_score, evidence }: { url: string; risk_score: number; evidence: Evidence[] }) {
  if (!process.env.OPENAI_API_KEY) return { summary_md: "", rationale_md: "" };

  const sys = `Du bist ein sachlicher Sicherheitsprüfer.\n- Erfinde keine Fakten.\n- Nutze NUR die gelieferten Evidence-Items.\n- Antworte kurz, klar, in Deutsch, Markdown erlaubt.\n- Gib zuerst 1–2 Sätze Zusammenfassung, dann eine knappe Bullet-Liste.`;

  const user = { url, risk_score, evidence: evidence.map((e) => ({ id: e.id, label: e.label, severity: e.severity, value: e.value, details: e.details })) };

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: JSON.stringify(user) },
      ],
    }),
  });

  const data = await openaiRes.json();
  const text: string = data?.choices?.[0]?.message?.content || "";
  const [firstLine, ...rest] = text.split("\n");
  return { summary_md: (firstLine || "").trim(), rationale_md: rest.join("\n").trim() };
}

// --- Route handler ----------------------------------------------------------

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { url } = body as { url?: string };

  if (!url || typeof url !== "string" || !isValidFullUrl(url)) {
    return NextResponse.json(
      { error: "Ungültige oder unvollständige URL (z. B. https://example.com)" },
      { status: 400 }
    );
  }

  // Lightweight existence check with timeout
  try {
    const head = await fetchWithTimeout(url, { method: "HEAD", timeoutMs: 5000 });
    if (!head.ok) {
      return NextResponse.json({ error: `Diese Webseite antwortet nicht (Status ${head.status}).` }, { status: 400 });
    }
  } catch (err) {
    console.error("Existenzprüfung fehlgeschlagen:", err);
    return NextResponse.json({ error: "Die Webseite konnte nicht gefunden oder erreicht werden." }, { status: 400 });
  }

  const t0 = Date.now();

  // Fetch & analyze deterministically
  const page = await fetchPage(url);
  if (!page.ok) {
    return NextResponse.json({ error: `Abruf fehlgeschlagen (Status ${page.status}).` }, { status: 400 });
  }

  const signals = extractSignals(page.finalUrl, page.html.slice(0, 150_000), page.headers);
  const { risk_score, evidence } = computeRisk(signals);

  // Convert to Datenschutz-Score (higher = better) to preserve compatibility
  const datenschutzScore = Math.max(0, 100 - risk_score);
  const resultLabel = mapResultLabel(datenschutzScore);

  // Optional concise explanation (LLM only on evidence)
  const explain = await explainWithLLM({ url: page.finalUrl, risk_score, evidence });

  const timing_ms = Date.now() - t0;
  const response = {
    // Old fields (compatibility)
    score: datenschutzScore,
    result: resultLabel,
    judgement: explain.summary_md ? `${explain.summary_md}\n${explain.rationale_md}` : "",
    // New rich fields
    version: "1.1.0",
    finalUrl: page.finalUrl,
    risk_score,
    confidence: Math.max(0.4, 1 - Math.min(1, evidence.length / 20)),
    findings: evidence,
    timing_ms,
  };

  return NextResponse.json(response);
}
