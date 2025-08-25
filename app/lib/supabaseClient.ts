// app/lib/supabaseClient.ts
// Client-side Supabase instance for Next.js App Router, using @supabase/ssr
// Marks this module as client-only so it isn't imported during SSR.

"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase browser client.
 * Uses persistent session storage and auto token refresh under the hood.
 */
export function getSupabaseClient(): SupabaseClient {
  if (_client) {
    console.debug("Reusing existing Supabase client");
    return _client;
  }
  console.debug("Creating Supabase client with URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.debug("Anon key present?", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return _client;
}

// Keep backward compatibility for existing imports: `import { supabase } from ".../supabaseClient"`
export const supabase: SupabaseClient = getSupabaseClient();