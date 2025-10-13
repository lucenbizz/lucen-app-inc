// app/api/my/orders/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

/* ---------- helpers ---------- */
function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function supabaseCookieName() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const m = url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  const ref = m?.[1] || 'khzbliduummbypuxqnfn';
  return `sb-${ref}-auth-token`;
}

function getAccessTokenFromCookies(store) {
  // 1) Direct server cookie set by @supabase/auth-helpers
  const direct = store.get('sb-access-token')?.value;
  if (direct) return direct;

  // 2) Browser cookie: sb-<ref>-auth-token is URL-encoded JSON: [access, refresh]
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

/* ---------- handlers ---------- */
export async function GET(req) {
  try {
    const store = cookies(); // <-- sync (do NOT await)
    const token = getAccessTokenFromCookies(store);
    if (!token) {
      return json({ ok: false, error: 'Not signed in' }, 401);
    }

    // query params
    const url = new URL(req.url);
    const rawLimit = parseInt(url.searchParams.get('limit') ?? '20', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;
    const status = url.searchParams.get('status') || null;

    const supabase = supabaseWithBearer(token);

    // With RLS, this should return only the caller's rows using auth.uid().
    let q = supabase
      .from('orders')
      .select(
        [
          'id',
          'created_at',
          'tier',
          'area_tag',
          'delivery_slot_at',
          'status',
          'price_cents',
          'customer_email',
          'assigned_to_name',
        ].join(',')
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) q = q.eq('status', status);

    const { data, error } = await q;

    // If RLS blocks, PostgREST may return an error; surface clearly
    if (error) {
      // Example: invalid JWT / RLS forbidden
      const code = error.code || 'POSTGREST_ERROR';
      const http = code === 'PGRST301' ? 401 : 403; // heuristic; adjust if you prefer
      return json({ ok: false, error: error.message, code }, http);
    }

    return json({ ok: true, count: data?.length ?? 0, items: data ?? [] }, 200);
  } catch (e) {
    return json({ ok: false, error: e?.message || 'Failed to load orders' }, 500);
  }
}

export async function POST() {
  return NextResponse.json({ ok: false, error: 'Method Not Allowed' }, { status: 405 });
}
