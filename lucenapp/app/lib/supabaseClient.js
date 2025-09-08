'use client';

import { createBrowserClient } from '@supabase/ssr';

// This keeps auth in both localStorage and HTTP cookies that your server & middleware can read.
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    cookies: {
      // leave undefined: @supabase/ssr handles document.cookie for you on the client
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'sb-auth', // optional custom key
      flowType: 'pkce',      // good default for web apps
    },
  }
);

export default supabase;
