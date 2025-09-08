// app/api/bookings/create/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getSupabaseRouteClient } from '../../../lib/supabaseServerClient';

export async function POST(req) {
  const supabase = getSupabaseRouteClient();

  // Must be signed in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Read payload
  let payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Example fields – adjust to your schema
  const row = {
    user_id: user.id,               // rely on RLS to enforce this
    slot_time: payload.slot_time,   // e.g. ISO string
    notes: payload.notes ?? null,
    status: 'pending',
  };

  const { data, error } = await supabase
    .from('bookings')
    .insert(row)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
