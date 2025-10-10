// app/api/areas/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/** Helpers */
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

/** GET /api/areas
 * Query:
 *   - fields=basic|full   (default basic)
 *   - active=true|false|all (default true)
 *   - q=search text       (optional)
 *   - limit=1..500        (default 200)
 *
 * Responses:
 *   { items: [{ tag, name }] }                       // fields=basic
 *   { items: [{ tag, name, state, center_lat, center_lng, radius_km, active }] } // fields=full
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const fields = (searchParams.get('fields') || 'basic').toLowerCase();
    const activeParam = searchParams.get('active'); // 'true' | 'false' | 'all'
    const limit = safeInt(searchParams.get('limit'), 200, 1, 500);
    const q = (searchParams.get('q') || '').trim();

    const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonError('Server missing Supabase env', 500);
    }

    // Plain anon client — relies on RLS to allow anon+authenticated SELECT active=true
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const fullCols = 'tag, name, state, center_lat, center_lng, radius_km, active';
    const basicCols = 'tag, name';
    const cols = fields === 'full' ? fullCols : basicCols;

    let qy = supabase
      .from('areas')
      .select(cols)
      .order('state', { ascending: true })
      .order('name', { ascending: true })
      .limit(limit);

    if (activeParam !== 'all') {
      qy = qy.eq('active', toBool(activeParam, true));
    }

    if (q) {
      qy = qy.or(`tag.ilike.%${q}%,name.ilike.%${q}%`);
    }

    const { data, error } = await qy;
    if (error) return jsonError(error.message || 'Failed to load areas', 500);

    if (fields === 'full') {
      return NextResponse.json({ items: data || [] });
    }
    return NextResponse.json({
      items: (data || []).map((r) => ({ tag: r.tag, name: r.name })),
    });
  } catch (e) {
    return jsonError((e && e.message) || 'Unexpected error', 500);
  }
}
