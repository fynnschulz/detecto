

// app/providers.tsx
"use client";

import { useEffect, useMemo, useRef, useState, createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/app/lib/supabaseClient";

/**
 * Lightweight Auth context to expose `session` + `isAuthReady` across the app
 * without relying on deprecated helpers. Components can call `useAuth()`.
 */
 type AuthCtx = { session: Session | null; isAuthReady: boolean };
 const AuthContext = createContext<AuthCtx | null>(null);
 export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <Providers>");
  return ctx;
 }

export default function Providers({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession: Session | null;
}) {
  const pathname = usePathname();
  const supabaseRef = useRef(getSupabaseClient());
  const supabase = supabaseRef.current;

  const [session, setSession] = useState<Session | null>(initialSession);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Reconcile session on mount and subscribe to auth changes
  useEffect(() => {
    let alive = true;
    console.debug("SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.debug("Anon key present?", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!alive) return;
        setSession(session ?? null);
        setIsAuthReady(true);
      })
      .catch((err) => {
        console.error("Error while fetching session:", err);
        setIsAuthReady(true);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s ?? null));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // Optional: prevent hydration warnings by deferring animated tree until mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const ctxValue = useMemo<AuthCtx>(() => ({ session, isAuthReady }), [session, isAuthReady]);

  return (
    <AuthContext.Provider value={ctxValue}>
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="min-h-screen"
        >
          {mounted && children}
        </motion.div>
      </AnimatePresence>
    </AuthContext.Provider>
  );
}