// app/lib/supabaseServerClient.js
import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export function getSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => {
          // In server components, next/headers cookieStore is read-only for mutation;
          // only use set/remove in Route Handlers or Server Actions.
        },
        remove: (name, options) => {
          // same note as above
        },
      },
    }
  );
}

// Simple helper most pages need
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
