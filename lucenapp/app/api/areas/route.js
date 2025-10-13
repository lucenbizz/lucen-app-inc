// app/api/areas/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const fields = (url.searchParams.get('fields') || 'basic').toLowerCase();
    const activeParam = url.searchParams.get('active');
    const wantActive = activeParam == null ? null : /^(1|true|yes)$/i.test(activeParam);
    const rawLimit = parseInt(url.searchParams.get('limit') ?? '100', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 100;

    const supabase = supabaseAnon();

    // Select a conservative set of columns that are likely to exist.
    // (No display_name here, since your table doesn’t have it.)
    const selectCols = fields === 'all'
      ? '*'
      : 'tag,name,active';

    const { data, error } = await supabase
      .from('areas')
      .select(selectCols)
      .order('name', { ascending: true })
      .limit(limit);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    let items = Array.isArray(data) ? data : [];

    // JS-filter active if requested and column exists
    if (wantActive !== null && items.length && Object.hasOwn(items[0], 'active')) {
      items = items.filter(a => !!a.active === wantActive);
    }

    // When fields=basic, trim to a small shape with robust fallbacks for name.
    if (fields !== 'all') {
      items = items.map(a => ({
        tag: a.tag,
        // fallbacks in case your schema uses a different label column
        name: a.name ?? a.title ?? a.label ?? a.tag,
        active: Object.hasOwn(a, 'active') ? !!a.active : true,
      }));
    }

    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to list areas' }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ ok: false, error: 'Method Not Allowed' }, { status: 405 });
}
