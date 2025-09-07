'use client';
import { useEffect, useState } from 'react';
export default function GlobalSpinner() {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const on = () => setBusy(true);
    const off = () => setBusy(false);
    window.addEventListener('req:start', on);
    window.addEventListener('req:end', off);
    return () => { window.removeEventListener('req:start', on); window.removeEventListener('req:end', off); };
  }, []);
  if (!busy) return null;
  return <div className="fixed top-2 right-2 bg-white/10 px-3 py-1 rounded">Loading…</div>;
}
