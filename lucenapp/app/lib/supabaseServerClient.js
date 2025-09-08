// app/lib/supabaseServerClient.js
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * For Server Components / Layouts / Pages (read-only cookies).
 * Use this to READ the current user/session on the server.
 */
export function getSupabaseServer() {
  const cookieStore = cookies(); // read-only outside route handlers
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        // set/remove are NO-OPs here (server components can't mutate cookies)
        set: () => {},
        remove: () => {},
      },
    }
  );
}

/**
 * For Route Handlers (app/api/**/route.js).
 * In route handlers, cookies() is writable, so we can set/remove as needed.
 */
export function getSupabaseRouteClient() {
  const cookieStore = cookies(); // writable in Route Handlers
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) =>
          cookieStore.set({ name, value, ...options }),
        remove: (name, options) =>
          cookieStore.set({ name, value: '', ...options }),
      },
    }
  );
}

/** Convenience: get the signed-in user (server components). */
export async function getUser() {
  const supabase = getSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return { user: null, error };
  return { user };
}

/** Convenience: get user + profile row. */
export async function getUserAndProfile() {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  return { user, profile };
}

/** Throw if not signed in (server components). */
export async function requireUser() {
  const { user } = await getUser();
  if (!user) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  return user;
}
