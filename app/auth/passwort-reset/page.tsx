"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Passwort-Zurücksetzen-Seite (Next.js App Router)
 *
 * Unterstützt beide Supabase-Flows:
 * 1) PKCE / Code-Flow → /passwort-reset?code=...
 *    → supabase.auth.exchangeCodeForSession(code)
 * 2) Impliziter Hash-Flow → /passwort-reset#access_token=...&refresh_token=...&type=recovery
 *    → supabase.auth.setSession({ access_token, refresh_token })
 *
 * Danach: supabase.auth.updateUser({ password })
 */

function assertEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Fehlende Umgebungsvariable: ${name}`);
  return value;
}

export default function PasswortResetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const supabase: SupabaseClient = useMemo(
    () =>
      createClient(
        assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
        assertEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
        }
      ),
    []
  );

  const [isHydrated, setIsHydrated] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Parse tokens from URL hash (implicit flow)
  function parseHashTokens(): { access_token?: string; refresh_token?: string; type?: string } {
    if (typeof window === "undefined") return {};
    const hash = window.location.hash?.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token") ?? undefined;
    const refresh_token = params.get("refresh_token") ?? undefined;
    const type = params.get("type") ?? undefined;
    return { access_token, refresh_token, type };
  }

  // Establish a session from either `code` (PKCE) or hash tokens (implicit)
  useEffect(() => {
    setIsHydrated(true);

    async function bootstrap() {
      try {
        setError(null);
        setInfo("Prüfe Auth-Link …");

        const code = searchParams?.get("code");
        if (code) {
          // PKCE-Flow
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (!data.session) throw new Error("Keine Session vom Auth-Code erhalten.");

          // URL aufräumen (code entfernen)
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("code");
            window.history.replaceState({}, "", url.toString());
          }

          setSessionReady(true);
          setInfo("Verbindung hergestellt. Du kannst jetzt ein neues Passwort setzen.");
          return;
        }

        // Impliziter Hash-Flow (type=recovery)
        const { access_token, refresh_token, type } = parseHashTokens();
        if (type === "recovery" && access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;

          // Hash entfernen
          if (typeof window !== "undefined") {
            window.history.replaceState({}, "", window.location.pathname + window.location.search);
          }

          setSessionReady(true);
          setInfo("Verbindung hergestellt. Du kannst jetzt ein neues Passwort setzen.");
          return;
        }

        // Falls bereits eine gültige Session existiert
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setSessionReady(true);
          setInfo("Session erkannt. Du kannst dein Passwort jetzt ändern.");
          return;
        }

        setSessionReady(false);
        setError(
          "Kein gültiger Wiederherstellungs‑Token gefunden. Öffne den Link aus der E‑Mail erneut oder fordere eine neue E‑Mail an."
        );
      } catch (e: any) {
        setSessionReady(false);
        setError(e?.message ?? "Unbekannter Fehler beim Verifizieren des Links.");
      } finally {
        setInfo(null);
      }
    }

    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Basic Validierung
    if (!password || password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (password !== confirm) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccessMsg("Passwort erfolgreich aktualisiert. Du kannst dich jetzt mit dem neuen Passwort anmelden.");

      // Optional: zur Login-Seite schicken (nach kurzer Wartezeit)
      setTimeout(() => {
        try {
          router.push("/auth/login");
        } catch {}
      }, 1200);
    } catch (e: any) {
      if (e?.message?.toLowerCase?.().includes("session")) {
        setError(
          "Auth‑Session fehlt oder ist abgelaufen. Öffne den Link aus der E‑Mail erneut oder fordere eine neue E‑Mail an."
        );
      } else if (e?.message?.toLowerCase?.().includes("token")) {
        setError("Ungültiger oder abgelaufener Token. Bitte fordere eine neue Passwort‑Reset‑E‑Mail an.");
      } else {
        setError(e?.message ?? "Fehler beim Aktualisieren des Passworts.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!isHydrated) return null; // vermeidet Mismatch beim SSR

  return (
    <main className="mx-auto my-16 max-w-md rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-neutral-100 shadow-lg">
      <h1 className="mb-2 text-2xl font-semibold">Passwort zurücksetzen</h1>
      <p className="mb-6 text-sm text-neutral-400">
        Setze hier dein neues Passwort. Dieser Link ist zeitlich begrenzt und funktioniert nur einmal.
      </p>

      {/* Info / Fehler-Ausgabe für Screenreader */}
      <div aria-live="polite" className="sr-only">
        {error ? `Fehler: ${error}` : successMsg ? successMsg : info ? info : ""}
      </div>

      {info && (
        <div className="mb-4 rounded-md border border-neutral-700 bg-neutral-800 p-3 text-sm text-neutral-200">{info}</div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-red-800 bg-red-900/40 p-3 text-sm text-red-200">{error}</div>
      )}

      {successMsg && (
        <div className="mb-4 rounded-md border border-emerald-800 bg-emerald-900/40 p-3 text-sm text-emerald-200">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="mb-1 block text-sm">
            Neues Passwort
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-400"
              placeholder="Mindestens 8 Zeichen"
              aria-invalid={Boolean(error)}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-2 my-auto rounded px-2 text-xs text-neutral-300 hover:text-white"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"}
            >
              {showPw ? "Verbergen" : "Anzeigen"}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirm" className="mb-1 block text-sm">
            Passwort bestätigen
          </label>
          <input
            id="confirm"
            name="confirm"
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-400"
            placeholder="Wiederhole dein Passwort"
          />
        </div>

        <button
          type="submit"
          disabled={!sessionReady || busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Speichere …" : sessionReady ? "Passwort speichern" : "Warte auf Bestätigung …"}
        </button>

        <p className="mt-2 text-center text-xs text-neutral-400">
          Probleme? <a className="underline hover:text-neutral-200" href="/auth/forgot-password">Neue E‑Mail anfordern</a>
        </p>
      </form>
    </main>
  );
}
