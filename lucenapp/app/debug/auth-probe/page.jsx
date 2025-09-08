'use client';
import { useEffect, useState } from 'react';
import supabase from '../../lib/supabaseClient';

export default function AuthProbe() {
  const [info, setInfo] = useState({});

  useEffect(() => {
    (async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const keyLen = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').length;

      let canFetch = false, err = null;
      try {
        const { data, error } = await supabase.from('profiles').select('id').limit(1);
        if (!error) canFetch = true; else err = error.message;
      } catch (e) { err = e.message; }

      setInfo({ url, keyLen, canFetch, err });
      // also test basic auth route
      const s = await supabase.auth.getUser();
      console.log('getUser result', s);
    })();
  }, []);

  return (
    <main className="p-6">
      <pre className="text-sm bg-black/40 p-3 rounded">
        {JSON.stringify(info, null, 2)}
      </pre>
      <p className="text-xs text-[#9a9a9a]">keyLen shows the anon key length only.</p>
    </main>
  );
}
