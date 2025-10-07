// app/api/my/orders/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Derive the sb-<ref>-auth-token cookie name from your Supabase URL
function supabaseCookieName() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const m = url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  const ref = m?.[1] || 'khzbliduummbypuxqnfn'; // fallback to your ref
  return `sb-${ref}-auth-token`;
}

// Create a Supabase client that forwards the user's JWT to PostgREST (RLS will do the filtering)
function supabaseWithBearer(token) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return createClient(url, anon, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(req) {
  try {
    // ✅ Next 15: cookies() must be awaited
    const store = await cookies();
    const token = store.get(supabaseCookieName())?.value || '';

    // optional query params
    const url = new URL(req.url);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 100)));
    const status = url.searchParams.get('status') || null;

    const supabase = supabaseWithBearer(token);

    // RLS should restrict to the current user; we just select needed fields
    let q = supabase
      .from('orders')
      .select('id, created_at, tier, area_tag, delivery_slot_at, status, price_cents, customer_email, assigned_to_name')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ items: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed to load orders' }, { status: 500 });
  }
}
