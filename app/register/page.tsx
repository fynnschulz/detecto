"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseclient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("❌ Login fehlgeschlagen: " + error.message);
    } else {
      router.push("/"); // Weiterleitung nach Login – Ziel ggf. anpassen
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black/80 text-white px-4">
      <div className="bg-zinc-900 p-6 rounded-2xl shadow-xl w-full max-w-md border border-zinc-700">
        <h2 className="text-2xl font-semibold mb-4 text-center">🔐 Login bei DETECTO</h2>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
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
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-md w-full transition"
          >
            Login
          </button>
        </form>
        <div className="text-sm mt-4 text-center text-gray-400">
          Noch kein Konto?{" "}
          <a href="/register" className="text-blue-400 underline">
            Jetzt registrieren
          </a>
        </div>
      </div>
    </div>
  );
}