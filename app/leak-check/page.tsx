'use client'

import React, { useState } from 'react'

type Finding = {
  source: string
  title: string
  date?: string
  exposed?: string[]
  confidence: number // 0–100
  url?: string
  source_type?: 'breach' | 'paste' | 'forum' | 'open_web' | 'broker' | 'darknet' | string
  evidence?: string
}

export default function LeakCheckPage() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')

  // Erweiterte Felder (Open-Web / Datenbroker)
  const [fullName, setFullName] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [address, setAddress] = useState('')
  const [birthYear, setBirthYear] = useState<string>('')
  const [aliases, setAliases] = useState('') // kommagetrennt
  const [services, setServices] = useState('') // kommagetrennt

  const [consent, setConsent] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [findings, setFindings] = useState<Finding[] | null>(null)

  const hasAnyInput = [email, username, phone, fullName, city, country, address, birthYear].some(v => String(v || '').trim().length > 0)
  const valid = hasAnyInput && consent

  function splitCSV(v: string): string[] {
    return v
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setLoading(true)
    setError(null)
    setFindings(null)
    try {
      const payload = {
        emails: [email.trim().toLowerCase()].filter(Boolean),
        usernames: [username.trim()].filter(Boolean),
        phones: [phone.trim()].filter(Boolean),
        fullName: fullName.trim() || undefined,
        city: city.trim() || undefined,
        country: country.trim() || undefined,
        address: address.trim() || undefined,
        birthYear: birthYear ? Number(birthYear) : undefined,
        aliases: splitCSV(aliases),
        services: splitCSV(services),
      }

      const res = await fetch('/api/leak-ai-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Scan fehlgeschlagen (${res.status})`)
      const data = await res.json()
      setFindings(data.findings ?? [])
    } catch (err: any) {
      setError(err?.message || 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-4xl font-semibold">Leak-Check</h1>
      <p className="mt-2 opacity-80">
        Prüfe, ob deine Daten in bekannten Leaks oder öffentlichen Quellen aufgetaucht sind.
      </p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        {/* Basis */}
        <div className="grid gap-2">
          <label className="text-sm opacity-80">E-Mail <span className="opacity-60">(empfohlen)</span></label>
          <input
            type="email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            placeholder="du@example.com"
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm opacity-80">Username <span className="opacity-60">(optional)</span></label>
          <input
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
            placeholder="z. B. deinHandle"
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm opacity-80">Telefonnummer <span className="opacity-60">(optional)</span></label>
          <input
            value={phone}
            onChange={(e)=>setPhone(e.target.value)}
            placeholder="+49…"
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30"
          />
        </div>

        {/* Erweiterte Suche */}
        <div className="mt-2 h-px bg-white/10" />
        <div className="text-sm font-medium opacity-90">Erweiterte Suche (optional)</div>

        <div className="grid gap-2">
          <label className="text-sm opacity-80">Voller Name</label>
          <input
            value={fullName}
            onChange={(e)=>setFullName(e.target.value)}
            placeholder="Vor- und Nachname"
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label className="text-sm opacity-80">Stadt</label>
            <input
              value={city}
              onChange={(e)=>setCity(e.target.value)}
              placeholder="z. B. Berlin"
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm opacity-80">Land</label>
            <input
              value={country}
              onChange={(e)=>setCountry(e.target.value)}
              placeholder="z. B. Deutschland"
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-sm opacity-80">Adresse <span className="opacity-60">(optional)</span></label>
          <input
            value={address}
            onChange={(e)=>setAddress(e.target.value)}
            placeholder="Straße und ggf. Hausnummer"
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm opacity-80">Geburtsjahr <span className="opacity-60">(optional)</span></label>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={birthYear}
            onChange={(e)=>setBirthYear(e.target.value)}
            placeholder="1998"
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm opacity-80">Aliase / Spitznamen <span className="opacity-60">(optional, Komma‑getrennt)</span></label>
          <input
            value={aliases}
            onChange={(e)=>setAliases(e.target.value)}
            placeholder="z. B. fynn, schulzewes"
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm opacity-80">Genutzte Dienste <span className="opacity-60">(optional, Komma‑getrennt)</span></label>
          <input
            value={services}
            onChange={(e)=>setServices(e.target.value)}
            placeholder="z. B. Amazon, PayPal, Instagram"
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30"
          />
        </div>

        <label className="mt-2 flex items-center gap-2 text-sm opacity-90">
          <input type="checkbox" checked={consent} onChange={(e)=>setConsent(e.target.checked)} />
          Ich stimme zu, dass eine KI-gestützte Suche in externen Quellen durchgeführt wird.
        </label>

        <button
          type="submit"
          disabled={!valid || loading}
          className="mt-2 inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 hover:bg-white/20 disabled:opacity-60"
        >
          {loading ? 'Prüfe…' : 'Jetzt prüfen'}
        </button>

        {error && <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm">{error}</div>}
      </form>

      {/* Ergebnisse */}
      {findings && (
        <div className="mt-6 grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-lg font-medium">
              {findings.length ? `Treffer: ${findings.length}` : 'Keine Treffer gefunden 🎉'}
            </div>
          </div>

          {findings.map((f, i)=>(
            <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${f.confidence >= 80 ? 'bg-red-400' : f.confidence >= 50 ? 'bg-yellow-400' : 'bg-green-400'}`} />
                <div className="font-semibold">{f.title}</div>
                <div className="ml-auto text-xs opacity-70">
                  {f.source}{f.date ? ` • ${f.date}` : ''}
                </div>
              </div>
              {f.exposed?.length ? (
                <div className="mt-2 text-sm opacity-90">Betroffen: {f.exposed.join(', ')}</div>
              ) : null}
              <div className="mt-2 text-xs opacity-70 flex gap-3 flex-wrap">
                {f.source_type ? <span className="px-2 py-0.5 rounded bg-white/10">{f.source_type}</span> : null}
                <span className="px-2 py-0.5 rounded bg-white/10">Confidence: {Math.round(f.confidence)}%</span>
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="px-2 py-0.5 rounded bg-white/10 underline">Quelle öffnen</a>
                ) : null}
              </div>
              {f.evidence ? (
                <div className="mt-2 text-xs opacity-80">Hinweis: {f.evidence}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}