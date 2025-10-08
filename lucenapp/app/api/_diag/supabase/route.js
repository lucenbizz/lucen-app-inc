// app/api/_diag/supabase/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../lib/env';

function redact(s, keep = 6) {
  if (!s) return '';
  const t = String(s);
  return t.length > keep ? `${t.slice(0, keep)}…(${t.length})` : t;
}

export async function GET() {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      cache: 'no-store',
    });
    const ok = res.ok;
    const status = res.status;
    const body = await res.json().catch(() => ({}));
    return NextResponse.json({
      ok,
      status,
      body_keys: Object.keys(body || {}),
      info: {
        url: SUPABASE_URL,
        anon_key_preview: redact(SUPABASE_ANON_KEY),
      },
    }, { status: ok ? 200 : 500 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
