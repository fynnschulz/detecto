"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import type { ReactNode } from "react";

const LESS_MOTION = true;

// --- Animation helpers
const fadeIn = (delay = 0): Variants => ({
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut", delay } },
});
const riseIn = (delay = 0): Variants => ({
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut", delay } },
});
const scaleIn = (delay = 0): Variants => ({
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: "easeOut", delay } },
});

function Glow({ className = "" }: { className?: string }) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-2xl opacity-25 ${className}`}
      style={{ willChange: "transform" }}
      animate={prefersReduced ? undefined : {
        y: [0, -6, 0, 6, 0],
        x: [0, 4, 0, -4, 0],
      }}
      transition={prefersReduced ? undefined : { duration: 14, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// --- Small helpers
function Container({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-7xl px-6 md:px-8">{children}</div>;
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80 backdrop-blur">
      {children}
    </span>
  );
}

function Accordion({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const prefers = useReducedMotion();
  const reduce = prefers || LESS_MOTION;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left flex items-center justify-between gap-4 px-5 py-4"
        aria-expanded={open}
      >
        <span className="font-semibold text-white text-lg md:text-xl">{title}</span>
        {reduce ? (
          <span className="text-white/70 text-xl">+</span>
        ) : (
          <motion.span
            className="text-white/70 text-xl"
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.25 }}
          >
            +
          </motion.span>
        )}
      </button>
      {reduce ? (
        open && (
          <div className="px-5 pb-5 text-white/80 text-sm md:text-base leading-relaxed">
            {children}
          </div>
        )
      ) : (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="content"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="px-5 pb-5 text-white/80 text-sm md:text-base leading-relaxed"
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

export default function GuardianNewsPage() {
  const prefersReduced = useReducedMotion();
  const reduce = prefersReduced || LESS_MOTION;

  return (
    <div className="relative min-h-screen overflow-x-clip bg-gradient-to-b from-[#0b0d10] via-[#070708] to-black text-white">
      {/* Backdrop like hero */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-48 h-[44rem] w-[44rem] rounded-full blur-2xl opacity-20 bg-gradient-to-tr from-cyan-500 via-sky-400 to-indigo-600" />
        <div className="absolute -bottom-48 -right-40 h-[44rem] w-[44rem] rounded-full blur-2xl opacity-15 bg-gradient-to-tr from-fuchsia-500 via-rose-400 to-orange-400" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),rgba(0,0,0,0)_60%)]" />

        <Glow className="-top-24 left-16 h-64 w-64 bg-cyan-500/40" />
        <Glow className="bottom-32 right-24 h-72 w-72 bg-fuchsia-500/30" />
        <Glow className="top-1/3 right-1/3 h-56 w-56 bg-indigo-500/25" />
      </div>

      {/* HERO */}
      <motion.header
        initial={reduce ? undefined : "hidden"}
        animate={reduce ? undefined : "show"}
        variants={reduce ? undefined : fadeIn()}
        className="pt-24 md:pt-32 pb-16 text-center"
      >
        <Container>
          <motion.h1
            variants={reduce ? undefined : riseIn(0)}
            initial={reduce ? undefined : "hidden"}
            animate={reduce ? undefined : "show"}
            className="text-5xl md:text-7xl font-extrabold leading-[1.1] [text-shadow:0_1px_8px_rgba(0,0,0,0.35)]"
          >
            <span className="bg-gradient-to-r from-cyan-300 via-blue-200 to-white bg-clip-text text-transparent">
              GUARDIAN
            </span>
            <br />
            <span>Dein unsichtbarer Schild im Netz.</span>
          </motion.h1>

          <motion.p
            variants={reduce ? undefined : fadeIn(0.1)}
            initial={reduce ? undefined : "hidden"}
            animate={reduce ? undefined : "show"}
            className="mx-auto mt-5 max-w-3xl text-lg md:text-2xl text-white/80"
          >
            Plakativer Schutz vor Phishing, Betrug, Datenlecks und dubiosen Angeboten – in Echtzeit, mit klaren
            Erklärungen und pragmatischen Empfehlungen.
          </motion.p>

          <motion.div
            variants={reduce ? undefined : fadeIn(0.2)}
            initial={reduce ? undefined : "hidden"}
            animate={reduce ? undefined : "show"}
            className="mt-8 flex flex-col sm:flex-row justify-center gap-4"
          >
            <Link
              href="/guardian"
              className="px-8 py-4 rounded-full bg-white text-black font-semibold text-base hover:bg-white/90 transition shadow"
            >
              Jetzt GUARDIAN starten
            </Link>
            <Link
              href="/einstellungen"
              className="px-8 py-4 rounded-full border border-white/20 text-white hover:bg-white/10 transition"
            >
              Schutz personalisieren
            </Link>
          </motion.div>

          <motion.div
            className="mx-auto mt-6 h-[2px] w-40 md:w-56 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent blur-[1px]"
            initial={reduce ? undefined : { opacity: 0 }}
            animate={reduce ? undefined : { opacity: [0, 1, 0.6, 1] }}
            transition={reduce ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Pill>Live-Erkennung</Pill>
            <Pill>Dein KI Bodyguard</Pill>
            <Pill>Benutzerfreundlich</Pill>
            <Pill>Made for Humans</Pill>
          </div>
        </Container>
      </motion.header>

      {/* BIG FEATURES */}
      <section className="py-12 md:py-16">
        <Container>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Echtzeit-Erkennung",
                lead: "Guardian analysiert Websites & Inhalte beim Öffnen.",
                points: ["Phishing-/Scam-Muster", "Fake-Shops & Dark Patterns", "Gefährliche Formulare"],
                emoji: "🛡️",
              },
              {
                title: "Benutzerfreundlich & aktiv",
                lead: "Guardian nimmt dir Arbeit ab: blockiert Absender, meldet Phishing und räumt Postfächer auf – wo möglich automatisiert.",
                points: [
                  "Ein-Klick-Blockieren & Spam-Filter",
                  "Phishing-Absender automatisch sperren",
                  "Geführte Melde- & Opt-out-Flows",
                ],
                emoji: "🤖",
              },
              {
                title: "Klare Entscheidungen",
                lead: "Sofortwarnungen mit Begründung und sicheren Alternativen.",
                points: ["Warum ist es riskant?", "Was bedeutet das?", "Was ist der nächste Schritt?"],
                emoji: "⚡",
              },
            ].map((f) => (
              <motion.div
                key={f.title}
                variants={reduce ? undefined : scaleIn(0.05)}
                initial={reduce ? undefined : "hidden"}
                whileInView={reduce ? undefined : "show"}
                whileHover={undefined}
                viewport={{ once: true, amount: 0.3 }}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-8 backdrop-blur-xl shadow-[0_0_0_0_rgba(0,0,0,0.0)] hover:shadow-[0_6px_20px_rgba(0,255,255,0.06)] transition"
              >
                <div className="text-4xl" aria-hidden>{f.emoji}</div>
                <h3 className="mt-2 text-2xl md:text-3xl font-extrabold">{f.title}</h3>
                <p className="mt-2 text-white/70">{f.lead}</p>
                <ul className="mt-4 space-y-1 text-white/80">
                  {f.points.map((p) => (
                    <li key={p} className="flex gap-2"><span>•</span><span>{p}</span></li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* HOW IT WORKS + WHY BEST (accordions) */}
      <section className="py-8 md:py-12">
        <Container>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-extrabold">Wie GUARDIAN funktioniert</h2>
              <motion.div variants={fadeIn(0.05)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
                <Accordion title="1) Erkennen – live & lokal">
                  GUARDIAN prüft Webseiten, Links und Inhalte beim Öffnen auf bekannte Betrugsmuster, manipulierte UI,
                  dubiose Zahlungswege und Warnsignale. Schlank, schnell, datensparsam.
                </Accordion>
              </motion.div>
              <motion.div variants={fadeIn(0.05)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
                <Accordion title="2) Verstehen – klare Erklärungen">
                  Statt kryptischer Codes erhältst du verständliche Hinweise: Was ist auffällig, warum ist es riskant, welche Daten würden betroffen sein?
                </Accordion>
              </motion.div>
              <motion.div variants={fadeIn(0.05)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
                <Accordion title="3) Handeln – sofort & sicher">
                  Blockieren, ignorieren oder sichere Alternative öffnen: GUARDIAN gibt dir konkrete, klickbare Optionen – inkl. seriösen Empfehlungen.
                </Accordion>
              </motion.div>
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-extrabold">Warum GUARDIAN das Beste ist</h2>
              <motion.div variants={fadeIn(0.05)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
                <Accordion title="Ernsthafte Erkennung statt reiner Blacklists">
                  Blacklists sind immer zu spät. GUARDIAN kombiniert Mustererkennung, Heuristiken und Kontextsignale – und warnt, bevor Schaden entsteht.
                </Accordion>
              </motion.div>
              <motion.div variants={fadeIn(0.05)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
                <Accordion title="Datensparsam, respektvoll, transparent">
                  Wir sammeln nicht deine Welt. Hinweise werden lokal bewertet, sensible Daten bleiben bei dir. Nur notwendige Checks verlassen dein Gerät.
                </Accordion>
              </motion.div>
              <motion.div variants={fadeIn(0.05)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
                <Accordion title="Erklärungen statt Panik">
                  Warnungen sind handlungsorientiert: kurz, klar und mit Lösungsvorschlag. So triffst du informierte Entscheidungen – ohne Angst-Marketing.
                </Accordion>
              </motion.div>
            </div>
          </div>
        </Container>
      </section>

      {/* CALL TO ACTION LARGE */}
      <section className="py-16 md:py-24 text-center">
        <Container>
          <motion.div
            variants={reduce ? undefined : scaleIn(0.1)}
            initial={reduce ? undefined : "hidden"}
            whileInView={reduce ? undefined : "show"}
            viewport={{ once: true, amount: 0.3 }}
            className="rounded-3xl border border-white/10 bg-white/[0.05] p-8 md:p-12 backdrop-blur-xl"
          >
            <div aria-hidden className="relative">
              <motion.div
                className="pointer-events-none absolute -inset-10 mx-auto h-[18rem] w-[18rem] rounded-full bg-gradient-to-tr from-cyan-400/20 via-white/10 to-fuchsia-400/20 blur-2xl"
                animate={{ rotate: [0, 15, 0, -15, 0] }}
                transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <h3 className="text-4xl md:text-6xl font-extrabold leading-tight">Bereit, dich schützen zu lassen?</h3>
            <p className="mt-4 text-lg md:text-2xl text-white/80 max-w-3xl mx-auto">
              Aktiviere GUARDIAN und erhalte Schutz in Echtzeit – mit verständlichen Erklärungen und sicheren Alternativen.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/guardian" className="px-8 py-4 rounded-full bg-white text-black font-semibold text-base hover:bg-white/90 transition shadow">
                Guardian aktivieren
              </Link>
              <Link href="/einstellungen" className="px-8 py-4 rounded-full border border-white/20 text-white hover:bg-white/10 transition">
                Einstellungen öffnen
              </Link>
            </div>
          </motion.div>
        </Container>
      </section>

      <footer className="pb-12 text-center text-xs text-white/50">© {new Date().getFullYear()} Detecto · Guardian</footer>
    </div>
  );
}