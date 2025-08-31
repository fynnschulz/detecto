'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

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
  source: string;
  title: string;
  date?: string;
  exposed?: string[];
  confidence: number; // 0–100
  url?: string;
  source_type?: 'breach' | 'paste' | 'forum' | 'open_web' | 'broker' | 'darknet' | string;
  evidence?: string;
};

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
  const [services, setServices] = useState('') // comma separated
  const [consent, setConsent] = useState(false)

  // UI state
  const [openBasics, setOpenBasics] = useState(true)
  const [openAdvanced, setOpenAdvanced] = useState(false)
  const [openResults, setOpenResults] = useState(true)
  const [phase, setPhase] = useState<'idle'|'running'|'done'|'error'>("idle")
  const [progressPct, setProgressPct] = useState(0)
  const [progressNotes, setProgressNotes] = useState<string[]>([])
  const [deepScan, setDeepScan] = useState(false)

  // Request state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [findings, setFindings] = useState<Finding[] | null>(null)

  const hasAnyInput = useMemo(() => [email, phone, fullName, city, country, address, birthYear]
    .some(v => String(v || '').trim().length > 0), [email, phone, fullName, city, country, address, birthYear])
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
    setPhase('running')
    setProgressPct(0)
    setProgressNotes(
      deepScan
        ? ["Eingaben normalisiert", "Query‑Expansion wird vorbereitet…"]
        : []
    )

    let pct = 0
    const targetWhileWaiting = deepScan ? 92 : 70
    const interval = setInterval(() => {
      // sanft ansteigen lassen, verlangsamt ab ~70%
      const base = pct < 60 ? 2 + Math.random() * 2 : pct < 80 ? 1 + Math.random() * 1.5 : 0.5 + Math.random()
      const factor = deepScan ? 0.8 : 1.2
      pct = Math.min(targetWhileWaiting, pct + base * factor)
      setProgressPct(Math.round(pct))
    }, 250)

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
        services: splitCSV(services),
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
      setFindings(data.findings ?? [])
      setOpenResults(true)
      if (deepScan) setProgressNotes(v => [...v, "KI‑Validierung & Konsolidierung abgeschlossen"])
      setProgressPct(100)
      setPhase('done')
      clearInterval(interval)
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
                <label className="text-sm opacity-80">Genutzte Dienste <span className="opacity-60">(Komma‑getrennt)</span></label>
                <input
                  value={services}
                  onChange={(e)=>setServices(e.target.value)}
                  placeholder="z. B. Amazon, PayPal, Instagram"
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-fuchsia-300/60 focus:ring-2 focus:ring-fuchsia-300/20 transition"
                />
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
            <button
              type="button"
              onClick={() => { setEmail(''); setPhone(''); setFullName(''); setCity(''); setCountry(''); setAddress(''); setBirthYear(''); setAliases(''); setServices(''); setFindings(null); setError(null); }}
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10 transition"
            >
              Zurücksetzen
            </button>
          </div>

          {error && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm">{error}</div>}
        </section>
        </form>

        {/* PROGRESS / RESULTS */}
        {phase === 'running' && (
          <section className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/[0.06] to-white/[0.03] backdrop-blur-xl p-5 shadow-[0_0_40px_rgba(0,255,255,0.08)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">{deepScan ? 'Tiefer Scan läuft…' : 'Schneller Scan läuft…'}</h2>
              <div className="text-sm opacity-80">{progressPct}%</div>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div className="h-2 w-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-white" style={{ transform: `translateX(-${100 - progressPct}%)` }} />
            </div>
            {deepScan && (
              <ul className="mt-4 space-y-2 text-sm opacity-90">
                {progressNotes.map((n, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 text-xs opacity-70">{deepScan ? 'Dies kann je nach Quelle 10–20 Sekunden dauern.' : 'Dies dauert nur wenige Sekunden.'}</div>
          </section>
        )}

        {phase === 'done' && (
          <section className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/[0.06] to-white/[0.03] backdrop-blur-xl p-5 shadow-[0_0_40px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Scan abgeschlossen</h2>
              <span className="text-sm opacity-80">100%</span>
            </div>
            {findings && findings.length ? (
              <div className="mt-4 grid gap-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-lg font-medium">Treffer: {findings.length}</div>
                </div>
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
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">Keine Treffer gefunden 🎉</div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}