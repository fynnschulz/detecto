// app/api/osint/search/route.ts
import { NextResponse } from 'next/server'
import { runConnectors, type Hit } from '@/app/lib/osint/connectors'

type Payload = {
  emails?: string[]
  usernames?: string[]
  phones?: string[]
  extraQueries?: string[] // optional freie Queries
}

function buildQueries(p: Payload): string[] {
  const q: string[] = []
  for (const e of p.emails || []) q.push(`"${e}" leak OR paste OR dump`)
  for (const u of p.usernames || []) q.push(`"${u}" leak OR paste OR dump`)
  for (const ph of p.phones || []) q.push(`"${ph}" leak OR paste OR dump`)
  for (const x of p.extraQueries || []) q.push(x)
  return q
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload & { query?: string }
    console.log("[OSINT][DEBUG] Raw request body:", body)
    // Add safe defaults in case body is nullish
    const safe: Payload = {
      emails: body?.emails || [],
      usernames: body?.usernames || [],
      phones: body?.phones || [],
      extraQueries: body?.extraQueries || []
    };
    console.log("[OSINT][DEBUG] Safe payload constructed:", safe)
    if (body?.query) {
      console.log("[OSINT][DEBUG] Incoming free query:", body.query)
      safe.extraQueries = [...(safe.extraQueries || []), body.query]
    }
    const queries = buildQueries(safe)
    console.log("[OSINT][DEBUG] Built queries for connectors:", queries)
    console.log("[OSINT][DEBUG] Number of queries built:", queries.length)
    if (!queries.length) {
      return NextResponse.json({ hits: [] }, { status: 200 })
    }
    let hits: Hit[] = []
    try {
      hits = await runConnectors(queries)
      console.log("[OSINT][DEBUG] Raw response from connectors (Google etc.):", hits)
      console.log("[OSINT][DEBUG] Number of hits returned from connectors:", hits.length)
      console.log("[OSINT][DEBUG] Hits JSON stringified:", JSON.stringify(hits))
    } catch (connectorError) {
      console.error("[OSINT][ERROR] Error fetching or parsing connector responses:", connectorError)
      return NextResponse.json({ error: 'Connector fetch or parse error' }, { status: 500 })
    }
    return NextResponse.json({ hits }, { status: 200 })
  } catch (e: any) {
    console.error("Error in search route:", e)
    return NextResponse.json({ error: e?.message || 'Fehler' }, { status: 500 })
  }
}