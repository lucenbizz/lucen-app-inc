// app/api/requests/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Helpers
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
function isIsoDate(s) {
  if (!s || typeof s !== 'string') return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}
function enforce20MinIncrement(iso) {
  const d = new Date(iso);
  const mins = d.getUTCMinutes();
  const secs = d.getUTCSeconds();
  const ms = d.getUTCMilliseconds();
  return mins % 20 === 0 && secs === 0 && ms === 0;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const area_tag = (body.area_tag || '').trim();
    const delivery_slot_at = body.delivery_slot_at;
    const notes = (body.notes || '').toString().slice(0, 1000);

    if (!area_tag) return jsonError('area_tag is required');
    if (!isIsoDate(delivery_slot_at))
      return jsonError('delivery_slot_at must be an ISO datetime');
    if (!enforce20MinIncrement(delivery_slot_at))
      return jsonError('Slot must be on a 20-minute boundary (e.g., 10:00, 10:20, 10:40)');

    const store = await cookies();
    const token = store.get(supabaseCookieName())?.value || '';
    const supabase = supabaseWithBearer(token);

    // Who is this?
    const { data: me, error: meErr } = await supabase.auth.getUser();
    if (meErr || !me?.user?.id) return jsonError('Not signed in', 401);
    const uid = me.user.id;

    // Insert request (RLS allows customer to insert their own)
    const insert = {
      customer_id: uid,
      area_tag,
      delivery_slot_at: new Date(delivery_slot_at).toISOString(),
      notes: notes || null,
    };

    const { data, error } = await supabase
      .from('delivery_requests')
      .insert(insert)
      .select('id')
      .single();

    if (error) {
      // Unique index duplicate (same customer/area/slot)
      if (error.code === '23505') {
        return jsonError('You already submitted a request for this area and time.', 409);
      }
      return jsonError(error.message || 'Failed to submit request', 500);
    }

    return NextResponse.json({ id: data.id, ok: true });
  } catch (e) {
    return jsonError(e.message || 'Unexpected error', 500);
  }
}
