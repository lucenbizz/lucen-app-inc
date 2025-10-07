// app/exec/page.jsx
'use client';

import { useEffect, useMemo, useState } from 'react';

export const dynamic = 'force-dynamic';

const BG = '#0b0b0c';
const EDGE_GLOW = 'rgba(245, 158, 11, .25)';

const dtfUTC = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric', month: 'short', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: true,
});
const fmtUTC = (v) => (v ? `${dtfUTC.format(new Date(v))} UTC` : '—');
const usd = (c) => `$${((c ?? 0) / 100).toFixed(2)}`;

async function fetchJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error((await r.json().catch(()=>({})))?.error || r.statusText);
  return r.json();
}

export default function ExecutiveDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        setErr('');
        // Execs will only see their attributed orders thanks to RLS
        const j = await fetchJSON('/api/admin/orders?limit=100');
        if (!dead) setOrders(normalize(j));
      } catch (e) {
        if (!dead) setErr(e.message || 'Failed to load');
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => { dead = true; };
  }, []);

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0,10);
    let todayCount = 0, monthRevenue = 0, pending = 0;
    for (const o of orders) {
      if ((o.created_at || '').startsWith(todayStr)) todayCount++;
      if ((o.created_at || '').slice(0,7) === new Date().toISOString().slice(0,7)) monthRevenue += o.price_cents || 0;
      if (o.status === 'pending' || o.status === 'scheduled') pending++;
    }
    return { todayCount, monthRevenue, pending };
  }, [orders]);

  return (
    <main className="min-h-[100dvh] text-slate-100 px-6 py-10" style={{ backgroundColor: BG }}>
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Executive Overview</h1>
            <p className="text-amber-300/80 text-sm mt-1">Orders attributed to you (RLS filtered).</p>
          </div>
          <div className="flex items-center gap-2">
            <A href="/exec/referrals">Growth Links</A>
            <A href="/dashboard">Main dashboard</A>
          </div>
        </header>

        {/* KPIs */}
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <Card title="New orders today" value={String(stats.todayCount)} />
          <Card title="This month (gross)" value={usd(stats.monthRevenue)} />
          <Card title="Pending/Scheduled" value={String(stats.pending)} />
        </div>

        {/* Table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,.45), rgba(0,0,0,.35))',
            boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 10px 50px -12px ${EDGE_GLOW}`,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {err && <div className="p-6 text-rose-300">{err}</div>}
          {loading && <Skeleton />}
          {!loading && !err && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-amber-200/90 bg-black/40 border-b border-amber-500/10">
                  <Th className="w-[120px]">Order</Th>
                  <Th className="w-[200px]">Customer</Th>
                  <Th>Tier</Th>
                  <Th>Area</Th>
                  <Th className="w-[220px]">Scheduled</Th>
                  <Th>Status</Th>
                  <Th className="text-right pr-4 w-[160px]">Total</Th>
                  <Th className="text-right pr-4 w-[220px]">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((r) => (
                  <tr key={r.id} className="border-b border-white/10 hover:bg-black/30">
                    <Td>
                      <div className="font-mono text-[11px] text-amber-200">#{String(r.id).slice(0, 10)}</div>
                      <div className="text-[11px] text-slate-400"><time dateTime={r.created_at||''}>{fmtUTC(r.created_at)}</time></div>
                    </Td>
                    <Td>{r.customer_email || '—'}</Td>
                    <Td>{cap(r.tier)}</Td>
                    <Td><span className="px-2 py-0.5 rounded-full text-[11px] ring-1 ring-amber-400/30 bg-amber-500/10 text-amber-200">{r.area_tag || '—'}</span></Td>
                    <Td><time dateTime={r.delivery_slot_at||''}>{fmtUTC(r.delivery_slot_at)}</time></Td>
                    <Td>{cap(r.status)}</Td>
                    <Td className="text-right pr-4"><span className="text-amber-200 font-medium">{usd(r.price_cents)}</span></Td>
                    <Td className="text-right pr-4">
                      <div className="flex items-center justify-end gap-2">
                        <A href={`/orders/${r.id}`}>View</A>
                        <A href={`/admin/orders?id=${r.id}&action=assign`}>Assign</A>
                        <A href={`/admin/orders?id=${r.id}&action=reschedule`}>Reschedule</A>
                      </div>
                    </Td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={8} className="p-6 text-center text-slate-300">No orders yet.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}

function normalize(raw) {
  const rows = raw?.items || raw?.orders || raw || [];
  return rows.map(x => ({
    id: x.id ?? x.order_id ?? cryptoId(),
    created_at: x.created_at ?? x.createdAt ?? null,
    customer_email: x.customer_email ?? x.email ?? x.customer?.email ?? null,
    tier: (x.tier ?? x.plan ?? 'bronze').toLowerCase(),
    area_tag: x.area_tag ?? x.area ?? null,
    delivery_slot_at: x.delivery_slot_at ?? x.scheduled_for ?? null,
    status: (x.status ?? 'pending').toLowerCase(),
    price_cents: x.price_cents ?? x.amount_cents ?? 0,
  }));
}
function Card({ title, value }) {
  return (
    <div className="rounded-2xl p-4"
         style={{
           background: 'rgba(0,0,0,.35)',
           boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 10px 40px -10px ${EDGE_GLOW}`,
           border: '1px solid rgba(255,255,255,0.06)',
         }}>
      <div className="text-xs text-amber-200/90">{title}</div>
      <div className="text-2xl font-semibold text-amber-100 mt-1">{value}</div>
    </div>
  );
}
function Th({ children, className }) { return <th className={`text-xs font-semibold tracking-wide uppercase px-3 py-3 ${className||''}`}>{children}</th>; }
function Td({ children, className }) { return <td className={`px-3 py-3 align-middle ${className||''}`}>{children}</td>; }
function A({ href, children }) {
  return (
    <a href={href}
       className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-black/40 text-amber-100
                  hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-50 transition">
      {children}
    </a>
  );
}
function cap(s){ return (s||'').slice(0,1).toUpperCase() + (s||'').slice(1); }
function cryptoId(){ if (typeof crypto!=='undefined'&&crypto.getRandomValues){const a=new Uint32Array(4);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(8,'0')).join('');} return Math.random().toString(36).slice(2)+Date.now().toString(36); }
function Skeleton(){
  return (
    <div className="p-4 animate-pulse">
      <div className="h-8 rounded-xl w-40 mb-4" style={{ background:'rgba(245,158,11,.14)' }}/>
      <div className="space-y-2">
        {Array.from({length:6}).map((_,i)=>(
          <div key={i} className="h-12 rounded-xl border border-amber-500/15" style={{ background:'rgba(0,0,0,.35)' }}/>
        ))}
      </div>
    </div>
  );
}
