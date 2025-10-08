'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function SignUpPage() {
  return (
    <Suspense fallback={<main className="max-w-md mx-auto p-6">Loading…</main>}>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp?.get('next') || '/dashboard';

  const supabase = useMemo(() => createClientComponentClient(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // If already signed in, send them where they intended to go
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.replace(next);
        router.refresh();
      }
    })();
  }, [router, next, supabase]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus('');
    setLoading(true);

    try {
      const origin =
        typeof window !== 'undefined'
          ? window.location.origin
          : (process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://lucen-app-inc.vercel.app');

      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) throw error;

      setStatus('Check your email to confirm your account. After you click the link, you’ll be signed in automatically.');
      // If you prefer a dedicated screen:
      // router.replace(`/auth/check-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setStatus(err?.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Create your account</h1>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded border bg-[#111] outline-none"
        />
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          placeholder="Password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded border bg-[#111] outline-none"
        />
        <button className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-2 font-medium transition"
          type="submit" disabled={loading}>
          {loading ? 'Creating your account…' : 'Sign up'}
        </button>
      </form>

      <p className="text-sm text-gray-400 mt-3">{status}</p>

      <p className="text-sm text-[#9a9a9a] mt-4">
        Already have an account?{' '}
        <a className="underline decoration-amber-400/70 hover:decoration-amber-300"
           href={`/sign-in?next=${encodeURIComponent(next)}`}>
          Sign in
        </a>
      </p>
    </main>
  );
}
