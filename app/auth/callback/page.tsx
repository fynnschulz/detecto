"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      localStorage.setItem("skipLoginModalOnce", "1");
    } catch {}

    const handleSession = async () => {
      // Token aus dem Hash auslesen
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);

      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          console.error("Fehler beim Setzen der Session:", error);
          router.push("/login");
          return;
        }

        router.push("/");
      } else {
        // Falls kein Token im Hash, normale Session prüfen
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          router.push("/");
        } else {
          router.push("/login");
        }
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