export default function UeberUnsPage() {
  return (
    <div className="min-h-screen bg-black text-white py-20 px-6">
      <div className="max-w-4xl mx-auto space-y-10">
        <h1 className="text-4xl font-bold text-center">Über uns</h1>

        <p className="text-gray-300 text-lg leading-relaxed">
          In einer digitalen Welt, in der Informationen in Sekundenschnelle verarbeitet werden,
          rückt der Schutz persönlicher Daten zunehmend in den Hintergrund. Jeden Tag werden Millionen von Menschen Opfer von intransparenten Datenpraktiken –
          oft ohne es zu wissen. Detecto wurde gegründet, um das zu ändern.
        </p>

        <p className="text-gray-300 text-lg leading-relaxed">
          Unser Ziel ist es, eine Plattform zu bieten, die Datenschutzanalysen einfach, verständlich und für jede Person zugänglich macht –
          unabhängig vom technischen Vorwissen. Dabei setzen wir auf modernste Technologien wie künstliche Intelligenz, ohne dabei die Verantwortung für Transparenz und Nachvollziehbarkeit aus den Augen zu verlieren.
        </p>

        <p className="text-gray-300 text-lg leading-relaxed">
          Unsere Motivation ist klar: Wir glauben, dass der Schutz der Privatsphäre ein Grundrecht ist. Und dass dieses Recht nicht durch komplexe AGBs,
          versteckte Tracker oder schwer verständliche Richtlinien ausgehöhlt werden darf.
        </p>

        <hr className="border-gray-700 my-10" />

        <h2 className="text-2xl font-bold mt-10">Über den Gründer</h2>

        <p className="text-gray-300 text-lg leading-relaxed">
          Detecto wurde von <strong>Fynn - Luca Schulz</strong> ins Leben gerufen. Als Gründer und Inhaber von Detecto verbindet er technisches Verständnis mit gesellschaftlicher Verantwortung.
        </p>

        <blockquote className="text-gray-400 italic border-l-4 border-gray-700 pl-4 mt-6">
          „Ich habe gesehen, wie sorglos viele Menschen mit ihren Daten umgehen – nicht aus Gleichgültigkeit, sondern weil sie gar nicht wissen, wie intransparent das Internet oft ist. Mir war klar: Das muss sich ändern.“
        </blockquote>

        <p className="text-gray-300 text-lg leading-relaxed mt-6">
          Fynn entwickelt Detecto mit dem klaren Ziel, digitale Aufklärung und Datenschutz in den Alltag zu bringen – einfach, verständlich und kostenlos zugänglich für alle.
        </p>

        <div className="mt-12 flex flex-col md:flex-row items-center justify-center gap-6">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-gray-700 shadow-lg">
            <img
              src="/fynn.jpg" // <-- Ersetze mit deinem Dateinamen im public-Ordner
              alt="Fynn - Luca Schulz"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-center md:text-left">
            <p className="text-xl font-extrabold tracking-wide">FYNN - LUCA SCHULZ</p>
            <p className="text-gray-400 text-sm mt-1">Gründer & Inhaber von Detecto</p>
          </div>
        </div>
      </div>
    </div>
  );
}