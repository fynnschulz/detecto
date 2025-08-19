"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
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

export default function NewsPage() {
  const prefersReduced = useReducedMotion();
  const reduce = prefersReduced || LESS_MOTION;

  return (
    <div className="relative min-h-screen overflow-x-clip bg-gradient-to-b from-[#0b0d10] via-[#070708] to-black text-white">
      {/* Background */}
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
            className="relative overflow-hidden text-5xl md:text-7xl font-extrabold bg-gradient-to-r from-cyan-300 via-white to-fuchsia-300 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(0,255,255,0.3)]"
          >
            <span className="relative inline-block">
              Neu bei Detecto
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shine_3s_linear_infinite] bg-[length:200%_100%]" />
            </span>
          </motion.h1>

          <motion.p
            variants={reduce ? undefined : fadeIn(0.1)}
            initial={reduce ? undefined : "hidden"}
            animate={reduce ? undefined : "show"}
            className="mx-auto mt-5 max-w-3xl text-lg md:text-2xl text-white/80"
          >
            Unsere neuesten Sicherheits-Tools – entwickelt, um dich und dein Unternehmen auf das nächste Level zu bringen.
          </motion.p>
        </Container>
      </motion.header>

      {/* TOOL SECTIONS */}
      <section className="py-12 md:py-16">
        <Container>
          <div className="grid gap-12 md:grid-cols-2">
            {/* Leak-Check */}
            <motion.div
              variants={reduce ? undefined : fadeIn(0.05)}
              initial={reduce ? undefined : "hidden"}
              animate={reduce ? undefined : "show"}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 md:p-12 backdrop-blur-xl shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="text-5xl mb-4" aria-hidden>🔍</div>
                <h2 className="text-3xl font-extrabold mb-3">Leak-Check – Finde deine Daten im Netz, bevor es Angreifer tun</h2>
                <p className="text-white/80 mb-6">
                  Erhalte sofortige Benachrichtigungen, wenn deine Daten kompromittiert werden. Schütze deine Identität und deine Unternehmensdaten proaktiv.
                </p>
              </div>
              <Link
                href="/leak-check"
                className="inline-block px-8 py-3 rounded-full bg-cyan-500 text-black font-semibold text-lg hover:bg-cyan-600 transition text-center"
              >
                Leak-Check starten
              </Link>
            </motion.div>

            {/* AttackSim */}
            <motion.div
              variants={reduce ? undefined : fadeIn(0.1)}
              initial={reduce ? undefined : "hidden"}
              animate={reduce ? undefined : "show"}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 md:p-12 backdrop-blur-xl shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="text-5xl mb-4" aria-hidden>⚡</div>
                <h2 className="text-3xl font-extrabold mb-3">AttackSim – Realistische Angriffsszenarien für dein Unternehmen</h2>
                <p className="text-white/80 mb-6">
                  Simuliere gezielte Cyberangriffe und schule dein Team im Umgang mit Bedrohungen – für eine sichere und widerstandsfähige Infrastruktur.
                </p>
              </div>
              <Link
                href="/attacksim"
                className="inline-block px-8 py-3 rounded-full bg-fuchsia-500 text-black font-semibold text-lg hover:bg-fuchsia-600 transition text-center"
              >
                AttackSim kennenlernen
              </Link>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* Detecto in Aktion */}
      <section className="py-12 md:py-16">
        <Container>
          <h2 className="text-3xl md:text-4xl font-extrabold mb-10 text-center">Detecto in Aktion</h2>
          <div className="grid gap-10 md:grid-cols-2">
            {/* Leak-Check Card */}
            <motion.div
              variants={reduce ? undefined : scaleIn(0.05)}
              initial={reduce ? undefined : "hidden"}
              animate={reduce ? undefined : "show"}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-8 backdrop-blur-xl shadow-lg flex flex-col"
            >
              <div className="bg-gray-700 rounded-lg h-48 md:h-56 mb-6" aria-label="Leak-Check Screenshot Placeholder" />
              <ul className="text-white/80 space-y-2 list-disc list-inside text-lg font-medium">
                <li>Treffer sofort sichtbar</li>
                <li>Opt-out-Generator</li>
              </ul>
            </motion.div>

            {/* AttackSim Card */}
            <motion.div
              variants={reduce ? undefined : scaleIn(0.1)}
              initial={reduce ? undefined : "hidden"}
              animate={reduce ? undefined : "show"}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-8 backdrop-blur-xl shadow-lg flex flex-col"
            >
              <div className="bg-gray-700 rounded-lg h-48 md:h-56 mb-6" aria-label="AttackSim Screenshot Placeholder" />
              <ul className="text-white/80 space-y-2 list-disc list-inside text-lg font-medium">
                <li>Realistische Simulation</li>
                <li>Fix-Anleitungen</li>
              </ul>
            </motion.div>
          </div>
        </Container>
      </section>

      <footer className="pb-12 text-center text-xs text-white/50">© {new Date().getFullYear()} Detecto</footer>
    </div>
  );
}