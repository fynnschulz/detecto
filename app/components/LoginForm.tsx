"use client";

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
    } else {
      localStorage.setItem("hideAuthModal", "true"); // Modal unterdrücken
      window.location.reload(); // Seite neu laden
    }

    setLoading(false);
  };

  return (
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
      {errorMsg && (
        <div className="text-red-500 text-sm">{errorMsg}</div>
      )}
      <button
        type="submit"
        disabled={loading}
        className={`${
          loading ? "bg-blue-400" : "bg-blue-500 hover:bg-blue-600"
        } text-white font-semibold py-2 rounded-md transition`}
      >
        {loading ? "Einloggen..." : "Einloggen"}
      </button>
    </form>
  );
}
