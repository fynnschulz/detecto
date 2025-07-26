// app/impressum/page.tsx
export default function ImpressumPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-24">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">Impressum</h1>

        <div className="space-y-4 text-gray-300 text-base leading-relaxed">
          <p><strong>Angaben gemäß § 5 TMG:</strong></p>
          <p>
            Detecto<br />
            Fynn - Luca Schulz<br />
            Heiligenbornstr. 7<br />
            66359 Bous<br />
            Deutschland
          </p>

          <p><strong>Kontakt:</strong></p>
          <p>
            Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV:<br />
            Fynn - Luca Schulz<br />
            Heiligenbornstr. 7<br />
            66359 Bous
          </p>

          <hr className="border-zinc-700 my-6" />

          <p><strong>Haftungsausschluss:</strong><br />
            Alle Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann jedoch keine Gewähr übernommen werden.
            Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für externe Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.
          </p>

          <p><strong>Hinweis zur KI-basierten Analyse:</strong><br />
            Die auf dieser Website angebotenen Funktionen basieren teilweise auf Künstlicher Intelligenz. Trotz hoher Genauigkeit kann es vereinzelt zu fehlerhaften Einschätzungen oder unvollständigen Ausgaben kommen.
            Bitte beachte, dass alle Bewertungen auf Wahrscheinlichkeiten beruhen und nicht als rechtsverbindliche Auskünfte zu verstehen sind.
          </p>
        </div>
      </div>
    </main>
  );
}