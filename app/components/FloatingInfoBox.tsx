// Datei: components/FloatingInfoBox.tsx

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AiOutlinePlus } from "react-icons/ai";

export default function FloatingInfoBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const shortText =
    "Datenmissbrauch ist heute massiver als je zuvor – viele Unternehmen sammeln, speichern und verkaufen persönliche Informationen, oft ohne Transparenz oder wirksame Kontrolle...";

  const fullText = `Im digitalen Zeitalter ist Datenmissbrauch zu einer fast alltäglichen Realität geworden. Große Tech‑Konzerne, Datensammler und Werbenetzwerke tracking unsere Online-Aktivitäten – oft ohne, dass wir es merken. Studien zeigen, dass 62 % der Amerikaner es unmöglich finden, durchs Leben zu gehen, ohne von Unternehmen getrackt zu werden (termly.io, pewresearch.org).

Cambridge‑Analytica etwa sammelte zwischen 30–87 Millionen Facebook-Profile, um Wähler gezielt zu beeinflussen – inklusive psychologischer Profilierung. Das zeigt dramatisch, wie Daten verwendet werden können: nicht nur für Werbung, sondern für politische Meinungsbildung.

Auch moderne Apps – z. B. period‑Tracker oder Social Media – verlangen häufig Zugriff auf Standort, Kontakte, Mikrofon und mehr, und das nicht nur zu harmlosen Zwecken. Solche Daten werden oft an Drittparteien verkauft – mit Risiken: Diskriminierung, Preisdifferenzierung, gezielte Beeinflussung.

Das System der Data‑Broker ist kaum reguliert: Firmen wie Acxiom oder LexisNexis handeln mit höchst sensiblen Daten – GPS‑Standorte, politische Einstellungen, Gesundheitsdaten. Selbst Regierungen greifen darauf zu – mitwirkung ohne Wissen der Betroffenen.

Detecto wurde deshalb entwickelt – aus dem dringenden Bedürfnis heraus, Nutzende zu empowern. Es sensibilisiert für Datenrisiken, zeigt Schwachpunkte auf und unterstützt bei informierten Datenschutzentscheidungen.`;

  return (
    <>
      {/* Button bleibt unten rechts fixiert */}
      <motion.div
        className="fixed bottom-6 right-6 z-50 bg-gray-800 text-white rounded-full w-14 h-14 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
      >
        <AiOutlinePlus size={28} />
      </motion.div>

      {/* Info-Fenster erscheint darüber, aber blockiert nichts */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4 }}
            className="fixed bottom-24 right-6 w-96 max-h-[70vh] overflow-y-auto bg-zinc-900 text-gray-300 rounded-2xl shadow-2xl p-6 text-sm z-40"
          >
            <h3 className="text-lg font-semibold mb-2 text-white">Warum Datenschutz wichtig ist</h3>
            <p>{isExpanded ? fullText : shortText}</p>
            {!isExpanded && (
              <button
                onClick={() => setIsExpanded(true)}
                className="mt-4 text-blue-400 hover:underline text-sm"
              >
                Mehr lesen
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}