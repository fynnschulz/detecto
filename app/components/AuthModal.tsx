/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import LoginForm from "./LoginForm";
import RegisterForm from "@/app/register/page";
import Link from "next/link";

export default function AuthModal() {
  const [show, setShow] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

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
        <h2 className="text-2xl font-semibold mb-4 text-center">
          {authMode === "login" ? "🔐 Login bei DETECTO" : "🆕 Registrieren bei DETECTO"}
        </h2>

        {authMode === "login" ? <LoginForm /> : <RegisterForm />}

        <div className="text-sm mt-4 text-center">
          {authMode === "login" ? (
            <>
              Noch kein Account?{" "}
              <button
                className="text-blue-400 underline"
                onClick={() => setAuthMode("register")}
              >
                Jetzt registrieren
              </button>
            </>
          ) : (
            <>
              Schon registriert?{" "}
              <button
                className="text-blue-400 underline"
                onClick={() => setAuthMode("login")}
              >
                Jetzt einloggen
              </button>
            </>
          )}
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