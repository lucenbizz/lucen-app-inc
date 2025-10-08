'use client';

import { useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function SignInPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3000');

  async function onSubmit(e) {
    e.preventDefault();
    setErr(''); setMsg(''); setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/dashboard';
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${origin}/auth/callback?next=/dashboard` },
        });
        if (error) throw error;
        setMsg('Check your email to confirm your account. After you click the link, you’ll be signed in automatically.');
      }
    } catch (e2) {
      setErr(e2?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[100dvh] grid place-items-center bg-black text-amber-100">
      <div className="w-full max-w-md p-6 rounded-2xl border border-amber-500/20 bg-zinc-900/60">
        <header className="mb-5">
          <h1 className="text-2xl font-bold">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="text-amber-200/70 text-sm mt-1">
            {mode === 'signin'
              ? 'Use your email and password to continue.'
              : 'Use a valid email address. We’ll send a confirmation link.'}
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="text-xs text-amber-300/80">Email</span>
            <input type="email" required value={email}
              onChange={(e)=>setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl bg-black/40 border border-amber-500/30 px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-xs text-amber-300/80">Password</span>
            <input type="password" required minLength={6} value={password}
              onChange={(e)=>setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl bg-black/40 border border-amber-500/30 px-3 py-2" />
          </label>

          {err && <div className="text-sm text-rose-300">{err}</div>}
          {msg && <div className="text-sm text-emerald-300">{msg}</div>}

          <button type="submit" disabled={busy}
            className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2">
            {busy ? 'Please wait…' : (mode === 'signin' ? 'Sign in' : 'Create account')}
          </button>
        </form>

        <div className="mt-4 text-sm text-amber-200/80">
          {mode === 'signin' ? (
            <>New here? <button onClick={()=>setMode('signup')} className="underline">Create an account</button></>
          ) : (
            <>Already have an account? <button onClick={()=>setMode('signin')} className="underline">Sign in instead</button></>
          )}
        </div>
      </div>
    </main>
  );
}

