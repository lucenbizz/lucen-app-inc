// /app/dashboard/page.jsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

/* ===========================
   THEME (Black & Gold)
   =========================== */
const BG = '#0b0b0c';
const GOLD_SOFT = 'rgba(245, 158, 11, .14)';
const EDGE_GLOW = 'rgba(245, 158, 11, .25)';

const STATUS_ORDER = ['pending', 'scheduled', 'in_transit', 'delivered', 'canceled'];
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

const tierCls = {
  bronze: 'bg-[#7c4a18]/20 text-[#f1c38a] ring-1 ring-[#c28c4b]/40',
  silver: 'bg-[#94a3b8]/20 text-[#dbe5f1] ring-1 ring-[#cbd5e1]/30',
  gold:   'bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/50',
  black:  'bg-black/60 text-slate-200 ring-1 ring-slate-500/40',
};

function cn(...xs) { return xs.filter(Boolean).join(' '); }
function usd(cents) { return `$${((cents ?? 0) / 100).toFixed(2)}`; }

// ✅ SSR-safe, consistent date formatting (UTC on server & client)
const dtfUTC = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});
function fmtDateUTC(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(+dt)) return '—';
  return `${dtfUTC.format(dt)} UTC`;
}

/* ===========================
   DATA LOADING (No demo fallback)
   =========================== */
async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

function normalizeOrders(raw) {
  const rows = (raw?.items || raw?.orders || raw || []);
  return rows.map((x) => ({
    id: x.id ?? x.order_id ?? x.reference ?? cryptoRandomId(),
    created_at: x.created_at ?? x.createdAt ?? null,
    customer_email: x.customer_email ?? x.email ?? x.customer?.email ?? null,
    tier: (x.tier ?? x.plan ?? 'bronze').toLowerCase(),
    area_tag: x.area_tag ?? x.area ?? x.territory ?? '—',
    delivery_slot_at: x.delivery_slot_at ?? x.slot ?? x.scheduled_for ?? null,
    status: (x.status ?? 'pending').toLowerCase(),
    assigned_to_name: x.assigned_to_name ?? x.assignee ?? x.driver_name ?? null,
    price_cents: x.price_cents ?? x.amount_cents ?? 0,
  }));
}

function useDashboardData() {
  const [state, setState] = useState({ loading: true, error: '', items: [], role: 'customer' });
  const [points, setPoints] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1) detect role
        let role = 'customer';
        try {
          const r = await fetchJSON('/api/auth/roles');
          if (r?.isAdmin) role = 'admin';
          else if (r?.isExecutive) role = 'executive';
          else if (r?.isStaff) role = 'staff';
        } catch {}

        // 2) endpoint
        let endpoint = '/api/my/orders?limit=100';
        if (role === 'admin' || role === 'executive') endpoint = '/api/admin/orders?limit=100';
        if (role === 'staff') endpoint = '/api/staff/deliveries?limit=100';

        // 3) fetch + normalize
        const data = await fetchJSON(endpoint);
        const items = normalizeOrders(data);

        // 4) loyalty (customer only)
        if (role === 'customer') {
          try {
            const s = await fetchJSON('/api/loyalty/summary');
            const bal = s?.summary?.points_balance ?? 0;
            if (!cancelled) setPoints(bal);
          } catch { if (!cancelled) setPoints(null); }
        } else {
          setPoints(null);
        }

        if (!cancelled) setState({ loading: false, error: '', items, role });
      } catch (e) {
        if (!cancelled) setState({ loading: false, error: e.message || 'Failed to load', items: [], role: 'customer' });
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return { ...state, points };
}

/* ===========================
   UI: Tooltip (no deps)
   =========================== */
function Tooltip({ label, children }) {
  return (
    <span className="relative inline-flex group">
      {children}
      <span
        className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap
                   rounded-md bg-black/90 text-[11px] text-amber-200 px-2 py-1 opacity-0
                   ring-1 ring-amber-500/30 group-hover:opacity-100 transition"
      >
        {label}
      </span>
    </span>
  );
}

/* ===========================
   PAGE
   =========================== */
