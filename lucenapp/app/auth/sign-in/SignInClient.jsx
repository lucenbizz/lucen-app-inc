'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import supabase from '../../lib/supabaseClient';

export default function SignInClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp?.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  // If already signed in, bounce
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
    if (error) { setErr(error.message); return; }
    router.replace(next);
    router.refresh(); // important so server sees cookie
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-sm">
      <input className="input w-full" type="email" required value={email}
             onChange={(e)=>setEmail(e.target.value)} placeholder="Email" />
      <input className="input w-full" type="password" required value={password}
             onChange={(e)=>setPassword(e.target.value)} placeholder="Password" />
      {err && <div className="text-red-400 text-sm">{err}</div>}
      <button className="btn btn-primary w-full" type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

