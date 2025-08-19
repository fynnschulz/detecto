"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";

/** ====== Motion helpers (Detecto style) ====== */
const LESS_MOTION = false;
const riseIn = (delay = 0): Variants => ({
  hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: "easeOut", delay },
  },
});
const fadeIn = (delay = 0): Variants => ({
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.6, ease: "easeOut", delay } },
});
const scaleIn = (delay = 0): Variants => ({
  hidden: { opacity: 0, scale: 0.96 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut", delay },
  },
});

/** ====== Layout helpers ====== */
function Container({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-7xl px-6 md:px-8">{children}</div>;
}

/** ====== SVG Emblems (clean, brandy) ====== */
function IconLeak() {
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden>
      <defs>
        <linearGradient id="lc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#fb7185" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="12" fill="none" stroke="url(#lc)" strokeWidth="3" />
      <line x1="28" y1="28" x2="42" y2="42" stroke="url(#lc)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
function IconAttack() {
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden>
      <defs>
        <linearGradient id="as" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="60%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <path d="M24 4 L30 22 L18 22 Z" fill="url(#as)" />
      <rect x="10" y="26" width="28" height="4" rx="2" fill="url(#as)" />
    </svg>
  );
}

/** ====== Page ====== */
export default function NewsPage() {
  const prefers = useReducedMotion();
  const reduce = prefers || LESS_MOTION;
  const year = new Date().getFullYear();

  return (
    <div className="relative min-h-screen overflow-x-clip bg-gradient-to-b from-[#090a0f] via-[#0a0b12] to-[#06070a] text-white">
      {/* Ambient background glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-48 h-[44rem] w-[44rem] rounded-full blur-3xl opacity-25 bg-gradient-to-tr from-cyan-500 via-sky-400 to-indigo-600" />
        <div className="absolute -bottom-56 -right-40 h-[44rem] w-[44rem] rounded-full blur-3xl opacity-20 bg-gradient-to-tr from-fuchsia-500 via-rose-400 to-orange-300" />
      </div>

      {/* HERO */}
      <motion.header className="pt-20 md:pt-28">
        <Container>
          <div className="relative">
            {/* soft ring */}
            <div aria-hidden className="pointer-events-none absolute -inset-x-10 -top-20 mx-auto h-[18rem] w-[18rem] rounded-full bg-gradient-to-tr from-cyan-400/15 via-white/5 to-fuchsia-400/15 blur-2xl" />
          </div>

          <motion.h1
            variants={reduce ? undefined : riseIn(0)}
            initial={reduce ? undefined : "hidden"}
            animate={reduce ? undefined : "show"}
            className="relative overflow-hidden text-5xl md:text-7xl font-extrabold bg-gradient-to-r from-cyan-300 via-white to-fuchsia-300 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(34,211,238,0.28)] text-center"
          >
            <span className="relative inline-block">
              Neu bei Detecto
              {/* Shine sweep */}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shine_3.2s_linear_infinite] bg-[length:200%_100%]" />
            </span>
          </motion.h1>

          <motion.p
            variants={reduce ? undefined : fadeIn(0.15)}
            initial={reduce ? undefined : "hidden"}
            animate={reduce ? undefined : "show"}
            className="mx-auto mt-4 max-w-3xl text-center text-lg md:text-2xl text-white/80"
          >
            Leak‑Check &amp; AttackSim – unsere neuesten Tools für elegante, wirksame digitale Sicherheit.
          </motion.p>

          <motion.div
            variants={reduce ? undefined : fadeIn(0.25)}
            initial={reduce ? undefined : "hidden"}
            animate={reduce ? undefined : "show"}
            className="mt-8 flex flex-col sm:flex-row justify-center gap-4"
          >
            <Link
              href="/leak-check"
              className="px-7 py-3 rounded-full bg-white text-black font-semibold text-base hover:bg-white/90 transition shadow"
            >
              Leak‑Check starten
            </Link>
            <Link
              href="/attacksim"
              className="px-7 py-3 rounded-full border border-white/20 text-white hover:bg-white/10 transition"
            >
              AttackSim kennenlernen
            </Link>
          </motion.div>

          <motion.div
            className="mx-auto mt-8 h-[2px] w-40 md:w-56 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent blur-[1px]"
            initial={reduce ? undefined : { opacity: 0 }}
            animate={reduce ? undefined : { opacity: [0, 1, 0.6, 1] }}
            transition={reduce ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </Container>
      </motion.header>

      {/* TOOLS */}
      <section className="py-12 md:py-16">
        <Container>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Leak-Check */}
            <motion.div
              variants={reduce ? undefined : scaleIn(0.05)}
              initial={reduce ? undefined : "hidden"}
              whileInView={reduce ? undefined : "show"}
              viewport={{ once: true, amount: 0.35 }}
              className="group relative rounded-3xl border border-white/10 bg-white/[0.05] p-8 md:p-10 backdrop-blur-xl shadow-[0_0_0_0_rgba(0,0,0,0.0)] hover:shadow-[0_8px_32px_rgba(34,211,238,0.15)] transition"
            >
              <div className="flex items-start gap-5">
                <div className="rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                  <IconLeak />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-extrabold">Leak‑Check</h2>
                  <p className="mt-2 text-white/75">
                    Finde exponierte Daten im Open Web &amp; Darknet – inkl. konkreten Opt‑out‑Anleitungen.
                  </p>
                  <div className="mt-6">
                    <Link
                      href="/leak-check"
                      className="inline-flex items-center rounded-full bg-cyan-400 px-5 py-2 text-black font-semibold hover:bg-cyan-300 transition"
                    >
                      Leak‑Check starten
                    </Link>
                  </div>
                </div>
              </div>
              {/* subtle gradient ring on hover */}
              <div aria-hidden className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition bg-gradient-to-r from-cyan-400/20 via-transparent to-fuchsia-400/20" />
            </motion.div>

            {/* AttackSim */}
            <motion.div
              variants={reduce ? undefined : scaleIn(0.1)}
              initial={reduce ? undefined : "hidden"}
              whileInView={reduce ? undefined : "show"}
              viewport={{ once: true, amount: 0.35 }}
              className="group relative rounded-3xl border border-white/10 bg-white/[0.05] p-8 md:p-10 backdrop-blur-xl hover:shadow-[0_8px_32px_rgba(244,114,182,0.14)] transition"
            >
              <div className="flex items-start gap-5">
                <div className="rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                  <IconAttack />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-extrabold">AttackSim</h2>
                  <p className="mt-2 text-white/75">
                    Simuliert realistische Angriffe, erklärt Risiken verständlich und liefert klare Fix‑Anleitungen.
                  </p>
                  <div className="mt-6">
                    <Link
                      href="/attacksim"
                      className="inline-flex items-center rounded-full bg-fuchsia-400 px-5 py-2 text-black font-semibold hover:bg-fuchsia-300 transition"
                    >
                      AttackSim kennenlernen
                    </Link>
                  </div>
                </div>
              </div>
              <div aria-hidden className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition bg-gradient-to-r from-fuchsia-400/20 via-transparent to-cyan-400/20" />
            </motion.div>
          </div>
        </Container>
      </section>

      {/* SHOWCASE */}
      <section className="py-12 md:py-16">
        <Container>
          <h3 className="text-center text-3xl md:text-4xl font-extrabold">Detecto in Aktion</h3>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            {/* Leak showcase */}
            <motion.div
              variants={reduce ? undefined : fadeIn(0.05)}
              initial={reduce ? undefined : "hidden"}
              whileInView={reduce ? undefined : "show"}
              viewport={{ once: true, amount: 0.3 }}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-8 backdrop-blur-xl"
            >
              <div className="relative mb-5 h-52 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 ring-1 ring-white/10 overflow-hidden">
                <div aria-hidden className="absolute -inset-8 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.22),transparent_45%),radial-gradient(ellipse_at_bottom_right,rgba(236,72,153,0.22),transparent_45%)]" />
                <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white/10 to-transparent" />
              </div>
              <ul className="space-y-2 text-white/80">
                <li className="flex gap-2"><span>•</span><span>Treffer sofort sichtbar</span></li>
                <li className="flex gap-2"><span>•</span><span>Opt‑out‑Generator</span></li>
              </ul>
            </motion.div>

            {/* Attack showcase */}
            <motion.div
              variants={reduce ? undefined : fadeIn(0.1)}
              initial={reduce ? undefined : "hidden"}
              whileInView={reduce ? undefined : "show"}
              viewport={{ once: true, amount: 0.3 }}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-8 backdrop-blur-xl"
            >
              <div className="relative mb-5 h-52 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 ring-1 ring-white/10 overflow-hidden">
                <div aria-hidden className="absolute -inset-8 bg-[radial-gradient(ellipse_at_top_left,rgba(236,72,153,0.22),transparent_45%),radial-gradient(ellipse_at_bottom_right,rgba(34,211,238,0.22),transparent_45%)]" />
                <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white/10 to-transparent" />
              </div>
              <ul className="space-y-2 text-white/80">
                <li className="flex gap-2"><span>•</span><span>Realistische Simulation</span></li>
                <li className="flex gap-2"><span>•</span><span>Fix‑Anleitungen</span></li>
              </ul>
            </motion.div>
          </div>
        </Container>
      </section>

      <footer className="pb-12 text-center text-xs text-white/50">© {year} Detecto</footer>

      {/* Page-scoped styles for shine keyframes */}
      <style jsx>{`
        @keyframes shine {
          0% { background-position: -100% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
