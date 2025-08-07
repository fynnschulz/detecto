

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

export default function ProtectedPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      const session = data?.session;

      if (!session || !session.user || !(session as any).created_at) {
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }

      const sessionCreatedTime = new Date((session as any).created_at).getTime();
      const now = Date.now();
      const FOUR_HOURS = 4 * 60 * 60 * 1000;

      if (now - sessionCreatedTime > FOUR_HOURS) {
        await supabase.auth.signOut();
        router.push("/login");
      } else {
        setLoading(false);
      }
    };

    checkSession();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-black/80">
        ⏳ Lade geschützten Inhalt...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-white bg-black/80 px-4">
      <div className="bg-zinc-900 p-6 rounded-2xl shadow-xl w-full max-w-md border border-zinc-700 text-center">
        <h1 className="text-3xl font-semibold mb-4">🔐 Geschützte Seite</h1>
        <p className="text-gray-300">
          Du bist eingeloggt und siehst diesen Text, weil du Zugriff hast.
        </p>
      </div>
    </div>
  );
}