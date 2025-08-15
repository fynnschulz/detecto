"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";

// Optional: type for alternative sites
type AltSite = { name: string; url: string; description?: string };

export default function WebsiteScanPage() {
  const [inputUrl, setInputUrl] = useState<string>("https://");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [score, setScore] = useState<number | null>(null);
  const [showScale, setShowScale] = useState<boolean>(false);
  const [judgementText, setJudgementText] = useState<string>("");
  const [showJudgement, setShowJudgement] = useState<boolean>(false);

  const [showAlternatives, setShowAlternatives] = useState<boolean>(false);
  const [loadingAlternatives, setLoadingAlternatives] = useState<boolean>(false);
  const [alternativeSites, setAlternativeSites] = useState<AltSite[]>([]);

  // Info panel state
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [infoExpanded, setInfoExpanded] = useState<boolean>(false);

  // Dynamische Hintergrundfarbe je nach Score (rot/orange/grün)
  const glowRGBA = (() => {
    if (score === null) return "rgba(56,189,248,0.14)"; // cyan, dezent vor Scan
    if (score < 40) return "rgba(239,68,68,0.22)";     // rot
    if (score < 65) return "rgba(245,158,11,0.18)";    // orange
    return "rgba(34,197,94,0.18)";                      // grün
  })();

  const handleScan = async () => {
    try {
      setIsLoading(true);
      setShowScale(false);
      setShowJudgement(false);
      setShowAlternatives(false);
      setAlternativeSites([]);
      setJudgementText("");

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl }),
      });

      if (!res.ok) {
        const msg = await res.text();
        setScore(null);
        setJudgementText(msg || "Scan fehlgeschlagen. Bitte versuche es erneut.");
        return;
      }

      const data = await res.json();

      // Score robust aus unterschiedlichen möglichen Feldern lesen
      const nextScore =
        typeof data?.score === "number"
          ? data.score
          : typeof data?.privacyScore === "number"
          ? data.privacyScore
          : null;

      // Urteil aus mehreren möglichen Feldern zusammenbauen
      const fromArray = (arr?: unknown) =>
        Array.isArray(arr)
          ? arr
              .filter((x) => typeof x === "string" && x.trim().length > 0)
              .join(" • ")
          : "";

      const verdictRaw =
        data?.judgementText ??
        data?.judgement ??
        data?.verdict ??
        data?.analysis ??
        data?.explanation ??
        fromArray(data?.reasons);

      setScore(nextScore);
      setJudgementText(
        typeof verdictRaw === "string" && verdictRaw.trim().length > 0
          ? verdictRaw
          : ""
      );
      setShowScale(true);
    } catch (err) {
      setScore(null);
      setJudgementText("Scan fehlgeschlagen. Bitte überprüfe die URL und versuche es erneut.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAlternatives = async () => {
    try {
      setLoadingAlternatives(true);

      const tryFetch = async (path: string, body: any) => {
        try {
          const r = await fetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!r.ok) return null;
          const d = await r.json();
          // Tolerant verschiedene Feldnamen abbilden
          const arr = Array.isArray(d?.alternatives)
            ? d.alternatives
            : Array.isArray(d?.results)
            ? d.results
            : null;
          return Array.isArray(arr) ? arr : null;
        } catch {
          return null;
        }
      };

      // 1) Primär: /api/alternatives
      let list = await tryFetch("/api/alternatives", { url: inputUrl });

      // 2) Falls vorhanden: /api/get-alternatives
      if (!list) {
        list = await tryFetch("/api/get-alternatives", { url: inputUrl });
      }

      // 3) Fallback: /api/smart-search mit Hostname-basierter Query
      if (!list) {
        const hostname = (() => {
          try {
            return new URL(inputUrl).hostname;
          } catch {
            return inputUrl;
          }
        })();
        list = await tryFetch("/api/smart-search", {
          query: `alternativen zu ${hostname}`,
        });
      }

      const normalized = (list || []).map((x: any) => ({
        name: x?.name ?? x?.title ?? x?.domain ?? x?.url ?? "Unbenannt",
        url: x?.url ?? x?.link ?? "#",
        description: x?.description ?? x?.summary ?? "",
      }));

      setAlternativeSites(normalized);
      setShowAlternatives(true);
    } finally {
      setLoadingAlternatives(false);
    }
  };

  return (
    <main className="relative min-h-[100svh] w-full overflow-hidden pt-[88px]">
      {/* Hintergrund wie Hero mit Score-Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(75%_60%_at_50%_0%,rgba(59,130,246,0.25),rgba(0,0,0,0)_60%)]"></div>
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(60% 45% at 50% 40%, ${glowRGBA}, rgba(0,0,0,0) 70%)`,
            transition: "background 500ms ease",
          }}
        />
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
            Website-Scan
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9 }}
            className="mt-3 text-base md:text-lg text-gray-300 text-center max-w-2xl"
          >
            URL eingeben, Scan starten – Detecto bewertet Datenschutz & Risiken und erklärt die Gründe.
          </motion.p>

          {/* === Original Scan-Tool Block (zentriert, UI unverändert) === */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.4 }}
            className="mt-8 z-10 w-full max-w-xl"
          >
            <div className="relative w-full">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 select-none pointer-events-none">
                https://
              </span>
              <input
                type="text"
                value={inputUrl.replace(/^https?:\/\//, "")}
                onChange={(e) =>
                  setInputUrl("https://" + e.target.value.replace(/^https?:\/\//, ""))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleScan();
                }}
                placeholder="Gib eine URL ein..."
                className="pl-[80px] pr-4 py-2 w-full rounded-full bg-zinc-800 text-white text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition hover:ring-2 hover:ring-cyan-400 hover:ring-offset-0"
              />
            </div>

            {/* Fehlermeldung für Scan-Fehlschlag */}
            {judgementText && score === null && (
              <div className="mt-6 px-5 py-3 bg-red-500/10 border border-red-400/30 text-red-200 rounded-xl text-sm backdrop-blur-md shadow-md transition-all duration-300">
                {judgementText}
              </div>
            )}

            {/* Button zentriert darunter */}
            {isLoading ? (
              <div className="mt-4 flex justify-center">
                <svg
                  className="animate-spin h-8 w-8 text-blue-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
              </div>
            ) : (
              <div className="flex justify-center">
                <button
                  onClick={handleScan}
                  className="mt-4 px-8 py-3 text-white font-semibold rounded-full text-lg relative overflow-hidden group shadow-xl hover:shadow-[0_0_20px_rgba(0,255,255,0.3)] transition-all duration-500 ease-in-out hover:scale-105"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 blur-md opacity-20 group-hover:opacity-30 transition-all duration-700 animate-pulse"></span>
                  <span className="relative z-10">Scan starten</span>
                </button>
              </div>
            )}

            {score !== null && (
              <div className="text-4xl font-semibold text-white text-center mt-4">
                Datenschutz-Score: {score}%
              </div>
            )}

            {showScale && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1 }}
                className="mt-10 w-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 p-6 rounded-2xl shadow-[0_0_25px_rgba(0,255,100,0.15)] transition-all duration-700"
              >
                <h3 className="text-2xl font-bold mb-4 text-center text-white">
                  Datenschutz-Risiko-Skala
                </h3>

                <div className="relative w-full h-6 rounded-full overflow-hidden">
                  <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-red-500 via-orange-400 to-green-500"></div>
                  <div className="absolute top-0 -translate-x-1/2 h-full w-[4px] bg-white shadow-lg z-10" style={{ left: `${score}%` }}></div>
                </div>

                <div className="flex justify-between text-sm text-gray-400 mt-2 px-1">
                  <span>Kritisch</span>
                  <span>Sehr sicher</span>
                </div>

                <div className="text-center mt-4">
                  <button
                    className="text-sm text-gray-400 underline hover:text-gray-200 transition"
                    onClick={() => setShowJudgement((prev) => !prev)}
                  >
                    {showJudgement ? "Einklappen" : "Urteil einsehen…"}
                  </button>
                </div>

                {score !== null && score < 65 && (
                  <>
                    <div className="text-center mt-4">
                      <button
                        className="text-sm text-gray-400 underline hover:text-gray-200 transition flex items-center gap-2"
                        onClick={() => {
                          if (showAlternatives) {
                            setShowAlternatives(false);
                          } else {
                            fetchAlternatives();
                          }
                        }}
                      >
                        {loadingAlternatives && !showAlternatives && (
                          <svg
                            className="animate-spin h-4 w-4 text-gray-400"
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
                        )}
                        {showAlternatives ? "Einklappen" : "Alternativen anzeigen…"}
                      </button>
                    </div>

                    {showAlternatives && (
                      <div className="mt-6 space-y-4 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 p-6 rounded-2xl shadow-[0_0_25px_rgba(0,255,100,0.15)] transition-all duration-700">
                        <h4 className="text-white font-semibold text-lg mb-4">Sicherere Alternativen:</h4>
                        {loadingAlternatives ? (
                          <p className="text-gray-400">Lade Alternativen...</p>
                        ) : alternativeSites.length === 0 ? (
                          <p className="text-gray-400">Keine Alternativen gefunden.</p>
                        ) : (
                          alternativeSites.map((site, index) => (
                            <div key={index} className="bg-black/30 p-4 rounded-xl border border-zinc-700 hover:border-green-400 transition duration-300 shadow-lg hover:shadow-green-500/20">
                              <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline font-semibold text-base">
                                {site.name}
                              </a>
                              <p className="text-gray-400 text-sm mt-1">{site.description}</p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}

                {showJudgement && (
                  <div className="mt-4 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black p-6 rounded-2xl text-left text-sm text-gray-300 shadow-[0_0_20px_rgba(0,255,255,0.1)] transition-all duration-700">
                    {judgementText
                      ? judgementText
                          .split("•")
                          .map((point: string) => point.trim())
                          .filter((point: string) => point.length > 0)
                          .map((point: string, index: number) => (
                            <div key={index} className="mb-2 flex items-start">
                              <span className="text-cyan-400 mr-2">•</span>
                              <span>{point}</span>
                            </div>
                          ))
                      : "Keine detaillierte Begründung verfügbar."}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>
      {/* Info Panel Anchor (bottom-right, relative to +) */}
      <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50">
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
            className={`absolute bottom-full right-0 mb-3 w-[86vw] max-w-md p-5 rounded-2xl border border-zinc-700/60 bg-zinc-900/80 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.45)] text-gray-200 transition-[max-height] duration-300 ease-out ${
              infoExpanded ? 'max-h-[70vh]' : 'max-h-44'
            } relative`}
          >
            <div
              className={`overflow-y-auto overscroll-contain pr-1 ${infoExpanded ? 'max-h-[60vh]' : 'max-h-28'}`}
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <h3 className="text-white font-semibold text-lg mb-2">Was macht der Website‑Scan?</h3>
              {!infoExpanded ? (
                <>
                  <p className="text-sm leading-relaxed text-gray-300">
                    Der Scan bewertet eine URL anhand technischer und textlicher Signale (Tracker, Third‑Parties, Policy‑Qualität) und liefert einen kompakten Score mit Kurzurteil.
                  </p>
                  <button
                    onClick={() => setInfoExpanded(true)}
                    className="mt-3 text-sm underline text-gray-300 hover:text-white"
                  >
                    Mehr lesen
                  </button>
                </>
              ) : (
                <div className="space-y-4 text-sm md:text-base leading-relaxed text-gray-300 pr-1">
                  <p>
                    Der Website‑Scan verarbeitet die eingegebene URL in einer mehrstufigen Pipeline: (1) Normalisierung &amp; DNS/SSL‑Check, (2) Abruf der Seite über einen Headless‑Client, (3) statische Analyse von HTML/CSS/JS (Tracker‑Signaturen, Third‑Party‑Requests, potentielle Fingerprinting‑Patterns), (4) Extraktion relevanter Texte wie Datenschutzerklärung, Cookie‑Banner und Einwilligungsdialoge, (5) policy‑aware NLP‑Analyse zur Erkennung von Datenflüssen, Rechtsgrundlagen, Speicherfristen und Weitergaben.
                  </p>
                  <p>
                    Aus diesen Signalen wird ein <strong>Score</strong> berechnet. Jedes Merkmal erhält ein Gewicht (z. B. Anzahl Third‑Parties, Klarheit der Rechtsgrundlage, Opt‑out‑Möglichkeiten, Transportverschlüsselung, Telemetrie/Tracking). Der Score wird in eine 0–100‑Skala gemappt; Schwellen (&lt;40 kritisch, 40–64 erhöht, ≥65 solide) steuern Marker‑ und Hintergrund‑Feedback.
                  </p>
                  <p>
                    Das <strong>Kurzurteil</strong> fasst die wichtigsten Befunde zusammen (z. B. „viele Drittanbieter‑Tracker“, „unklare Rechtsgrundlage“, „fehlende Granularität der Einwilligung“). Liegt der Score unter dem Grenzwert, können <strong>Alternativen</strong> vorgeschlagen werden. Diese werden kontextuell ermittelt (thematisch ähnliche Seiten) und priorisieren Anbieter mit weniger Third‑Party‑Abhängigkeiten, klaren Policies und guter Transport‑/At‑Rest‑Verschlüsselung.
                  </p>
                  <p>
                    Datenschutz‑Prinzipien: <strong>Datensparsamkeit</strong> (nur die zur Bewertung nötigen Artefakte), <strong>Transparenz</strong> (begründete Erläuterungen), <strong>Reproduzierbarkeit</strong> (deterministische Regeln + Modelle) und <strong>Sicherheit</strong> (scoped Fetch, isolierte Umgebung, keine Speicherung personenbezogener Inhalte ohne Einwilligung).
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        <button
          aria-label={showInfo ? 'Info schließen' : 'Info öffnen'}
          onClick={() => {
            if (showInfo) {
              setInfoExpanded(false);
              setShowInfo(false);
            } else {
              setShowInfo(true);
            }
          }}
          className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-zinc-900/80 backdrop-blur border border-zinc-700/60 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center justify-center hover:scale-105 transition-transform duration-200"
        >
          <span className="relative text-white text-3xl leading-none select-none">{showInfo ? '×' : '+'}</span>
        </button>
      </div>
    </main>
  );
}
