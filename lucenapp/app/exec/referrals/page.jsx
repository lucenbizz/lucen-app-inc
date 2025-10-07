// app/exec/referrals/page.jsx
'use client';

import { useEffect, useMemo, useState } from 'react';

export const dynamic = 'force-dynamic';

const BG = '#0b0b0c';
const EDGE_GLOW = 'rgba(245, 158, 11, .25)';

function appOrigin() {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_ORIGIN || '';
}

export default function GrowthCodesPage() {
  const [refCodes, setRefCodes] = useState([]);
  const [invites, setInvites] = useState([]);
  const [creatingRef, setCreatingRef] = useState(false);
  const [creatingInv, setCreatingInv] = useState(false);
  const [error, setError] = useState('');

  const base = useMemo(() => appOrigin(), []);

  // Optional list endpoints (referrals/list may not exist in your app yet)
  useEffect(() => {
    (async () => {
      try {
        setError('');
        const [a, b] = await Promise.allSettled([
          fetch('/api/referrals/list', { cache: 'no-store' }),
          fetch('/api/invite-staff/list', { cache: 'no-store' }),
        ]);
        if (a.status === 'fulfilled' && a.value?.ok) {
          const j = await a.value.json();
          setRefCodes(Array.isArray(j.items) ? j.items : []);
        }
        if (b.status === 'fulfilled' && b.value?.ok) {
          const j = await b.value.json();
          setInvites(Array.isArray(j.items) ? j.items : []);
        }
      } catch (e) {
        setError(e.message || 'Failed to load');
      }
    })();
  }, []);

  async function createReferral() {
    if (creatingRef) return;
    setCreatingRef(true); setError('');
    try {
      const res = await fetch('/api/referrals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({}),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Create failed');
      setRefCodes((xs) => [{ code: j.code, active: true, created_at: new Date().toISOString() }, ...xs]);
    } catch (e) {
      setError(e.message || 'Create failed');
    } finally { setCreatingRef(false); }
  }

  async function createInvite() {
    if (creatingInv) return;
    setCreatingInv(true); setError('');
    try {
      const res = await fetch('/api/invite-staff/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ maxUses: 1 }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Invite failed');
      setInvites((xs) => [{ code: j.code, active: true, max_uses: 1, uses: 0, created_at: new Date().toISOString() }, ...xs]);
    } catch (e) {
      setError(e.message || 'Invite failed');
    } finally { setCreatingInv(false); }
  }

  return (
    <main className="min-h-[100dvh] text-slate-100 px-6 py-10" style={{ backgroundColor: BG }}>
      <div className="max-w-5xl mx-auto space-y-10">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Growth Links</h1>
            <p className="text-amber-300/80 text-sm mt-1">
              Share with customers or invite new staff. QR codes included.
            </p>
          </div>
        </header>

        {error && <div className="text-rose-300 text-sm">{error}</div>}

        {/* Customer Referral Codes */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Customer Referrals</h2>
            <button
              onClick={createReferral}
              disabled={creatingRef}
              className="rounded-xl px-4 py-2 border border-amber-500/30 bg-black/40 text-amber-100
                         hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-50
                         transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {creatingRef ? 'Creating…' : 'New code'}
            </button>
          </div>
          <CardsGrid
            items={refCodes}
            linkFor={(it) => `${base}/auth/sign-in?ref=${encodeURIComponent(it.code)}&redirect=%2Fdashboard`}
          />
        </section>

        {/* Staff Invitations */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Invite Staff</h2>
            <button
              onClick={createInvite}
              disabled={creatingInv}
              className="rounded-xl px-4 py-2 border border-amber-500/30 bg-black/40 text-amber-100
                         hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-50
                         transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {creatingInv ? 'Creating…' : 'Invite staff'}
            </button>
          </div>
          <CardsGrid
            items={invites}
            linkFor={(it) => `${base}/auth/sign-in?sref=${encodeURIComponent(it.code)}&redirect=%2Fdashboard`}
            staff
          />
        </section>
      </div>
    </main>
  );
}

function CardsGrid({ items, linkFor, staff = false }) {
  if (!items?.length) {
    return <div className="text-sm text-slate-300">No items yet. Create one above.</div>;
  }
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {items.map((it) => {
        const link = linkFor(it);
        const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`;
        return (
          <div key={it.code}
               className="rounded-2xl border p-4"
               style={{
                 borderColor: 'rgba(255,255,255,0.08)',
                 background: 'linear-gradient(180deg, rgba(0,0,0,.45), rgba(0,0,0,.35))',
                 boxShadow: `0 10px 40px -10px ${EDGE_GLOW}`,
               }}>
            <div className="flex items-start gap-4">
              <img src={qr} alt={`QR for ${it.code}`} className="w-[110px] h-[110px] rounded-lg border border-amber-500/20 bg-black/30" />
              <div className="flex-1 min-w-0">
                <div className="text-lg font-semibold">{it.code}</div>
                <div className="text-xs text-slate-300 mt-1 truncate">{link}</div>
                <div className="text-xs text-amber-300/80 mt-1">
                  {it.active ? 'Active' : 'Inactive'}
                  {staff && <> • Uses {it.uses ?? 0}/{it.max_uses ?? 1}</>}
                  {it.created_at ? <> • {new Date(it.created_at).toLocaleString()}</> : null}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <CopyBtn text={link} />
                  <a href={link} className="text-amber-200 text-sm underline hover:text-amber-100">Open link</a>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(()=>setOk(false), 1200); }
    catch {}
  }
  return (
    <button onClick={copy}
      className="text-sm rounded-lg px-3 py-1.5 border border-amber-500/30 bg-black/40 text-amber-100 hover:border-amber-400/60 hover:bg-amber-500/10">
      {ok ? 'Copied' : 'Copy'}
    </button>
  );
}
