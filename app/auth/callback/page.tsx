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
    const run = async () => {
      try {
        // Modal dauerhaft (4h) unterdrücken
        document.cookie = "suppress_login=1; path=/; max-age=" + 60 * 60 * 4;

        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (!code) {
          router.push("/login");
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error("Session-Error:", error);
          router.push("/login");
          return;
        }

        // Erfolgreich eingeloggt
        router.push("/");
      } catch (e) {
        console.error(e);
        router.push("/login");
      }
    };

    run();
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