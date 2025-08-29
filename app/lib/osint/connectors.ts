// app/lib/osint/connectors.ts
export type Hit = {
  source: 'google' | 'github'
  title: string
  url: string
  snippet?: string
  date?: string
  source_type?: 'open_web' | 'paste' | 'forum' | 'repo'
}

const GOOGLE_API = 'https://www.googleapis.com/customsearch/v1'
const GITHUB_API = 'https://api.github.com/search/code'

function guessType(url: string): Hit['source_type'] {
  const u = url.toLowerCase()
  if (u.includes('paste') || u.includes('ghostbin') || u.includes('haste')) return 'paste'
  if (u.includes('forum') || u.includes('/t/')) return 'forum'
  if (u.includes('github.com')) return 'repo'
  return 'open_web'
}

export async function googleSearch(query: string): Promise<Hit[]> {
  const key = process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_API_KEY
  const cx  = process.env.GOOGLE_SEARCH_CX || process.env.GOOGLE_CSE_ID
  if (!key || !cx) return []
  const url = `${GOOGLE_API}?key=${key}&cx=${cx}&q=${encodeURIComponent(query)}&num=5&safe=off`
  const r = await fetch(url, { next: { revalidate: 0 } })
  if (!r.ok) return []
  const data = await r.json()
  const items = data.items || []
  return items.map((it: any) => ({
    source: 'google' as const,
    title: it.title,
    url: it.link,
    snippet: it.snippet,
    date: it.pagemap?.metatags?.[0]?.['article:published_time'],
    source_type: guessType(it.link),
  }))
}

export async function githubSearch(query: string): Promise<Hit[]> {
  const token = process.env.GITHUB_TOKEN
  const url = `${GITHUB_API}?q=${encodeURIComponent(`${query} in:file size:<20000`)}&per_page=5&sort=indexed&order=desc`
  const r = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    next: { revalidate: 0 },
  })
  if (!r.ok) return []
  const data = await r.json()
  const items = data.items || []
  return items.map((it: any) => ({
    source: 'github' as const,
    title: `${it.repository?.full_name ?? 'repo'}: ${it.name}`,
    url: it.html_url,
    snippet: `path: ${it.path}`,
    source_type: 'repo' as const,
  }))
}

export async function runConnectors(queries: string[], limitPerConnector = 5): Promise<Hit[]> {
  const collected: Hit[] = []
  for (const q of queries.slice(0, 6)) {
    const [g, gh] = await Promise.allSettled([googleSearch(q), githubSearch(q)])
    if (g.status === 'fulfilled') collected.push(...g.value.slice(0, limitPerConnector))
    if (gh.status === 'fulfilled') collected.push(...gh.value.slice(0, limitPerConnector))
  }
  // Dedupe by URL
  const seen = new Set<string>()
  return collected.filter(h => {
    if (!h.url || seen.has(h.url)) return false
    seen.add(h.url)
    return true
  })
}