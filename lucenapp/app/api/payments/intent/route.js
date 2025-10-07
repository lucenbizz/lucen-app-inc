// app/api/payments/intent/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

/** ===== Helpers ===== */
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
// must hit 20-min boundaries like :00, :20, :40 (UTC)
function enforce20MinIncrement(iso) {
  const d = new Date(iso);
  return d.getUTCMinutes() % 20 === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}
function randomId() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const a = new Uint32Array(4);
    crypto.getRandomValues(a);
    return [...a].map((x) => x.toString(16).padStart(8, '0')).join('');
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function cents(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.max(0, Math.round(x)) : 0;
}

/** ===== Handler ===== */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const area_tag = (body.area_tag || '').trim();
    const delivery_slot_at = body.delivery_slot_at;
    const cartTotalCents = cents(body.cartTotalCents);
    const reservationId = typeof body.reservationId === 'string' ? body.reservationId : null;
    const orderTempId = typeof body.orderTempId === 'string' ? body.orderTempId : null;

    if (!area_tag) return jsonError('area_tag is required');
    if (!isIsoDate(delivery_slot_at)) return jsonError('delivery_slot_at must be an ISO datetime');
    if (!enforce20MinIncrement(delivery_slot_at))
      return jsonError('Slot must be on a 20-minute boundary (e.g., 10:00, 10:20, 10:40)');
    if (!cartTotalCents) return jsonError('cartTotalCents is required');

    // Identify user
    const store = await cookies();
    const token = store.get(supabaseCookieName())?.value || '';
    const supabase = supabaseWithBearer(token);

    const { data: me, error: meErr } = await supabase.auth.getUser();
    if (meErr || !me?.user?.id) return jsonError('Not signed in', 401);
    const uid = me.user.id;

    // 1) HARD GATE: must be validated for this area & slot
    const origin = process.env.NEXT_PUBLIC_APP_ORIGIN || req.nextUrl.origin;
    const valRes = await fetch(`${origin}/api/areas/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ area_tag, delivery_slot_at }),
    });
    if (!valRes.ok) {
      let msg = 'Delivery not available yet';
      try {
        const j = await valRes.json();
        if (j && j.error) msg = j.error;
      } catch {}
      return jsonError(msg, 409);
    }
    const val = await valRes.json();
    if (!val?.ok) {
      return jsonError(val?.error || 'Delivery not available yet', 409);
    }

    // 2) If customer reserved loyalty points, verify non-expired & compute discount
    let discountCents = 0;
    if (reservationId) {
      const { data: rsv, error: rErr } = await supabase
        .from('loyalty_reservations')
        .select('id, user_id, value_cents, expires_at, committed_at, order_temp_id')
        .eq('id', reservationId)
        .single();

      if (rErr) return jsonError(rErr.message || 'Failed to check reservation', 500);

      // Must be this user, not expired, not already committed, and match this order temp id (if provided)
      const now = Date.now();
      const expMs = rsv?.expires_at ? new Date(rsv.expires_at).getTime() : 0;
      if (!rsv || rsv.user_id !== uid) return jsonError('Reservation does not belong to you', 403);
      if (!expMs || expMs <= now) return jsonError('Reservation expired', 409);
      if (rsv.committed_at) return jsonError('Reservation already used', 409);
      if (orderTempId && rsv.order_temp_id && rsv.order_temp_id !== orderTempId) {
        return jsonError('Reservation order mismatch', 409);
      }

      discountCents = cents(rsv.value_cents);
    }

    const amountCents = Math.max(0, cartTotalCents - discountCents);

    // 3) Create payment intent (DEMO provider). Real provider wiring can replace this.
    const pi = `pi_${randomId()}`;
    const clientSecret = `demo_${pi}_${randomId()}`;

    // (Optional) You could persist a "pending charge" row here with the validation reason
    // and the computed net amount. The actual commit happens in your webhook after capture.

    return NextResponse.json({
      provider: 'demo',
      amountCents,
      paymentIntentId: pi,
      clientSecret,
      // surface useful echo:
      area_tag,
      delivery_slot_at,
      validation: val?.reason || 'validated',
      discountCents,
      orderTempId: orderTempId || null,
    });
  } catch (e) {
    const msg = (e && e.message) || 'Unexpected error';
    return jsonError(msg, 500);
  }
}
