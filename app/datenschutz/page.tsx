export default function Datenschutz() {
  return (
    <main className="min-h-screen bg-black text-gray-200 px-8 py-16 max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold mb-12">Datenschutzerklärung</h1>

      <section className="space-y-8 text-base leading-relaxed">
        <div>
          <h2 className="text-2xl font-semibold">1. Einleitung</h2>
          <p>
            Wir freuen uns über dein Interesse an Detecto. Der Schutz deiner personenbezogenen Daten hat für uns höchste Priorität.
            Detecto ist so konzipiert, dass deine Privatsphäre gewahrt bleibt – ganz ohne Nutzertracking oder Profilbildung.
          </p>
          <p>
            Diese Datenschutzerklärung informiert dich darüber, welche Daten wir erheben, verarbeiten und wie wir sie schützen – gemäß der Datenschutz-Grundverordnung (DSGVO).
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold">2. Verantwortlicher Anbieter</h2>
          <p>
            Detecto<br />
            E-Mail: support@detecto.app<br />
            Verantwortlich im Sinne der DSGVO: Fynn - Luca Schulz / Detecto Heiligenbornstr. 7 66359 Bous
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold">3. Datenverarbeitung bei Nutzung der Website</h2>
          <p>Beim Besuch unserer Website werden automatisch folgende Informationen erfasst (Server-Logfiles):</p>
          <ul className="list-disc list-inside ml-4">
            <li>IP-Adresse (anonymisiert, nicht dauerhaft gespeichert)</li>
            <li>Datum und Uhrzeit des Zugriffs</li>
            <li>Browsertyp und -version</li>
            <li>Betriebssystem</li>
            <li>Referrer-URL (falls vorhanden)</li>
          </ul>
          <p>
            Diese Daten dienen ausschließlich der technischen Bereitstellung und Sicherheit der Website (z. B. zur Erkennung von Angriffen).
            Eine Speicherung über 7 Tage hinaus erfolgt nicht. Eine Zusammenführung mit anderen Daten findet nicht statt.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold">3a. Registrierung und Benutzerkonto</h2>
          <p>
            Wenn du ein Benutzerkonto bei Detecto erstellst, verarbeiten wir die von dir angegebenen personenbezogenen Daten,
            insbesondere:
          </p>
          <ul className="list-disc list-inside ml-4">
            <li>Name</li>
            <li>E-Mail-Adresse</li>
            <li>Passwort (verschlüsselt gespeichert, niemals im Klartext)</li>
            <li>Optional: Adresse, Stadt, Postleitzahl, Land</li>
          </ul>
          <p>
            Diese Daten werden ausschließlich zur Bereitstellung deines Kontos, zur Authentifizierung und zur Nutzung der
            registrierungspflichtigen Funktionen (z. B. Community, VPN, erweiterte Scan-Funktionen) verarbeitet.
            Eine Weitergabe an Dritte erfolgt nicht, außer wenn wir gesetzlich dazu verpflichtet sind.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold">4. Nutzung unserer Tools (Scan, Suche, Empfehlungen)</h2>
          <ul className="list-disc list-inside ml-4">
            <li>Es werden keine personenbezogenen Daten gespeichert.</li>
            <li>Die eingegebenen URLs oder Suchbegriffe werden ausschließlich lokal oder temporär zur Verarbeitung genutzt und nicht dauerhaft gespeichert.</li>
            <li>Es findet keine Profilbildung, kein Tracking und keine Weitergabe an Dritte statt.</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-2">Automatisierte KI-Auswertung von Webseiten</h3>
          <p>
            Zur Bewertung von Webseiten im Rahmen unserer Scan-Funktion verwenden wir ein KI-Sprachmodell der Firma OpenAI (GPT).
            Die Analyse erfolgt auf Grundlage öffentlich zugänglicher Informationen, insbesondere der Datenschutzrichtlinien der jeweiligen Webseite.
          </p>
          <p className="mt-2">
            Die KI erstellt auf dieser Basis eine Einschätzung zu Transparenz, Nutzerkontrolle und Zweckbindung der Datenverarbeitung.
            Dabei wird die jeweilige Branche berücksichtigt – jedoch nicht als pauschale Rechtfertigung für problematische Praktiken.
            Stattdessen werden besonders positive oder negative Abweichungen im Verhältnis zum Branchendurchschnitt in der Bewertung hervorgehoben.
          </p>
          <p className="mt-2">
            Die resultierenden Einschätzungen (z. B. Score, Farbbewertung, Gründe) dienen ausschließlich der informativen Orientierung.
            Die Bewertungen sind nicht rechtsverbindlich, können je nach Anfragezeitpunkt leicht variieren und stellen keine amtliche Prüfung dar.
            Detecto übernimmt keine Haftung für etwaige Fehleinschätzungen. Nutzerinnen und Nutzer werden ausdrücklich dazu aufgefordert,
            die offiziellen Datenschutzrichtlinien der analysierten Webseiten stets selbst zu prüfen.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold">4a. Login mit Drittanbietern (Google, Apple)</h2>
          <p>
            Wir bieten dir die Möglichkeit, dich über Google oder Apple bei Detecto anzumelden. Hierbei werden die zur
            Authentifizierung notwendigen Daten (z. B. E-Mail-Adresse, Name) von dem jeweiligen Anbieter an uns übermittelt.
            Die Anmeldung über Drittanbieter erfolgt nur mit deiner ausdrücklichen Einwilligung und unterliegt den
            Datenschutzbestimmungen des jeweiligen Anbieters:
          </p>
          <ul className="list-disc list-inside ml-4">
            <li><a href="https://policies.google.com/privacy" className="text-blue-400 underline">Google Privacy Policy</a></li>
            <li><a href="https://www.apple.com/legal/privacy/" className="text-blue-400 underline">Apple Privacy Policy</a></li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold">5. Cookies und Analyse-Tools</h2>
          <p>
            Detecto verwendet keine Cookies, außer technisch notwendige (z. B. zur Session-Steuerung in der App).<br />
            Wir setzen keine Tracking- oder Marketing-Tools wie Google Analytics ein.
          </p>
          <p>
            Zusätzlich zu technisch notwendigen Cookies setzen wir Session-Cookies ein, um angemeldete Benutzer während
            ihres Besuchs eingeloggt zu halten. Diese Cookies enthalten keine sensiblen Daten und werden automatisch gelöscht,
            sobald du dich ausloggst oder den Browser schließt.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold">6. Kontaktaufnahme</h2>
          <p>
            Wenn du uns per E-Mail kontaktierst, verarbeiten wir deine übermittelten Angaben (z. B. E-Mail-Adresse, Nachricht) nur zur Bearbeitung deiner Anfrage.
            Diese Daten werden vertraulich behandelt und nicht weitergegeben.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold">7. Deine Rechte gemäß DSGVO</h2>
          <ul className="list-disc list-inside ml-4">
            <li>Auskunft über deine gespeicherten Daten</li>
            <li>Berichtigung falscher Daten</li>
            <li>Löschung deiner Daten („Recht auf Vergessenwerden“)</li>
            <li>Einschränkung der Verarbeitung</li>
            <li>Datenübertragbarkeit</li>
            <li>Widerspruch gegen die Verarbeitung</li>
            <li>Beschwerde bei einer Datenschutzbehörde</li>
          </ul>
          <p>Wenn du eines dieser Rechte wahrnehmen möchtest, schreibe uns an <strong>support@detecto.app</strong>.</p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold">8. Datensicherheit</h2>
          <p>
            Unsere Website nutzt moderne Verschlüsselung (TLS/SSL).<br />
            Die Datenverarbeitung erfolgt nach dem Prinzip der Datensparsamkeit – nur das, was technisch notwendig ist.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold">8a. Speicherdauer und Löschung von Kontodaten</h2>
          <p>
            Deine Kontodaten werden solange gespeichert, wie dein Account aktiv ist. Du kannst dein Konto jederzeit löschen,
            indem du uns unter <strong>support@detecto.app</strong> kontaktierst. Nach Löschung deines Kontos werden deine
            personenbezogenen Daten innerhalb von 30 Tagen vollständig entfernt, sofern keine gesetzlichen Aufbewahrungspflichten bestehen.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold">9. Änderungen der Datenschutzerklärung</h2>
          <p>
            Wir behalten uns vor, diese Datenschutzerklärung anzupassen, um sie an geänderte rechtliche Rahmenbedingungen oder neue Funktionen anzupassen.
            Die jeweils aktuelle Version ist jederzeit unter https://www.detecto.app/datenschutz verfügbar.
          </p>
        </div>

        <p className="text-sm text-gray-500">Stand: August 2025</p>
      </section>
    </main>
  );
}