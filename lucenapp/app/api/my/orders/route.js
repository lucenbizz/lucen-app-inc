// app/api/my/orders/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

/* ---------- helpers ---------- */
function supabaseCookieName() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const m = url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  const ref = m?.[1] || 'khzbliduummbypuxqnfn';
  return `sb-${ref}-auth-token`;
}

function getAccessTokenFromCookies(store) {
  // Preferred (server-side helper cookie)
  const direct = store.get('sb-access-token')?.value;
  if (direct) return direct;

  // Fallback: browser cookie sb-<ref>-auth-token = URL-encoded JSON [access, refresh]
  const comboRaw = store.get(supabaseCookieName())?.value;
  if (comboRaw) {
    try {
      const decoded = decodeURIComponent(comboRaw);
      const arr = JSON.parse(decoded);
      if (Array.isArray(arr) && typeof arr[0] === 'string' && arr[0]) {
        return arr[0];
      }
    } catch { /* ignore parse errors */ }
  }
  return null;
}

function supabaseWithBearer(token) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return createClient(url, anon, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

/* ---------- handler ---------- */
export async function GET(req) {
  try {
    const store = cookies(); // <-- sync (do not await)
    const token = getAccessTokenFromCookies(store);
    if (!token) return json({ ok: false, error: 'Not signed in' }, 401);

    const url = new URL(req.url);
    const rawLimit = parseInt(url.searchParams.get('limit') || '100', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 100;
    const status = url.searchParams.get('status') || null;

    const supabase = supabaseWithBearer(token);

    // RLS should restrict to auth.uid() rows; select only what you need
    let q = supabase
      .from('orders')
      .select(
        'id, created_at, tier, area_tag, delivery_slot_at, status, price_cents, customer_email, assigned_to_name'
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) q = q.eq('status', status);

    const { data, error } = await q;

    if (error?.code === 'PGRST301' || error?.code === 'PGRST302') {
      // common RLS / permission errors
      return json({ ok: false, error: error.message }, 403);
    }
    if (error) return json({ ok: false, error: error.message }, 500);

    return json({ ok: true, count: data?.length || 0, items: data || [] }, 200);
  } catch (e) {
    return json({ ok: false, error: e?.message || 'Failed to load orders' }, 500);
  }
}

export async function POST() {
  // If POST isn't supported, be explicit rather than 500-ing
  return NextResponse.json({ ok: false, error: 'Method Not Allowed' }, { status: 405 });
}
