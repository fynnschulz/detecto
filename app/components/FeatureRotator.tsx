// Datei: app/components/FeatureRotator.tsx

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const features = [
  "🔍 Echtzeit-Scan von Websites – finde Datenschutzrisiken mit nur einem Klick.",
  "🛡️ Sofortige Bewertung – erkenne auf einen Blick, wie riskant eine Seite ist.",
  "👁️‍🗨️ Live-Schutz beim Surfen – automatische Warnung vor gefährlichen Seiten.",
  "🔒 Integrierter VPN-Modus – verschlüsselte Verbindung für anonymes Surfen.",
  "🧠 KI-gestützte Datenschutzanalyse – verständlich & effizient.",
  "👥 Community-Bewertungen – erfahre, was andere über Webseiten sagen.",
  "📌 Empfehlungen & sichere Alternativen – direkt nach dem Scan.",
  "⚙️ Individuelle Einstellungen – passe deinen Schutz selbst an.",
  "🚀 Browserbasierte Nutzung – keine Installation notwendig.",
  "📱 Mobile-optimiert – sicher auch unterwegs.",
];

export default function FeatureRotator() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-center mt-4 h-10 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.p
          key={features[index]}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5 }}
          className="text-gray-300 text-sm md:text-base"
        >
          {features[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}