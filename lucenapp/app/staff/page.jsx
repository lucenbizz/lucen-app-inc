// app/staff/page.jsx
'use client';

import { useEffect, useMemo, useState } from 'react';

export const dynamic = 'force-dynamic';

const BG = '#0b0b0c';
const EDGE_GLOW = 'rgba(245, 158, 11, .25)';

const STATUS_LABEL = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  canceled: 'Canceled',
};

const statusCls = {
  pending:   'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/40',
  scheduled: 'bg-yellow-500/15 text-yellow-200 ring-1 ring-yellow-400/40',
  in_transit:'bg-orange-500/15 text-orange-200 ring-1 ring-orange-400/40',
  delivered: 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40',
  canceled:  'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/40',
};

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

export default function StaffDashboard() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        setErr('');
        const j = await fetchJSON('/api/staff/deliveries?limit=100');
        if (!dead) setRows(normalize(j));
      } catch (e) {
        if (!dead) setErr(e.message || 'Failed to load');
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => { dead = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter(r =>
      String(r.id).toLowerCase().includes(s) ||
      String(r.customer_email || '').toLowerCase().includes(s) ||
      String(r.area_tag || '').toLowerCase().includes(s) ||
      String(r.status || '').toLowerCase().includes(s)
    );
  }, [rows, q]);

  return (
    <main className="min-h-[100dvh] text-slate-100 px-6 py-10" style={{ backgroundColor: BG }}>
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Deliveries</h1>
            <p className="text-amber-300/80 text-sm mt-1">Orders assigned to you.</p>
          </div>
          <a
            href="/dashboard"
            className="rounded-xl px-4 py-2 border border-amber-500/30 bg-black/40 text-amber-100
                       hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-50 transition"
          >
            Go to main dashboard →
          </a>
        </header>

        {/* Controls */}
        <div
          className="rounded-2xl p-4 mb-4 backdrop-blur-xl"
          style={{
            background: 'rgba(0,0,0,.35)',
            boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 10px 40px -10px ${EDGE_GLOW}`,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <input
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            placeholder="Search by order, customer, area, status…"
            className="w-full rounded-xl bg-black/40 border border-amber-500/30 px-4 py-2.5 outline-none placeholder:text-slate-400 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/25"
          />
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
                  <Th>Area</Th>
                  <Th className="w-[220px]">Scheduled</Th>
                  <Th>Status</Th>
                  <Th className="text-right pr-4 w-[160px]">Total</Th>
                  <Th className="text-right pr-4 w-[220px]">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-white/10 hover:bg-black/30">
                    <Td>
                      <div className="font-mono text-[11px] text-amber-200">#{String(r.id).slice(0, 10)}</div>
                      <div className="text-[11px] text-slate-400"><time dateTime={r.created_at||''}>{fmtUTC(r.created_at)}</time></div>
                    </Td>
                    <Td>{r.customer_email || '—'}</Td>
                    <Td><span className="px-2 py-0.5 rounded-full text-[11px] ring-1 ring-amber-400/30 bg-amber-500/10 text-amber-200">{r.area_tag || '—'}</span></Td>
                    <Td><time dateTime={r.delivery_slot_at||''}>{fmtUTC(r.delivery_slot_at)}</time></Td>
                    <Td><span className={`px-2 py-0.5 rounded-full text-[11px] ring-1 ${statusCls[r.status] || statusCls.pending}`}>{STATUS_LABEL[r.status] || r.status}</span></Td>
                    <Td className="text-right pr-4"><span className="text-amber-200 font-medium">{usd(r.price_cents)}</span></Td>
                    <Td className="text-right pr-4">
                      <div className="flex items-center justify-end gap-2">
                        <A href={`/orders/${r.id}`}>View</A>
                        {r.status !== 'delivered' && (
                          <A href={`/api/orders/${r.id}/fulfill`} target="_self">Mark delivered</A>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-slate-300">No deliveries match.</td></tr>
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
    area_tag: x.area_tag ?? x.area ?? null,
    delivery_slot_at: x.delivery_slot_at ?? x.scheduled_for ?? null,
    status: (x.status ?? 'pending').toLowerCase(),
    price_cents: x.price_cents ?? x.amount_cents ?? 0,
  }));
}
function cryptoId(){ if (typeof crypto!=='undefined'&&crypto.getRandomValues){const a=new Uint32Array(4);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(8,'0')).join('');} return Math.random().toString(36).slice(2)+Date.now().toString(36);}

function Th({ children, className }) { return <th className={`text-xs font-semibold tracking-wide uppercase px-3 py-3 ${className||''}`}>{children}</th>; }
function Td({ children, className }) { return <td className={`px-3 py-3 align-middle ${className||''}`}>{children}</td>; }
function A({ href, children, target }) {
  return (
    <a href={href} target={target}
       className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-black/40 text-amber-100
                  hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-50 transition">
      {children}
    </a>
  );
}
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
