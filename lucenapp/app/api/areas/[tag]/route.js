// app/api/areas/[tag]/route.js
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
 * GET /api/areas/[tag]?fields=basic|all
 * 
 * - fields=basic (default): returns { tag, name, active }
 * - fields=all: returns { tag, name, state, active }
 */
export async function GET(req, { params }) {
  try {
    const tag = params?.tag?.toString() || '';
    if (!tag) return json({ ok: false, error: 'tag required' }, 422);

    const url = new URL(req.url);
    const fields = (url.searchParams.get('fields') || 'basic').toLowerCase();

    const sb = supabaseAnon();
    const { data, error } = await sb
      .from('areas')
      .select('tag,name,state')
      .eq('tag', tag)
      .maybeSingle();

    if (error) return json({ ok: false, error: error.message }, 500);
    if (!data?.tag) return json({ ok: false, error: 'Not found' }, 404);

    const active = (data.state ?? '').toString().toLowerCase() === 'active';

    const item =
      fields === 'all'
        ? { tag: data.tag, name: data.name ?? String(data.tag), state: data.state, active }
        : { tag: data.tag, name: data.name ?? String(data.tag), active };

    return json({ ok: true, item }, 200);
  } catch (e) {
    return json({ ok: false, error: e?.message || 'Unexpected error' }, 500);
  }
}

export async function POST() {
  return NextResponse.json({ ok: false, error: 'Method Not Allowed' }, { status: 405 });
}
