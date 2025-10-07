// /app/plans/page.jsx
'use client';

import { useEffect, useMemo, useState } from 'react';

// Import whole modules, then safely pick what we need (with fallbacks)
let payout = {};
let loyalty = {};
try { payout = require('../lib/payout'); } catch {}
try { loyalty = require('../lib/loyalty'); } catch {}

/* ===========================
   SAFE HELPERS (fallbacks if missing from libs)
   =========================== */
const TIER_ORDER = Array.isArray(payout.TIER_ORDER)
  ? payout.TIER_ORDER
  : ['bronze', 'silver', 'gold', 'black'];

const TIER_RATES_CENTS = payout.TIER_RATES_CENTS ?? {
  bronze: 5000,   // $50
  silver: 7500,   // $75
  gold:   15000,  // $150
  black:  50000,  // $500
};

const TIER_DISPLAY = payout.TIER_DISPLAY ?? {
  bronze: { title: 'Bronze Ebook', features: ['Standard delivery', 'Basic support'] },
  silver: { title: 'Silver Ebook', features: ['Standard delivery', 'Priority support'] },
  gold:   { title: 'Gold Ebook · Priority Delivery', features: ['Priority delivery', 'Premium support'] },
  black:  { title: 'Black Ebook · VIP · Priority', features: ['VIP status', 'Priority delivery', 'Concierge support'] },
};

const centsToUSD = typeof payout.centsToUSD === 'function'
  ? payout.centsToUSD
  : (c) => ((c ?? 0) / 100).toFixed(2);

// Loyalty fallbacks
const REDEEM_STEP = Number(loyalty.REDEEM_STEP) || 1000; // redeem in 1k steps
const multipliers = { bronze: 1.0, silver: 1.25, gold: 1.5, black: 2.0 }; // $1 = 5 pts × multiplier
const pointsFor = typeof loyalty.pointsFor === 'function'
  ? loyalty.pointsFor
  : (payableCents, tier) => {
      const mult = multipliers[tier] ?? 1.0;
      return Math.round((payableCents / 100) * 5 * mult);
    };
const maxRedeemablePoints = typeof loyalty.maxRedeemablePoints === 'function'
  ? loyalty.maxRedeemablePoints
  : (balancePts, priceCents) => {
      // 1000 pts => $5  => 1 pt = $0.005 = 0.5 cents
      const byPriceCap = Math.floor(priceCents / 0.5);
      const hardCap = Math.max(0, Math.min(balancePts, byPriceCap));
      // step down to nearest REDEEM_STEP
      return Math.floor(hardCap / REDEEM_STEP) * REDEEM_STEP;
    };

/* ===========================
   THEME (Black & Gold)
   =========================== */
const BG = '#0b0b0c';
const GOLD_SOFT = 'rgba(245, 158, 11, .14)';
const EDGE_GLOW = 'rgba(245, 158, 11, .25)';

function cn(...xs){ return xs.filter(Boolean).join(' '); }
function usd(c) { return `$${centsToUSD(c)}`; }

/* ===========================
   FETCH HELPERS
   =========================== */
async function fetchJSON(url, init) {
  const res = await fetch(url, { cache: 'no-store', ...init });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

/* ===========================
   TIME SLOT HELPERS
   =========================== */
function nextDays(n = 7) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    d.setHours(0,0,0,0);
    out.push(d);
  }
  return out;
}
function dayTimes20m() {
  const out = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 20) {
      const label = new Date(2000,0,1,h,m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      out.push({ h, m, label });
    }
  }
  return out;
}
function toISOAtLocal(d, h, m) {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x.toISOString();
}

/* ===========================
   COMPONENT
   =========================== */
