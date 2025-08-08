"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError("❌ Registrierung fehlgeschlagen: " + error.message);
    } else {
      // Erfolgreich registriert → ggf. Weiterleitung oder Bestätigung anzeigen
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black/80 text-white px-4">
      <div className="bg-zinc-900 p-6 rounded-2xl shadow-xl w-full max-w-md border border-zinc-700">
        <h2 className="text-2xl font-semibold mb-4 text-center">🧾 Jetzt registrieren bei DETECTO</h2>
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-zinc-800 text-white px-4 py-2 rounded-md w-full focus:outline-none"
            required
          />
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-zinc-800 text-white px-4 py-2 rounded-md w-full focus:outline-none"
            required
          />
          {error && (
            <div className="bg-red-500/10 text-red-300 text-sm px-3 py-2 rounded-md border border-red-400/30">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 rounded-md w-full transition"
          >
            Registrieren
          </button>
        </form>
        <div className="text-sm mt-4 text-center text-gray-400">
          Bereits ein Konto?{" "}
          <a href="/login" className="text-blue-400 underline">
            Zum Login
          </a>
        </div>
      </div>
    </div>
  );
}