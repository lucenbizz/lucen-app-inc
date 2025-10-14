'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import {
  TIER_RATES_CENTS,
  TIER_ORDER,
  TIER_DISPLAY,
  centsToUSD,
  tierTitle,
  tierFeatures,
} from '../lib/payout';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

export default function PlansPage() {
  return (
    <Suspense fallback={<main className="p-6 text-center text-white">Loading…</main>}>
      <PlansInner />
    </Suspense>
  );
}

function PlansInner() {
  const params = useSearchParams();
  const initialTier = (params.get('tier') || 'bronze').toLowerCase();
  const [tier, setTier] = useState(TIER_ORDER.includes(initialTier) ? initialTier : 'bronze');
  const [areas, setAreas] = useState([]);
  const [areaTag, setAreaTag] = useState('');
  const [slotAt, setSlotAt] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/areas?fields=basic&active=true', { cache: 'no-store' });
        const j = await r.json();
        const items = Array.isArray(j.items) ? j.items : [];
        setAreas(items);
        const urlArea = params.get('area');
        if (urlArea) setAreaTag(urlArea);
        else if (items.length) setAreaTag(items[0].tag);
      } catch {
        setAreas([]);
      }
    })();
  }, []);

  const MIN_LEAD_MIN = 20;
  const slots = useMemo(() => {
    const out = [];
    const now = new Date();
    const start = new Date(now.getTime() + MIN_LEAD_MIN * 60 * 1000);
    const aligned = new Date(start);
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
  useEffect(() => {
    const urlSlot = params.get('slot');
    if (urlSlot) setSlotAt(urlSlot);
    else if (!slotAt && slots.length) setSlotAt(slots[0].iso);
  }, [slots]);

  async function startCheckout() {
    if (!areaTag) return alert('Choose a service area first.');
    if (!slotAt) return alert('Choose a delivery time slot first.');
    const res = await fetch('/api/payments/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents: TIER_RATES_CENTS[tier],
        tier,
        area_tag: areaTag,
        delivery_slot_at: slotAt,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json?.error || 'Failed to start checkout.');
      return;
    }
    if (json?.url) window.location.href = json.url;
  }

  const cartTotalCents = TIER_RATES_CENTS[tier];
  const title = tierTitle(tier);
  const features = tierFeatures(tier);

  return (
    <main className="min-h-screen bg-black text-white p-6 flex flex-col items-center space-y-6">
      <h1 className="text-3xl font-bold text-yellow-400">Lucen Membership Plans</h1>
      <p className="text-sm text-gray-400 max-w-md text-center">
        Choose your tier, select your service area, and continue securely through Stripe Checkout.
      </p>

      {/* Tier cards */}
      <div className="grid gap-3 sm:grid-cols-2 max-w-3xl w-full">
        {TIER_ORDER.map((t) => (
          <label
            key={t}
            className={`border rounded-2xl p-4 transition-all duration-200 cursor-pointer ${
              tier === t
                ? 'border-yellow-400 ring-2 ring-yellow-400 bg-gradient-to-br from-yellow-400/10 to-transparent'
                : 'border-gray-700 hover:border-yellow-400 hover:bg-yellow-400/5'
            }`}
          >
            <input
              type="radio"
              name="tier"
              checked={tier === t}
              onChange={() => setTier(t)}
              className="hidden"
            />
            <div>
              <div className="font-semibold text-yellow-300">{TIER_DISPLAY[t].title}</div>
              <div className="text-sm text-gray-400 mb-2">
                ${centsToUSD(TIER_RATES_CENTS[t])}
              </div>
              <ul className="text-xs text-gray-400 space-y-1">
                {TIER_DISPLAY[t].features.map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
            </div>
          </label>
        ))}
      </div>

      {/* Area & Slot selectors */}
      <div className="max-w-3xl w-full border border-gray-800 rounded-2xl p-4 bg-black/50 backdrop-blur">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="text-sm font-semibold text-yellow-400 mb-1">Service area</div>
            <select
              value={areaTag}
              onChange={(e) => setAreaTag(e.target.value)}
              className="w-full rounded-xl bg-black border border-gray-700 px-3 py-2 text-white focus:border-yellow-400 focus:ring-0"
            >
              {areas.map((a) => (
                <option key={a.tag} value={a.tag}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-sm font-semibold text-yellow-400 mb-1">Delivery time (UTC)</div>
            <select
              value={slotAt}
              onChange={(e) => setSlotAt(e.target.value)}
              className="w-full rounded-xl bg-black border border-gray-700 px-3 py-2 text-white focus:border-yellow-400 focus:ring-0"
            >
              {slots.map((s) => (
                <option key={s.iso} value={s.iso}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Summary + Pay */}
      <div className="max-w-3xl w-full border border-gray-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between bg-black/70 backdrop-blur">
        <div>
          <div className="font-semibold text-yellow-400">{title}</div>
          <div className="text-sm text-gray-400">{features.join(' • ')}</div>
        </div>
        <div className="text-right mt-4 sm:mt-0">
          <div className="text-2xl font-bold text-yellow-300">
            ${centsToUSD(cartTotalCents)}
          </div>
          <button
            onClick={startCheckout}
            className="mt-2 px-5 py-2 rounded-xl bg-yellow-400 text-black font-semibold hover:bg-yellow-300 transition-all hover:shadow-[0_0_10px_rgba(255,215,0,0.7)]"
          >
            Pay with Stripe
          </button>
        </div>
      </div>
    </main>
  );
}

/* Helper */
function humanUTC(d) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${fmt.format(d)} UTC`;
}
