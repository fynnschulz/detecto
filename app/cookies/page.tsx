

export default function CookiePage() {
  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-6 text-center">Cookie-Richtlinie</h1>

        <p className="mb-6">
          Diese Cookie-Richtlinie erklärt, was Cookies sind und wie wir sie auf unserer Website verwenden. Bitte
          lese diese Richtlinie sorgfältig, um zu verstehen, welche Arten von Cookies wir verwenden, welche Informationen
          wir mithilfe von Cookies sammeln und wie diese Informationen verwendet werden.
        </p>

        <h2 className="text-2xl font-semibold mt-10 mb-4">1. Was sind Cookies?</h2>
        <p className="mb-6">
          Cookies sind kleine Textdateien, die auf deinem Gerät gespeichert werden, wenn du unsere Website besuchst.
          Sie dienen dazu, bestimmte Informationen über dich oder dein Gerät zu speichern, um dir ein besseres
          Nutzungserlebnis zu bieten.
        </p>

        <h2 className="text-2xl font-semibold mt-10 mb-4">2. Arten von Cookies</h2>
        <p className="mb-4">Wir verwenden die folgenden Arten von Cookies auf unserer Website:</p>
        <ul className="list-disc list-inside mb-6 ml-4">
          <li><strong>Notwendige Cookies:</strong> Diese Cookies sind für den Betrieb unserer Website unerlässlich. Sie ermöglichen grundlegende Funktionen wie die Seitennavigation und den Zugang zu sicheren Bereichen.</li>
          <li><strong>Funktionale Cookies:</strong> Diese Cookies ermöglichen es uns, Einstellungen zu speichern, z. B. deine Sprache oder Region, um dir ein personalisiertes Erlebnis zu bieten.</li>
          <li><strong>Performance- und Analyse-Cookies:</strong> Diese Cookies helfen uns zu verstehen, wie Besucher mit der Website interagieren, indem sie Informationen anonym sammeln und melden.</li>
          <li><strong>Cookies von Drittanbietern:</strong> Diese werden von externen Diensten gesetzt, z. B. beim Login über Google oder Apple. Dabei können Informationen wie deine IP-Adresse oder dein Login-Zeitpunkt übermittelt werden.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-10 mb-4">3. Warum verwenden wir Cookies?</h2>
        <p className="mb-6">
          Wir verwenden Cookies, um:
        </p>
        <ul className="list-disc list-inside mb-6 ml-4">
          <li>die Funktionsfähigkeit unserer Website sicherzustellen,</li>
          <li>deine Anmeldung zu verwalten,</li>
          <li>deine Präferenzen zu speichern,</li>
          <li>die Leistung unserer Website zu analysieren und zu verbessern.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-10 mb-4">4. Einwilligung zur Cookie-Nutzung</h2>
        <p className="mb-6">
          Beim ersten Besuch unserer Website wirst du durch ein Cookie-Banner um deine Einwilligung zur Nutzung bestimmter Cookies gebeten.
          Du kannst deine Einwilligung jederzeit über die Cookie-Einstellungen am unteren Rand der Seite widerrufen oder ändern.
        </p>

        <h2 className="text-2xl font-semibold mt-10 mb-4">5. Verwaltung und Deaktivierung von Cookies</h2>
        <p className="mb-6">
          Du kannst Cookies jederzeit über die Einstellungen deines Browsers deaktivieren oder löschen. Beachte jedoch, dass
          bestimmte Funktionen unserer Website dadurch möglicherweise nicht mehr ordnungsgemäß funktionieren.
        </p>

        <h2 className="text-2xl font-semibold mt-10 mb-4">6. Änderungen dieser Cookie-Richtlinie</h2>
        <p className="mb-6">
          Wir behalten uns das Recht vor, diese Cookie-Richtlinie jederzeit zu ändern. Alle Änderungen werden auf dieser Seite veröffentlicht.
          Bitte überprüfe sie regelmäßig, um auf dem neuesten Stand zu bleiben.
        </p>

        <h2 className="text-2xl font-semibold mt-10 mb-4">7. Kontakt</h2>
        <p className="mb-6">
          Wenn du Fragen zu dieser Cookie-Richtlinie hast, kontaktiere uns bitte unter: <br />
          <a href="mailto:support@detecto.app" className="text-blue-400 underline">support@detecto.app</a>
        </p>

        <p className="text-sm text-gray-400 mt-8 text-right">Stand: August 2025</p>
      </div>
    </div>
  );
}