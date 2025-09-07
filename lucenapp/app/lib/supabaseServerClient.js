// lib/supabaseServerClient.js
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Use in Server Components (pages/layouts/loaders).
 * Read-only cookie access to avoid Next 15 write restriction.
 */
export async function createSupabaseServerClientReadonly() {
  const cookieStore = await cookies(); // Next 15: must await
  return createServerClient(URL, ANON, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      // No-ops to satisfy the API without triggering Next's restriction
      set() {},
      remove() {},
    },
  });
}

/**
 * Use ONLY in Route Handlers (/app/api/*) or Server Actions.
 * Allows Supabase to refresh/set auth cookies.
 */
export async function createSupabaseRouteClient() {
  const cookieStore = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name, options) {
        cookieStore.set({ name, value: '', ...options, expires: new Date(0) });
      },
    },
  });
}

/** Helpers for common Server Component usage */
export async function getUser() {
  const supabase = await createSupabaseServerClientReadonly();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function getUserAndProfile() {
  const supabase = await createSupabaseServerClientReadonly();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role, plan, ebooks_quota, priority_delivery, vip_badge')
    .eq('id', user.id)
    .single();

  return { supabase, user, profile: profile ?? null };
}
