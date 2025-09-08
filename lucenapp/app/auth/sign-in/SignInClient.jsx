'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import supabase from '../../lib/supabaseClient';

export default function SignInClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [email, setEmail] = useState('');
  const [password,  setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const next = sp?.get('next') || '/dashboard';

  // Optional: if already signed in, bounce straight to next
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.replace(next);
        router.refresh();
      }
    })();
  }, [router, next]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    // Important: refresh so the server (and middleware) sees the cookie
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-sm mx-auto">
      <input
        type="email" value={email} onChange={e=>setEmail(e.target.value)}
        placeholder="Email" className="input w-full" required
      />
      <input
        type="password" value={password} onChange={e=>setPassword(e.target.value)}
        placeholder="Password" className="input w-full" required
      />
      {err && <div className="text-red-400 text-sm">{err}</div>}
      <button disabled={loading} className="btn btn-primary w-full">
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
