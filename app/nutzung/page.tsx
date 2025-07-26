// Datei: app/nutzung/page.tsx

"use client";

import { motion } from "framer-motion";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black text-gray-300 px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="max-w-3xl mx-auto"
      >
        <h1 className="text-4xl font-bold text-white mb-8">Nutzungsbedingungen</h1>

        <p className="mb-6">
          Diese Nutzungsbedingungen regeln die Nutzung der Webseite „Detecto“ sowie aller
          damit verbundenen Funktionen und Inhalte. Mit dem Zugriff auf diese Webseite erklären Sie sich mit den nachfolgenden
          Bedingungen einverstanden. Bitte lesen Sie diese sorgfältig durch.
        </p>

        <h2 className="text-2xl font-semibold text-white mt-10 mb-4">1. Allgemeines</h2>
        <p className="mb-6">
          Detecto ist eine digitale Plattform zur Analyse von Datenschutzinformationen,
          zur Bereitstellung von datenschutzfreundlichen Alternativen und zur Aufklärung
          über den Umgang mit personenbezogenen Daten. Die Nutzung erfolgt auf eigenes Risiko.
        </p>

        <h2 className="text-2xl font-semibold text-white mt-10 mb-4">2. Leistungsbeschreibung</h2>
        <p className="mb-6">
          Detecto stellt Werkzeuge zur Verfügung, die Webseiten auf Datenschutzaspekte hin prüfen, Tools empfehlen und Warnungen ausgeben.
          Die Bewertungen basieren auf öffentlich zugänglichen Informationen und teilweise auf künstlicher Intelligenz.
          Es besteht kein Anspruch auf Vollständigkeit, Richtigkeit oder rechtliche Verbindlichkeit der Inhalte. Die Analysen stellen keine rechtliche Beratung dar.
        </p>
        <p className="mb-6">
          Die Bewertungen und Score-Werte (z. B. Datenschutz-Score in Prozent) werden durch ein KI-Modell (GPT von OpenAI) generiert. Dabei werden Transparenz,
          Nutzerkontrolle und der Umgang mit personenbezogenen Daten berücksichtigt. Die Einordnung erfolgt anhand eines internen Bewertungsschemas und
          dient ausschließlich der informativen Orientierung.
        </p>
        <p className="mb-6">
          Die Einschätzungen können leicht variieren – etwa abhängig vom Zeitpunkt der Anfrage oder Formulierungen in den Datenschutzrichtlinien der analysierten Webseite.
          Es handelt sich ausdrücklich nicht um eine rechtsverbindliche Aussage. Nutzer sollten die Datenschutzrichtlinien jeder Seite zusätzlich eigenständig prüfen.
        </p>

        <h2 className="text-2xl font-semibold text-white mt-10 mb-4">3. Nutzungsvoraussetzungen</h2>
        <p className="mb-6">
          Die Nutzung von Detecto setzt voraus, dass Sie volljährig und geschäftsfähig sind. Mit der Nutzung erkennen Sie an,
          dass die Plattform keinen Ersatz für juristischen Rat bietet. Für Pro-Features oder bestimmte Funktionen kann ein Benutzerkonto erforderlich sein.
        </p>

        <h2 className="text-2xl font-semibold text-white mt-10 mb-4">4. Nutzerverhalten</h2>
        <p className="mb-6">
          Sie verpflichten sich, keine rechtswidrigen, diskriminierenden, beleidigenden oder sicherheitsgefährdenden Inhalte über die Plattform zu verbreiten.
          Jeglicher Missbrauch – etwa durch automatisierte Abfragen, Hacking-Versuche oder Fälschung von Identitäten – ist untersagt.
          Der Betreiber behält sich das Recht vor, Nutzer bei Verstößen dauerhaft auszuschließen.
        </p>

        <h2 className="text-2xl font-semibold text-white mt-10 mb-4">5. Geistiges Eigentum</h2>
        <p className="mb-6">
          Alle Inhalte, Logos, Texte, Grafiken und Programmfunktionen unterliegen dem Urheberrecht bzw. sonstigen gewerblichen Schutzrechten.
          Jede unerlaubte Nutzung, Vervielfältigung, Weitergabe oder Verwertung bedarf der schriftlichen Genehmigung durch den Betreiber.
        </p>

        <h2 className="text-2xl font-semibold text-white mt-10 mb-4">6. Haftungsausschluss</h2>
        <p className="mb-6">
          Detecto übernimmt keine Haftung für die inhaltliche Richtigkeit, Vollständigkeit oder Aktualität der bereitgestellten Informationen.
          Die Nutzung erfolgt auf eigene Verantwortung. Für Schäden materieller oder immaterieller Art, die aus der Nutzung entstehen,
          wird keine Haftung übernommen, es sei denn, sie beruhen auf Vorsatz oder grober Fahrlässigkeit.
        </p>

        <h2 className="text-2xl font-semibold text-white mt-10 mb-4">7. Verfügbarkeit</h2>
        <p className="mb-6">
          Detecto bemüht sich um eine möglichst unterbrechungsfreie Verfügbarkeit. Es kann jedoch keine Garantie für Ausfallsicherheit,
          Datenverlust oder Systemstörungen übernommen werden. Wartungsarbeiten oder technische Probleme können den Zugriff zeitweise einschränken.
        </p>

        <h2 className="text-2xl font-semibold text-white mt-10 mb-4">8. Datenschutz</h2>
        <p className="mb-6">
          Der Schutz Ihrer Daten hat für uns oberste Priorität. Alle Informationen zum Umgang mit personenbezogenen Daten finden Sie in unserer
          <a href="/datenschutz" className="text-blue-400 hover:underline ml-1">Datenschutzerklärung</a>.
        </p>

        <h2 className="text-2xl font-semibold text-white mt-10 mb-4">9. Änderungen der Bedingungen</h2>
        <p className="mb-6">
          Wir behalten uns das Recht vor, diese Nutzungsbedingungen jederzeit zu ändern. Maßgeblich ist die jeweils bei Nutzung gültige Fassung.
          Über wesentliche Änderungen werden registrierte Nutzer rechtzeitig informiert.
        </p>

        <h2 className="text-2xl font-semibold text-white mt-10 mb-4">10. Anwendbares Recht</h2>
        <p className="mb-6">
          Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist, soweit gesetzlich zulässig, Saarlouis.
        </p>

        <h2 className="text-2xl font-semibold text-white mt-10 mb-4">11. Kontakt</h2>
        <p className="mb-6">
          Bei Fragen zu diesen Nutzungsbedingungen oder zur Nutzung der Plattform wenden Sie sich bitte an:
        </p>
        <p className="mb-6">
          Detecto<br />
          Fynn - Luca Schulz<br />
          Heiligenbornstr. 7<br />
          66359 Bous<br />
          E-Mail: support@detecto.app
        </p>
      </motion.div>
    </main>
  );
}