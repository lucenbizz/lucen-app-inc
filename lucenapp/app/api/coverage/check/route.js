// app/api/coverage/check/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function jsonError(msg, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req) {
  try {
    const { area_tag, delivery_slot_at } = await req.json();
    if (!area_tag) return jsonError('area_tag required');
    if (!delivery_slot_at) return jsonError('delivery_slot_at required');

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return jsonError('server missing supabase env', 500);

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    // Basic check: area exists and is active (anon policy must allow select active=true)
    const { data: area, error } = await supabase
      .from('areas')
      .select('tag, active')
      .eq('tag', area_tag)
      .eq('active', true)
      .maybeSingle();
    if (error) return jsonError(error.message, 500);
    if (!area) return jsonError('No active coverage for this area', 404);

    // You can add additional soft rules here if needed…
    return NextResponse.json({ ok: true, reason: 'area_active' });
  } catch (e) {
    return jsonError(e?.message || 'unexpected error', 500);
  }
}

