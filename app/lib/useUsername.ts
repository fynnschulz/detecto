"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

export function useUsername() {
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { mounted && setUsername(""); return; }

      // 1) schneller Versuch: user_metadata.username
      let name: string | null =
        (user.user_metadata as any)?.username ?? null;

      // 2) kanonisch aus profiles (falls vorhanden)
      if (user.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .single();
        if (profile?.username) name = profile.username;
      }

      // 3) Fallback: vor dem @ aus der E‑Mail
      if (!name) name = user.email?.split("@")[0] ?? "";

      if (mounted) setUsername(name);
    }

    load();

    // aktualisieren, wenn sich die Session ändert
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return username;
}