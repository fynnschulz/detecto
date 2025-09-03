"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function ProtectoPage() {
  const [tab, setTab] = useState<"block" | "isolate" | "fake">("block");
  const [faqOpen, setFaqOpen] = useState<string | null>(null);

  const features = [
    {
      title: "Tracker-Block",
      k: "block",
      tagline: "Stoppt Werbe- & Analyse-Domains schon im Request.",
      bullets: [
        "Declarative Net Rules gegen Ads, Beacons, Fingerprint-CDNs",
        "3rd‑Party Cookies & Set‑Cookie‑Header blocken/strippen",
        "Domain‑Listen + Heuristik (Pfad‑Muster, Query‑Parameter)"
      ],
    },
    {
      title: "Storage-Isolation",
      k: "isolate",
      tagline: "Trennt Tracking‑Speicher von deiner eigentlichen Session.",
      bullets: [
        "Virtuelle Container pro Seite/Scope",
        "document.cookie / localStorage / sessionStorage‑Guards",
        "Nur notwendige Session‑Cookies bleiben erhalten"
      ],
    },
    {
      title: "Privacy‑Fake (optional)",
      k: "fake",
      tagline: "Täuscht Tracker – echte Nutzung bleibt privat.",
      bullets: [
        "Leichte Randomisierung (UA, Canvas, Audio)",
        "Kontextsichere Platzhalter‑IDs statt echter Identität",
        "Site‑Kompatibilität durch Whitelist & Feintuning"
      ],
    },
  ];

  const glow = "before:content-[''] before:absolute before:-inset-1 before:bg-gradient-to-r before:from-pink-500/30 before:via-fuchsia-400/20 before:to-sky-400/30 before:blur-2xl before:rounded-[28px]";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(1200px_600px_at_80%_-10%,rgba(56,189,248,0.06),transparent),radial-gradient(900px_400px_at_10%_10%,rgba(236,72,153,0.05),transparent)]">
      {/* floating background orbs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-pink-500/20 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute top-10 right-[-100px] h-96 w-96 rounded-full bg-sky-400/20 blur-3xl animate-[pulse_8s_ease-in-out_infinite]" />

      {/* Hero */}
      <section className="relative z-10 px-4 pt-16 pb-8 md:pt-24 md:pb-12">
        <div className="mx-auto max-w-6xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/80 backdrop-blur">
            <span className="inline-block h-2 w-2 rounded-full bg-pink-400 animate-pulse" />
            Neu: Das Herzstück von Detecto
          </div>

          <h1 className="mx-auto max-w-4xl bg-gradient-to-br from-white via-pink-100 to-sky-100 bg-clip-text text-4xl font-extrabold leading-tight text-transparent md:text-6xl">
            Detecto <span className="whitespace-nowrap">Protecto</span>
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-balance text-base text-white/80 md:text-lg">
            Der ultimative Cookie‑ & Tracking‑Schutz. **Nur notwendige Cookies**, isolierte Sessions, geblockte Fingerprints –
            und auf Wunsch smarte Privacy‑Fakes. Webseiten glauben, sie dürfen alles. In Wahrheit sammeln sie: fast nichts.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className={`relative ${glow} inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/20 transition hover:from-pink-400 hover:to-sky-400`}
            >
              Jetzt vormerken
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white/90 hover:bg-white/10"
            >
              Wie es funktioniert
            </a>
          </div>

          {/* compatibility strip */}
          <div className="mx-auto mt-10 flex flex-wrap items-center justify-center gap-4 text-xs text-white/60">
            <Badge>Chrome</Badge>
            <Badge>Firefox</Badge>
            <Badge>Edge</Badge>
            <Badge>Safari (macOS & iOS)</Badge>
          </div>
        </div>
      </section>

      {/* Value Grid */}
      <section className="relative z-10 px-4 pb-4 md:pb-8">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              t: "Cookie‑Banner? Egal.",
              d: "Akzeptieren klicken ohne Bauchweh: Tracker werden trotzdem blockiert oder isoliert.",
              i: (
                <IconShield/>
              ),
            },
            {
              t: "Weniger Fingerprints",
              d: "Bekannte Fingerprinting‑Skripte stoppen – optionale Fake‑Signale senken Wiedererkennung.",
              i: (<IconWaves/>),
            },
            {
              t: "Schnell & Kompatibel",
              d: "Regeln vorrangig deklarativ (Performanz), feines Whitelisting für kritische Sites.",
              i: (<IconSpeed/>),
            },
          ].map((c, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: idx * 0.06 }}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-md"
            >
              <div className="absolute -top-10 right-[-50px] h-32 w-32 rounded-full bg-pink-400/10 blur-2xl" />
              <div className="mb-3 text-2xl">{c.i}</div>
              <h3 className="text-lg font-semibold text-white">{c.t}</h3>
              <p className="mt-1 text-sm text-white/80">{c.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Tabs: Block / Isolate / Fake */}
      <section id="how" className="relative z-10 px-4 py-6 md:py-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex flex-wrap gap-2">
            {features.map((f) => (
              <button
                key={f.k}
                onClick={() => setTab(f.k as typeof tab)}
                className={`relative rounded-2xl border px-4 py-2 text-sm transition ${
                  tab === f.k
                    ? "border-pink-400/80 bg-pink-500/10 text-white shadow-[0_0_15px_rgba(255,20,147,0.35)]"
                    : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                }`}
              >
                {f.title}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Left: explanation */}
            <motion.div
              key={`left-${tab}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-5"
            >
              <h3 className="text-lg font-semibold text-white">
                {features.find((x) => x.k === tab)?.title}
              </h3>
              <p className="mt-1 text-sm text-white/80">
                {features.find((x) => x.k === tab)?.tagline}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/85">
                {features
                  .find((x) => x.k === tab)!
                  .bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r from-pink-400 to-sky-400" />
                      <span>{b}</span>
                    </li>
                  ))}
              </ul>
              <div className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-sky-400/10 blur-2xl" />
            </motion.div>

            {/* Right: mock demo */}
            <motion.div
              key={`right-${tab}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/60 to-zinc-900/30 p-5"
            >
              <div className="mb-3 flex items-center justify-between text-xs text-white/70">
                <span className="font-medium">Live‑Vorschau</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5">{tab === "block" ? "Requests" : tab === "isolate" ? "Storage" : "Signals"}</span>
              </div>

              {tab === "block" && <DemoBlock/>}
              {tab === "isolate" && <DemoIsolate/>}
              {tab === "fake" && <DemoFake/>}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="relative z-10 px-4 py-6 md:py-10">
        <div className="mx-auto max-w-6xl">
          <h3 className="mb-4 text-center text-2xl font-semibold text-white md:text-3xl">
            Drei Schichten Schutz. Ein Ziel: echte Privatsphäre.
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { n: "01", t: "Filtern", d: "Block‑ & Redirect‑Regeln stoppen Tracker an der Quelle." },
              { n: "02", t: "Isolieren", d: "Tracking‑Speicher getrennt von deiner Session halten." },
              { n: "03", t: "Täuschen", d: "Unvermeidbare Abfragen mit harmlosen Platzhalterdaten beantworten." },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-5"
              >
                <div className="text-sm text-white/60">{s.n}</div>
                <div className="mt-1 text-lg font-semibold text-white">{s.t}</div>
                <p className="mt-1 text-sm text-white/80">{s.d}</p>
                <div className="pointer-events-none absolute -left-10 -bottom-12 h-32 w-32 rounded-full bg-pink-400/10 blur-2xl" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 px-4 py-6 md:py-12">
        <div className="mx-auto max-w-5xl">
          <h3 className="mb-4 text-center text-2xl font-semibold text-white md:text-3xl">Häufige Fragen</h3>
          <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.06]">
            {[
              {
                q: "Brauche ich dann Cookie‑Banner überhaupt noch?",
                a: "Du siehst sie weiterhin – rechtlich erforderlich. Aber du kannst beruhigt zustimmen: Protecto blockt/isoliert Tracker trotzdem.",
              },
              {
                q: "Macht Protecto Seiten kaputt?",
                a: "Standardmäßig sehr kompatibel (declarative Regeln). Für Spezialfälle gibt’s Whitelist & sanften Fake‑Modus.",
              },
              {
                q: "Läuft das auch auf Safari/iOS?",
                a: "Ja. Als WebExtension gebündelt in eine Safari App Extension – gleicher Funktionsumfang mit iOS‑Packaging.",
              },
              {
                q: "Was ist mit Performance?",
                a: "Regeln laufen vorrangig deklarativ – das ist extrem schnell. Content‑Shims nur gezielt und leichtgewichtig.",
              },
            ].map((f) => (
              <button
                key={f.q}
                onClick={() => setFaqOpen((p) => (p === f.q ? null : f.q))}
                className="w-full text-left"
              >
                <div className="flex items-start gap-3 p-4">
                  <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-gradient-to-r from-pink-400 to-sky-400" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{f.q}</div>
                    <motion.div
                      initial={false}
                      animate={{ height: faqOpen === f.q ? "auto" : 0, opacity: faqOpen === f.q ? 1 : 0 }}
                      className="overflow-hidden text-sm text-white/80"
                    >
                      <div className="pt-2 pr-2 text-white/80">{f.a}</div>
                    </motion.div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-4 pb-20">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-zinc-900/60 via-zinc-900/40 to-zinc-900/60 p-6 text-center">
          <h3 className="bg-gradient-to-br from-white via-pink-100 to-sky-100 bg-clip-text text-2xl font-bold text-transparent md:text-3xl">
            Bereit für echte Ruhe vor Trackern?
          </h3>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-white/80">
            Teste Protecto als Browser‑Erweiterung. Später auch in der App verfügbar. Frühstarter bekommen priorisierten Zugang.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className={`relative ${glow} inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/20 transition hover:from-pink-400 hover:to-sky-400`}>
              Zugang sichern
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <a href="#how" className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white/90 hover:bg-white/10">Mehr erfahren</a>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- Small UI Pieces ---------- */
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
      <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
      {children}
    </span>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 text-pink-300">
      <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" fill="currentColor" opacity="0.3" />
      <path d="M9.5 12.5l1.8 1.8 3.7-3.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconWaves() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 text-sky-300">
      <path d="M3 12c2.5-2 5.5-2 8 0s5.5 2 8 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 16c2.5-2 5.5-2 8 0s5.5 2 8 0" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".7" />
      <path d="M3 8c2.5-2 5.5-2 8 0s5.5 2 8 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".35" />
    </svg>
  );
}
function IconSpeed() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 text-white/80">
      <path d="M4 13a8 8 0 1116 0" fill="none" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M12 13l5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Demo Cards ---------- */
function DemoBlock() {
  const rows = [
    { h: "tracker.adservice.com", a: "BLOCKED", d: "Werbe‑Beacon" },
    { h: "analytics.example.com", a: "BLOCKED", d: "Seitenanalyse" },
    { h: "cdn.fingerprint.io", a: "BLOCKED", d: "Fingerprint‑Lib" },
    { h: "images.example.com", a: "ALLOWED", d: "CDN (Media)" },
    { h: "api.example.com", a: "ALLOWED", d: "1st‑Party API" },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
      <table className="w-full text-sm">
        <thead className="bg-white/5 text-white/70">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Host</th>
            <th className="px-3 py-2 text-left font-medium">Aktion</th>
            <th className="px-3 py-2 text-left font-medium">Beschreibung</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-white/5">
              <td className="px-3 py-2 text-white/90">{r.h}</td>
              <td className="px-3 py-2">
                <span className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs ${r.a === "BLOCKED" ? "bg-pink-500/15 text-pink-200" : "bg-emerald-500/10 text-emerald-200"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${r.a === "BLOCKED" ? "bg-pink-400" : "bg-emerald-400"}`} />
                  {r.a}
                </span>
              </td>
              <td className="px-3 py-2 text-white/70">{r.d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DemoIsolate() {
  const items = [
    { k: "document.cookie", v: "(nur notwendige Session‑Cookies)" },
    { k: "localStorage", v: "isolation: enabled (tracking scope)" },
    { k: "sessionStorage", v: "isolation: enabled (tracking scope)" },
  ];
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm">
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
            <div>
              <div className="font-mono text-white/90">{it.k}</div>
              <div className="text-white/70">{it.v}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DemoFake() {
  const items = [
    { k: "User‑Agent", v: "Chrome/119.0 (randomized minor)" },
    { k: "Canvas", v: "per‑site noise (subtle)" },
    { k: "Audio", v: "noise seed active" },
    { k: "IP", v: "unchanged (Browser policy)" },
  ];
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm">
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-pink-400" />
            <div>
              <div className="font-mono text-white/90">{it.k}</div>
              <div className="text-white/70">{it.v}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
