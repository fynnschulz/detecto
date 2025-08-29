import { NextResponse } from 'next/server'

// --- Einfache In-Memory Rate-Limit (pro IP) ---
const WINDOW_MS = 10 * 60 * 1000; // 10 Minuten
const MAX_REQUESTS = 8;           // max 8 Scans pro 10 Min
const ipHits: Map<string, number[]> = new Map();

function rateLimit(ip: string) {
  const now = Date.now();
  const arr = (ipHits.get(ip) || []).filter(ts => now - ts < WINDOW_MS);
  if (arr.length >= MAX_REQUESTS) return false;
  arr.push(now);
  ipHits.set(ip, arr);
  return true;
}

// --- Payload Definition ---
 type Payload = {
  emails?: string[]
  usernames?: string[]
  phones?: string[]
  fullName?: string
  city?: string
  country?: string
  address?: string
  birthYear?: number
  aliases?: string[]
  services?: string[]
}

// --- Hilfsfunktionen zur Normalisierung ---
function normEmail(e: string) {
  return String(e).trim().toLowerCase();
}
function normUsername(u: string) {
  return String(u).trim();
}
function normPhone(p: string) {
  // sehr einfache Normalisierung → nur Ziffern + führendes +
  const trimmed = String(p).trim();
  const plus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return plus ? `+${digits}` : digits;
}
function normText(s?: string) { return (s || '').trim(); }

// --- Sanitizer für Findings ---
const EXPOSED_WHITELIST = new Set([
  'email','password','phone','username','address','fullname','name','dob','birthdate','tokens','api_keys','credit_card','location','ip','device','other'
]);

function sanitizeFindings(raw: any): any[] {
  let arr: any[] = [];
  if (Array.isArray(raw)) arr = raw; else if (raw && Array.isArray(raw.findings)) arr = raw.findings; else return [];

  const out: any[] = [];
  const dedupe = new Set<string>();

  for (const f of arr) {
    const source = normText(f?.source);
    const title = normText(f?.title);
    const date = normText(f?.date);
    const url = normText(f?.url);
    const source_type = normText(f?.source_type);
    const evidence = normText(f?.evidence);
    let confidence = Number.isFinite(f?.confidence) ? Math.max(0, Math.min(100, Number(f.confidence))) : 0;

    let exposed: string[] = Array.isArray(f?.exposed) ? f.exposed.map((x: any)=> String(x).toLowerCase().trim()).filter((x: string)=> EXPOSED_WHITELIST.has(x)) : [];

    const key = `${source}|${title}|${date}|${url}`;
    if (!source && !title && !url) continue;
    if (dedupe.has(key)) continue;
    dedupe.add(key);

    out.push({ source, title, date, url, source_type, evidence, exposed, confidence });
  }

  // sort: high confidence first, then newest date if vorhanden
  out.sort((a, b) => {
    const c = b.confidence - a.confidence;
    if (c !== 0) return c;
    const ta = Date.parse(a.date || '');
    const tb = Date.parse(b.date || '');
    return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
  });

  return out;
}

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    if (!rateLimit(ip)) {
      return NextResponse.json({ error: 'Zu viele Anfragen. Bitte in ein paar Minuten erneut versuchen.' }, { status: 429 })
    }

    const body = (await req.json()) as Payload

    const emails = (body.emails ?? []).map(normEmail).filter(Boolean)
    const usernames = (body.usernames ?? []).map(normUsername).filter(Boolean)
    const phones = (body.phones ?? []).map(normPhone).filter(Boolean)

    const fullName = normText(body.fullName)
    const city = normText(body.city)
    const country = normText(body.country)
    const address = normText(body.address)
    const birthYear = Number.isFinite(body.birthYear) ? Number(body.birthYear) : undefined
    const aliases = (body.aliases ?? []).map(normText).filter(Boolean)
    const services = (body.services ?? []).map(normText).filter(Boolean)

    if (!emails.length && !usernames.length && !phones.length && !fullName && !city && !country && !address) {
      return NextResponse.json({ error: 'Bitte gib mindestens eine E‑Mail, einen Nutzernamen, eine Telefonnummer oder Name/Ort an.' }, { status: 400 })
    }

    // Query-Objekt für die KI
    const queryPayload = {
      emails,
      usernames,
      phones,
      person: {
        fullName: fullName || undefined,
        city: city || undefined,
        country: country || undefined,
        address: address || undefined,
        birthYear: birthYear || undefined,
        aliases: aliases.length ? aliases : undefined,
      },
      context: {
        services: services.length ? services : undefined,
      }
    };

    async function getBaseUrl(req: Request) {
      const proto = req.headers.get('x-forwarded-proto') || 'https'
      const host  = req.headers.get('x-forwarded-host') || req.headers.get('host')
      return `${proto}://${host}`
    }

    const base = await getBaseUrl(req)
    const osintRes = await fetch(`${base}/api/osint/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails, usernames, phones }),
      cache: 'no-store'
    })
    let webHits: any[] = []
    if (osintRes.ok) {
      try {
        const data = await osintRes.json()
        webHits = Array.isArray(data?.hits) ? data.hits.slice(0, 20) : []
      } catch { webHits = [] }
    }

    const system = `Du bist ein präziser Sicherheits-Assistent. Durchsuche nur verlässliche, bekannte Quellen (Breach-Datenbanken, Foren-Spiegel, Paste-Sites, People-Search/Öffentliches Web). Antworte ausschließlich im JSON-Format und erfinde nichts. Wenn keine eindeutigen Treffer vorliegen, gib eine leere Liste zurück.`

    const user = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Finde verifizierbare Hinweise auf Datenleaks zu folgendem Suchauftrag (JSON unten). Nutze auch die folgenden Rohdaten aus OSINT-Quellen:\nRawHits: ${JSON.stringify(webHits)}\nRegeln:\n- Nur echte, belegbare Quellen mit URL (wenn verfügbar).\n- Kein Halluzinieren.\n- Für jeden Treffer: source, title, date (YYYY-MM-DD wenn bekannt), exposed (z. B. email/password/phone/username/address/other), confidence (0-100), url (falls vorhanden), source_type (breach|paste|forum|open_web|broker|darknet), evidence (kurzer Hinweis/Beleg).\n- Nur JSON zurückgeben, kein Fließtext.\n\nQuery: ${JSON.stringify(queryPayload)}`
        }
      ]
    } as const

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20s Timeout

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [ { role: 'system', content: system }, user ],
        temperature: 0,
        response_format: { type: 'json_object' },
        max_tokens: 1200
      }),
      signal: controller.signal
    })
    clearTimeout(timeout);

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      throw new Error(`OpenAI API Fehler: ${errText}`)
    }

    const aiData = await aiRes.json()

    let parsed: any;
    try {
      const content = aiData.choices?.[0]?.message?.content ?? '{}';
      parsed = JSON.parse(content);
    } catch {
      parsed = { findings: [] };
    }

    const findings = sanitizeFindings(parsed);

    return NextResponse.json({ query: queryPayload, findings }, { status: 200 })
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'Zeitüberschreitung bei der Abfrage' : (e?.message || 'Fehler')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
