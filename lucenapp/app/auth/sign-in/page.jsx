// app/auth/sign-in/page.jsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const BG = '#0b0b0c';
const EDGE_GLOW = 'rgba(245, 158, 11, .25)';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const OAUTH_PROVIDERS = [
  { key: 'google', label: 'Continue with Google' },
  { key: 'apple',  label: 'Continue with Apple'  },
];

export default function SignInPage() {
  return (
    <Suspense fallback={<Loader />}>
      <SignInInner />
    </Suspense>
  );
}

function SignInInner() {
  const sp = useSearchParams();
  const redirectTo = sp.get('redirect') || '/dashboard';
  const refCode = sp.get('ref') || '';
  const staffCode = sp.get('sref') || '';
  const [email, setEmail] = useState(sp.get('email') || '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const supabase = useMemo(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON) return null;
    return createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }, []);

  useEffect(() => {
    if (!supabase && typeof window !== 'undefined') {
      setError('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    }
  }, [supabase]);

  function buildCallback() {
    const u = new URL('/auth/callback', window.location.origin);
    if (redirectTo) u.searchParams.set('redirect', redirectTo);
    if (refCode)   u.searchParams.set('ref', refCode);
    if (staffCode) u.searchParams.set('sref', staffCode);
    return u.toString();
  }

  async function sendMagicLink(e) {
    e.preventDefault();
    if (!supabase) return;
    setSending(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: buildCallback() },
      });
      if (err) throw err;
      setSent(true);
    } catch (e2) {
      setError(e2.message || 'Unable to send magic link');
    } finally {
      setSending(false);
    }
  }

  async function oauthSignIn(provider) {
    if (!supabase) return;
    setError('');
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: buildCallback(), queryParams: {} },
      });
      if (err) throw err;
    } catch (e2) {
      setError(e2.message || 'OAuth sign-in failed');
    }
  }

  return (
    <main className="min-h-[100dvh] text-slate-100 grid place-items-center px-6" style={{ backgroundColor: BG }}>
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundSize: '40px 40px',
          backgroundImage:
            'linear-gradient(to right, #ffffff14 1px, transparent 1px),\
             linear-gradient(to bottom, #ffffff14 1px, transparent 1px)',
        }}/>
      </div>

      <div className="w-full max-w-md relative rounded-2xl border p-6"
           style={{
             borderColor: 'rgba(255,255,255,0.08)',
             background: 'linear-gradient(180deg, rgba(0,0,0,.45), rgba(0,0,0,.35))',
             boxShadow: `0 10px 40px -10px ${EDGE_GLOW}`,
           }}>
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
          <p className="text-amber-300/80 text-sm mt-1">Use a magic link or continue with a provider.</p>
          {(refCode || staffCode) && (
            <p className="text-xs text-amber-200/80 mt-2">
              {refCode && <>Referral: <strong>{refCode}</strong>{' '}</>}
              {staffCode && <>Staff invite: <strong>{staffCode}</strong></>}
            </p>
          )}
        </header>

        <form onSubmit={sendMagicLink} className="space-y-3">
          <label className="block text-sm text-amber-200">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl bg-black/40 border border-amber-500/30 px-3 py-2 outline-none focus:border-amber-400/70"
          />
          <button
            type="submit"
            disabled={sending || !email}
            className="w-full rounded-xl px-4 py-2 mt-2
                       border border-amber-500/30 bg-black/40 text-amber-100
                       hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-50
                       transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending…' : 'Send magic link'}
          </button>
          {sent && <p className="text-xs text-emerald-300 mt-1">Check your inbox for the sign-in link.</p>}
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-slate-300">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="grid gap-2">
          {OAUTH_PROVIDERS.map((p) => (
            <button
              key={p.key}
              onClick={() => oauthSignIn(p.key)}
              className="w-full rounded-xl px-4 py-2
                         border border-amber-500/30 bg-black/40 text-amber-100
                         hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-50
                         transition"
            >
              {p.label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-rose-300 mt-4">{error}</p>}
      </div>
    </main>
  );
}

function Loader() {
  return (
    <main className="min-h-[100dvh] grid place-items-center px-6" style={{ backgroundColor: BG }}>
      <div className="w-full max-w-md rounded-2xl border p-6" style={{
        borderColor: 'rgba(255,255,255,0.08)',
        background: 'linear-gradient(180deg, rgba(0,0,0,.45), rgba(0,0,0,.35))',
        boxShadow: `0 10px 40px -10px ${EDGE_GLOW}`,
      }}>
        <h1 className="text-lg font-semibold mb-2">Loading…</h1>
        <p className="text-sm text-amber-200/80">Please wait.</p>
      </div>
    </main>
  );
}
