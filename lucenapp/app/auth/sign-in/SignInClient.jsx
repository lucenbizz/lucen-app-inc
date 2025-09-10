'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import supabase from '../../lib/supabaseClient';

// Conservative client-side check (server still enforces in /dashboard)
function isProbablyAdmin(profile, user) {
  const email = (user?.email || '').toLowerCase();
  return (
    profile?.role === 'admin' ||
    profile?.is_admin === true ||
    profile?.is_staff === true ||
    email === 'zayhubbard4@yahoo.com' // fallback allowlist
  );
}

// Ask the server who we are (preferred, avoids trusting client state)
async function fetchMe() {
  try {
    const res = await fetch('/api/me', { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json(); // expect { user, profile, ... }
  } catch {
    return null;
  }
}

export default function SignInClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp?.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function goToCorrectPlace(fallbackUser = null) {
    // Prefer server’s verdict; fall back to a local guess if needed.
    const me = await fetchMe();
    const user = me?.user ?? fallbackUser;
    const profile = me?.profile ?? null;

    const dest = isProbablyAdmin(profile, user) ? '/Admin' : next;
    router.replace(dest);
    router.refresh(); // make sure server sees the new auth cookie
  }

  // If already signed in, bounce appropriately
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await goToCorrectPlace(user);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    // data.user can be null here (depends on SDK), so we still call /api/me
    await goToCorrectPlace(data?.user ?? null);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-sm">
      <input
        className="input w-full"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        autoComplete="email"
      />
      <input
        className="input w-full"
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoComplete="current-password"
      />
      {err && <div className="text-red-400 text-sm">{err}</div>}
      <button className="btn btn-primary w-full" type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
