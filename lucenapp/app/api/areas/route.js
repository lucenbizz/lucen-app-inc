// app/api/areas/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

/** ===== Helpers ===== */
function supabaseCookieName() {
  const ref =
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(
      /^https?:\/\/([a-z0-9-]+)\.supabase\.co/i
    )?.[1] || 'khzbliduummbypuxqnfn';
  return `sb-${ref}-auth-token`;
}
function supabaseWithBearer(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
function jsonError(msg, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}
function toBool(v, dflt = true) {
  if (v === null || v === undefined) return dflt;
  const s = String(v).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'off'].includes(s)) return false;
  return dflt;
}
function safeInt(v, dflt, min, max) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}

/** ===== GET /api/areas =====
 * Query params:
 *   - fields=basic|full  (default basic)
 *   - active=true|false|all (default true)
 *   - q=search text (optional)
 *   - limit=1..500 (default 200)
 *
 * Responses:
 *   { items: [{ tag, name }] }              // fields=basic (default)
 *   { items: [{ tag, name, state, center_lat, center_lng, radius_km, active }] } // fields=full
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const fields = (searchParams.get('fields') || 'basic').toLowerCase();
    const activeParam = searchParams.get('active'); // 'true' | 'false' | 'all'
    const limit = safeInt(searchParams.get('limit'), 200, 1, 500);
    const q = (searchParams.get('q') || '').trim();

    // Require auth (RLS policy is `to authenticated using (true)`)
    const store = await cookies();
    const token = store.get(supabaseCookieName())?.value || '';
    const supabase = supabaseWithBearer(token);

    const { data: me, error: meErr } = await supabase.auth.getUser();
    if (meErr || !me?.user?.id) return jsonError('Not signed in', 401);

    // Columns to fetch
    const fullCols = 'tag, name, state, center_lat, center_lng, radius_km, active';
    const basicCols = 'tag, name';
    const cols = fields === 'full' ? fullCols : basicCols;

    let qy = supabase
      .from('areas')
      .select(cols)
      .order('state', { ascending: true })
      .order('name', { ascending: true })
      .limit(limit);

    // Active filter (default true). If active=all → no filter.
    if (activeParam !== 'all') {
      qy = qy.eq('active', toBool(activeParam, true));
    }

    // Simple search over tag/name if provided
    if (q) {
      // Supabase supports `or()` with ilike on both columns
      qy = qy.or(`tag.ilike.%${q}%,name.ilike.%${q}%`);
    }

    const { data, error } = await qy;
    if (error) return jsonError(error.message || 'Failed to load areas', 500);

    // Ensure basic payload shape if fields=basic
    if (fields !== 'full') {
      const items = (data || []).map((r) => ({ tag: r.tag, name: r.name }));
      return NextResponse.json({ items });
    }

    return NextResponse.json({ items: data || [] });
  } catch (e) {
    const msg = (e && e.message) || 'Unexpected error';
    return jsonError(msg, 500);
  }
}
