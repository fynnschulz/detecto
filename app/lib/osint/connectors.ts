// app/lib/osint/connectors.ts
export type Hit = {
  source: 'google' | 'github'
  title: string
  url: string
  snippet?: string
  date?: string
  source_type?: 'open_web' | 'paste' | 'forum' | 'repo'
}

// ---------------------------------------------
// Locale & Query-Expansion Utilities
// ---------------------------------------------
export type SearchVariant = { q: string; boost?: number }

type LocalePrefs = {
  lr: string // language restrict for CSE
  gl: string // geo
  siteTLDs: string[]
}

const DE_PREFS: LocalePrefs = {
  lr: 'lang_de',
  gl: 'de',
  siteTLDs: ['.de', '.at', '.ch']
}

const STOPWORDS_DE = new Set([
  'der','die','das','den','dem','des','ein','eine','einen','einem','eines',
  'und','oder','aber','doch','dass','daß','weil','wie','wo','wohin','woher',
  'wann','wer','was','welche','welcher','welches','mit','für','von','im','in',
  'auf','an','am','zum','zur','zu','bei','über','unter','ohne','bis','als',
  'sehr','mal','halt','eben','auch','noch','nur','schon','wo','wozu','womit'
])

const SYNONYMS_DE: Record<string, string[]> = {
  kaufen: ['shop', 'bestellen', 'preis', 'preisvergleich', 'angebot', 'deal', 'online kaufen'],
  günstig: ['billig', 'preiswert', 'rabatt', 'angebot', 'sale', 'deal'],
  webseite: ['seite', 'shop', 'anbieter', 'händler'],
  'png': ['bild'],
  'png zu pdf': ['png in pdf', 'bild in pdf', 'convert png to pdf', 'png pdf converter']
}

const ECOM_SITES_HINTS = [
  'shop', 'store', 'official', 'offiziell', 'preis', 'preisvergleich', 'vergleich',
  'angebot', 'deal', 'kaufen', 'bestellen'
]

function addTitleUrlHints(core: string): string[] {
  return [core, `intitle:${core}`, `inurl:${core}`]
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s\.\-]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function removeStopwords(words: string[]): string[] {
  return words.filter(w => !STOPWORDS_DE.has(w))
}

function expandSynonyms(words: string[]): string[] {
  const out = new Set<string>(words)
  for (const w of words) {
    const syns = SYNONYMS_DE[w]
    if (syns) syns.forEach(s => out.add(s))
  }
  return Array.from(out)
}

function detectIntent(tokens: string[]) {
  const joined = tokens.join(' ')
  const hasBuy = tokens.includes('kaufen') || tokens.includes('bestellen') || tokens.includes('preis') || tokens.includes('preisvergleich')
  const hasCheap = tokens.includes('günstig') || tokens.includes('preiswert') || tokens.includes('billig') || tokens.includes('deal') || tokens.includes('angebot')
  const isConvert = joined.includes('png zu pdf') || joined.includes('png in pdf') || (tokens.includes('png') && tokens.includes('pdf'))
  return { hasBuy, hasCheap, isConvert }
}

export function buildQueryVariants(rawQuery: string, locale: LocalePrefs = DE_PREFS): SearchVariant[] {
  const tokens = tokenize(rawQuery)
  const noStops = removeStopwords(tokens)
  const expanded = expandSynonyms(noStops)
  const { hasBuy, hasCheap, isConvert } = detectIntent(expanded)

  const coreA = expanded.join(' ')

  const quotedBrand = /[a-z]{2,}\s+[a-z]{2,}/i.test(rawQuery) ? `"${rawQuery.trim()}"` : ''
  const buyHints = hasBuy || hasCheap ? ECOM_SITES_HINTS.slice(0, 3).join(' OR ') : ''
  const tldFilters = locale.siteTLDs.map(tld => `site:${tld}`).join(' OR ')

  const base: SearchVariant[] = []

  base.push({ q: coreA, boost: 1 })

  if (quotedBrand) base.push({ q: `${coreA} ${quotedBrand}`, boost: 1.1 })

  addTitleUrlHints(coreA).forEach(v => base.push({ q: v, boost: 0.95 }))

  if (hasBuy || hasCheap) {
    base.push({ q: `${coreA} (${buyHints})`, boost: 1.15 })
    base.push({ q: `${coreA} kaufen preis`, boost: 1.15 })
    base.push({ q: `${coreA} shop`, boost: 1.05 })
    base.push({ q: `${coreA} preisvergleich`, boost: 1.05 })
  }

  if (isConvert) {
    base.push({ q: `png pdf converter`, boost: 1.1 })
    base.push({ q: `"png to pdf" OR "png in pdf"`, boost: 1.0 })
  }

  base.push({ q: `${coreA} (${tldFilters})`, boost: 1.0 })

  const seen = new Set<string>()
  return base.filter(v => {
    if (seen.has(v.q)) return false
    seen.add(v.q)
    return true
  })
}