export default function DashboardPage() {
  const { loading, error, items, role, points } = useDashboardData();
  const router = useRouter();

 

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState('slot');
  const [sortDir, setSortDir] = useState('asc');

 
  useEffect(() => {
    if (!loading && role === 'customer' && (!items || items.length === 0)) {
      router.replace('/plans');
    }
  }, [loading, role, items, router]);

  const filtered = useMemo(() => {
    let arr = items;
    if (q) {
      const s = q.toLowerCase();
      arr = arr.filter((r) =>
        String(r.id).toLowerCase().includes(s) ||
        String(r.area_tag).toLowerCase().includes(s) ||
        String(r.tier).toLowerCase().includes(s) ||
        String(r.customer_email || '').toLowerCase().includes(s)
      );
    }
    if (statusFilter !== 'all') arr = arr.filter((r) => r.status === statusFilter);

    const dir = sortDir === 'asc' ? 1 : -1;
    arr = [...arr].sort((a, b) => {
      if (sortKey === 'slot')   return (new Date(a.delivery_slot_at || 0) - new Date(b.delivery_slot_at || 0)) * dir;
      if (sortKey === 'status') return (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)) * dir;
      if (sortKey === 'tier')   return String(a.tier).localeCompare(String(b.tier)) * dir;
      if (sortKey === 'price')  return ((a.price_cents || 0) - (b.price_cents || 0)) * dir;
      return String(a.id).localeCompare(String(b.id)) * dir;
    });
    return arr;
  }, [items, q, statusFilter, sortKey, sortDir]);

  return (
    <main className="relative min-h-[100dvh] text-slate-100 overflow-hidden" style={{ backgroundColor: BG }}>
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0" style={{
          opacity: .65,
          backgroundImage:
            `radial-gradient(60rem 60rem at 15% 10%, ${GOLD_SOFT}, transparent 45%),
             radial-gradient(50rem 50rem at 85% 90%, rgba(255,255,255,.05), transparent 40%)`,
        }} />
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundSize: '40px 40px',
          backgroundImage:
            'linear-gradient(to right, #ffffff14 1px, transparent 1px),\
             linear-gradient(to bottom, #ffffff14 1px, transparent 1px)',
        }} />
      </div>

      {/* Header with CTA and Points badge */}
      <section className="relative max-w-7xl mx-auto px-6 pt-10 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-amber-300/80">
              {role === 'admin' ? 'Admin' : role === 'executive' ? 'Executive' : role === 'staff' ? 'Staff' : 'Customer'} view
            </p>
          </div>

          <div className="flex items-center gap-3">
            {role === 'customer' && <PointsBadge points={points} />}
            <a
              href="/plans"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2
                         border border-amber-500/30 bg-black/40 text-amber-100
                         hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-50
                         transition shadow-[0_0_0_1px_rgba(245,158,11,0.12)]"
            >
              <span>Choose an ebook</span>
              <span>→</span>
            </a>
          </div>
        </div>
      </section>

      {/* Controls */}
      <section className="relative max-w-7xl mx-auto px-6">
        <div
          className="rounded-2xl p-4 backdrop-blur-xl"
          style={{
            background: 'rgba(0,0,0,.35)',
            boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 10px 40px -10px ${EDGE_GLOW}`,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search orders, area, email…"
                  className="w-full rounded-xl bg-black/40 border border-amber-500/20 px-4 py-2.5 outline-none placeholder:text-slate-400 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/25"
                />
                <div className="pointer-events-none absolute right-3 top-2.5 text-slate-400 text-xs">⌘K</div>
              </div>
              <div className="hidden md:flex items-center gap-2">
                {['all', ...STATUS_ORDER].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs border transition',
                      statusFilter === s
                        ? 'border-amber-400/70 text-amber-200 bg-amber-400/10 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                        : 'border-white/10 text-slate-300 hover:border-white/20'
                    )}
                  >
                    {s === 'all' ? 'All' : STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SortBtn label="Time"   active={sortKey === 'slot'}   dir={sortDir} onClick={() => toggleSort('slot')} />
              <SortBtn label="Status" active={sortKey === 'status'} dir={sortDir} onClick={() => toggleSort('status')} />
              <SortBtn label="Tier"   active={sortKey === 'tier'}   dir={sortDir} onClick={() => toggleSort('tier')} />
              <SortBtn label="Price"  active={sortKey === 'price'}  dir={sortDir} onClick={() => toggleSort('price')} />
            </div>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="relative max-w-7xl mx-auto px-6 mt-6 pb-12">
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,.45), rgba(0,0,0,.35))',
            boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 10px 50px -12px ${EDGE_GLOW}`,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <TableShell loading={loading} error={error} rows={filtered} role={role} />
        </div>
      </section>
    </main>
  );

  function toggleSort(key) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
}

/* ===========================
   TABLE
   =========================== */
