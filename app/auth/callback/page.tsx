"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleSession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token");

      if (access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (!error && data?.session) {
          try {
            localStorage.setItem("skip @app/components/LoginForm", "1");
          } catch (e) {
            // ignore
          }
          router.push("/");
          return;
        }
      }

      // fallback
      router.push("/login");
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