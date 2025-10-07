// /app/api/delivery-requests/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { tier, delivery_slot_at, area_tag, address, notes } = body || {};
  if (!tier) return NextResponse.json({ error: 'tier required' }, { status: 400 });

  const { data, error } = await supabase.from('delivery_requests').insert({
    customer_user_id: session.user.id,
    tier,
    delivery_slot_at: delivery_slot_at || null,
    area_tag: area_tag || null,
    address: address || null,
    notes: notes || null,
    status: 'pending'
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  try {
    await supabase.from('audit_log').insert({
      actor_id: session.user.id,
      action: 'delivery.request.create',
      meta: body
    });
  } catch {}

  return NextResponse.json({ ok: true, requestId: data.id });
}
