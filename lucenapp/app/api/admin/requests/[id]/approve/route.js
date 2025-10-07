// app/api/admin/requests/[id]/approve/route.js
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

function getErrorMessage(err) {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  try { return JSON.stringify(err); } catch { return String(err); }
}

export async function POST(req, { params }) {
  try {
    const id = params && params.id;
    if (!id) return jsonError('Missing id');

    let body = {};
    try { body = await req.json(); } catch {}
    const note = typeof body.note === 'string' ? body.note : null;

    const store = await cookies();
    const token = store.get(supabaseCookieName())?.value || '';
    const supabase = supabaseWithBearer(token);

    const { error } = await supabase.rpc('approve_delivery_request', {
      p_id: id,
      p_note: note,
    });

    if (error) {
      const msg = getErrorMessage(error);
      if (/not authorized|permission|forbidden/i.test(msg)) return jsonError('Forbidden', 403);
      return jsonError(msg || 'Failed to approve', 500);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(getErrorMessage(e) || 'Unexpected error', 500);
  }
}
