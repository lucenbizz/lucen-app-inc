// lib/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js';

export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !service) throw new Error('Supabase admin env missing');
  return createClient(url, service); // bypasses RLS for server jobs (webhooks)
}