export function buildCseParams(locale: LocalePrefs = DE_PREFS) {
  return { lr: locale.lr, gl: locale.gl, num: 10, safe: 'off' as const }
}

// ---------------------------------------------
// External APIs
// ---------------------------------------------
const GOOGLE_API = 'https://www.googleapis.com/customsearch/v1'
const GITHUB_API = 'https://api.github.com/search/code'

function guessType(url: string): Hit['source_type'] {
  const u = url.toLowerCase()
  if (u.includes('paste') || u.includes('ghostbin') || u.includes('haste')) return 'paste'
  if (u.includes('forum') || u.includes('/t/')) return 'forum'
  if (u.includes('github.com')) return 'repo'
  return 'open_web'
}

// Accept optional params (lr, gl, num, safe) and broaden env var names
export async function googleSearch(query: string, extraParams: Record<string, string | number> = {}): Promise<Hit[]> {
  const key = process.env.GOOGLE_SEARCH_KEY || process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_API_KEY
  const cx  = process.env.GOOGLE_SEARCH_CX || process.env.GOOGLE_CSE_ID
  if (!key || !cx) return []

  const defaults = buildCseParams()
  const params = new URLSearchParams({
    key, cx, q: query,
    lr: String(extraParams.lr ?? defaults.lr),
    gl: String(extraParams.gl ?? defaults.gl),
    num: String(extraParams.num ?? defaults.num),
    safe: String(extraParams.safe ?? defaults.safe)
  })

  const url = `${GOOGLE_API}?${params.toString()}`
  const r = await fetch(url, { next: { revalidate: 0 }, cache: 'no-store' })
  if (!r.ok) return []
  const data = await r.json()
  const items = data.items || []
  return items.map((it: any) => ({
    source: 'google' as const,
    title: it.title,
    url: it.link,
    snippet: it.snippet,
    date: it.pagemap?.metatags?.[0]?.['article:published_time'],
    source_type: guessType(it.link)
  }))
}

export async function githubSearch(query: string): Promise<Hit[]> {
  const token = process.env.GITHUB_TOKEN
  const url = `${GITHUB_API}?q=${encodeURIComponent(`${query} in:file size:<20000`)}&per_page=5&sort=indexed&order=desc`
  const r = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    next: { revalidate: 0 }
  })
  if (!r.ok) return []
  const data = await r.json()
  const items = data.items || []
  return items.map((it: any) => ({
    source: 'github' as const,
    title: `${it.repository?.full_name ?? 'repo'}: ${it.name}`,
    url: it.html_url,
    snippet: `path: ${it.path}`,
    source_type: 'repo' as const
  }))
}

// ---------------------------------------------
// Orchestrator
// ---------------------------------------------
export async function runConnectors(queries: string[], limitPerConnector = 5): Promise<Hit[]> {
  const collected: Hit[] = []

  // If a single natural-language query is given, expand it into variants.
  let toRun: string[] = []
  if (queries.length <= 1) {
    const base = queries[0] ?? ''
    toRun = buildQueryVariants(base).slice(0, 6).map(v => v.q)
  } else {
    toRun = queries.slice(0, 6)
  }

  const params = buildCseParams()

  for (const q of toRun) {
    const [g, gh] = await Promise.allSettled([
      googleSearch(q, params),
      githubSearch(q)
    ])
    if (g.status === 'fulfilled') collected.push(...g.value.slice(0, limitPerConnector))
    if (gh.status === 'fulfilled') collected.push(...gh.value.slice(0, limitPerConnector))
  }

  // Dedupe by URL (host+path)
  const seen = new Set<string>()
  return collected.filter(h => {
    if (!h.url) return false
    try {
      const url = new URL(h.url)
      const key = `${url.hostname}${url.pathname}`.toLowerCase().replace(/\/$/, '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    } catch {
      if (seen.has(h.url)) return false
      seen.add(h.url)
      return true
    }
  })
}