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
    'khzbliduummbypuxqnfn';
  return `sb-${ref}-auth-token`;
}

// Safely extract an access token from cookies (supports both schemes)
function getAccessTokenFromCookies(store) {
  // 1) Newer helper cookies (server-side)
  const direct = store.get('sb-access-token')?.value;
  if (direct) return direct;

  // 2) Browser cookie: sb-<ref>-auth-token = URL-encoded JSON array [access, refresh]
  const comboRaw = store.get(supabaseCookieName())?.value;
  if (comboRaw) {
    try {
      const decoded = decodeURIComponent(comboRaw);
      const arr = JSON.parse(decoded);
      if (Array.isArray(arr) && typeof arr[0] === 'string' && arr[0]) {
        return arr[0];
      }
    } catch { /* ignore parse errors */ }
  }

  return null;
}

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET() {
  try {
    const store = cookies(); // <-- sync, do NOT await
    const token = getAccessTokenFromCookies(store);

    if (!token) {
      return json({ ok: false, error: 'Not signed in' }, 401);
    }

    const supabase = supabaseWithBearer(token);

    // With RLS (using auth.uid()) this should return the caller’s row.
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin,is_executive,is_staff')
      .single();

    // If there’s simply no row, treat as unauth (or fallback to all false)
    if (error?.code === 'PGRST116') {
      return json({ ok: true, isAdmin: false, isExecutive: false, isStaff: false }, 200);
    }
    if (error) {
      // Surface as 403 if the token is valid but RLS blocks access
      return json({ ok: false, error: error.message }, 403);
    }

    const isAdmin = !!data?.is_admin;
    const isExecutive = !!data?.is_executive;
    const isStaff = !!data?.is_staff;

    return json({ ok: true, isAdmin, isExecutive, isStaff }, 200);
  } catch (e) {
    return json({ ok: false, error: e?.message || 'Failed to get roles' }, 500);
  }
}
