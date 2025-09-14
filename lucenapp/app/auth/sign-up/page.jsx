'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import supabase from '../../lib/supabaseClient'; // keep if this path is correct

export default function SignUpPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp?.get('next') || '/dashboard';

  const [email, setEmail]   = useState('');
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
  }, [router, next]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus('');
    setLoading(true);

    try {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : '';
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) throw error;

      setStatus('Check your email to confirm your account.');
      // Optional: route to a “check your email” page
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
          className="w-full px-3 py-2 rounded border bg-[#111]"
        />
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded border bg-[#111]"
        />
        <button className="btn btn-primary w-full" type="submit" disabled={loading}>
          {loading ? 'Creating your account…' : 'Sign up'}
        </button>
      </form>

      <p className="text-sm text-gray-400 mt-3">{status}</p>

      <p className="text-sm text-[#9a9a9a] mt-4">
        Already have an account?{' '}
        <a className="link" href={`/auth/sign-in?next=${encodeURIComponent(next)}`}>
          Sign in
        </a>
      </p>
    </main>
  );
}
