// @ts-nocheck
"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

export default function NewsPage() {
  const updates = [
    {
      date: "19. Aug 2025",
      title: "AttackSim",
      desc:
        "Simulator für Web-Apps, APIs & Netzwerke. Realistische Angriffspfade, priorisierte Funde, klare Fix-Guides.",
      tag: "Angriffssimulation",
    },
    {
      date: "18. Aug 2025",
      title: "Leak-/Daten-Check",
      desc:
        "Suche nach exponierten E-Mails, Usernames & IDs im Open Web & Darknet. Treffer mit Risiko-Einstufung.",
      tag: "Datencheck",
    },
    {
      date: "15. Aug 2025",
      title: "VPN",
      desc: "Sicher verbinden, Tracking umgehen, Region wechseln. Integration in Detecto im Aufbau.",
      tag: "VPN",
    },
    {
      date: "07. Aug 2025",
      title: "Community",
      desc: "Erfahrungsberichte, Bewertungen und Hinweise – datenschutzfreundlich eingebunden.",
      tag: "Community",
    },
    {
      date: "24. Jul 2025",
      title: "Scan & Suchmaschine",
      desc: "Website‑Scan mit Datenschutz‑Score und KI‑Suchmaschine mit präzisen, sicheren Treffern.",
      tag: "Tools",
    },
  ];

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.7, ease: "easeOut", delay },
  });

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-gray-800 via-[#111] to-black text-white overflow-x-hidden">
      {/* HERO */}
      <section className="relative flex min-h-[78vh] items-center justify-center px-6 pt-28 text-center">
        <motion.div {...fadeUp(0)} className="relative z-10 max-w-3xl">
          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.35),0_0_24px_rgba(59,130,246,0.15)]">
            <span className="bg-gradient-to-r from-cyan-300 via-blue-200 to-white bg-clip-text text-transparent">
              Neuigkeiten · Detecto
            </span>
          </h1>
          <p className="mt-5 text-xl md:text-2xl text-gray-300 [text-shadow:0_1px_6px_rgba(0,0,0,0.35)]">
            Releases, Meilensteine und Previews – kompakt und übersichtlich.
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

      {/* FEATURED BLOCK: AttackSim */}
      <section className="relative px-6">
        <motion.div
          {...fadeUp(0.05)}
          className="mx-auto max-w-6xl rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-black/70 p-6 md:p-8 shadow-[0_0_40px_rgba(0,255,255,0.08)] backdrop-blur-md"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="text-sm text-cyan-300">Neu & glänzend</div>
              <h2 className="text-3xl md:text-4xl font-extrabold mt-1">
                Detecto AttackSim
              </h2>
              <p className="mt-2 text-gray-300 max-w-2xl">
                KI-gestützte Simulation realer Angriffspfade für Web-Apps, APIs
                und Netzwerke. Ergebnisse werden in klare, nachvollziehbare
                Aufgabenpakete übersetzt – inklusive Verifizierungs-Checks.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/AttackSim"
                  className="px-5 py-2 rounded-full bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition"
                >
                  AttackSim öffnen
                </Link>
                <Link
                  href="/kontakt"
                  className="px-5 py-2 rounded-full bg-transparent border border-gray-600 text-white font-semibold hover:bg-zinc-800 transition"
                >
                  Demo anfragen
                </Link>
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="relative mx-auto md:mx-0 w-full max-w-md"
            >
              {/* Soft glow behind the image */}
              <div aria-hidden className="absolute -inset-6 rounded-3xl bg-gradient-to-tr from-cyan-400/15 via-blue-500/10 to-purple-500/10 blur-2xl" />

              <div className="relative w-[280px] h-[160px] mx-auto overflow-hidden rounded-tl-xl rounded-tr-xl rounded-bl-xl bg-gradient-to-r from-transparent via-transparent to-neutral-900 shadow-lg">
                <Image
                  src="/attacksim.png"
                  alt="AttackSim Vorschau"
                  width={280}
                  height={160}
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* TOOL-KACHELN */}
      <section className="mt-24 px-6">
        <div className="mx-auto max-w-6xl">
          <motion.h3 {...fadeUp(0)} className="text-4xl font-bold text-white text-center">
            Aktuelle Detecto-Module
          </motion.h3>
          <motion.p {...fadeUp(0.03)} className="mt-3 text-center text-gray-400 max-w-2xl mx-auto">
            Knackig erklärt – sofort nutzbar.
          </motion.p>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* AttackSim Card */}
            <motion.div
              {...fadeUp(0.06)}
              className="relative overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900/70 p-6 shadow-xl"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-purple-500/10"
              />
              <div
                aria-hidden
                className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-cyan-400/15 blur-3xl"
              />

              <div className="flex items-center justify-between gap-4">
                <h4 className="text-2xl font-bold">AttackSim</h4>
              </div>
              <p className="mt-3 text-gray-300">
                Simulation realistischer Angriffswege, Priorisierung nach Impact
                & Exploitbarkeit, reproduzierbare Schritte, Verifizierung nach Fix.
              </p>
              <ul className="mt-4 space-y-2 text-gray-300 text-sm">
                <li>• Scope: Domains, Subdomains, APIs, Netzsegmente</li>
                <li>• Ausgabe: Kontext, Schweregrad, Vorgehensweise</li>
                <li>• Checks: Bestätigung nach Behebung</li>
              </ul>
              <div className="mt-5 flex gap-3">
                <Link
                  href="/AttackSim"
                  className="px-4 py-2 rounded-full bg-white text-black font-semibold hover:bg-white/90 transition"
                >
                  Tool öffnen
                </Link>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-full bg-zinc-800/70 border border-zinc-600 text-white font-semibold hover:bg-zinc-700/70 transition"
                >
                  Zum Dashboard
                </Link>
              </div>
            </motion.div>

            {/* Leak Check Card */}
            <motion.div
              {...fadeUp(0.09)}
              className="relative overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900/70 p-6 shadow-xl"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-emerald-400/10 via-cyan-400/10 to-blue-400/10"
              />
              <div
                aria-hidden
                className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-emerald-400/15 blur-3xl"
              />

              <div className="flex items-center justify-between gap-4">
                <h4 className="text-2xl font-bold">Leak-/Daten-Check</h4>
              </div>
              <p className="mt-3 text-gray-300">
                Suche nach exponierten E-Mails, Usernames & IDs im Open Web und
                Darknet – inklusive Risiko-Einstufung, Zeitstempel und
                Schritt-für-Schritt-Hilfen zum Entfernen.
              </p>
              <ul className="mt-4 space-y-2 text-gray-300 text-sm">
                <li>• Quellen: Leaksammlungen, Paste-Sites, Foren</li>
                <li>• Ergebnis: Trefferliste mit Kontext & Timestamp</li>
                <li>• Unterstützung: Opt-out-Vorlagen & Generator</li>
              </ul>
              <div className="mt-5 flex gap-3">
                <Link
                  href="/leakcheck"
                  className="px-4 py-2 rounded-full bg-white text-black font-semibold hover:bg-white/90 transition"
                >
                  Tool öffnen
                </Link>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-full bg-zinc-800/70 border border-zinc-600 text-white font-semibold hover:bg-zinc-700/70 transition"
                >
                  Zum Dashboard
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CHANGELOG / TIMELINE */}
      <section className="mt-28 px-6">
        <div className="mx-auto max-w-5xl">
          <motion.h3 {...fadeUp(0)} className="text-3xl md:text-4xl font-bold text-white text-center">
            Changelog & Meilensteine
          </motion.h3>
          <motion.p {...fadeUp(0.03)} className="mt-3 text-center text-gray-400 max-w-2xl mx-auto">
            Fortschritt, transparent und nachvollziehbar.
          </motion.p>

          <div className="mt-12 relative">
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-400/40 via-zinc-700 to-transparent" />
            <ul className="space-y-10">
              {updates.map((u, i) => (
                <motion.li
                  key={u.title}
                  {...fadeUp(0.03 * i)}
                  className="relative md:grid md:grid-cols-2 md:gap-10 items-start"
                >
                  <div className="hidden md:block" />
                  <div className="relative md:col-start-1 md:col-end-3">
                    <div className="md:absolute md:left-1/2 md:-translate-x-1/2 md:top-2 h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.8)]" />
                    <div
                      className={`mt-0 md:max-w-[48%] ${
                        i % 2 === 0 ? "md:mr-auto md:pr-6" : "md:ml-auto md:pl-6"
                      }`}
                    >
                      <div className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-5 backdrop-blur-md shadow-xl">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{u.date}</span>
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-cyan-400/30 text-cyan-300 bg-cyan-500/10">
                            {u.tag}
                          </span>
                        </div>
                        <h4 className="mt-2 text-xl font-semibold text-white">{u.title}</h4>
                        <p className="mt-2 text-gray-300">{u.desc}</p>
                      </div>
                    </div>
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-28 px-6 pb-24">
        <motion.div
          {...fadeUp(0)}
          className="mx-auto max-w-5xl rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-black/70 p-8 text-center shadow-[0_0_40px_rgba(0,255,255,0.08)]"
        >
          <h3 className="text-3xl font-bold">News abonnieren</h3>
          <p className="mt-3 text-gray-300">Updates direkt ins Postfach.</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <input
              type="email"
              placeholder="E-Mail-Adresse"
              className="w-full sm:w-96 px-4 py-3 rounded-full bg-zinc-900/80 border border-zinc-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
            <button className="px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition">
              Abonnieren
            </button>
          </div>
          <div className="mt-4 text-xs text-gray-500">Keine Werbung. Abmeldung jederzeit möglich.</div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="text-center text-sm text-gray-600 py-12 space-y-2 bg-black/40">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-400">
          <Link href="/datenschutz" className="hover:underline">Datenschutz</Link>
          <Link href="/cookies" className="hover:underline">Cookies</Link>
          <Link href="/nutzung" className="hover:underline">Nutzungsbedingungen</Link>
          <Link href="/rechtliches" className="hover:underline">Rechtliches</Link>
          <Link href="/ueber-uns" className="hover:underline">Über uns</Link>
          <Link href="/impressum" className="hover:underline">Impressum</Link>
        </div>
        <div>© 2025 Detecto – Datenschutz neu gedacht.</div>
      </footer>
    </div>
  );
}