// lib/supabaseServiceClient.js (SERVER ONLY)
import { createClient } from '@supabase/supabase-js';

export function createServiceClient() {
  if (typeof window !== 'undefined') {
    throw new Error('Service client must not be used in the browser');
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

