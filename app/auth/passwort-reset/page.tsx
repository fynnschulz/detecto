"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function PasswortResetPage() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code");

  const [isExchanging, setIsExchanging] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const run = async () => {
      setIsExchanging(true);
      setError(null);
      setMessage(null);

      if (code) {
        // Variante 1: Supabase liefert ?code=...
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setError("Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Zurücksetzungslink an.");
        }
      } else {
        // Variante 2: Supabase liefert Tokens im URL-Hash (#access_token=...&refresh_token=...&type=recovery)
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        if (hash && hash.includes("access_token") && hash.includes("refresh_token")) {
          const params = new URLSearchParams(hash.replace(/^#/, ""));
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          const type = params.get("type");

          if (type === "recovery" && access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) {
              setError("Konnte die Sitzung nicht herstellen. Bitte fordere einen neuen Reset-Link an.");
            } else {
              // optional: Hash aus der URL entfernen, damit er nicht stört
              try {
                window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
              } catch {}
            }
          } else {
            setError("Dein Reset-Link ist ungültig oder unvollständig. Bitte fordere im Login-Fenster einen neuen Link an.");
          }
        } else {
          // Weder code noch Hash-Token: nüchterne Meldung statt generischem Hinweis
          setError("Es wurde kein gültiger Reset-Code gefunden. Öffne den Link direkt aus der E-Mail oder fordere einen neuen Link an.");
        }
      }

      setIsExchanging(false);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (password !== confirm) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setError("Konnte das Passwort nicht ändern. Bitte erneut versuchen.");
      return;
    }

    setMessage("Passwort aktualisiert! Du wirst gleich weitergeleitet…");
    setTimeout(() => router.push("/"), 1500);
  };

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.25),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(16,185,129,0.2),transparent_60%)] text-white">
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16">
        {/* Logo/Marke */}
        <div className="mb-6 flex items-center gap-2 opacity-90">
          <div className="h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-sm tracking-widest text-emerald-300/90">DETECTO</span>
        </div>

        {/* Card */}
        <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-md">
          <h1 className="mb-1 text-xl font-semibold">Neues Passwort festlegen</h1>
          <p className="mb-6 text-sm text-white/70">
            Setze dein Passwort sicher zurück. Der Link aus deiner E-Mail öffnet diese Seite automatisch.
          </p>

          {isExchanging ? (
            <div className="rounded-md border border-white/10 bg-white/5 p-3 text-sm text-white/80">
              Bitte warten… wir prüfen deinen Link.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {message && (
                <div className="rounded-md border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
                  {message}
                </div>
              )}
              {error && (
                <div className="rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm text-white/80">Neues Passwort</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none ring-0 placeholder-white/40"
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/80">Passwort bestätigen</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                  required
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none ring-0 placeholder-white/40"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 w-full rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
              >
                {submitting ? "Speichere…" : "Passwort speichern"}
              </button>
            </form>
          )}

          <div className="mt-6 flex items-center justify-between text-xs text-white/60">
            <button
              onClick={() => router.push("/")}
              className="underline-offset-2 hover:underline"
              type="button"
            >
              Zurück zur Startseite
            </button>
            <span className="opacity-70">Sicher durch KI · Detecto</span>
          </div>
        </div>

        {/* kleine Fußzeile */}
        <div className="mt-6 text-center text-[11px] text-white/50">
          Probleme mit dem Link? Fordere im Login-Fenster einen neuen Reset-Link an.
        </div>
      </div>
    </div>
  );
}