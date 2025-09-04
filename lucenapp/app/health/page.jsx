'use client';
import { useEffect, useState } from 'react';

const Pill = ({ ok, label }) => (
  <span className={`px-2 py-0.5 rounded text-xs border ${ok ? 'border-green-600 text-green-400 bg-green-600/10' : 'border-red-600 text-red-400 bg-red-600/10'}`}>
    {label ?? (ok ? 'OK' : 'FAIL')}
  </span>
);

export default function HealthPage() {
  const [data, setData] = useState(null);
  const [sw, setSw] = useState({ registered: false, controlled: false });

  useEffect(() => {
    fetch('/api/health', { cache: 'no-store' }).then(r => r.json()).then(setData);
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(regs => setSw({ registered: regs.length > 0, controlled: !!navigator.serviceWorker.controller }))
        .catch(() => {});
    }
  }, []);

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Preflight</h1>
      {!data ? <p>Checking…</p> : (
        <div className="space-y-2 text-sm">
          <div>Env vars: URL <Pill ok={data.envs.NEXT_PUBLIC_SUPABASE_URL} /> · Anon <Pill ok={data.envs.NEXT_PUBLIC_SUPABASE_ANON_KEY} /> · Service <Pill ok={data.envs.SUPABASE_SERVICE_ROLE_KEY} /></div>
          <div>Manifest.json exists <Pill ok={data.files['manifest.json']} /> · Icons 192/512 in manifest <Pill ok={data.manifestOk} /></div>
          <div>Icons files: 192 <Pill ok={data.files['icon-192.png']} /> · 512 <Pill ok={data.files['icon-512.png']} /></div>
          <div>Service worker file <Pill ok={data.files['sw.js']} /> · Offline page <Pill ok={data.files['offline.html']} /></div>
          <div>SW status (this browser): registered <Pill ok={sw.registered} /> · controlling <Pill ok={sw.controlled} /></div>
          <div>Tailwind v4 PostCSS plugin <Pill ok={data.postcssHasTailwind} /></div>
          <div><code>generateMetadata()</code> awaits <code>headers()</code>: <strong>{data.awaitedHeaders}</strong></div>
          <div>Supabase public read (plans) <Pill ok={data.supabase.ok} /> {data.supabase.error && <span className="opacity-60">— {data.supabase.error}</span>}</div>
          <p className="opacity-50 text-xs">Checked at {new Date(data.time).toLocaleString()}</p>
        </div>
      )}
    </main>
  );
}
