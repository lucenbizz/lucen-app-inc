// app/auth/callback/page.jsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function CallbackPage() {
  return (
    <Suspense fallback={<Loader />}>
      <CallbackInner />
    </Suspense>
  );
}

function CallbackInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Processing sign-in…');

  const redirectTo = sp.get('redirect') || '/dashboard';
  const code = sp.get('code');
  const ref = sp.get('ref');
  const sref = sp.get('sref');

  const supabase = useMemo(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON) return null;
    return createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!supabase) throw new Error('Missing Supabase env');
        if (!code) throw new Error('No auth code found');

        setStatus('Exchanging code for session…');
        const { data, error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) throw exErr;
        const session = data?.session;
        if (!session?.access_token || !session?.refresh_token) throw new Error('No session tokens returned');

        setStatus('Finalizing session…');
        await syncCookies({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
        });

        // Attach referral (customer) if present
        if (ref) {
          await fetch('/api/referrals/attach', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ code: ref }),
          });
        }

        // Accept staff invite if present
        if (sref) {
          await fetch('/api/invite-staff/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ code: sref }),
          });
        }

        const clean = window.location.pathname + (redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : '');
        window.history.replaceState({}, '', clean);
        router.replace(redirectTo);
      } catch (e) {
        setError(e.message || 'Sign-in failed');
        setStatus('');
      }
    })();
  }, [code, redirectTo, ref, router, sref, supabase]);

  return (
    <main className="min-h-[70vh] grid place-items-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-amber-500/25 bg-black/40 p-6 text-amber-50">
        <h1 className="text-lg font-semibold mb-2">Signing you in…</h1>
        {status && <p className="text-sm text-amber-200/80 mb-3">{status}</p>}
        {error && <p className="text-sm text-rose-300">{error}</p>}
      </div>
    </main>
  );
}

async function syncCookies({ access_token, refresh_token, expires_at }) {
  const res = await fetch('/api/auth/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ access_token, refresh_token, expires_at }),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
}

function Loader() {
  return (
    <main className="min-h-[70vh] grid place-items-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-amber-500/25 bg-black/40 p-6 text-amber-50">
        <h1 className="text-lg font-semibold mb-2">Signing you in…</h1>
        <p className="text-sm text-amber-200/80">Please wait.</p>
      </div>
    </main>
  );
}
