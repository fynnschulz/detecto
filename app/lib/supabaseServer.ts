

// app/lib/supbaseServer.ts
// Next.js (App Router) server-side Supabase client using the modern @supabase/ssr package
// Works with Next.js 15+ where cookies() is asynchronous.

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Create a server-side Supabase client that reads/writes auth cookies via Next.js headers API.
 * Use this in Server Components, Server Actions, route handlers, and layout.tsx to fetch the initial session.
 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          // Next.js cookies() has no direct remove, emulate by setting an expired cookie
          cookieStore.set({ name, value: "", ...options, expires: new Date(0) });
        },
      },
    }
  );

  return supabase;
}