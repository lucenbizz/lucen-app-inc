// app/api/loyalty/reserve/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

/** ---- config ---- */
const RESERVE_TTL_SECONDS = 120;   // reservation holds for 2 minutes
const REDEEM_STEP = 500;           // redeem in 500-pt steps (adjust if you changed it)
const VALUE_CENTS_PER_POINT = 0.5; // 1,000 pts = $5.00 => 0.5 cents per point

/** ---- helpers ---- */
function supabaseCookieName() {
  const ref =
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
      .match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1] || 'khzbliduummbypuxqnfn';
  return `sb-${ref}-auth-token`;
}
function supabaseWithBearer(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      auth: { persistSession: false, autoRefreshToken: false } }
  );
}
function jsonError(msg, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}
function isPositiveInt(n) {
  return Number.isInteger(n) && n > 0;
}
function toInt(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : 0;
}
function floorToStep(points, step) {
  return Math.floor(points / step) * step;
}

/** ---- GET user points balance ----
 * Tries loyalty_balances first, then falls back to summing loyalty_events(points_delta)
 */
async function getPointsBalance(supabase, uid) {
  // balances table
  try {
    const { data, error } = await supabase
      .from('loyalty_balances')
      .select('points_balance')
      .eq('user_id', uid)
      .limit(1);
    if (!error && Array.isArray(data) && data.length) {
      return toInt(data[0].points_balance || 0);
    }
  } catch {}
  // fallback: sum events
  try {
    const { data, error } = await supabase
      .from('loyalty_events')
      .select('points_delta')
      .eq('user_id', uid);
    if (!error && Array.isArray(data)) {
      return data.reduce((sum, r) => sum + toInt(r.points_delta || 0), 0);
    }
  } catch {}
  return 0;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderTempId = (body.orderTempId || '').toString().slice(0, 128);
    const requestedPoints = toInt(body.requestedPoints);
    const priceCents = toInt(body.priceCents);

    if (!orderTempId) return jsonError('orderTempId is required');
    if (!isPositiveInt(requestedPoints)) return jsonError('requestedPoints must be a positive integer');
    if (priceCents <= 0) return jsonError('priceCents must be > 0');

    const store = await cookies();
    const token = store.get(supabaseCookieName())?.value || '';
    const supabase = supabaseWithBearer(token);

    const { data: me, error: meErr } = await supabase.auth.getUser();
    if (meErr || !me?.user?.id) return jsonError('Not signed in', 401);
    const uid = me.user.id;

    // fetch balance
    const balance = await getPointsBalance(supabase, uid);

    // compute max redeemable by cart total (can't reduce below $0)
    // points <= (cartTotalCents / valuePerPointInCents)
    const maxByCart = Math.floor(priceCents / VALUE_CENTS_PER_POINT); // e.g. $10000 / 0.5 = 20000 pts
    // clamp by balance and step
    const maxRedeemable = floorToStep(Math.max(0, Math.min(balance, maxByCart)), REDEEM_STEP);

    if (maxRedeemable <= 0) {
      return jsonError('No redeemable points for this cart', 409);
    }

    // round requested to step and clamp
    let pointsReserved = floorToStep(requestedPoints, REDEEM_STEP);
    if (pointsReserved <= 0) pointsReserved = REDEEM_STEP;
    if (pointsReserved > maxRedeemable) pointsReserved = maxRedeemable;

    const valueCents = Math.floor(pointsReserved * VALUE_CENTS_PER_POINT); // integer cents
    const expiresAt = new Date(Date.now() + RESERVE_TTL_SECONDS * 1000).toISOString();

    // Clear any existing uncommitted reservation for this (user, orderTempId)
    await supabase
      .from('loyalty_reservations')
      .delete()
      .eq('user_id', uid)
      .eq('order_temp_id', orderTempId)
      .is('committed_at', null);

    // Insert new reservation
    const { data: inserted, error: insErr } = await supabase
      .from('loyalty_reservations')
      .insert({
        user_id: uid,
        order_temp_id: orderTempId,
        points_reserved: pointsReserved,
        value_cents: valueCents,
        expires_at: expiresAt,
        committed_at: null,
      })
      .select('id, expires_at')
      .single();

    if (insErr) {
      // table missing or RLS blocking
      return jsonError(insErr.message || 'Failed to reserve points', 500);
    }

    return NextResponse.json({
      reservationId: inserted.id,
      pointsReserved,
      valueCents,
      expiresAt: inserted.expires_at || expiresAt,
    });
  } catch (e) {
    return jsonError((e && e.message) || 'Unexpected error', 500);
  }
}
