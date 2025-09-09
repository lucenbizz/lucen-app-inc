export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  try {
    const supa = admin();
    const tables = ['plans','ebooks','delivery_slots','bookings'];
    const results = {};
    for (const t of tables) {
      const { error, count } = await supa.from(t).select('*', { head: true, count: 'exact' });
      results[t] = error ? { ok:false, error: error.message } : { ok:true, count };
    }
    return NextResponse.json({ ok:true, results });
  } catch (e) {
    return NextResponse.json({ ok:false, error: String(e?.message || e) }, { status: 500 });
  }
}
