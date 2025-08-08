"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [username, setUsername] = useState("");

  const handleNextStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (step < 3) {
      setStep(step + 1);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          firstName,
          lastName,
          address,
          username,
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
    <div className="min-h-screen flex items-center justify-center bg-black/80 text-white px-4">
      <div className="bg-zinc-900 p-6 rounded-2xl shadow-xl w-full max-w-md border border-zinc-700">
        <h2 className="text-2xl font-semibold mb-4 text-center">🧾 Jetzt registrieren bei DETECTO</h2>
        <form onSubmit={handleNextStep} className="flex flex-col gap-4">
          {step === 1 && (
            <>
              <input type="email" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-zinc-800 text-white px-4 py-2 rounded-md w-full focus:outline-none" required />
              <input type="password" placeholder="Passwort" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-zinc-800 text-white px-4 py-2 rounded-md w-full focus:outline-none" required />
            </>
          )}

          {step === 2 && (
            <>
              <input type="text" placeholder="Vorname" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-zinc-800 text-white px-4 py-2 rounded-md w-full focus:outline-none" required />
              <input type="text" placeholder="Nachname" value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-zinc-800 text-white px-4 py-2 rounded-md w-full focus:outline-none" required />
              <input type="text" placeholder="Adresse" value={address} onChange={(e) => setAddress(e.target.value)} className="bg-zinc-800 text-white px-4 py-2 rounded-md w-full focus:outline-none" required />
            </>
          )}

          {step === 3 && (
            <>
              <input type="text" placeholder="Nutzername" value={username} onChange={(e) => setUsername(e.target.value)} className="bg-zinc-800 text-white px-4 py-2 rounded-md w-full focus:outline-none" required />
            </>
          )}

          {error && <div className="bg-red-500/10 text-red-300 text-sm px-3 py-2 rounded-md border border-red-400/30">{error}</div>}

          {success && <div className="bg-green-500/10 text-green-300 text-sm px-3 py-2 rounded-md border border-green-400/30">{success}</div>}

          <button type="submit" className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 rounded-md w-full transition">
            {step < 3 ? "Weiter" : "Registrieren"}
          </button>
        </form>

        <div className="text-sm mt-4 text-center text-gray-400">
          Bereits ein Konto? <a href="/login" className="text-blue-400 underline">Zum Login</a>
        </div>
      </div>
    </div>
  );
}