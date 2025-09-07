'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '../lib/supabaseClient';

export default function SignOutButton({ className = 'btn', children = 'Sign out' }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const onClick = async () => {
    try {
      setBusy(true);
      await supabase.auth.signOut();
      // Send user to sign-in (or home) and refresh server session
      router.replace('/auth/sign-in');
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label="Sign out"
      disabled={busy}
    >
      {busy ? 'Signing out…' : children}
    </button>
  );
}
