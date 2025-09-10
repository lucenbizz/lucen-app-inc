// app/components/AuthSync.jsx
'use client';
import { useEffect } from 'react';
import supabase from '../lib/supabaseClient';

export default function AuthSync() {
  useEffect(() => {
    // Push current session on mount (covers hard refresh)
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'INITIAL', session }),
      });
    })();

    // Keep server cookies in sync with client auth changes
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: _event, session }),
      });
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return null;
}
