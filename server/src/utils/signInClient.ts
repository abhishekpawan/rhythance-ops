import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * A fresh Supabase client for one sign-in or sign-up.
 *
 * Signing in on a shared client stores that user's session in it, and every later call on that
 * client (from any request) then runs as that user instead of with the service key. Use one of
 * these per request for signInWithPassword, signUp and the signOut that follows a sign-in.
 */
export function createSignInClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase credentials");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
