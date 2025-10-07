// lib/server/supabase.js
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

export async function readAuthCookieToken() {
  // cookie name must match your project ref
  const ref = SUPABASE_URL.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1];
  const name = `sb-${ref}-auth-token`;
  const store = await cookies();
  return store.get(name)?.value || '';
}

// Server-side client where we optionally attach the user's bearer (for RLS)
export async function supabaseServerClientWithUser() {
  const token = await readAuthCookieToken(); // may be empty if signed out
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Bare anon client (no user token)
export function supabaseServerAnon() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
