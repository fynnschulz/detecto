"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";

type SearchResult = { name: string; url: string; description: string };

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

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
        <div className="w-full max-w-3xl flex flex-col items-center">
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
              onChange={(e) => setSearchQuery(e.target.value)}
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
              {searchQuery.length > 0 && searchResults.length === 0 && !isLoading && (
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

      {/* Floating Plus Button (unten rechts, wie Website-Scan) */}
      <button
        aria-label={showInfo ? "Info schließen" : "Info öffnen"}
        onClick={() => {
          if (showInfo && infoExpanded) {
            setInfoExpanded(false);
            setTimeout(() => setShowInfo(false), 120);
          } else if (showInfo) {
            setShowInfo(false);
          } else {
            setShowInfo(true);
          }
        }}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 h-14 w-14 md:h-16 md:w-16 rounded-full bg-zinc-900/80 backdrop-blur border border-zinc-700/60 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center justify-center hover:scale-105 transition-transform duration-200"
      >
        <span className="relative text-white text-3xl leading-none select-none">{showInfo ? "×" : "+"}</span>
      </button>
      {/* Compact Info Panel */}
      {showInfo && !infoExpanded && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.25 }}
          className="fixed right-6 md:right-8 top-1/2 -translate-y-1/2 z-50 w-[86vw] max-w-md p-5 rounded-2xl border border-zinc-700/60 bg-zinc-900/80 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.45)] text-gray-200 max-h-[70vh] overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <h3 className="text-lg font-semibold mb-2 text-white">Über die Suchmaschine</h3>
          <p className="text-sm leading-relaxed text-gray-300">
            Unsere KI-gestützte Suche findet datenschutzfreundliche Webseiten nach Thema, Kategorie oder Zweck – kuratiert und bewertet durch Detecto.
          </p>
          <button
            onClick={() => setInfoExpanded(true)}
            className="mt-3 text-sm underline text-gray-300 hover:text-white"
          >
            Mehr lesen
          </button>
        </motion.div>
      )}
      {/* Expanded Info Modal */}
      {showInfo && infoExpanded && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative bg-zinc-900/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl max-w-2xl w-full mx-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7),0_0_40px_rgba(34,211,238,0.08)] border border-zinc-700/60 max-h-[80vh] overflow-y-auto overscroll-contain text-gray-200"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <h3 className="text-2xl font-bold mb-4 text-white">Wie die Detecto-Suchmaschine funktioniert</h3>
            <div className="mt-3 space-y-4 text-sm md:text-base leading-relaxed text-gray-300">
              <p>
                Die Detecto-Suchmaschine nutzt eine mehrstufige Pipeline: (1) Verarbeitung der Suchanfrage mit linguistischer Analyse, (2) KI-gestützte Abfrage relevanter, thematisch passender Quellen, (3) Filterung nach Datenschutzkriterien (Tracker, Third-Parties, Policy-Qualität), (4) Bewertung der Kandidaten nach denselben strengen Maßstäben wie beim Website-Scan.
              </p>
              <p>
                Ergebnisse werden als kuratierte Liste ausgegeben, wobei jede Seite ein sicheres Profil aufweist. Die Sortierung priorisiert Anbieter mit klaren Datenschutzerklärungen, geringen Third-Party-Abhängigkeiten, SSL/TLS-Verschlüsselung und transparenter Datenverarbeitung.
              </p>
              <p>
                Die Suchmaschine ist darauf optimiert, schnell und praxisnah umsetzbare, sichere Alternativen zu gängigen Angeboten zu finden – egal ob für E-Commerce, Kommunikation oder Informationssuche.
              </p>
              <p>
                Datenschutzprinzipien: <strong>Datensparsamkeit</strong> (nur notwendige Anfrage- und Bewertungsdaten), <strong>Transparenz</strong> (Begründung der Platzierung), <strong>Reproduzierbarkeit</strong> (deterministische Bewertungslogik) und <strong>Sicherheit</strong> (isolierte Verarbeitung, keine unnötige Speicherung).
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}