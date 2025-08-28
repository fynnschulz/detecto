"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [username, setUsername] = useState("");

  const handleNextStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (step < 3) {
      setStep(step + 1);
      return;
    }

    const trimmedUsername = username.trim();

    const displayName = [firstName, lastName].filter(Boolean).join(" ").trim();

    // Prüfe, ob der Nutzername bereits vergeben ist
    const { data: taken } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', trimmedUsername)
      .maybeSingle();
    if (taken) {
      setError('Dieser Nutzername ist bereits vergeben.');
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          firstName,
          lastName,
          street,
          postalCode,
          username: trimmedUsername,
          name: displayName,
        },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError("❌ Registrierung fehlgeschlagen: " + error.message);
    } else {
      setSuccess("✅ Bitte bestätige die dir gesendete E-Mail, um dein Konto zu aktivieren.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-zinc-950 to-black text-white px-4 py-10">
      <div className="relative w-full max-w-md">
        {/* Glow / Deko */}
        <div className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 blur-2xl" />

        <div className="relative rounded-2xl border border-white/10 bg-zinc-900/80 backdrop-blur-xl shadow-2xl p-6 sm:p-7">
          {/* Header */}
          <div className="mb-5 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Jetzt registrieren bei <span className="text-white/90">DETECTO</span></h2>
            <p className="mt-1 text-sm text-zinc-400">Erstelle dein Konto in drei kurzen Schritten.</p>
          </div>

          {/* Step Indicator */}
          <div className="mb-6 flex items-center gap-2">
            {[1,2,3].map((s) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? "bg-blue-500" : "bg-zinc-700"}`} />
            ))}
          </div>

          <form onSubmit={handleNextStep} className="flex flex-col gap-4">
            {step === 1 && (
              <>
                <div>
                  <label className="mb-1 block text-sm text-zinc-300">E‑Mail</label>
                  <input
                    type="email"
                    placeholder="z. B. max@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-zinc-800/70 px-4 py-2.5 text-white placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 transition"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-300">Passwort</label>
                  <input
                    type="password"
                    placeholder="Mind. 6 Zeichen"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-zinc-800/70 px-4 py-2.5 text-white placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 transition"
                    required
                  />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <label className="mb-1 block text-sm text-zinc-300">Vorname</label>
                  <input
                    type="text"
                    placeholder="z. B. Max"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-zinc-800/70 px-4 py-2.5 text-white placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 transition"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-300">Nachname</label>
                  <input
                    type="text"
                    placeholder="z. B. Mustermann"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-zinc-800/70 px-4 py-2.5 text-white placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 transition"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-300">Straße &amp; Nummer</label>
                  <input
                    type="text"
                    placeholder="z. B. Musterstraße 12"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-zinc-800/70 px-4 py-2.5 text-white placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 transition"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-300">Postleitzahl</label>
                  <input
                    type="text"
                    placeholder="z. B. 12345"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-zinc-800/70 px-4 py-2.5 text-white placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 transition"
                    required
                  />
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div>
                  <label className="mb-1 block text-sm text-zinc-300">Nutzername</label>
                  <input
                    type="text"
                    placeholder="Dein öffentlicher Nutzername"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-zinc-800/70 px-4 py-2.5 text-white placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 transition"
                    required
                  />
                </div>
              </>
            )}

            {error && (
              <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {success}
              </div>
            )}

            <button
              type="submit"
              className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-4 py-2.5 font-semibold text-white transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
            >
              {step < 3 ? "Weiter" : "Registrieren"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}