// app/components/SignOutButton.jsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignOutButton({ redirectTo = '/auth/sign-in', className = '' }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signOut() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signout', { method: 'POST', cache: 'no-store' });
      if (!res.ok) throw new Error('Sign-out failed');
      router.replace(redirectTo);
    } catch (e) {
      alert(e.message || 'Sign-out failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={signOut}
      disabled={loading}
      className={
        className ||
        'inline-flex items-center gap-2 rounded-xl px-4 py-2 ' +
        'border border-amber-500/30 bg-black/40 text-amber-100 ' +
        'hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-50 ' +
        'transition disabled:opacity-60 disabled:cursor-not-allowed'
      }
      title="Sign out"
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
