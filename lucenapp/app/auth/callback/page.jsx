'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import supabase from '../../lib/supabaseClient'; // adjust path if your client lives elsewhere

function CallbackInner() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    (async () => {
      try {
        const next = sp.get('next') || '/dashboard';
        const code = sp.get('code');
        const token_hash = sp.get('token_hash'); // older links
        const type = sp.get('type') || 'signup';

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (token_hash) {
          const { error } = await supabase.auth.verifyOtp({ type, token_hash });
          if (error) throw error;
        } // else: no token params, just continue

        router.replace(next);
      } catch (e) {
        console.error('Auth callback error:', e);
        router.replace(
          `/auth/sign-in?error=${encodeURIComponent(e?.message || 'Auth error')}`
        );
      }
    })();
  }, [router, sp]);

  return (
    <main className="min-h-[60vh] grid place-items-center p-6 text-center">
      <p className="text-sm text-gray-400">Signing you in…</p>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="p-6 text-center">Loading…</main>}>
      <CallbackInner />
    </Suspense>
  );
}

export const dynamic = 'force-dynamic';
