
 "use client";
import AuthModal from "./components/AuthModal";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import FloatingInfoBox from "./components/FloatingInfoBox";
import FeatureRotator from "./components/FeatureRotator";

export default function Home() {
  const [showMainContent, setShowMainContent] = useState(false);
  const [activeTool, setActiveTool] = useState("scan");
  const [showScale, setShowScale] = useState(false);
  const [inputUrl, setInputUrl] = useState("");
  const [riskLevel, setRiskLevel] = useState("safe");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ name: string; url: string; description: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [showJudgement, setShowJudgement] = useState(false);
  const [judgementText, setJudgementText] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [showGlow, setShowGlow] = useState(false);
  const [renderGlow, setRenderGlow] = useState(false);
  const [alternativeSites, setAlternativeSites] = useState<{ name: string; url: string; description: string }[]>([]);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [activeInfo, setActiveInfo] = useState("Scan");
  const [showLoginModal, setShowLoginModal] = useState(true);

const fetchAlternatives = async () => {
  try {
    setLoadingAlternatives(true);
    setShowAlternatives(true);

    const response = await fetch("/api/get-alternatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: inputUrl }), // inputUrl = gescannte URL
    });

    const data: { alternatives: { name: string; url: string; description: string }[] } = await response.json();
    setAlternativeSites(data.alternatives || []);
  } catch (error) {
    console.error("Fehler beim Abrufen der Alternativen:", error);
  } finally {
    setLoadingAlternatives(false);
  }
};

