// app/components/RequireAuth.jsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import supabase from '../lib/supabaseClient';

export default function RequireAuth({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;

      if (!user) {
        const next = encodeURIComponent(pathname || '/dashboard');
        router.replace(`/auth/sign-in?next=${next}`);
      } else {
        setChecking(false);
      }
    })();

    // keep server in sync if auth changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.refresh();
    });

    return () => { mounted = false; sub.subscription?.unsubscribe?.(); };
  }, [router, pathname]);

  if (checking) {
    return <div className="p-6 text-sm text-[#bdbdbd]">Loading…</div>;
  }
  return children;
}
