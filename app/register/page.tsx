

"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      alert("Passwörter stimmen nicht überein");
      return;
    }
    // TODO: Registrierung an Backend senden
    console.log("Registrierung:", { email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black/80 text-white">
      <div className="bg-zinc-900 p-6 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-4 text-center">📝 Registrieren bei DETECTO</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="E-Mail-Adresse"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-zinc-800 text-white px-4 py-2 rounded-md focus:outline-none"
            required
          />
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-zinc-800 text-white px-4 py-2 rounded-md focus:outline-none"
            required
          />
          <input
            type="password"
            placeholder="Passwort bestätigen"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="bg-zinc-800 text-white px-4 py-2 rounded-md focus:outline-none"
            required
          />
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-md transition"
          >
            Registrieren
          </button>
        </form>
        <div className="text-sm mt-4 text-center">
          Schon ein Konto?{" "}
          <Link href="/" className="text-blue-400 underline">
            Jetzt einloggen
          </Link>
        </div>
      </div>
    </div>
  );
}