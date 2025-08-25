"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SearchResult = { name: string; url: string; description: string };

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const pathname = usePathname();
  const navItems = [
    { label: "Website-Scan", href: "/WebsiteScan" },
    { label: "Suchmaschine", href: "/search" },
    { label: "Community", href: "/community" },
    { label: "VPN", href: "/vpn" },
  ];

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setHasSearched(false);
      setSearchResults([]);
      return;
    }

    setHasSearched(true);
    setIsLoading(true);

    try {
      const response = await fetch("/api/smart-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery })
      });

      const data = await response.json();
      console.log("Empfangene Such-Ergebnisse:", data);
      console.log("Daten für Anzeige:", data.alternatives);
      if (Array.isArray(data.alternatives) && data.alternatives.length > 0) {
        setSearchResults(data.alternatives as SearchResult[]);
      } else {
        console.warn("Keine gültigen Ergebnisse von der KI erhalten.");
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Fehler bei der KI-Suche:", error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Topbar 1:1 aus app/page.tsx */}
      <nav className="fixed left-0 right-0 top-0 z-50 pt-[max(env(safe-area-inset-top),0px)] md:pt-4 bg-transparent backdrop-blur-0 border-0">
        <div className="px-3 py-2 overflow-x-auto md:overflow-visible whitespace-nowrap md:whitespace-normal [-webkit-overflow-scrolling:touch] [scrollbar-width:none] md:flex md:justify-center" style={{ msOverflowStyle: 'none' }}>
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
                    <span className="absolute inset-0 rounded-full bg-blue-500 opacity-10 blur-md animate-pulse"></span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="relative min-h-[100svh] w-full overflow-hidden pt-[88px]">
      {/* Hintergrund wie bei Website-Scan (Hero-Style) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(75%_60%_at_50%_0%,rgba(59,130,246,0.25),rgba(0,0,0,0)_60%)]"></div>
        <div className="absolute -top-24 -left-24 w-[36rem] h-[36rem] rounded-full bg-cyan-500/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-16 -right-16 w-[28rem] h-[28rem] rounded-full bg-indigo-500/20 blur-3xl animate-pulse" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, black 55%, transparent 75%)",
            maskImage: "radial-gradient(ellipse at 50% 30%, black 55%, transparent 75%)",
          }}
        />
      </div>

      <section className="relative z-10 flex items-center justify-center min-h-[calc(100svh-88px)] px-6">
        <div className="w-full max-w-3xl flex flex-col items-center transform-gpu -translate-y-8 md:-translate-y-12">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-3xl md:text-5xl font-extrabold text-white text-center"
          >
            Suchmaschine
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9 }}
            className="mt-3 text-base md:text-lg text-gray-300 text-center max-w-2xl"
          >
            Finde datenschutzfreundliche Webseiten nach Thema, Kategorie oder Zweck – kuratiert von Detecto.
          </motion.p>

          {/* Eingabe & Button zentral */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2 }}
            className="mt-8 z-10 w-full max-w-xl"
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const v = e.target.value;
                setSearchQuery(v);
                if (v.trim().length === 0) {
                  setHasSearched(false);
                  setSearchResults([]);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="Suche nach sicheren Webseiten, Kategorien oder Zwecken..."
              className="w-full p-4 rounded-full bg-zinc-800 text-white text-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition duration-300 shadow-md hover:shadow-green-500/40"
            />
            {isLoading ? (
              <div className="mt-4 flex justify-center">
                <svg
                  className="animate-spin h-8 w-8 text-green-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  ></path>
                </svg>
              </div>
            ) : (
              <div className="flex justify-center">
                <button
                  onClick={handleSearch}
                  className="mt-4 px-8 py-3 text-white font-semibold rounded-full text-lg relative overflow-hidden group shadow-xl hover:shadow-[0_0_20px_rgba(0,255,255,0.3)] transition-all duration-500 ease-in-out hover:scale-105"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-green-500 via-green-400 to-green-500 blur-md opacity-20 group-hover:opacity-30 transition-all duration-700 animate-pulse"></span>
                  <span className="relative z-10">Suchen</span>
                </button>
              </div>
            )}

            {/* Ergebnisse */}
            <div className="mt-8 space-y-6">
              {hasSearched && !isLoading && searchResults.length === 0 && (
                <p className="text-gray-400 text-center">Keine passenden Webseiten gefunden.</p>
              )}
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  className="bg-black/30 p-4 rounded-xl border border-zinc-700 hover:border-green-400 transition duration-300 shadow-lg hover:shadow-green-500/20"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold text-white">{result.name}</h3>
                    <span className="text-sm bg-green-700 text-white px-3 py-1 rounded-full">SICHER</span>
                  </div>
                  <p className="text-gray-400 text-sm mb-2">{result.description}</p>
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline text-sm"
                  >
                    Website besuchen
                  </a>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Floating Info: Suchmaschine – technischer Überblick */}
      <div className="fixed right-5 bottom-5 z-50">
        {/* Toggle-Symbol */}
        <button
          aria-label={showInfo ? "Infobox schließen" : "Infobox öffnen"}
          onClick={() => {
            if (showInfo) {
              setShowInfo(false);
              setInfoExpanded(false);
            } else {
              setShowInfo(true);
            }
          }}
          className="h-12 w-12 rounded-full bg-zinc-800 text-white shadow-xl border border-zinc-700/70 hover:border-cyan-400/70 hover:scale-105 transition-all duration-300 flex items-center justify-center"
        >
          <span className="text-xl font-bold select-none">i</span>
        </button>
      </div>

      {/* Seiten-Infobox (rechts) */}
      {showInfo && (
        <aside
          className={
            `fixed right-5 bottom-24 z-50 bg-zinc-900/95 backdrop-blur rounded-2xl border border-zinc-700/70 shadow-2xl transition-[width,height,opacity,transform] duration-300 overflow-hidden` +
            (infoExpanded ? " w-[90vw] max-w-[480px] h-[72vh] translate-y-0" : " w-[86vw] max-w-[420px] h-[260px] translate-y-0")
          }
          role="dialog"
          aria-modal="true"
          aria-label="Technische Erklärung der Suchmaschine"
        >
          <div className="flex items-start justify-between gap-4 p-5">
            <h3 className="text-white text-lg md:text-xl font-semibold">Wie die Detecto‑Suchmaschine funktioniert</h3>
          </div>

          <div className="px-5 pb-4 text-sm text-zinc-300 leading-relaxed h-[calc(100%-64px)] overflow-y-auto">
            {/* Kompakte Vorschau */}
            {!infoExpanded && (
              <div className="overflow-visible h-full">
                <p className="mb-6">
                  Unsere KI‑gestützte Suchmaschine führt eine semantische Query‑Analyse, Quellensuche und
                  mehrstufige Risiko‑/Privacy‑Bewertung durch. Ergebnisse werden nach Datenschutz‑Score,
                  Relevanz und Vertrauenssignalen gerankt.
                </p>
                <button
                  onClick={() => setInfoExpanded(true)}
                  className="text-cyan-400 hover:underline font-medium"
                >
                  Mehr lesen…
                </button>
              </div>
            )}

            {/* Ausgeklappte, scrollbare Vollansicht */}
            {infoExpanded && (
              <div className="space-y-4 pr-1">
                <p>
                  Das Suchmaschinen‑Modul von Detecto ist darauf ausgelegt, auf Schlüsselwörter und komplexe natürlichsprachliche Anfragen präzise zu reagieren und ausschließlich hochwertige, datenschutzfreundliche Ergebnisse zu liefern. Dazu wird die Eingabe zunächst semantisch interpretiert, wobei Synonyme, Kontext, Suchabsicht und relevante Entitäten (z. B. Marken, Kategorien, Einsatzwecke, Regionen) erkannt werden. Auf dieser Basis werden geprüfte Quellenkandidaten ermittelt und deren Inhalte automatisiert ausgewertet. Entscheidend ist, dass nicht nur die thematische Passung, sondern vor allem die daten­schutz­bezogene Qualität der jeweiligen Seite bewertet wird: Detecto untersucht Hinweise in Policies und Metadaten, erkennt Muster für Tracking, Profiling und Fingerprinting, berücksichtigt Verschlüsselung und Transport­sicherheit, prüft Drittanbieter‑Abhängigkeiten sowie potenzielle Datenübermittlungen und gewichtet Transparenz‑und Vertrauenssignale. Aus diesen Befunden entsteht ein konsistentes Relevanz‑und Sicherheitsprofil, mit dem die Resultate gerankt und Duplikate bereinigt werden. Die Ausgabe priorisiert somit Seiten, die den inhaltlichen Bedarf bestmöglich erfüllen und dabei ein hohes Schutzniveau für personenbezogene Daten wahren. Hinter den Kulissen sorgen Watchlists, konservative Fallbacks, Zeitlimits und Validierungen dafür, dass unsichere oder irreführende Treffer verworfen werden. Die Kombination aus moderner KI‑Analyse, kuratierter Datenbasis und kontinuierlicher Qualitätskontrolle gewährleistet eine Suche, die gleichermaßen effizient, verlässlich und sicher ist. Da sich das Web dynamisch verändert, versteht sich jedes Ergebnis als aktuelle Momentaufnahme; Detecto aktualisiert Relevanz und Bewertung fortlaufend, um Dir eine belastbare Entscheidungshilfe zu geben.
                </p>
              </div>
            )}
          </div>
        </aside>
      )}
      </main>
    </>
  );
}