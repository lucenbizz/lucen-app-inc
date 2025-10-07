// app/api/auth/roles/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Build a Supabase client that forwards the user's JWT (from cookie) to PostgREST
function supabaseWithBearer(token) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return createClient(url, anon, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Derive the sb-<ref>-auth-token cookie name from your SUPABASE URL
function supabaseCookieName() {
  const ref =
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
      .match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1] ||
    'khzbliduummbypuxqnfn'; // fallback if env missing
  return `sb-${ref}-auth-token`;
}

export async function GET() {
  try {
    // ✅ Next 15: cookies() must be awaited
    const store = await cookies();
    const token = store.get(supabaseCookieName())?.value || '';

    const supabase = supabaseWithBearer(token);

    // Adjust this SELECT to your schema. Examples:
    // - profiles: is_admin, is_executive, is_staff
    // - user_roles view: is_admin, is_executive, is_staff
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin,is_executive,is_staff')
      .single();

    if (error && error.code !== 'PGRST116') throw error; // ignore "no rows" as not logged in

    const isAdmin = !!data?.is_admin;
    const isExecutive = !!data?.is_executive;
    const isStaff = !!data?.is_staff;

    // If no row (not signed in), all false → treated as customer on the client
    return NextResponse.json({ isAdmin, isExecutive, isStaff });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed to get roles' }, { status: 500 });
  }
}
