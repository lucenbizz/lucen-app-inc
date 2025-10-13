// app/api/areas/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * GET /api/areas?fields=basic|all&active=true|false&limit=50
 * Returns: { items: [...] }
 *
 * - fields=basic -> tag, name (and display_name if present)
 * - fields=all   -> *
 * - active=true  -> filters to active areas *if column exists* (otherwise we filter in JS)
 */
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const fields = (url.searchParams.get('fields') || 'basic').toLowerCase();
    const activeParam = url.searchParams.get('active');
    const wantActive = activeParam == null ? null : /^(1|true|yes)$/i.test(activeParam);
    const rawLimit = parseInt(url.searchParams.get('limit') ?? '100', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 100;

    const supabase = supabaseAnon();

    // Pick columns
    let columns;
    if (fields === 'all') {
      columns = '*';
    } else {
      // keep it small; include display_name if your table has it
      columns = 'tag,name,display_name,active';
    }

    // Do a broad select; we’ll JS-filter active if the column exists
    const { data, error } = await supabase
      .from('areas')
      .select(columns)
      .order('name', { ascending: true })
      .limit(limit);

    if (error) return json({ ok: false, error: error.message }, 500);

    let items = Array.isArray(data) ? data : [];

    // If caller asked for active=true/false and we have an 'active' field, filter in JS.
    if (wantActive !== null && items.length && Object.hasOwn(items[0], 'active')) {
      items = items.filter(a => !!a.active === wantActive);
    }

    // Trim to "basic" if caller asked for basic but table returned extra
    if (fields !== 'all') {
      items = items.map(a => ({
        tag: a.tag,
        name: a.name ?? a.display_name ?? a.tag,
        active: Object.hasOwn(a, 'active') ? !!a.active : true,
      }));
    }

    return json({ ok: true, items }, 200);
  } catch (e) {
    return json({ ok: false, error: e?.message || 'Failed to list areas' }, 500);
  }
}

export async function POST() {
  return NextResponse.json({ ok: false, error: 'Method Not Allowed' }, { status: 405 });
}
