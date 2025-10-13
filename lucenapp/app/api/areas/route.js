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
    const { data, error } = await supabase
      .from('areas')
      .select(fields === 'all' ? '*' : 'tag,name,active')
      .order('name', { ascending: true })
      .limit(limit);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    let items = Array.isArray(data) ? data : [];

    // Normalize shape
    items = items.map(a => ({
      tag: String(a.tag),
      name: a.name ?? String(a.tag),
      active: typeof a.active === 'boolean' ? a.active : true,
      ...(fields === 'all' ? { active_raw: a.active } : {}),
    }));

    // Apply active filter if requested
    if (wantActive !== null) {
      items = items.filter(a => a.active === wantActive);
    }

    // Trim to basic shape if requested
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