export default function PlansPage() {
  // Tier selection
  const [tier, setTier] = useState(TIER_ORDER[0] || 'bronze');
  const cartTotalCents = TIER_RATES_CENTS[tier] || 0;

  // Area dropdown
  const [areas, setAreas] = useState([]); // [{tag,name}]
  const [areaTag, setAreaTag] = useState('');

  // Slot dropdowns
  const days = useMemo(() => nextDays(7), []);
  const times = useMemo(() => dayTimes20m(), []);
  const [dayIndex, setDayIndex] = useState(null);
  const [timeIndex, setTimeIndex] = useState(null);

  // Loyalty
  const [balance, setBalance] = useState(0);
  useEffect(() => {
    (async () => {
      try {
        const s = await fetchJSON('/api/loyalty/summary');
        setBalance(s?.summary?.points_balance ?? 0);
      } catch { setBalance(0); }
    })();
  }, []);

  const maxRedeemPts = useMemo(
    () => maxRedeemablePoints(balance, cartTotalCents),
    [balance, cartTotalCents]
  );
  const [redeemPts, setRedeemPts] = useState(0);

  // Reservation
  const [orderTempId] = useState(() => cryptoRandomId());
  const [reservation, setReservation] = useState(null); // {id, pointsReserved, valueCents, expiresAt}
  const [countdown, setCountdown] = useState(0);

  // Payment intent
  const [intent, setIntent] = useState(null); // {provider, clientSecret, amountCents, paymentIntentId}
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load areas
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchJSON('/api/areas'); // expect {items:[{tag,name}]} or array
        const list = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        const norm = list.map(x => ({ tag: x.tag || x.id || String(x), name: x.name || x.label || (x.tag || x.id || String(x)) }));
        setAreas(norm);
        if (norm.length > 0) setAreaTag(norm[0].tag);
      } catch {
        setAreas([]);
      }
    })();
  }, []);

  // auto reserve when redeemPts changes (and > 0). Clear if 0.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!redeemPts) { setReservation(null); setIntent(null); return; }
      try {
        const r = await fetchJSON('/api/loyalty/reserve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderTempId, requestedPoints: redeemPts, priceCents: cartTotalCents }),
        });
        if (!cancelled) {
          setReservation({
            id: r.reservationId,
            pointsReserved: r.pointsReserved,
            valueCents: r.valueCents,
            expiresAt: r.expiresAt,
          });
          setIntent(null);
        }
      } catch (e) {
        if (!cancelled) setErrorMsg(e.message || 'Failed to reserve points');
      }
    })();
    return () => { cancelled = true; };
  }, [redeemPts, cartTotalCents, orderTempId]);

  // countdown
  useEffect(() => {
    if (!reservation?.expiresAt) { setCountdown(0); return; }
    const tick = () => {
      const ms = new Date(reservation.expiresAt).getTime() - Date.now();
      setCountdown(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [reservation?.expiresAt]);

  // Calculate derived UI
  const discountCents = reservation?.valueCents || 0;
  const totalCents = Math.max(0, cartTotalCents - discountCents);
  const willEarn = pointsFor(totalCents, tier);

  // Slot ISO
  const deliverySlotISO = useMemo(() => {
    if (dayIndex == null || timeIndex == null) return '';
    return toISOAtLocal(days[dayIndex], times[timeIndex].h, times[timeIndex].m);
  }, [dayIndex, timeIndex, days, times]);

  // Actions
  async function createIntent() {
    setSubmitting(true);
    setErrorMsg('');
    try {
      if (!areaTag) throw new Error('Please choose an area.');
      if (!deliverySlotISO) throw new Error('Please choose a date & time.');
      // If using points, ensure a live reservation
      if (redeemPts > 0 && !reservation?.id) {
        throw new Error('Your points reservation expired. Please re-reserve.');
      }

      const body = {
        reservationId: reservation?.id || null,
        orderTempId,
        cartTotalCents,
        tier,
        areaTag,
        deliverySlotAt: deliverySlotISO,
      };

      const j = await fetchJSON('/api/payments/intent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setIntent(j);
    } catch (e) {
      setErrorMsg(e.message || 'Failed to create payment intent');
    } finally {
      setSubmitting(false);
    }
  }

  async function simulatePaySuccess() {
    if (!intent?.paymentIntentId) return alert('Create payment intent first.');
    try {
      const res = await fetch('/api/payments/webhook', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'demo',
          type: 'payment.succeeded',
          payment_intent_id: intent.paymentIntentId,
          amount_cents: intent.amountCents,
          purchaseTier: tier,
          area_tag: areaTag,
          delivery_slot_at: deliverySlotISO,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Webhook failed');
      alert('Payment committed. Points redeemed and new points awarded on the net charge.');
      // window.location.href = `/checkout/thank-you?order=${json.order_id || ''}`;
    } catch (e) {
      alert(e.message || 'Simulation failed');
    }
  }

  // Reset reservation/intent when tier changes
  useEffect(() => { setRedeemPts(0); setReservation(null); setIntent(null); }, [tier]);

  return (
    <main className="relative min-h-[100dvh] text-slate-100" style={{ backgroundColor: BG }}>
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

      <section className="relative max-w-6xl mx-auto px-6 py-10 space-y-6">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Choose an ebook</h1>
            <p className="text-amber-300/80 text-sm mt-1">Pick your tier, area, and delivery slot — then redeem points and pay.</p>
          </div>
          <div className="rounded-xl px-3 py-2 text-amber-100"
               style={{ background: 'rgba(0,0,0,.4)', border: '1px solid rgba(245,158,11,.35)' }}
               title="Your points balance">
            <span className="text-[11px] opacity-80 mr-2">Points</span>
            <strong>{balance.toLocaleString()}</strong>
          </div>
        </header>

        {/* Tiers */}
        <div className="grid md:grid-cols-2 gap-4">
          {TIER_ORDER.map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              className={cn(
                'text-left rounded-2xl border p-4 hover:shadow transition',
                tier === t
                  ? 'border-amber-400/70 bg-amber-400/10 shadow-[0_0_20px_rgba(245,158,11,0.18)]'
                  : 'border-white/10 bg-black/40 hover:border-amber-400/40 hover:bg-black/30'
              )}
              style={{ backdropFilter: 'blur(8px)' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-semibold">{TIER_DISPLAY[t]?.title ?? t}</div>
                  <div className="text-sm text-slate-300 mt-0.5">{(TIER_DISPLAY[t]?.features || []).join(' • ')}</div>
                </div>
                <div className="text-2xl font-bold text-amber-200">{usd(TIER_RATES_CENTS[t])}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Scheduling + Area */}
        <div
          className="rounded-2xl border p-4 grid md:grid-cols-3 gap-4"
          style={{
            borderColor: 'rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(0,0,0,.45), rgba(0,0,0,.35))',
            boxShadow: `0 10px 40px -10px ${EDGE_GLOW}`,
          }}
        >
          <div>
            <label className="block text-sm mb-1 text-amber-200">Area</label>
            <select
              value={areaTag}
              onChange={(e)=>setAreaTag(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-amber-500/30 px-3 py-2 outline-none focus:border-amber-400/70"
            >
              {areas.length === 0 && <option value="">No areas available</option>}
              {areas.map(a => (
                <option key={a.tag} value={a.tag}>{a.name} ({a.tag})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1 text-amber-200">Date</label>
            <select
              value={dayIndex ?? ''}
              onChange={(e)=>setDayIndex(e.target.value === '' ? null : Number(e.target.value))}
              className="w-full rounded-xl bg-black/40 border border-amber-500/30 px-3 py-2 outline-none focus:border-amber-400/70"
            >
              <option value="">Select date</option>
              {days.map((d, i) => (
                <option key={i} value={i}>
                  {d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1 text-amber-200">Time (20-min)</label>
            <select
              value={timeIndex ?? ''}
              onChange={(e)=>setTimeIndex(e.target.value === '' ? null : Number(e.target.value))}
              className="w-full rounded-xl bg-black/40 border border-amber-500/30 px-3 py-2 outline-none focus:border-amber-400/70"
            >
              <option value="">Select time</option>
              {times.map((t, i) => (
                <option key={i} value={i}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Loyalty & Summary */}
        <div
          className="rounded-2xl border p-4 space-y-3"
          style={{
            borderColor: 'rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(0,0,0,.45), rgba(0,0,0,.35))',
            boxShadow: `0 10px 40px -10px ${EDGE_GLOW}`,
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold">{TIER_DISPLAY[tier]?.title ?? tier}</div>
              <div className="text-sm text-slate-300">{(TIER_DISPLAY[tier]?.features || []).join(' • ')}</div>
              <div className="text-sm text-green-500 mt-1">
                You’ll earn <strong>{pointsFor(Math.max(0, cartTotalCents - (reservation?.valueCents||0)), tier)}</strong> points.
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-200">{usd(cartTotalCents)}</div>
          </div>

          <div className="border-t border-white/10 pt-3">
            <div className="font-semibold mb-1">Redeem your points</div>
            <div className="text-sm text-slate-300 mb-2">
              Balance: <strong>{balance.toLocaleString()}</strong> pts • Redeem in {REDEEM_STEP}-pt steps (1,000 pts = $5).
            </div>
            <RedeemPicker value={redeemPts} onChange={setRedeemPts} max={maxRedeemPts} />

            {reservation && (
              <ReservationBadge reservation={reservation} countdown={countdown} onRereserve={() => {
                setRedeemPts(Math.max(REDEEM_STEP, Math.min(maxRedeemPts, redeemPts || REDEEM_STEP)));
              }}/>
            )}

            <div className="flex items-center justify-end gap-4 pt-2">
              <div className="text-sm">Discount: <strong>${centsToUSD(discountCents)}</strong></div>
              <div className="text-xl font-bold">Total: {usd(totalCents)}</div>
            </div>
          </div>
        </div>

        {/* Error */}
        {errorMsg && <div className="text-rose-300 text-sm">{errorMsg}</div>}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            disabled={submitting}
            onClick={createIntent}
            className={cn(
              'border rounded-xl px-4 py-2 transition',
              'border-amber-500/30 bg-black/40 text-amber-100 hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-50',
              submitting && 'opacity-60 cursor-not-allowed'
            )}
          >
            Create Payment Intent
          </button>

          {intent?.provider === 'demo' && (
            <button
              onClick={simulatePaySuccess}
              className="border rounded-xl px-4 py-2 border-amber-500/30 bg-black/40 text-amber-100 hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-50 transition"
            >
              DEMO: Simulate Paid
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

/* ===========================
   SMALL COMPONENTS
   =========================== */
function RedeemPicker({ value, onChange, max }) {
  const steps = [];
  for (let p = 0; p <= max; p += REDEEM_STEP) steps.push(p);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {steps.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            'text-sm border rounded-xl px-3 py-1',
            value === p ? 'bg-amber-500/20 border-amber-400/60 text-amber-50' : 'bg-black/40 border-amber-500/30 hover:border-amber-400/60'
          )}
        >
          {p.toLocaleString()} pts
        </button>
      ))}
      {max === 0 && <span className="text-xs text-slate-400">No redeemable points for this cart.</span>}
    </div>
  );
}

function ReservationBadge({ reservation, countdown, onRereserve }) {
  return (
    <div className="mt-2 text-sm flex items-center gap-3">
      <span className="px-2 py-1 rounded-xl bg-amber-500/10 border border-amber-400/30 text-amber-100">
        Reserved: {reservation.pointsReserved.toLocaleString()} pts (−${centsToUSD(reservation.valueCents)})
      </span>
      <span className="text-slate-300">Expires in {countdown}s</span>
      {countdown === 0 && (
        <button
          className="text-xs border rounded-xl px-2 py-1 border-amber-500/30 hover:border-amber-400/60"
          onClick={onRereserve}
          title="Re-reserve"
        >
          Re-reserve
        </button>
      )}
    </div>
  );
}

function cryptoRandomId() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const a = new Uint32Array(4); crypto.getRandomValues(a);
    return [...a].map(x=>x.toString(16).padStart(8,"0")).join("");
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
