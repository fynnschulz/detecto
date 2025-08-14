

"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";

type SearchResult = { name: string; url: string; description: string };

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
    <main className="min-h-[100svh] w-full flex items-start justify-center pt-28 pb-24 px-4">
      <div className="w-full max-w-3xl flex flex-col items-center">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-3xl md:text-5xl font-extrabold text-white text-center"
        >
          Suchmaschine
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2 }}
          className="mt-10 z-10 w-full max-w-xl"
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
            <button
              onClick={handleSearch}
              className="mt-4 px-8 py-3 text-white font-semibold rounded-full text-lg relative overflow-hidden group shadow-xl hover:shadow-[0_0_20px_rgba(0,255,255,0.3)] transition-all duration-500 ease-in-out hover:scale-105"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-green-500 via-green-400 to-green-500 blur-md opacity-20 group-hover:opacity-30 transition-all duration-700 animate-pulse"></span>
              <span className="relative z-10">Suchen</span>
            </button>
          )}

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
    </main>
  );
}