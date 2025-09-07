// app/lib/supabaseClient.js
'use client';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'sb-auth', // optional custom key
    },
    // optional tuning for realtime client on the browser
    realtime: {
      params: { eventsPerSecond: 3 },
    },
  }
);

export default supabase;
