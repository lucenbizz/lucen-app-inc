'use client';


import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  TIER_RATES_CENTS,
  TIER_ORDER,
  TIER_DISPLAY,
  centsToUSD,
  tierTitle,
  tierFeatures,
} from '../lib/payout';
import {
  pointsFor,
  maxRedeemablePoints,
  REDEEM_STEP,
} from '../lib/loyalty';

import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

export default function CheckoutPage() {
  return (
    <Suspense fallback={<main className="p-6 max-w-3xl mx-auto">Loading…</main>}>
      <CheckoutInner />
    </Suspense>
  );
}

function CheckoutInner() {
  const params = useSearchParams();
  const initialTier = (params.get('tier') || 'bronze').toLowerCase();
  const [tier, setTier] = useState(TIER_ORDER.includes(initialTier) ? initialTier : 'bronze');

  // Pricing
  const cartTotalCents = TIER_RATES_CENTS[tier];
  const title = tierTitle(tier);
  const features = tierFeatures(tier);

  // Loyalty
  const [balance, setBalance] = useState(0);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/loyalty/summary', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        setBalance(json?.summary?.points_balance || 0);
      } catch {}
    })();
  }, []);
  const maxRedeemPts = useMemo(
    () => maxRedeemablePoints(balance, cartTotalCents),
    [balance, cartTotalCents]
  );
  const [redeemPts, setRedeemPts] = useState(0);

  // Reservation / intent
  const [orderTempId] = useState(() => cryptoRandomId());
  const [reservation, setReservation] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [intent, setIntent] = useState(null); // { provider, clientSecret, amountCents, paymentIntentId }

  // Areas & Slot (prefill from Plans)
  const [areas, setAreas] = useState([]);
  const [areaTag, setAreaTag] = useState('');
  const [slotAt, setSlotAt] = useState('');
  const piFromQuery = params.get('pi') || '';

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/areas?fields=basic&active=true', { cache: 'no-store' });
        const j = await r.json();
        const items = Array.isArray(j.items) ? j.items : [];
        setAreas(items);

        const areaParam = params.get('area');
        if (areaParam) setAreaTag(areaParam);
        else if (items.length) setAreaTag(items[0].tag);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefill tier/slot and intent secret from Plans/localStorage
  useEffect(() => {
    const urlTier = (params.get('tier') || '').toLowerCase();
    if (urlTier && TIER_ORDER.includes(urlTier)) setTier(urlTier);

    const slotParam = params.get('slot');
    if (slotParam) setSlotAt(slotParam);

    try {
      const cs = localStorage.getItem('lastClientSecret');
      if (cs && piFromQuery) {
        setIntent({
          provider: 'stripe',
          clientSecret: cs,
          paymentIntentId: piFromQuery,
          amountCents: TIER_RATES_CENTS[urlTier || 'bronze'],
        });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build next 72 slots (20 min apart) in UTC (fallback UI)
  const slots = useMemo(() => {
    const out = [];
    const now = new Date();
    const aligned = new Date(now);
    aligned.setUTCSeconds(0, 0);
    const m = aligned.getUTCMinutes();
    const add = (20 - (m % 20)) % 20;
    aligned.setUTCMinutes(m + add);
    for (let i = 0; i < 72; i++) {
      const d = new Date(aligned.getTime() + i * 20 * 60 * 1000);
      out.push({ iso: d.toISOString(), label: humanUTC(d) });
    }
    return out;
  }, []);
  useEffect(() => { if (!slotAt && slots.length) setSlotAt(slots[0].iso); }, [slots, slotAt]);

  // Loyalty reservation
  async function reservePoints(points) {
    if (!points) { setReservation(null); setIntent(null); return; }
    const res = await fetch('/api/loyalty/reserve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderTempId, requestedPoints: points, priceCents: cartTotalCents })
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error || 'Reserve failed'); return; }
    setReservation({
      id: json.reservationId,
      pointsReserved: json.pointsReserved,
      valueCents: json.valueCents,
      expiresAt: json.expiresAt,
    });
    setIntent(null);
  }
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

  // Create (or recreate) intent from Checkout (if Plans wasn’t used)
  async function createIntent() {
    if (!areaTag) return alert('Choose a service area first.');
    if (!slotAt) return alert('Choose a delivery time slot first.');
    const res = await fetch('/api/payments/intent', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        area_tag: areaTag,
        delivery_slot_at: slotAt,
        cartTotalCents,
        reservationId: reservation?.id || null,
        orderTempId,
        tier,
      })
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error || 'Failed to create intent'); return; }
    setIntent(json);
    try { if (json?.clientSecret) localStorage.setItem('lastClientSecret', json.clientSecret); } catch {}
  }

  // Confirm payment (Stripe Elements)
  const canRenderElements = !!(intent?.provider === 'stripe' && intent?.clientSecret && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const discountCents = reservation?.valueCents || 0;
  const totalCents = Math.max(0, cartTotalCents - discountCents);
  const willEarn = pointsFor(totalCents, tier);

  // Reset on tier change (keep intent if it matches new tier only if you want)
  useEffect(() => { setRedeemPts(0); setReservation(null); }, [tier]);

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Checkout</h1>

      {/* Tier */}
      <div className="border rounded-2xl p-4">
        <div className="font-semibold mb-2">Select ebook tier</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {TIER_ORDER.map((t) => (
            <label key={t}
              className={`border rounded-xl p-3 flex items-start gap-3 cursor-pointer ${tier===t?'ring-2 ring-black':''}`}>
              <input type="radio" name="tier" checked={tier===t} onChange={()=>setTier(t)} className="mt-1" />
              <div>
                <div className="font-medium">{TIER_DISPLAY[t].title}</div>
                <div className="text-sm text-gray-600">${centsToUSD(TIER_RATES_CENTS[t])}</div>
                <ul className="text-xs text-gray-700 mt-1 space-y-0.5">
                  {TIER_DISPLAY[t].features.map((f,i)=><li key={i}>• {f}</li>)}
                </ul>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Area + Slot */}
      <div className="border rounded-2xl p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="text-sm font-semibold mb-1">Service area</div>
            <select
              value={areaTag}
              onChange={(e)=>setAreaTag(e.target.value)}
              className="w-full rounded-xl bg-white border px-3 py-2"
            >
              {areas.map(a => (
                <option key={a.tag} value={a.tag}>{a.name}</option>
              ))}
            </select>
          </label>

        <label className="block">
          <div className="text-sm font-semibold mb-1">Delivery time (20-min slots, UTC)</div>
          <select
            value={slotAt}
            onChange={(e)=>setSlotAt(e.target.value)}
            className="w-full rounded-xl bg-white border px-3 py-2"
          >
            {slots.map(s => (
              <option key={s.iso} value={s.iso}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="text-xs text-gray-600">
        Selected: area=<code>{areaTag || '—'}</code>, slot=<code>{slotAt || '—'}</code>
      </div>
    </div>

      {/* Summary + Loyalty */}
      <div className="border rounded-2xl p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold">{title}</div>
            <div className="text-sm text-gray-600">{features.join(' • ')}</div>
            <div className="text-sm text-green-700 mt-1">
              You’ll earn <strong>{willEarn}</strong> points on this purchase.
            </div>
          </div>
          <div className="text-2xl font-bold">${centsToUSD(cartTotalCents)}</div>
        </div>

        <div className="mt-2 border-t pt-3">
          <div className="font-semibold mb-1">Use your points</div>
          <div className="text-sm text-gray-600 mb-2">
            Balance: <strong>{balance.toLocaleString()}</strong> pts • Redeem in {REDEEM_STEP}-pt steps (1,000 pts = $5).
          </div>
          <RedeemPicker
            value={redeemPts}
            onChange={(p)=>{ setRedeemPts(p); reservePoints(p); }}
            max={maxRedeemPts}
          />

          {reservation && (
            <div className="mt-2 text-sm flex items-center gap-3">
              <span className="px-2 py-1 border rounded-xl bg-gray-50">
                Reserved: {reservation.pointsReserved.toLocaleString()} pts (−${centsToUSD(reservation.valueCents || 0)})
              </span>
              <span className="text-gray-600">Expires in {countdown}s</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-4 pt-2">
            <div className="text-sm">Discount: <strong>${centsToUSD(reservation?.valueCents || 0)}</strong></div>
            <div className="text-xl font-bold">Total: ${centsToUSD(totalCents)}</div>
          </div>
        </div>
      </div>

      {/* Payment (Stripe Elements) */}
      {canRenderElements ? (
        <Elements stripe={stripePromise} options={{ clientSecret: intent.clientSecret }}>
          <StripeForm />
        </Elements>
      ) : (
        <div className="flex items-center justify-end gap-2">
          {!intent?.paymentIntentId && (
            <button onClick={createIntent} className="border rounded-xl px-4 py-2 hover:shadow">
              Create Payment Intent
            </button>
          )}
          {!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && (
            <p className="text-xs text-gray-500">
              Set <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> to render the payment form.
            </p>
          )}
        </div>
      )}
    </main>
  );
}

/* ---- Stripe Card Form ---- */
function StripeForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const onPay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setMsg('');

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Optional: redirect to a receipt page that reads PI from query
        return_url: typeof window !== 'undefined'
          ? `${window.location.origin}/checkout/thank-you`
          : undefined,
      },
      redirect: 'if_required', // allow in-page confirmations (US cards)
    });

    if (error) {
      setMsg(error.message || 'Payment failed');
    } else {
      setMsg('Payment processing… you may be redirected if required.');
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={onPay} className="border rounded-2xl p-4 space-y-3">
      <PaymentElement />
      <button
        disabled={!stripe || submitting}
        className="border rounded-xl px-4 py-2 hover:shadow disabled:opacity-50"
      >
        {submitting ? 'Processing…' : 'Pay now'}
      </button>
      {msg && <p className="text-sm text-gray-600">{msg}</p>}
    </form>
  );
}

/* ---- Small UI helpers ---- */
function RedeemPicker({ value, onChange, max }) {
  const steps = [];
  for (let p = 0; p <= max; p += REDEEM_STEP) steps.push(p);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {steps.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`text-sm border rounded-xl px-3 py-1 ${value===p?'bg-black text-white':'bg-white hover:shadow'}`}
        >
          {p.toLocaleString()} pts
        </button>
      ))}
      {max === 0 && <span className="text-xs text-gray-500">No redeemable points for this cart.</span>}
    </div>
  );
}

function cryptoRandomId() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const a = new Uint32Array(4); crypto.getRandomValues(a);
    return [...a].map(x=>x.toString(16).padStart(8,'0')).join('');
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function humanUTC(d) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  return `${fmt.format(d)} UTC`;
}
