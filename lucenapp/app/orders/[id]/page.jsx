// app/orders/[id]/page.jsx
export const dynamic = 'force-dynamic';

const BG = '#0b0b0c';
const EDGE_GLOW = 'rgba(245, 158, 11, .25)';

function usd(c) { return `$${((c ?? 0) / 100).toFixed(2)}`; }
function dtUTC(s) {
  if (!s) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC', year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(new Date(s)) + ' UTC';
  } catch { return s; }
}

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Failed ${url}`);
  return r.json();
}

export default async function OrderDetailPage({ params }) {
  const id = params?.id;

  // Fetch order details from your API (adjust if your route differs)
  const order = await getJSON(`${process.env.NEXT_PUBLIC_APP_ORIGIN ?? ''}/api/orders/${id}`)
    .catch(async () => {
      // fallback to relative during runtime
      return getJSON(`/api/orders/${id}`);
    });

  const o = order?.item || order || {};
  let exec = null;

  // If the API doesn't include exec info, look it up (route already exists in your app set)
  if (o.exec_id) {
    try {
      const j = await getJSON(`${process.env.NEXT_PUBLIC_APP_ORIGIN ?? ''}/api/users/lookup?id=${o.exec_id}`)
        .catch(async () => getJSON(`/api/users/lookup?id=${o.exec_id}`));
      exec = j?.user || j || null;
    } catch {}
  }

  return (
    <main className="min-h-[100dvh] text-slate-100 px-6 py-10" style={{ backgroundColor: BG }}>
      <div className="max-w-3xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Order #{String(id).slice(0, 12)}</h1>
          <p className="text-amber-300/80 text-sm mt-1">Details & status</p>
        </header>

        <section className="rounded-2xl border p-5"
          style={{
            borderColor: 'rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(0,0,0,.45), rgba(0,0,0,.35))',
            boxShadow: `0 10px 40px -10px ${EDGE_GLOW}`,
          }}>
          <div className="grid gap-3">
            <Row label="Tier"       value={o.tier ? cap(o.tier) : '—'} />
            <Row label="Area"       value={o.area_tag || '—'} />
            <Row label="Scheduled"  value={dtUTC(o.delivery_slot_at)} />
            <Row label="Status"     value={o.status ? cap(o.status) : '—'} />
            <Row label="Total"      value={usd(o.price_cents)} />
            <Row label="Customer"   value={o.customer_email || '—'} />
          </div>

          {/* Referred by badge */}
          <div className="mt-5">
            <div className="text-sm text-amber-200 mb-1">Referred by</div>
            {exec ? (
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1
                              ring-1 ring-amber-400/40 bg-amber-500/10 text-amber-100">
                <span className="font-medium">{exec.name || exec.full_name || 'Executive'}</span>
                {exec.email && <span className="text-amber-200/80">• {exec.email}</span>}
              </div>
            ) : (
              <div className="text-xs text-slate-400">None</div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="text-sm text-amber-200/90">{label}</div>
      <div className="text-sm text-slate-200">{value}</div>
    </div>
  );
}
function cap(s){ return (s||'').slice(0,1).toUpperCase() + (s||'').slice(1); }