useEffect(() => {
  if (score !== null) {
    setRenderGlow(true); // Glow wird überhaupt erst eingefügt
    setShowGlow(true);   // Glow wird eingeblendet

    const timer1 = setTimeout(() => setShowGlow(false), 2800); // smooth ausblenden
    const timer2 = setTimeout(() => setRenderGlow(false), 4000); // aus DOM entfernen

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }
}, [score]);

  useEffect(() => {
    const timer = setTimeout(() => setShowMainContent(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const tools: { name: string; id: string }[] = [
    { name: "Scan", id: "scan" },
    { name: "Suchmaschine", id: "search" },
    { name: "Community", id: "community" },
    { name: "VPN", id: "vpn" },
  ];

  const getScaleStyle = () => {
    switch (riskLevel) {
      case "safe":
        return "bg-green-500 w-full";
      case "medium":
        return "bg-orange-400 w-1/2";
      case "unsafe":
        return "bg-red-500 w-1/4";
      default:
        return "w-0";
    }
  };

  const handleScan = async () => {
    if (!inputUrl) return;

    setIsLoading(true);
    setShowScale(false); // Skala erstmal ausblenden bis Response kommt
    setScanCompleted(false);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: inputUrl })
      });

      const data: { result: string; score?: number; judgement?: string } = await response.json();
      setJudgementText(data.judgement || "");
      setScore(typeof data.score === "number" ? data.score : null);

      console.log("Antwort von API:", data);

      const resultText = data.result.toLowerCase();

      if (
        resultText.includes("sehr gut") ||
        resultText.includes("gut") ||
        resultText.includes("grün") ||
        resultText.includes("positiv") ||
        resultText.includes("transparent und fair")
      ) {
        setRiskLevel("safe");
      } else if (
        resultText.includes("durchschnittlich") ||
        resultText.includes("mittelmäßig") ||
        resultText.includes("teilweise") ||
        resultText.includes("okay") ||
        resultText.includes("mäßig") ||
        resultText.includes("gemischt") ||
        resultText.includes("orange")
      ) {
        setRiskLevel("medium");
      } else if (
        resultText.includes("kritisch") ||
        resultText.includes("unsicher") ||
        resultText.includes("problematisch") ||
        resultText.includes("rot") ||
        resultText.includes("nicht zu empfehlen")
      ) {
        setRiskLevel("unsafe");
      } else {
        setRiskLevel("medium"); // fallback
      }

      setShowScale(true);
    } catch (error) {
      console.error("Fehler beim Scan:", error);
    } finally {
      setIsLoading(false);
      setScanCompleted(true);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);

    try {
      const response = await fetch("/api/smart-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery })
      });

      // Prüfe, ob das Backend wirklich "alternatives" liefert, sonst ggf. anpassen!
      const data = await response.json();
      console.log("Empfangene Such-Ergebnisse:", data);
      console.log("Daten für Anzeige:", data.alternatives);
      if (Array.isArray(data.alternatives) && data.alternatives.length > 0) {
        setSearchResults(data.alternatives);
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

  const renderToolContent = () => {
    switch (activeTool) {
      case "scan":
        return (
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
    className="pl-[80px] pr-4 py-2 w-full rounded-full bg-zinc-800 text-white text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
  />
</div>
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
              .map((point, index) => point.trim())
              .filter((point) => point.length > 0)
              .map((point, index) => (
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
        );
      case "search":
        return (
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
              placeholder="..."
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
        );
      case "community":
        return (
          <div className="mt-10 z-10 w-full max-w-xl text-gray-300">
            <p>Hier können Nutzer Bewertungen und Erfahrungen teilen.</p>
          </div>
        );
      case "vpn":
        return (
          <div className="mt-10 z-10 w-full max-w-xl text-gray-300">
            <p>VPN-Funktion – bald verfügbar.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-gradient-to-b from-gray-800 via-[#111] to-black text-white w-full min-h-screen overflow-x-hidden font-sans relative">
      <AnimatePresence>
        {!showMainContent && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="fixed inset-0 flex items-center justify-center z-50 bg-black"
          >
            <Image
              src="/logo-intro.png"
              alt="Detecto Logo"
              width={300}
              height={300}
              className="object-contain"
              priority
            />
          </motion.div>
        )}
      </AnimatePresence>
      {showMainContent && (
        <>
          {showLoginModal && (
            <div className="fixed inset-0 z-[1000] bg-black bg-opacity-60 flex items-center justify-center">
              <div className="relative bg-zinc-900 text-white rounded-2xl shadow-xl p-8 w-[90%] max-w-md border border-zinc-700">
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="absolute top-3 right-3 text-gray-400 hover:text-white transition text-xl"
                >
                  ×
                </button>
                <h2 className="text-2xl font-bold mb-6 text-center">Anmelden bei DETECTO</h2>
                <input
                  type="email"
                  placeholder="E-Mail"
                  className="w-full p-3 mb-4 rounded-md bg-zinc-800 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="password"
                  placeholder="Passwort"
                  className="w-full p-3 mb-4 rounded-md bg-zinc-800 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button className="w-full bg-blue-600 hover:bg-blue-700 transition text-white font-semibold py-2 rounded-md mb-4">
                  Anmelden
                </button>
                <div className="flex items-center justify-center mb-4 text-gray-400">oder</div>
                <div className="flex flex-col space-y-2">
                  <button className="w-full bg-white text-black font-medium py-2 rounded-md hover:bg-gray-100 transition">
                    Mit Google anmelden
                  </button>
                  <button className="w-full bg-white text-black font-medium py-2 rounded-md hover:bg-gray-100 transition">
                    Mit Apple anmelden
                  </button>
                </div>
                <div className="mt-6 text-center text-sm text-gray-400">
                  Noch kein Account?{" "}
                  <a href="/register" className="text-blue-400 hover:underline">
                    Jetzt registrieren
                  </a> 
                </div>
              </div>
            </div>
          )}
          <nav className="fixed top-4 left-4 z-50 bg-zinc-900 bg-opacity-80 rounded-xl p-2 max-w-[90vw] overflow-x-auto">
            <div className="flex space-x-4 whitespace-nowrap">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className={`text-white px-4 py-2 rounded-md hover:bg-zinc-700 transition ${activeTool === tool.id ? "bg-blue-600" : ""}`}
                >
                  {tool.name}
                </button>
              ))}
            </div>
          </nav>

          <main className="space-y-40">
            <section className="relative min-h-screen flex flex-col items-center justify-start px-6 pt-40 text-center overflow-visible group bg-gradient-to-b from-gray-800 via-[#111] to-black">

              {renderGlow && (
                <motion.div
                  className="absolute top-0 left-0 w-full h-32 z-40 pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                  style={{
                    background:
                      score !== null && score < 40
                        ? "linear-gradient(to bottom, rgba(255, 0, 0, 0.4), transparent)"
                        : score !== null && score < 70
                        ? "linear-gradient(to bottom, rgba(255, 165, 0, 0.4), transparent)"
                        : "linear-gradient(to bottom, rgba(0, 255, 0, 0.4), transparent)"
                  }}
                />
              )}
              
              <motion.h1
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1 }}
                className="text-5xl md:text-7xl font-extrabold z-10 group-hover:tracking-wide transition-all duration-500"
              >
                {activeTool === "scan"
                  ? "Datenschutz. Klar. Verständlich."
                  : "Finde Tools, denen du vertrauen kannst."}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2 }}
                className="text-xl md:text-2xl text-gray-300 max-w-2xl mt-6 z-10"
              >
                {activeTool === "scan"
                  ? "Scanne jede Website und entdecke ihre Datenschutzrisiken – mit einem Klick."
                  : "Gib konkrete Stichworte oder Wünsche ein – z. B. „Webseite für günstige Kleidung“ oder „sicherer Passwort-Manager“. Unsere KI schlägt dir passende, datenschutzfreundliche Tools vor."}
              </motion.p>
              {renderToolContent()}
            </section>

            {activeTool === "scan" && (
              <>
               <section className="w-full text-center px-6 mt-20">
                 <motion.div
                   initial={{ opacity: 0, y: 20 }}
                   whileInView={{ opacity: 1, y: 0 }}
                   transition={{ duration: 1 }}
                   viewport={{ once: true }}
                 >
                   <h2 className="text-5xl font-bold text-white mb-2 mt-20">Ein Überblick über DETECTO</h2>
                   <p className="text-lg text-gray-400 max-w-3xl mx-auto">
                     Unsere Mission: Tools zur Verfügung zu stellen, die Datenschutz neu denken – klar, verständlich und für jeden zugänglich.
                   </p>
                 </motion.div>
               </section>

               <section className="min-h-[80vh] mt-[-40px] w-full bg-transparent p-6 shadow-none">
                  <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-24 items-center">
                    <motion.div
                      initial={{ opacity: 0, x: -50 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.8 }}
                      viewport={{ once: true }}
                      className="flex flex-col justify-center h-full"
                      style={{ height: "100%" }}
                    >
                      <div className="flex flex-col justify-center h-full">
                        <h3 className="text-4xl font-bold text-white text-center mb-8">UNSERE TOOLS</h3>
                        <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                          {["Scan", "Suchmaschine", "Community", "VPN"].map((tool) => (
                            <button
                              key={tool}
                              onClick={() => setActiveInfo(tool)}
                              className={`px-4 py-2 rounded-full font-semibold text-sm shadow transition ${
                                activeInfo === tool
                                  ? "bg-blue-800 text-white shadow-lg"
                                  : "bg-zinc-700 text-white hover:bg-blue-700"
                              }`}
                            >
                              {tool}
                            </button>
                          ))}
                        </div>

                        <div className="mt-6 transition-all duration-500 ease-in-out">
                          {activeInfo === "Scan" && (
                            <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-800/90 to-black/90 p-6 rounded-2xl shadow-[0_0_40px_rgba(0,255,255,0.09)] text-white max-w-2xl mx-auto space-y-6 transition-all duration-500 border border-zinc-700 backdrop-blur-md">
                              <h3 className="text-2xl font-bold text-center text-white mb-4">🔍 Scan-Funktion Schritt für Schritt</h3>

                              <div className="flex items-start space-x-4 hover:bg-white/5 hover:shadow-cyan-400/10 p-4 rounded-xl transition-all duration-300 group">
                                <div className="bg-zinc-900/80 border border-blue-700 rounded-full w-12 h-12 flex items-center justify-center text-xl shadow-inner group-hover:shadow-cyan-300/30 transition-all duration-300">🌐</div>
                                <div>
                                  <p className="text-white font-semibold">Schritt 1: URL eingeben</p>
                                  <p className="text-gray-300 text-sm">Tippe oder füge die Webadresse ein, die du scannen möchtest.</p>
                                </div>
                              </div>

                              <div className="flex items-start space-x-4 hover:bg-white/5 hover:shadow-cyan-400/10 p-4 rounded-xl transition-all duration-300 group">
                                <div className="bg-zinc-900/80 border border-blue-700 rounded-full w-12 h-12 flex items-center justify-center text-xl shadow-inner group-hover:shadow-cyan-300/30 transition-all duration-300">⚙️</div>
                                <div>
                                  <p className="text-white font-semibold">Schritt 2: Scan starten</p>
                                  <p className="text-gray-300 text-sm">Unsere KI analysiert die Datenschutzlage in Sekunden.</p>
                                </div>
                              </div>

                              <div className="flex items-start space-x-4 hover:bg-white/5 hover:shadow-cyan-400/10 p-4 rounded-xl transition-all duration-300 group">
                                <div className="bg-zinc-900/80 border border-blue-700 rounded-full w-12 h-12 flex items-center justify-center text-xl shadow-inner group-hover:shadow-cyan-300/30 transition-all duration-300">📊</div>
                                <div>
                                  <p className="text-white font-semibold">Schritt 3: Ergebnis prüfen</p>
                                  <p className="text-gray-300 text-sm">Erhalte einen Datenschutz-Score und detaillierte Einschätzung.</p>
                                </div>
                              </div>

                              <div className="flex items-start space-x-4 hover:bg-white/5 hover:shadow-cyan-400/10 p-4 rounded-xl transition-all duration-300 group">
                                <div className="bg-zinc-900/80 border border-blue-700 rounded-full w-12 h-12 flex items-center justify-center text-xl shadow-inner group-hover:shadow-cyan-300/30 transition-all duration-300">✅</div>
                                <div>
                                  <p className="text-white font-semibold">Schritt 4: Alternativen finden</p>
                                  <p className="text-gray-300 text-sm">Wenn nötig, werden dir sicherere Webseiten vorgeschlagen.</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {activeInfo === "Suchmaschine" && (
                            <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-800/90 to-black/90 p-6 rounded-2xl shadow-[0_0_40px_rgba(0,255,255,0.09)] text-white max-w-2xl mx-auto space-y-6 transition-all duration-500 border border-zinc-700 backdrop-blur-md">
                              <h3 className="text-2xl font-bold text-center text-white mb-4">🔎 Suchmaschine Schritt für Schritt</h3>
                              <div className="flex items-start space-x-4 hover:bg-white/5 hover:shadow-cyan-400/10 p-4 rounded-xl transition-all duration-300 group">
                                <div className="bg-zinc-900/80 border border-blue-700 rounded-full w-12 h-12 flex items-center justify-center text-xl shadow-inner group-hover:shadow-cyan-300/30 transition-all duration-300">💡</div>
                                <div>
                                  <p className="text-white font-semibold">Schritt 1: Wunsch oder Stichwort eingeben</p>
                                  <p className="text-gray-300 text-sm">Beschreibe, was du suchst, z. B. „sicherer Passwort-Manager“.</p>
                                </div>
                              </div>
                              <div className="flex items-start space-x-4 hover:bg-white/5 hover:shadow-cyan-400/10 p-4 rounded-xl transition-all duration-300 group">
                                <div className="bg-zinc-900/80 border border-blue-700 rounded-full w-12 h-12 flex items-center justify-center text-xl shadow-inner group-hover:shadow-cyan-300/30 transition-all duration-300">🔎</div>
                                <div>
                                  <p className="text-white font-semibold">Schritt 2: Suchen</p>
                                  <p className="text-gray-300 text-sm">Klicke auf „Suchen“, um passende Tools zu finden.</p>
                                </div>
                              </div>
                              <div className="flex items-start space-x-4 hover:bg-white/5 hover:shadow-cyan-400/10 p-4 rounded-xl transition-all duration-300 group">
                                <div className="bg-zinc-900/80 border border-blue-700 rounded-full w-12 h-12 flex items-center justify-center text-xl shadow-inner group-hover:shadow-cyan-300/30 transition-all duration-300">🌱</div>
                                <div>
                                  <p className="text-white font-semibold">Schritt 3: Ergebnis auswählen</p>
                                  <p className="text-gray-300 text-sm">Erhalte 1–3 sichere Webseiten mit Erklärung zur Auswahl.</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {activeInfo === "Community" && (
                            <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-800/90 to-black/90 p-6 rounded-2xl shadow-[0_0_40px_rgba(0,255,255,0.09)] text-white max-w-2xl mx-auto space-y-6 transition-all duration-500 border border-zinc-700 backdrop-blur-md">
                              <h3 className="text-2xl font-bold text-center text-white mb-4">👥 Community Schritt für Schritt</h3>
                              <div className="flex items-start space-x-4 hover:bg-white/5 hover:shadow-cyan-400/10 p-4 rounded-xl transition-all duration-300 group">
                                <div className="bg-zinc-900/80 border border-blue-700 rounded-full w-12 h-12 flex items-center justify-center text-xl shadow-inner group-hover:shadow-cyan-300/30 transition-all duration-300">🗣️</div>
                                <div>
                                  <p className="text-white font-semibold">Schritt 1: Bewertungen lesen</p>
                                  <p className="text-gray-300 text-sm">Sieh dir Erfahrungen und Hinweise anderer Nutzer an.</p>
                                </div>
                              </div>
                              <div className="flex items-start space-x-4 hover:bg-white/5 hover:shadow-cyan-400/10 p-4 rounded-xl transition-all duration-300 group">
                                <div className="bg-zinc-900/80 border border-blue-700 rounded-full w-12 h-12 flex items-center justify-center text-xl shadow-inner group-hover:shadow-cyan-300/30 transition-all duration-300">✍️</div>
                                <div>
                                  <p className="text-white font-semibold">Schritt 2: Eigene Meinung teilen</p>
                                  <p className="text-gray-300 text-sm">Bald kannst du selbst Bewertungen und Tipps abgeben.</p>
                                </div>
                              </div>
                              <div className="flex items-start space-x-4 hover:bg-white/5 hover:shadow-cyan-400/10 p-4 rounded-xl transition-all duration-300 group">
                                <div className="bg-zinc-900/80 border border-blue-700 rounded-full w-12 h-12 flex items-center justify-center text-xl shadow-inner group-hover:shadow-cyan-300/30 transition-all duration-300">🔒</div>
                                <div>
                                  <p className="text-white font-semibold">Schritt 3: Datenschutz bleibt gewahrt</p>
                                  <p className="text-gray-300 text-sm">Alle Beiträge sind anonymisiert und sicher gespeichert.</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {activeInfo === "VPN" && (
                            <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-800/90 to-black/90 p-6 rounded-2xl shadow-[0_0_40px_rgba(0,255,255,0.09)] text-white max-w-2xl mx-auto space-y-6 transition-all duration-500 border border-zinc-700 backdrop-blur-md">
                              <h3 className="text-2xl font-bold text-center text-white mb-4">🛡️ VPN Schritt für Schritt</h3>
                              <div className="flex items-start space-x-4 hover:bg-white/5 hover:shadow-cyan-400/10 p-4 rounded-xl transition-all duration-300 group">
                                <div className="bg-zinc-900/80 border border-blue-700 rounded-full w-12 h-12 flex items-center justify-center text-xl shadow-inner group-hover:shadow-cyan-300/30 transition-all duration-300">🔗</div>
                                <div>
                                  <p className="text-white font-semibold">Schritt 1: VPN auswählen</p>
                                  <p className="text-gray-300 text-sm">Wähle einen datenschutzfreundlichen VPN aus (bald verfügbar).</p>
                                </div>
                              </div>
                              <div className="flex items-start space-x-4 hover:bg-white/5 hover:shadow-cyan-400/10 p-4 rounded-xl transition-all duration-300 group">
                                <div className="bg-zinc-900/80 border border-blue-700 rounded-full w-12 h-12 flex items-center justify-center text-xl shadow-inner group-hover:shadow-cyan-300/30 transition-all duration-300">🛡️</div>
                                <div>
                                  <p className="text-white font-semibold">Schritt 2: Verbindung starten</p>
                                  <p className="text-gray-300 text-sm">Stelle eine sichere Verbindung mit nur einem Klick her.</p>
                                </div>
                              </div>
                              <div className="flex items-start space-x-4 hover:bg-white/5 hover:shadow-cyan-400/10 p-4 rounded-xl transition-all duration-300 group">
                                <div className="bg-zinc-900/80 border border-blue-700 rounded-full w-12 h-12 flex items-center justify-center text-xl shadow-inner group-hover:shadow-cyan-300/30 transition-all duration-300">🚀</div>
                                <div>
                                  <p className="text-white font-semibold">Schritt 3: Sicher surfen</p>
                                  <p className="text-gray-300 text-sm">Surfe anonym und geschützt im Internet.</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.8 }}
                      viewport={{ once: true }}
                      className="relative h-96 w-full rounded-3xl overflow-hidden shadow-2xl"
                    >
                      <Image
                        src="/scan-photo.jpg"
                        alt="Foto: Scan-Visualisierung"
                        fill
                        className="object-cover rounded-3xl"
                      />
                    </motion.div>
                  </div>
                </section>

                <section className="relative h-[60vh] bg-gradient-to-b from-gray-800 via-[#111] to-black flex items-center justify-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1 }}
                    viewport={{ once: true }}
                    className="text-center"
                  >
                    <h2 className="text-5xl font-bold">Intelligent. Schnell. Sicher.</h2>
                    <p className="text-gray-400 mt-4 max-w-xl mx-auto">
                      Detecto setzt neue Maßstäbe für transparente und
                      benutzerfreundliche Datenschutzanalysen.
                    </p>

                    <FeatureRotator />
                  </motion.div>
                </section>

                <footer className="text-center text-sm text-gray-600 py-12 space-y-2 bg-black">
                  <div className="flex flex-wrap justify-center space-x-6 text-sm text-gray-400">
                    <Link href="/datenschutz" className="hover:underline">
                      Datenschutz
                    </Link>
                    <Link href="/cookies" className="hover:underline">
                      Cookies
                    </Link>
                    <Link href="/nutzung" className="hover:underline">
                      Nutzungsbedingungen
                    </Link>
                    <Link href="/rechtliches" className="hover:underline">
                      Rechtliches
                    </Link>
                    <Link href="/ueber-uns" className="hover:underline">
                      Über uns
                    </Link>
                    <Link href="/impressum" className="hover:underline">Impressum
                    </Link>
                  </div>
                  <div>© 2025 Detecto – Datenschutz neu gedacht.</div>
                </footer>
              </>
            )}
          </main>
          <FloatingInfoBox />
        </>
      )}
    </div>
  );
}
