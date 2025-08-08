/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import LoginForm from "./LoginForm";
import Link from "next/link";

export default function AuthModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hide = localStorage.getItem("hideAuthModal");
    if (hide !== "true") {
      setShow(true);
    }

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setShow(false);
        localStorage.setItem("hideAuthModal", "true");
      }
    };

    const interval = setInterval(checkSession, 5000); // alle 5 Sekunden
    return () => clearInterval(interval);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-zinc-900 p-8 rounded-3xl shadow-2xl w-[90%] max-w-[400px] text-white border border-zinc-700">
        <h2 className="text-2xl font-semibold mb-4 text-center">🔐 Anmelden bei DETECTO</h2>
        <LoginForm />
        <div className="text-sm mt-4 text-center">
          Noch kein Account?{" "}
          <Link href="/register" className="text-blue-400 underline">
            Jetzt registrieren
          </Link>
        </div>
        <div className="text-center mt-3">
          <button
            onClick={() => {
              setShow(false);
              localStorage.setItem("hideAuthModal", "true");
            }}
            className="mt-2 text-sm text-gray-400 hover:text-white"
          >
            Oder ohne Login fortfahren
          </button>
        </div>
      </div>
    </div>
  );
}