// app/vpn/page.tsx
'use client';
import React from 'react';


export default function VPNPage() {
  const affiliateUrl = process.env.NEXT_PUBLIC_VPN_AFFILIATE_URL || '#';

  return (
    <main className="vpn-root">
      {/* Background gradient + light beams */}
      <div className="bg-base" />
      <div className="glow glow-a" />
      <div className="glow glow-b" />
      <div className="beam beam-1" />
      <div className="beam beam-2" />

      <section className="container">
        <div className="badge mx-auto text-center">Detecto Feature</div>
        <h1 className="title text-center">
          Detecto VPN <span className="title-fade">– powered by NordVPN</span>
        </h1>
        <p className="lead text-center mx-auto">
          Sichere dein WLAN, verhindere Tracking und verschlüssele deinen gesamten Datenverkehr. Die Verbindung und Abrechnung laufen direkt über NordVPN – du profitierst von der einfachen Detecto‑Integration.
        </p>

        <div className="flex justify-center gap-4">
          <a
            href={affiliateUrl}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="btn btn-primary"
          >
            Jetzt aktivieren
          </a>
        </div>

        <div className="disclaimer text-center mx-auto">
          Hinweis: Dies ist eine <strong>NordVPN‑Integration</strong>. Detecto speichert keine Inhalte deiner
          Verbindung. Für die VPN‑Leistung und die No‑Logs‑Richtlinie ist NordVPN verantwortlich.
        </div>

        <div className="cards">
          <FeatureCard
            icon={ShieldIcon}
            title="Schutz in öffentlichem WLAN"
            text="Verschlüsselter Tunnel gegen Mitlesen, z. B. im Café, Hotel oder Flughafen."
          />
          <FeatureCard
            icon={LightningIcon}
            title="Schnell & stabil"
            text="Moderne Protokolle wie WireGuard® sorgen für hohe Geschwindigkeiten."
          />
          <FeatureCard
            icon={GlobeIcon}
            title="Standorte weltweit"
            text="Wähle Server in vielen Ländern – ideal für Reisen und Latenzoptimierung."
          />
          <FeatureCard
            icon={EyeOffIcon}
            title="Tracker‑Blocklisten (optional)"
            text="Blockiere Ads/Tracker via DNS‑Filter – mehr Ruhe beim Surfen."
          />
        </div>
      </section>

      <section id="how" className="container narrow how">
        <h2 className="h2 text-center">So startest du in 60 Sekunden</h2>
        <ol className="steps">
          <li>
            <span className="step">1</span>
            <div>
              <strong>Auf „Jetzt aktivieren“ klicken</strong>
              <p>Du landest beim Partner und wählst das gewünschte Paket.</p>
            </div>
          </li>
          <li>
            <span className="step">2</span>
            <div>
              <strong>App herunterladen & einloggen</strong>
              <p>Offizielle Apps für iOS, Android, macOS, Windows und Linux stehen bereit.</p>
            </div>
          </li>
          <li>
            <span className="step">3</span>
            <div>
              <strong>Mit einem Tipp verbinden</strong>
              <p>Standort wählen, verbinden – fertig. Detecto zeigt dir Tipps und Best Practices.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="container faq">
        <h2 className="h2 text-center">Häufige Fragen</h2>
        <div className="faq-grid">
          <FAQ
            q="Ist das ein echtes Detecto‑VPN?"
            a="Es handelt sich um eine geprüfte NordVPN‑Integration, die wir sauber in Detecto einbetten. Kauf, Technik und Verbindungsdaten laufen direkt bei NordVPN."
          />
          <FAQ
            q="Speichert Detecto meine Daten?"
            a="Nein. Detecto erhält keine Inhalte deiner VPN‑Verbindung. Wir tracken lediglich anonyme Klicks auf den Aktivieren‑Button, um die Integration zu verbessern."
          />
          <FAQ
            q="Gibt es ein Probeabo?"
            a="NordVPN bietet oft rabattierte Einstiegsangebote an. Details siehst du nach Klick auf „Jetzt aktivieren“."
          />
          <FAQ
            q="Brauche ich das für jedes Gerät?"
            a="Du kannst die App auf mehreren Geräten nutzen – die genaue Anzahl hängt vom gewählten NordVPN‑Paket ab."
          />
        </div>
      </section>

      <style jsx>{`
        .vpn-root {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          color: #e6e6f0;
          background: radial-gradient(1200px 800px at 20% 10%, rgba(46, 115, 255, 0.20), transparent 60%),
                      radial-gradient(900px 600px at 80% 0%, rgba(168, 85, 247, 0.18), transparent 60%),
                      #0b0f1a;
        }
        .bg-base {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(11, 15, 26, 0) 0%, rgba(11, 15, 26, 0.6) 60%, rgba(11, 15, 26, 0.9) 100%);
          pointer-events: none;
          z-index: 0;
        }
        .glow {
          position: absolute;
          width: 60vw;
          height: 60vw;
          filter: blur(60px);
          opacity: 0.35;
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
          animation: float 18s ease-in-out infinite;
        }
        .glow-a {
          left: -10vw;
          top: -10vw;
          background: radial-gradient(circle at 30% 30%, rgba(56, 189, 248, 0.6), transparent 60%);
        }
        .glow-b {
          right: -15vw;
          top: 5vw;
          background: radial-gradient(circle at 70% 30%, rgba(139, 92, 246, 0.6), transparent 60%);
          animation-delay: 4s;
        }
        .beam {
          position: absolute;
          inset: -20vh -20vw;
          background: conic-gradient(from 180deg at 50% 50%, rgba(99, 102, 241, 0.12), rgba(34, 197, 94, 0.10), rgba(56, 189, 248, 0.12), rgba(99, 102, 241, 0.12));
          mix-blend-mode: screen;
          filter: blur(40px) saturate(1.2);
          mask-image: radial-gradient(60% 40% at 50% 40%, black 30%, transparent 60%);
          pointer-events: none;
          z-index: 0;
          animation: drift 22s linear infinite;
        }
        .beam-1 { opacity: 0.6; }
        .beam-2 { opacity: 0.4; animation-direction: reverse; animation-duration: 28s; }

        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(18px); } }
        @keyframes drift { 0% { transform: rotate(0deg) scale(1.05); } 100% { transform: rotate(360deg) scale(1.05); } }

        .container {
          position: relative;
          z-index: 1;
          max-width: 1100px;
          margin: 0 auto;
          padding: 96px 20px 40px;
        }
        .container.narrow { max-width: 900px; }

        .badge {
          display: block;
          text-align: center;
          margin: 0 auto;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(8px);
        }
        .title {
          margin: 16px 0 12px;
          font-size: clamp(32px, 5.6vw, 60px);
          line-height: 1.05;
          font-weight: 900;
          letter-spacing: -0.02em;
          text-align: center;
          /* Light effects (no animation) */
          background: linear-gradient(135deg, #eaf2ff 10%, #b7c8ff 35%, #c3b3ff 65%, #eaf2ff 90%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow:
            0 0 0px rgba(255,255,255,0),
            0 1px 12px rgba(120, 150, 255, 0.25),
            0 2px 26px rgba(139, 92, 246, 0.22),
            0 6px 48px rgba(56, 189, 248, 0.18);
          position: relative;
        }
        .title::after {
          content: "";
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: -10px;
          width: min(220px, 40%);
          height: 6px;
          border-radius: 999px;
          background: radial-gradient(60% 100% at 50% 50%, rgba(139,92,246,0.6), rgba(56,189,248,0.25) 70%, transparent 80%);
          filter: blur(8px);
          opacity: 0.9;
        }
        .title-fade {
          font-weight: 800;
          opacity: 0.95;
        }
        .lead {
          margin: 10px 0 20px;
          font-size: clamp(16px, 2.2vw, 20px);
          color: #cfd3e6;
          max-width: 800px;
        }
        .cta-row { display: flex; gap: 14px; flex-wrap: wrap; margin: 20px 0 10px; }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 46px;
          padding: 0 18px;
          border-radius: 12px;
          font-weight: 600;
          text-decoration: none;
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
          border: 1px solid rgba(255,255,255,0.12);
          backdrop-filter: blur(8px);
        }
        .btn-primary {
          background: linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(139, 92, 246, 0.25));
          box-shadow: 0 8px 24px rgba(56, 189, 248, 0.15), 0 8px 24px rgba(139, 92, 246, 0.12);
        }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(56, 189, 248, 0.22), 0 10px 28px rgba(139, 92, 246, 0.2); }
        .btn-ghost { background: rgba(255,255,255,0.04); }
        .btn-ghost:hover { background: rgba(255,255,255,0.07); transform: translateY(-1px); }

        .disclaimer {
          margin-top: 14px;
          font-size: 13px;
          color: #b8bdd6;
        }

        .cards {
          margin-top: 34px;
          display: grid;
          grid-template-columns: repeat(1, minmax(0, 1fr));
          gap: 14px;
        }
        @media (min-width: 720px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (min-width: 1040px) { .cards { grid-template-columns: repeat(4, minmax(0, 1fr)); } }

        .card {
          position: relative;
          padding: 18px;
          border-radius: 16px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          backdrop-filter: blur(10px);
          min-height: 140px;
        }
        .card h3 { margin: 10px 0 6px; font-size: 16px; font-weight: 700; }
        .card p { margin: 0; color: #cfd3e6; font-size: 14px; }
        .icon {
          width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center;
          border-radius: 10px;
          background: radial-gradient(circle at 30% 30%, rgba(56,189,248,0.25), rgba(139,92,246,0.22));
          border: 1px solid rgba(255,255,255,0.14);
        }

        .how { padding-top: 40px; }
        .h2 {
          font-size: clamp(20px, 3vw, 28px);
          font-weight: 800;
          letter-spacing: -0.01em;
          margin-bottom: 14px;
        }
        .steps { list-style: none; padding: 0; margin: 0; display: grid; gap: 14px; }
        .steps li {
          display: grid; grid-template-columns: 42px 1fr; gap: 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px; padding: 14px;
          backdrop-filter: blur(10px);
        }
        .step {
          width: 42px; height: 42px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(139, 92, 246, 0.25));
          font-weight: 800; color: #eaf2ff; border: 1px solid rgba(255,255,255,0.14);
        }

        .faq { padding-top: 32px; padding-bottom: 70px; }
        .faq-grid { display: grid; gap: 12px; grid-template-columns: 1fr; place-items: center; }
        @media (min-width: 900px) { .faq-grid { grid-template-columns: 1fr 1fr; } }
        .faq-item {
          width: 100%;
          max-width: 760px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          padding: 14px 16px;
          backdrop-filter: blur(10px);
        }
        .faq-item summary {
          cursor: pointer;
          font-weight: 700;
          text-align: center;
        }
        .faq-item p {
          margin: 8px 0 0;
          color: #cfd3e6;
          text-align: center;
        }
      `}</style>
    </main>
  );
}

function FeatureCard({ icon: Icon, title, text }: { icon: React.FC<React.SVGProps<SVGSVGElement>>; title: string; text: string }) {
  return (
    <div className="card">
      <span className="icon" aria-hidden>
        <Icon width={18} height={18} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <details className="faq-item">
      <summary>{q}</summary>
      <p>{a}</p>
    </details>
  );
}

function ShieldIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
function LightningIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
function GlobeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M5 7c3 .5 11 .5 14 0M5 17c3-.5 11-.5 14 0" />
    </svg>
  );
}
function EyeOffIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M3 3l18 18" strokeLinecap="round" />
      <path d="M10.6 10.6a3 3 0 004.2 4.2M9.88 4.6A9.55 9.55 0 0112 4c6 0 9 8 9 8a15.3 15.3 0 01-3.2 4.4" />
      <path d="M6.1 6.1A15.78 15.78 0 003 12s3 8 9 8c1.1 0 2.1-.2 3.02-.54" />
    </svg>
  );
}
