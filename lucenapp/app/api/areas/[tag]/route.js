// app/api/areas/[tag]/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function json(d, s = 200) { return NextResponse.json(d, { status: s }); }
function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function GET(_req, { params }) {
  try {
    const tag = params?.tag?.toString() || '';
    if (!tag) return json({ ok: false, error: 'tag required' }, 422);

    const supabase = supabaseAnon();
    const { data, error } = await supabase
      .from('areas')
      .select('tag,name,display_name,active,*')
      .eq('tag', tag)
      .maybeSingle();

    if (error) return json({ ok: false, error: error.message }, 500);
    if (!data) return json({ ok: false, error: 'Not found' }, 404);

    return json({ ok: true, item: data }, 200);
  } catch (e) {
    return json({ ok: false, error: e?.message || 'Unexpected error' }, 500);
  }
}
