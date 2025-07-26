// Datei: app/rechtliches/page.tsx

"use client";

import { motion } from "framer-motion";

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-black text-gray-300 px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="max-w-3xl mx-auto"
      >
        <h1 className="text-4xl font-bold text-white mb-8">Rechtliche Hinweise</h1>

        <p className="mb-6">
          <strong>Haftung für Inhalte gemäß § 7 Abs. 1 TMG:</strong><br />
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.
          Nach §§ 8 bis 10 TMG sind wir jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder
          nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
        </p>

        <p className="mb-6">
          Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.
          Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich.
          Bei Bekanntwerden entsprechender Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
        </p>

        <p className="mb-6">
          <strong>Haftung für externe Links:</strong><br />
          Unsere Webseite enthält Verlinkungen zu externen Webseiten Dritter, auf deren Inhalte wir keinen Einfluss haben.
          Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter
          oder Betreiber der Seiten verantwortlich. Zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar.
          Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar.
          Bei Bekanntwerden von Rechtsverletzungen werden derartige Links umgehend entfernt.
        </p>

        <p className="mb-6">
          <strong>Urheberrecht:</strong><br />
          Die durch die Seitenbetreiber erstellten Inhalte und Werke auf dieser Website unterliegen dem deutschen Urheberrecht.
          Beiträge Dritter sind als solche gekennzeichnet. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung
          außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
          Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.
        </p>

        <p className="mb-6">
          <strong>Markenrechte:</strong><br />
          Alle innerhalb dieses Internetangebotes genannten und ggf. durch Dritte geschützten Marken- und Warenzeichen unterliegen uneingeschränkt
          den Bestimmungen des jeweils gültigen Kennzeichenrechts und den Besitzrechten der jeweiligen eingetragenen Eigentümer.
          Allein aufgrund der bloßen Nennung ist nicht der Schluss zu ziehen, dass Markenzeichen nicht durch Rechte Dritter geschützt sind.
        </p>

        <p className="mb-6">
          <strong>Rechtswirksamkeit dieses Haftungsausschlusses:</strong><br />
          Dieser Haftungsausschluss ist als Teil des Internetangebotes zu betrachten, von dem aus auf diese Seite verwiesen wurde.
          Sofern Teile oder einzelne Formulierungen dieses Textes der geltenden Rechtslage nicht, nicht mehr oder nicht vollständig entsprechen sollten,
          bleiben die übrigen Teile des Dokuments in ihrem Inhalt und ihrer Gültigkeit davon unberührt.
        </p>

        <p className="mb-6">
          <strong>Anwendbares Recht:</strong><br />
          Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist, soweit gesetzlich zulässig, Saarlouis.
        </p>

        <p className="mb-6">
          <strong>Hinweis zur Nutzung von KI-Analysen:</strong><br />
          Die auf unserer Plattform integrierten Analyse-Tools basieren teilweise auf künstlicher Intelligenz (KI).
          Trotz kontinuierlicher Verbesserung kann es zu fehlerhaften oder unvollständigen Einschätzungen kommen.
          Alle bereitgestellten Auswertungen dienen ausschließlich der Information und ersetzen keine rechtliche Beratung.
          Nutzer sind angehalten, die Ergebnisse eigenverantwortlich zu bewerten und bei Unsicherheit fachkundigen Rat einzuholen.
        </p>
      </motion.div>
    </main>
  );
}