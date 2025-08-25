"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase browser client.
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

export const supabase: SupabaseClient = getSupabaseClient();