/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import LoginForm from "./LoginForm";
import RegisterForm from "@/app/register/page";
import Link from "next/link";

export default function AuthModal() {
  const [show, setShow] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const supabase = useSupabaseClient();

  useEffect(() => {
    // Respect previously chosen "hideAuthModal"
    const hide = localStorage.getItem("hideAuthModal");
    if (hide !== "true") {
      setShow(true);
    }

    let isMounted = true;

    const closeHandler = () => {
      setShow(false);
      try {
        localStorage.setItem("hideAuthModal", "true");
      } catch {}
    };
    window.addEventListener("auth:closeModal", closeHandler);

    const openHandler = () => {
      setShow(true);
      try { localStorage.removeItem("hideAuthModal"); } catch {}
    };
    window.addEventListener("auth:openModal", openHandler);

    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      if (data.session) {
        setShow(false);
        localStorage.setItem("hideAuthModal", "true");
      }
    });

    // React immediately to auth changes (no polling)
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === "SIGNED_IN" && session) {
        setShow(false);
        localStorage.setItem("hideAuthModal", "true");
      }
      if (event === "SIGNED_OUT") {
        localStorage.removeItem("hideAuthModal"); // Modal jetzt NICHT sofort öffnen – Reload übernimmt Autostart
        setShow(false);
      }
    });

    return () => {
      isMounted = false;
      subscription?.subscription?.unsubscribe?.();
      window.removeEventListener("auth:openModal", openHandler);
      window.removeEventListener("auth:closeModal", closeHandler);
    };
  }, [supabase]);

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
              <Link href="/register" className="text-blue-400 underline">Jetzt registrieren</Link>
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