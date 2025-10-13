// app/api/areas/[tag]/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function json(data, status = 200) { return NextResponse.json(data, { status }); }

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * GET /api/areas/[tag]?fields=basic|all
 * - basic: { tag, name, active }
 * - all:   { tag, name, active }
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
      .select('tag,name,active')
      .eq('tag', tag)
      .maybeSingle();

    if (error) return json({ ok: false, error: error.message }, 500);
    if (!data?.tag) return json({ ok: false, error: 'Not found' }, 404);

    const item = {
      tag: data.tag,
      name: data.name ?? String(data.tag),
      active: typeof data.active === 'boolean' ? data.active : true,
    };

    // Same shape for both modes (you can expand here later if needed)
    return json({ ok: true, item }, 200);
  } catch (e) {
    return json({ ok: false, error: e?.message || 'Unexpected error' }, 500);
  }
}

export async function POST() {
  return NextResponse.json({ ok: false, error: 'Method Not Allowed' }, { status: 405 });
}
