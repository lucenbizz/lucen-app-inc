// app/api/admin/requests/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

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

function getErrorCode(err) {
  return err && typeof err === 'object' && 'code' in err ? err.code : undefined;
}

function getErrorMessage(err) {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  try { return JSON.stringify(err); } catch { return String(err); }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get('status') || 'pending').toLowerCase();
    const limitRaw = parseInt(searchParams.get('limit') || '100', 10);
    const limit = Math.min(Math.max(Number.isNaN(limitRaw) ? 100 : limitRaw, 1), 500);

    const store = await cookies();
    const token = store.get(supabaseCookieName())?.value || '';
    const supabase = supabaseWithBearer(token);

    let q = supabase
      .from('delivery_requests')
      .select('id, customer_id, area_tag, delivery_slot_at, status, notes, approved_by, approved_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') q = q.eq('status', status);

    const { data, error } = await q;
    if (error) {
      const code = getErrorCode(error);
      const msg = getErrorMessage(error);
      if (code === '42501' || /forbidden|permission/i.test(msg)) return jsonError('Forbidden', 403);
      return jsonError(msg || 'Failed to list requests', 500);
    }

    return NextResponse.json({ items: data || [] });
  } catch (e) {
    return jsonError(getErrorMessage(e) || 'Unexpected error', 500);
  }
}
