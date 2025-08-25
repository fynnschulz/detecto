"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

export default function ProtectedPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;

      if (!session || !session.user) {
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (user) {
        setUserId(user.id);
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(profileData);
      }

      setLoading(false);
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
        <p className="text-gray-400 mt-4">User ID: {userId ?? "Keine User ID gefunden"}</p>
        <p className="text-gray-400 mt-2">
          Profil: {profile ? JSON.stringify(profile) : "Kein Profil gefunden"}
        </p>
      </div>
    </div>
  );
}