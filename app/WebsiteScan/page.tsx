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

  const handleScan = async () => {
    try {
      setIsLoading(true);
      setShowScale(false);
      setShowJudgement(false);
      setShowAlternatives(false);
      setAlternativeSites([]);
      setJudgementText("");

      // Call the same API your Hero-Page used
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
      // Expecting: { score: number, judgementText?: string }
      const nextScore = typeof data?.score === "number" ? data.score : null;
      setScore(nextScore);
      setJudgementText(data?.judgementText || "");
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
      const res = await fetch("/api/alternatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl }),
      });
      if (!res.ok) {
        setAlternativeSites([]);
        return setLoadingAlternatives(false);
      }
      const data = await res.json();
      const list: AltSite[] = Array.isArray(data?.alternatives) ? data.alternatives : [];
      setAlternativeSites(list);
      setShowAlternatives(true);
    } finally {
      setLoadingAlternatives(false);
    }
  };

  return (
    <main className="min-h-[100svh] w-full flex items-start justify-center pt-28 pb-24 px-4">
      <div className="w-full max-w-3xl flex flex-col items-center">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-3xl md:text-5xl font-extrabold text-white text-center"
        >
          Website-Scan
        </motion.h1>

        {/* === Original Scan-Tool Block (unverändert) === */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4 }}
          className="mt-10 z-10 w-full max-w-xl"
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

          {isLoading ? (
            <div className="mt-4 flex justify-center">
              <svg
                className="animate-spin h-8 w-8 text-blue-500"
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
            <button
              onClick={handleScan}
              className="mt-4 px-8 py-3 text-white font-semibold rounded-full text-lg relative overflow-hidden group shadow-xl hover:shadow-[0_0_20px_rgba(0,255,255,0.3)] transition-all duration-500 ease-in-out hover:scale-105"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 blur-md opacity-20 group-hover:opacity-30 transition-all duration-700 animate-pulse"></span>
              <span className="relative z-10">Scan starten</span>
            </button>
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
                {/* Farbverlauf-Hintergrund */}
                <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-red-500 via-orange-400 to-green-500"></div>
                {/* Score-Markierung */}
                <div
                  className="absolute top-0 -translate-x-1/2 h-full w-[4px] bg-white shadow-lg z-10"
                  style={{ left: `${score}%` }}
                ></div>
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
                      className="text-sm text-gray-400 underline hover:text-gray-200 transition"
                      onClick={() => {
                        if (showAlternatives) {
                          setShowAlternatives(false);
                        } else {
                          fetchAlternatives();
                        }
                      }}
                    >
                      {showAlternatives ? "Einklappen" : "Alternativen anzeigen…"}
                    </button>
                  </div>

                  {showAlternatives && (
                    <div className="mt-6 space-y-4 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 p-6 rounded-2xl shadow-[0_0_25px_rgba(0,255,100,0.15)] transition-all duration-700">
                      <h4 className="text-white font-semibold text-lg mb-4">
                        Sicherere Alternativen:
                      </h4>
                      {loadingAlternatives ? (
                        <p className="text-gray-400">Lade Alternativen...</p>
                      ) : alternativeSites.length === 0 ? (
                        <p className="text-gray-400">Keine Alternativen gefunden.</p>
                      ) : (
                        alternativeSites.map((site, index) => (
                          <div
                            key={index}
                            className="bg-black/30 p-4 rounded-xl border border-zinc-700 hover:border-green-400 transition duration-300 shadow-lg hover:shadow-green-500/20"
                          >
                            <a
                              href={site.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-400 hover:underline font-semibold text-base"
                            >
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
    </main>
  );
}
