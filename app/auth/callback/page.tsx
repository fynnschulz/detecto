"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@supabase/auth-helpers-nextjs";

const supabase = createBrowserSupabaseClient();

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleSession = async () => {
      // Tausche Auth-Code/Access-Token aus der URL in eine Session
      const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);

      if (exchangeError) {
        console.error("exchangeCodeForSession error:", exchangeError);
        router.replace("/login");
        return;
      }

      // Session prüfen (sollte nun vorhanden sein)
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        router.replace("/");
      } else {
        router.replace("/login");
      }
    };

    handleSession();
  }, [router]);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "1.2rem",
        fontFamily: "sans-serif",
        color: "white",
      }}
    >
      ✅ Deine E-Mail wurde bestätigt! Anmeldung wird abgeschlossen ...
    </div>
  );
}