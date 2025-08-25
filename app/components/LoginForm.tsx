"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log("🔐 signIn result:", { data, error });

    if (error) {
      setErrorMsg(error.message);
    } else if (data?.session) {
      setSuccessMsg("✅ Login erfolgreich!");

      // Fetch the logged-in user and log their ID
      const { data: { user } } = await supabase.auth.getUser();
      console.log("👤 user.id:", user?.id);

      // Optional: Profil laden
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (pErr) {
        console.warn("Profil konnte nicht geladen werden:", pErr.message);
      } else {
        console.log("📄 Profil:", profile);
      }

      try {
        localStorage.setItem("hideAuthModal", "true");
      } catch {}

      // Falls AuthModal sichtbar ist, es schließen (globale Event-Variante)
      window.dispatchEvent(new CustomEvent("auth:closeModal"));

      // Session sollte jetzt sofort im Provider ankommen → kein Reload nötig
      // Falls du dennoch neu laden willst, kommentiere die nächste Zeile aus
      // window.location.reload();
    } else {
      setErrorMsg("Login fehlgeschlagen – keine Session erhalten.");
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
      {successMsg && (
        <div className="text-green-500 text-sm">{successMsg}</div>
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
