'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

// helpers for percentage formatting
const clampPct = (v: number) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0))
const fmtPct = (v: number) => {
  const x = Math.round(clampPct(v) * 10) / 10
  return (x % 1 === 0 ? x.toFixed(0) : x.toFixed(1))
}

// Inline Topbar (no import)

type Audience = "personal" | "business";
type NavItem = { label: string; href: string };

function Topbar({ navItems, audience, className }: { navItems: NavItem[]; audience: Audience; className?: string }) {
  const pathname = usePathname();
  if (audience !== "personal") return null;
  return (
    <nav
      className={`fixed left-0 right-0 top-0 z-50 pt-[max(env(safe-area-inset-top),0px)] md:pt-4 bg-transparent backdrop-blur-0 border-0 select-none ${className ?? ""}`}
    >
      <div
        className="px-3 py-2 overflow-x-auto md:overflow-visible whitespace-nowrap md:whitespace-normal [-webkit-overflow-scrolling:touch] md:flex md:justify-center"
        style={{ msOverflowStyle: "none" as any }}
      >
        <div className="inline-flex md:flex items-center gap-2 min-w-max md:min-w-0">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center px-5 py-2 text-sm font-medium rounded-full transition-all duration-300 relative 
            ${
              isActive
                ? "bg-blue-500/80 text-white shadow-[0_0_10px_rgba(0,200,255,0.6)]"
                : "bg-zinc-800/60 text-gray-300 hover:bg-blue-700/30 hover:text-white"
            }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="relative z-10">{item.label}</span>
                {isActive && (
                  <span className="absolute inset-0 rounded-full bg-blue-500 opacity-10 blur-md animate-pulse" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// Types
type Finding = {
  source: string
  title?: string
  date?: string
  exposed?: string[]
  confidence: number // 0–100
  url?: string
  source_type?: 'breach' | 'paste' | 'forum' | 'open_web' | 'broker' | 'darknet' | string
  evidence?: string
  status?: string
  indicators?: string[]
  trade_score?: number
  actions?: string[]
}

// NAV_ITEMS definieren (irrelevanter Testkommentar)
const NAV_ITEMS = [
  { label: "Website-Scan", href: "/WebsiteScan" },
  { label: "Suchmaschine", href: "/search" },
  { label: "Community", href: "/community" },
  { label: "Datencheck", href: "/leak-check" },
  { label: "VPN", href: "/vpn" },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, ease: 'easeOut', delay },
});

export default function LeakCheckPage() {
  // Inputs
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [fullName, setFullName] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [address, setAddress] = useState('')
  const [birthYear, setBirthYear] = useState<string>('')
  const [aliases, setAliases] = useState('') // comma separated
  const [passwords, setPasswords] = useState<string[]>(['']) // up to 3 passwords
  const [consent, setConsent] = useState(false)

  // UI state
  const [openBasics, setOpenBasics] = useState(true)
  const [openAdvanced, setOpenAdvanced] = useState(false)
  const [openResults, setOpenResults] = useState(true)
  const [phase, setPhase] = useState<'idle'|'running'|'done'|'error'>("idle")
  const [progressPct, setProgressPct] = useState(0)
  const [progressNotes, setProgressNotes] = useState<string[]>([])
  const [deepScan, setDeepScan] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpExpanded, setHelpExpanded] = useState(false)

  // Circular progress constants
  const R = 54; // radius
  const CIRC = useMemo(() => 2 * Math.PI * R, [])

  // Request state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [findings, setFindings] = useState<Finding[] | null>(null)
  const [nextSteps, setNextSteps] = useState<string[]>([])
  const [stats, setStats] = useState<{queries:number; hits:number} | null>(null)

  const hasAnyInput = useMemo(() => [email, phone, fullName, city, country, address, birthYear]
    .some(v => String(v || '').trim().length > 0), [email, phone, fullName, city, country, address, birthYear])
  const valid = hasAnyInput && consent

  function splitCSV(v: string): string[] {
    return v
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  }

  function updatePassword(idx: number, value: string) {
    setPasswords(prev => {
      const next = [...prev]
      next[idx] = value
      return next
    })
  }

  function addPasswordField() {
    setPasswords(prev => (prev.length < 3 ? [...prev, ''] : prev))
  }

  function removePasswordField(idx: number) {
    setPasswords(prev => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setLoading(true)
    setError(null)
    setFindings(null)
    setPhase('running')
    setProgressPct(0)
    setNextSteps([])
    setStats(null)
    setProgressNotes(
      deepScan
        ? ["Eingaben normalisiert", "Query‑Expansion wird vorbereitet…"]
        : []
    )

    const startedAt = Date.now()
    const minDurationMs = deepScan ? 18000 : 3500

    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt
      const fraction = Math.min(elapsed / minDurationMs, 0.99) // bis 99% während wir warten
      const pct = Math.max(1, Math.floor(fraction * 100))
      setProgressPct(pct)
    }, deepScan ? 120 : 80)

    try {
      const payload = {
        emails: [email.trim().toLowerCase()].filter(Boolean),
        // username removed
        phones: [phone.trim()].filter(Boolean),
        fullName: fullName.trim() || undefined,
        city: city.trim() || undefined,
        country: country.trim() || undefined,
        address: address.trim() || undefined,
        birthYear: birthYear ? Number(birthYear) : undefined,
        aliases: splitCSV(aliases),
        passwords: passwords.map(p => p.trim()).filter(Boolean),
        deepScan,
      }

      const res = await fetch('/api/leak-ai-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (deepScan) setProgressNotes(v => [...v, "Treffer werden geladen & geprüft…"])
      if (!res.ok) throw new Error(`Scan fehlgeschlagen (${res.status})`)
      const data = await res.json()
      const elapsed = Date.now() - startedAt
      const remaining = Math.max(0, minDurationMs - elapsed)

      const finalize = () => {
        setFindings(data.findings ?? [])
        setNextSteps(Array.isArray(data.next_steps) ? data.next_steps : [])
        setStats(data.stats && typeof data.stats === 'object'
          ? { queries: Number(data.stats.queries)||0, hits: Number(data.stats.hits)||0 }
          : null)
        setOpenResults(true)
        if (deepScan) setProgressNotes(v => [...v, "KI‑Validierung & Konsolidierung abgeschlossen"])
        // stop the main timer first
        clearInterval(interval)

        // read the latest percentage synchronously via functional update
        let startVal = 0
        setProgressPct(p => { startVal = Math.max(0, Math.min(100, p)); return p })

        const duration = deepScan ? 1200 : 600 // ms for the final smooth fill
        const stepMs = 40
        const steps = Math.max(1, Math.ceil(duration / stepMs))
        let i = 0
        const finTimer = setInterval(() => {
          i++
          const next = startVal + ((100 - startVal) * (i / steps))
          // keep one decimal as elsewhere
          const rounded = Math.round(next * 10) / 10
          setProgressPct(Math.min(100, rounded))
          if (i >= steps) {
            clearInterval(finTimer)
            setProgressPct(100)
            setPhase('done')
          }
        }, stepMs)
      }

      if (remaining > 0) {
        // Während wir warten, langsam weiter auf ~99% schieben
        const smoothTimer = setInterval(() => {
          setProgressPct(p => Math.min(99, p + (deepScan ? 0.25 : 1.8)))
        }, deepScan ? 220 : 140)
        setTimeout(() => {
          clearInterval(smoothTimer)
          finalize()
        }, remaining)
      } else {
        finalize()
      }
    } catch (err: any) {
      setError(err?.message || 'Unbekannter Fehler')
      setPhase('error')
    } finally {
      clearInterval(interval)
      setLoading(false)
    }
  }

  // Helpers
  const RiskDot: React.FC<{v:number}> = ({ v }) => (
    <span className={`inline-block h-2.5 w-2.5 rounded-full ${v >= 80 ? 'bg-red-400' : v >= 50 ? 'bg-yellow-400' : 'bg-green-400'}`} />
  )

  const toggleHelp = () => {
    setHelpOpen(v => {
      if (v) setHelpExpanded(false)
      return !v
    })
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-gray-900 via-[#0b0b0f] to-black text-white overflow-x-hidden">
      <div className="mx-auto max-w-4xl px-6 py-10 pt-24 md:pt-28">
        <Topbar navItems={NAV_ITEMS} audience="personal" />
        {/* HERO */}
        <section className="relative flex items-center justify-center px-0 pt-2 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0 }}
            className="relative z-10 max-w-3xl mx-auto px-2"
          >
            <h1 className="text-5xl md:text-7xl font-extrabold leading-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.35),0_0_24px_rgba(59,130,246,0.15)]">
              <span className="bg-gradient-to-r from-cyan-300 via-blue-200 to-white bg-clip-text text-transparent">
                Leak‑ / Daten‑Check
              </span>
            </h1>
            <p className="mt-5 text-xl md:text-2xl text-gray-300 [text-shadow:0_1px_6px_rgba(0,0,0,0.35)]">
              Finde geleakte E‑Mails, Nummern & Namen – mit echten Web‑Treffern und smarter Risiko‑Einstufung.
            </p>
            <div className="mx-auto mt-6 h-[2px] w-40 md:w-56 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent blur-[1px]" />
          </motion.div>

          {/* Subtile Lichter */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0.35 }}
            animate={{ opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 10, repeat: Infinity }}
          >
            <div className="absolute -top-24 left-[20%] h-80 w-80 rounded-full blur-3xl bg-cyan-500/20" />
            <div className="absolute top-24 right-[18%] h-96 w-96 rounded-full blur-3xl bg-blue-500/20" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full blur-2xl bg-purple-500/15" />
          </motion.div>
        </section>

        {/* Card container */}
        <form onSubmit={onSubmit} className="grid gap-5">
        {/* BASICS */}
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/[0.06] to-white/[0.03] backdrop-blur-xl p-4 md:p-5 shadow-[0_0_40px_rgba(0,255,255,0.08)] transition-all">
          <button
            type="button"
            onClick={() => setOpenBasics(v => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <h2 className="text-xl font-semibold">Basisdaten</h2>
              <p className="text-sm opacity-80">E‑Mail empfohlen, Telefonnummer optional</p>
            </div>
            <span className={`i-chevron ${openBasics ? 'rotate-180' : ''} transition-transform`}>▼</span>
          </button>

          {openBasics && (
            <div className="mt-4 grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm opacity-80">E‑Mail <span className="opacity-60">(empfohlen)</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e)=>setEmail(e.target.value)}
                  placeholder="du@example.com"
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20 transition"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm opacity-80">Telefonnummer <span className="opacity-60">(optional)</span></label>
                <input
                  value={phone}
                  onChange={(e)=>setPhone(e.target.value)}
                  placeholder="+49…"
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20 transition"
                />
              </div>
            </div>
          )}
        </section>

        {/* ADVANCED */}
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/[0.06] to-white/[0.03] backdrop-blur-xl p-4 md:p-5 shadow-[0_0_40px_rgba(255,0,255,0.06)] transition-all">
          <button
            type="button"
            onClick={() => setOpenAdvanced(v => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <h2 className="text-xl font-semibold">Erweiterte Angaben</h2>
              <p className="text-sm opacity-80">Optional für präzisere Ergebnisse</p>
            </div>
            <span className={`i-chevron ${openAdvanced ? 'rotate-180' : ''} transition-transform`}>▼</span>
          </button>

          {openAdvanced && (
            <div className="mt-4 grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm opacity-80">Voller Name</label>
                <input
                  value={fullName}
                  onChange={(e)=>setFullName(e.target.value)}
                  placeholder="Vor- und Nachname"
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-fuchsia-300/60 focus:ring-2 focus:ring-fuchsia-300/20 transition"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm opacity-80">Stadt</label>
                  <input
                    value={city}
                    onChange={(e)=>setCity(e.target.value)}
                    placeholder="z. B. Berlin"
                    className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-fuchsia-300/60 focus:ring-2 focus:ring-fuchsia-300/20 transition"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm opacity-80">Land</label>
                  <input
                    value={country}
                    onChange={(e)=>setCountry(e.target.value)}
                    placeholder="z. B. Deutschland"
                    className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-fuchsia-300/60 focus:ring-2 focus:ring-fuchsia-300/20 transition"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm opacity-80">Adresse <span className="opacity-60">(optional)</span></label>
                <input
                  value={address}
                  onChange={(e)=>setAddress(e.target.value)}
                  placeholder="Straße und ggf. Hausnummer"
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-fuchsia-300/60 focus:ring-2 focus:ring-fuchsia-300/20 transition"
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
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-fuchsia-300/60 focus:ring-2 focus:ring-fuchsia-300/20 transition"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm opacity-80">Aliase / Spitznamen <span className="opacity-60">(Komma‑getrennt)</span></label>
                <input
                  value={aliases}
                  onChange={(e)=>setAliases(e.target.value)}
                  placeholder="z. B. fynn, schulzewes"
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-fuchsia-300/60 focus:ring-2 focus:ring-fuchsia-300/20 transition"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm opacity-80">Passwörter <span className="opacity-60">(bis zu 3 – optional)</span></label>
                <div className="space-y-2">
                  {passwords.map((pw, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="password"
                        value={pw}
                        onChange={(e)=>updatePassword(idx, e.target.value)}
                        placeholder={`Passwort ${idx+1}`}
                        className="flex-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-fuchsia-300/60 focus:ring-2 focus:ring-fuchsia-300/20 transition"
                      />
                      {passwords.length > 1 && (
                        <button type="button" onClick={()=>removePasswordField(idx)} className="text-xs px-2 py-1 rounded-lg bg-white/10 border border-white/10 hover:bg-white/20">
                          Entfernen
                        </button>
                      )}
                    </div>
                  ))}
                  {passwords.length < 3 && (
                    <button type="button" onClick={addPasswordField} className="text-sm px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 hover:bg-white/20">
                      + Passwort hinzufügen
                    </button>
                  )}
                  <p className="text-xs opacity-70">
                    Wir speichern deine Passwörter nicht. Sie werden nur kurz für die Suche verarbeitet und danach verworfen.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* CONSENT + ACTION */}
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/[0.06] to-white/[0.03] backdrop-blur-xl p-4 md:p-5">
          <label className="flex items-center gap-2 text-sm opacity-90">
            <input type="checkbox" checked={consent} onChange={(e)=>setConsent(e.target.checked)} />
            Ich stimme zu, dass eine KI‑gestützte Suche in externen Quellen durchgeführt wird.
          </label>

          {/* Deep Scan Switch */}
          <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div>
              <div className="text-sm font-medium">Deep Scan (gründlicher, langsamer)</div>
              <div className="text-xs opacity-70">Mehr Quellen & Varianten, intensivere Evidenz‑Prüfung</div>
            </div>
            <button
              type="button"
              onClick={() => setDeepScan(v => !v)}
              aria-pressed={deepScan}
              className={`relative h-6 w-11 rounded-full transition ${deepScan ? 'bg-cyan-400/80' : 'bg-white/15'}`}
              title="Deep Scan umschalten"
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${deepScan ? 'right-0.5' : 'left-0.5'}`}
              />
            </button>
          </div>

          <div className="mt-3 flex gap-3">
            <button
              type="submit"
              disabled={!valid || loading}
              className="inline-flex items-center justify-center rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-4 py-2 hover:bg-cyan-500/20 hover:border-cyan-300/70 disabled:opacity-60 transition"
            >
              {loading ? 'Scanne…' : deepScan ? 'Deep Scan starten' : 'Schnellen Scan starten'}
            </button>
          </div>

          {error && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm">{error}</div>}
        </section>
        </form>

        {/* PROGRESS / RESULTS */}
        {phase === 'running' && (
          <section className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/[0.06] to-white/[0.03] backdrop-blur-xl p-5 shadow-[0_0_40px_rgba(0,255,255,0.08)]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold">{deepScan ? 'Tiefer Scan läuft…' : 'Schneller Scan läuft…'}</h2>
            <div className="text-base font-semibold tracking-wide">{fmtPct(progressPct)}%</div>
          </div>

          <div className="mt-3 flex items-center gap-4">
            {/* Circular progress */}
            <div className="relative h-[132px] w-[132px]">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden>
                <circle cx="60" cy="60" r={R} stroke="rgba(255,255,255,0.15)" strokeWidth="6" fill="none" />
                <circle
                  cx="60" cy="60" r={R}
                  stroke={deepScan ? 'url(#gradDeep)' : 'url(#gradFast)'}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={((100 - (Math.round(clampPct(progressPct) * 10) / 10)) / 100) * CIRC}
                  fill="none"
                  style={{ transition: 'stroke-dashoffset 120ms linear' }}
                />
                <defs>
                  <linearGradient id="gradDeep" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                  <linearGradient id="gradFast" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#a3e635" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 grid place-items-center text-xl font-semibold">
                {fmtPct(progressPct)}%
              </div>
            </div>

            <div className="flex-1">
              {deepScan ? (
                <div className="space-y-2 text-sm opacity-90">
                  {progressNotes.map((n, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300" />
                      <span>{n}</span>
                    </div>
                  ))}
                  <div className="text-xs opacity-70">Dies kann je nach Quelle 10–20 Sekunden dauern.</div>
                </div>
              ) : (
                <div className="text-sm opacity-80">Kurz-Check aktiv. Das geht fix.</div>
              )}
            </div>
          </div>
          </section>
        )}

        {phase === 'done' && (
          <section className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/[0.06] to-white/[0.03] backdrop-blur-xl p-5 shadow-[0_0_40px_rgba(0,0,0,0.25)]">
            {/* Success flash with full circle */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="mb-3 flex items-center gap-4"
            >
              <div className="relative h-[132px] w-[132px]">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden>
                  <circle cx="60" cy="60" r={R} stroke="rgba(255,255,255,0.15)" strokeWidth="6" fill="none" />
                  <circle
                    cx="60" cy="60" r={R}
                    stroke="url(#gradDeep)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={0}
                    fill="none"
                  />
                </svg>
                {/* flash ring */}
                <motion.span
                  initial={{ opacity: 0.0, scale: 0.9 }}
                  animate={{ opacity: [0.0, 0.6, 0.0], scale: [0.9, 1.15, 1.25] }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="pointer-events-none absolute inset-0 rounded-full ring-4 ring-cyan-300/40"
                />
                <div className="absolute inset-0 grid place-items-center text-xl font-semibold">100%</div>
              </div>
              <div className="flex-1">
                <div className="text-base font-medium">Scan abgeschlossen – Ergebnisse unten</div>
                <div className="text-xs opacity-70">Wir haben alles konsolidiert und gewichten die Treffer nach Quelle & Evidenz.</div>
              </div>
            </motion.div>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Scan abgeschlossen</h2>
              <span className="text-sm opacity-80">100%</span>
            </div>
            {nextSteps && nextSteps.length > 0 && (
              <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-1.5 text-lg font-semibold">Nächste Schritte</div>
                <ul className="space-y-1 text-sm text-gray-200">
                  {nextSteps.map((a, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-[6px] inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {findings && findings.length ? (
              <div className="mt-4 grid gap-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-lg font-medium">Treffer: {findings.length}</div>
                </div>
                {stats && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm opacity-85">
                      Suchstatistik: <span className="px-2 py-0.5 rounded bg-white/10">Queries: {stats.queries}</span>{' '}
                      <span className="px-2 py-0.5 rounded bg-white/10 ml-2">Treffer: {stats.hits}</span>
                    </div>
                  </div>
                )}
                {findings.map((f, i) => (
                  <div key={i} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 pl-5 hover:shadow-[0_0_30px_rgba(0,255,255,0.15)]">
                    <div aria-hidden className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-emerald-400/10 via-cyan-400/10 to-blue-400/10" />
                    <div className="flex items-center gap-3">
                      <RiskDot v={f.confidence} />
                      <div className="font-semibold">{f.title}</div>
                      <div className="ml-auto text-xs opacity-70">{f.source}{f.date ? ` • ${f.date}` : ''}</div>
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
                    {f.actions && f.actions.length > 0 && (
                      <div className="mt-3">
                        <div className="text-sm font-medium text-white/90">Empfohlen</div>
                        <ul className="mt-1 space-y-1 text-sm text-gray-300">
                          {f.actions.slice(0,5).map((act, j) => (
                            <li key={j} className="flex items-start gap-2">
                              <span className="mt-[6px] inline-block h-1.5 w-1.5 rounded-full bg-cyan-300" />
                              <span>{act}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">Keine Treffer gefunden 🎉</div>
            )}
          </section>
        )}
      </div>

        {/* Floating Help Button */}
        <button
          type="button"
          onClick={toggleHelp}
          aria-expanded={helpOpen}
          aria-controls="help-panel"
          className="fixed bottom-5 right-5 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-gray-400 text-black shadow-xl ring-1 ring-gray-300/60 hover:scale-105 active:scale-95 transition"
          title={helpOpen ? 'Hilfe schließen' : 'Hilfe öffnen'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`h-6 w-6 transition-transform ${helpOpen ? 'rotate-45' : ''}`}
            aria-hidden
          >
            <path d="M11 4a1 1 0 0 1 2 0v7h7a1 1 0 1 1 0 2h-7v7a1 1 0 1 1-2 0v-7H4a1 1 0 1 1 0-2h7V4z"/>
          </svg>
        </button>

        {/* Sliding Help Panel */}
        {helpOpen && (
          <motion.div
            id="help-panel"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`fixed bottom-20 right-5 z-[59] ${helpExpanded ? 'w-[92vw] md:w-[520px] max-h-[70vh]' : 'w-[88vw] md:w-[380px]'} rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/[0.06] to-white/[0.03] backdrop-blur-xl shadow-[0_15px_60px_rgba(0,0,0,0.35)]`}
            role="dialog"
            aria-label="Erklärung Datencheck"
            aria-modal="false"
          >
            <div className="relative p-4 md:p-5">
              {/* Header */}
              <div className="mb-2 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-cyan-400" />
                <h3 className="text-base md:text-lg font-semibold">Wie funktioniert der Datencheck?</h3>
              </div>

              {/* Content */}
              {!helpExpanded ? (
                <div className="text-sm text-gray-200/90 space-y-3">
                  <p>
                    Der Datencheck durchsucht öffentliche Quellen (z. B. Paste‑Seiten, Foren, Code‑Hosts und
                    Suchindizes) nach Spuren deiner Eingaben. Wir normalisieren E‑Mail & Telefonnummer,
                    bilden Varianten/Hashes und prüfen Treffer mit einer KI auf <em>Evidenz</em> & Risiko.
                  </p>
                  <p className="text-gray-300/90">
                    Du kannst zwischen einem schnellen Scan (kompakt und zügig) und einem Deep Scan wählen, der gründlicher arbeitet, mehr Quellen und Varianten einbezieht und die Evidenz strenger prüft.
                  </p>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setHelpExpanded(true)}
                      className="text-cyan-300 hover:text-white underline underline-offset-2"
                    >
                      Mehr lesen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-200/90 max-h-[56vh] overflow-y-auto pr-1 space-y-3">
                  <p>
                    <strong>Überblick.</strong> Der Datencheck kombiniert gezielte Websuche mit inhaltlicher
                    Validierung. Aus deinen Angaben werden normalisierte Varianten erzeugt (E‑Mail‑Normalisierung,
                    internationale Telefonformate), dazu Hash‑Ableitungen (MD5/SHA‑1/SHA‑256) und leichte
                    Schreibvarianten.
                  </p>
                  <p>
                    <strong>Suche & Quellen.</strong> Wir erstellen Query‑Kombinationen (z. B. „E‑Mail + leak“,
                    „Telefon + paste“, optional auch eingegebene Passwörter) und fragen primär seriöse Quellen ab:
                    Paste‑Seiten, Foren, Code‑Hosts (z. B. GitHub/Gist) und Suchindizes. Ergebnisse werden dedupliziert.
                  </p>
                  <p>
                    <strong>Pipeline im Detail.</strong> Zunächst werden Eingaben vereinheitlicht (z. B. Klein‑/Großschreibung und Sonderzeichen sowie E.164‑Formate für Telefonnummern). Darauf aufbauend erzeugen wir Varianten wie Punkte‑ oder Plus‑Aliase bei E‑Mails sowie tokenisierte Namensformen. Anschließend erweitern wir die Suchanfragen mehrsprachig um passende Schlüsselwörter; optional werden auch eingegebene Passwörter berücksichtigt.
                  </p>
                  <p>
                    Danach rufen wir die Seiten ab, extrahieren den Text und suchen mithilfe von Regex und toleranter Ähnlichkeitserkennung nach Treffern. Die Bewertung berücksichtigt Quelle, Aktualität und Mehrfach‑Belege und führt zu einer Confidence‑Einschätzung von 0 bis 100. Am Ende erhältst du eine konsolidierte Ausgabe mit Quelle, kompaktem Hinweis zur Evidenz und einer transparenten Risikoeinschätzung.
                  </p>
                  <p>
                    <strong>Datenschutz.</strong> Deine Eingaben werden nur für die Dauer der Suche genutzt und anschließend verworfen. Wir speichern keine Passwörter. Treffer enthalten nur kurze Nachweise (Snippets/Links), damit du sie selbst prüfen kannst.
                  </p>
                  <p className="opacity-80">
                    Tipp: Je mehr optionale Felder du angibst (z. B. Name, genutzte Dienste), desto gezielter kann
                    der Datencheck filtern und False‑Positives reduzieren.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
    </div>
  )
}