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
    const rawLimit = parseInt(url.searchParams.get('limit') ?? '200', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 200;

    const supabase = supabaseAnon();
    const selectCols = fields === 'all' ? '*' : 'tag,name,state';

    const { data, error } = await supabase
      .from('areas')
      .select(selectCols)
      .order('name', { ascending: true })
      .limit(limit);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    let items = Array.isArray(data) ? data : [];

    // Map to a consistent shape
    items = items.map((a) => {
      const active = (a.state ?? '').toString().toLowerCase() === 'active';
      return {
        tag: String(a.tag),
        name: a.name ?? String(a.tag),
        active,
        ...(fields === 'all' ? { state: a.state } : {}),
      };
    });

    // If active filter requested, apply it
    if (wantActive !== null) {
      items = items.filter((a) => a.active === wantActive);
    }

    // Trim to basic if requested
    if (fields !== 'all') {
      items = items.map(({ tag, name, active }) => ({ tag, name, active }));
    }

    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to list areas' }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ ok: false, error: 'Method Not Allowed' }, { status: 405 });
}
