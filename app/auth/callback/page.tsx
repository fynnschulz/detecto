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
    // Wenn man über den Bestätigungslink kommt, unterdrücken wir einmalig das Auto-Login-Modal
    try {
      localStorage.setItem("skipLoginModalOnce", "1");
    } catch (e) {
      // ignore
    }

    const handleSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (data?.session) {
        router.push("/");
      } else {
        router.push("/login");
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