function TableShell({ loading, error, rows, role }) {
  if (error) return <div className="p-6 text-rose-300">{error}</div>;
  if (loading) return <SkeletonTable />;
  if (!rows?.length) {
    return (
      <div className="p-8 text-center text-slate-300 text-sm">
        <div className="mb-3">No orders yet.</div>
        <a
          href="/plans"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2
                     border border-amber-500/30 bg-black/40 text-amber-100
                     hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-50 transition"
        >
          Browse plans <span>→</span>
        </a>
      </div>
    );
  }

  return (
    <div className="relative">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-amber-200/90 bg-black/40 border-b border-amber-500/10">
            <Th className="w-[120px]">Order</Th>
            <Th className="w-[180px]">Customer</Th>
            <Th>Tier</Th>
            <Th>Area</Th>
            <Th className="w-[220px]">Scheduled</Th>
            <Th>Status</Th>
            <Th className="w-[160px]">Assignee</Th>
            <Th className="text-right pr-4 w-[160px]">Price</Th>
            <Th className="text-right pr-4 w-[240px]">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-white/10 hover:bg-black/30">
              <Td>
                <div className="font-mono text-[11px] text-amber-200">#{String(r.id).slice(0, 10)}</div>
                <div className="text-[11px] text-slate-400">
                  <time dateTime={r.created_at || ''}>{fmtDateUTC(r.created_at)}</time>
                </div>
              </Td>
              <Td>
                <div className="text-slate-200 truncate max-w-[180px]">{r.customer_email || '—'}</div>
              </Td>
              <Td>
                <Tooltip label={`Plan: ${capitalize(r.tier)}`}>
                  <span className={cn('px-2 py-0.5 rounded-full text-[11px] ring-1', tierCls[r.tier] || tierCls.bronze)}>
                    {capitalize(r.tier)}
                  </span>
                </Tooltip>
              </Td>
              <Td>
                <Tooltip label={`Area tag: ${r.area_tag || '—'}`}>
                  <span className="px-2 py-0.5 rounded-full text-[11px] ring-1 ring-amber-400/30 bg-amber-500/10 text-amber-200">
                    {r.area_tag || '—'}
                  </span>
                </Tooltip>
              </Td>
              <Td>
                <div className="text-slate-200">
                  <time dateTime={r.delivery_slot_at || ''}>{fmtDateUTC(r.delivery_slot_at)}</time>
                </div>
              </Td>
              <Td>
                <span className={cn('px-2 py-0.5 rounded-full text-[11px] ring-1', statusCls[r.status] || statusCls.pending)}>
                  {STATUS_LABEL[r.status] || r.status}
                </span>
              </Td>
              <Td>
                <div className="text-slate-200">{r.assigned_to_name || '—'}</div>
              </Td>
              <Td className="text-right pr-4">
                <div className="text-amber-200 font-medium">{usd(r.price_cents)}</div>
              </Td>
              <Td className="text-right pr-4">
                <div className="flex items-center justify-end gap-2 flex-wrap">
                  <ActionButton href={`/orders/${r.id}`}>View</ActionButton>
                  {(role === 'admin' || role === 'executive') && (
                    <>
                      <ActionButton href={`/admin/orders?id=${r.id}&action=reschedule`}>Reschedule</ActionButton>
                      <ActionButton href={`/admin/orders?id=${r.id}&action=assign`}>Assign</ActionButton>
                    </>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ===========================
   SMALL PIECES
   =========================== */
function Th({ children, className }) {
  return (
    <th className={cn('text-xs font-semibold tracking-wide uppercase px-3 py-3', className)}>
      {children}
    </th>
  );
}

function Td({ children, className }) {
  return (
    <td className={cn('px-3 py-3 align-middle', className)}>
      {children}
    </td>
  );
}

function ActionButton({ href, children }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-black/40 text-amber-100
                 hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-50 transition"
    >
      {children}
    </a>
  );
}

function SortBtn({ label, active, dir, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-xl text-xs border transition',
        active
          ? 'border-amber-400/70 text-amber-200 bg-amber-400/10 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
          : 'border-white/10 text-slate-300 hover:border-white/20'
      )}
    >
      <span className="mr-1">{label}</span>
      <span className="opacity-80">{active ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </button>
  );
}

function SkeletonTable() {
  const rows = Array.from({ length: 6 });
  return (
    <div className="p-4 animate-pulse">
      <div className="h-8 rounded-xl w-40 mb-4" style={{ background: 'rgba(245,158,11,.14)' }} />
      <div className="space-y-2">
        {rows.map((_, i) => (
          <div key={i} className="h-12 rounded-xl border border-amber-500/15" style={{ background: 'rgba(0,0,0,.35)' }} />
        ))}
      </div>
    </div>
  );
}

function PointsBadge({ points }) {
  return (
    <div
      className="rounded-xl px-3 py-2 text-amber-100 flex items-center gap-2"
      style={{
        background: 'rgba(0,0,0,.4)',
        border: '1px solid rgba(245,158,11,.35)',
        boxShadow: '0 0 0 1px rgba(245,158,11,.12), 0 10px 30px -12px rgba(245,158,11,.25)',
      }}
      title="Your loyalty points"
    >
      <span className="text-[11px] opacity-80">Points</span>
      <span className="font-semibold">{points == null ? '—' : points.toLocaleString()}</span>
    </div>
  );
}

function capitalize(s) { return (s || '').slice(0,1).toUpperCase() + (s || '').slice(1); }
function cryptoRandomId() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const a = new Uint32Array(4); crypto.getRandomValues(a);
    return [...a].map((x) => x.toString(16).padStart(8, '0')).join('');
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
