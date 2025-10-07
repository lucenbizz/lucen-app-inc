// /app/checkout/page.jsx
'use client';
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  TIER_RATES_CENTS,
  TIER_ORDER,
  TIER_DISPLAY,
  centsToUSD,
  tierTitle,
  tierFeatures,
} from "../lib/payout";
import {
  pointsFor,
  maxRedeemablePoints,
  REDEEM_STEP,
} from "../lib/loyalty";

export default function CheckoutPageWrapper() {
  return (
    <Suspense fallback={<div className="p-6">Loading checkout…</div>}>
      <CheckoutPageInner />
    </Suspense>
  );
}

function CheckoutPageInner() {
  const params = useSearchParams();

  // Initials via URL (?tier=&slot=&area=)
  const initialTier = (params.get("tier") || "bronze").toLowerCase();
  const [tier, setTier] = useState(TIER_ORDER.includes(initialTier) ? initialTier : "bronze");

  // Delivery details
  const initialSlotIso = params.get("slot") || "";
  const [slotLocal, setSlotLocal] = useState(isoToLocalInputValue(initialSlotIso)); // datetime-local
  const [areaTag, setAreaTag] = useState(params.get("area") || "");

  // Shipping/contact (minimal)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address1, setAddress1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postal, setPostal] = useState("");

  // Pricing + points
  const cartTotalCents = TIER_RATES_CENTS[tier];
  const title = tierTitle(tier);
  const features = tierFeatures(tier);

  const [balance, setBalance] = useState(0);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/loyalty/summary");
        const json = await res.json();
        setBalance(json?.summary?.points_balance || 0);
      } catch {}
    })();
  }, []);
  const maxRedeemPts = useMemo(() => maxRedeemablePoints(balance, cartTotalCents), [balance, cartTotalCents]);
  const [redeemPts, setRedeemPts] = useState(0);

  // Reservation state
  const [orderTempId] = useState(() => cryptoRandomId());
  const [reservation, setReservation] = useState(null); // { id, valueCents, expiresAt, pointsReserved }
  const [countdown, setCountdown] = useState(0);
  const [intent, setIntent] = useState(null); // { provider, clientSecret, amountCents, paymentIntentId }
  const [message, setMessage] = useState("");

  // Availability
  const [availability, setAvailability] = useState({ checked: false, available: false, loading: false });

  // Reserve points when user picks amount
  async function reservePoints(points) {
    if (!points) { setReservation(null); setIntent(null); return; }
    const res = await fetch("/api/loyalty/reserve", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderTempId, requestedPoints: points, priceCents: cartTotalCents })
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error || "Reserve failed"); return; }
    setReservation({
      id: json.reservationId,
      pointsReserved: json.pointsReserved,
      valueCents: json.valueCents,
      expiresAt: json.expiresAt,
    });
    setIntent(null);
  }

  // Expiry countdown
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

  // Check coverage for areaTag
  async function checkAvailability(tag) {
    if (!tag?.trim()) { setAvailability({ checked: true, available: false, loading: false }); return; }
    setAvailability(a => ({ ...a, loading: true }));
    try {
      const res = await fetch(`/api/coverage/check?area=${encodeURIComponent(tag.trim())}`);
      const json = await res.json();
      setAvailability({ checked: true, available: !!json.available, loading: false });
    } catch {
      setAvailability({ checked: true, available: false, loading: false });
    }
  }
  useEffect(() => {
    const id = setTimeout(() => checkAvailability(areaTag), 250);
    return () => clearTimeout(id);
  }, [areaTag]);

  // Create payment intent (covers reservation + availability)
  async function createIntent() {
    setMessage("");
    if (!reservation?.id) { alert("Reserve points first (or choose 0 pts)."); return; }
    if (areaTag && availability.checked && !availability.available) {
      alert("We don’t have coverage in your area yet. Please submit a request.");
      return;
    }
    const payload = {
      reservationId: reservation.id,
      orderTempId,
      cartTotalCents,
      tier,
      area_tag: areaTag || null,
      slot: localInputToISO(slotLocal),
      address: { name, email, address1, city, state, postal },
    };
    const res = await fetch("/api/payments/intent", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) {
      if (json?.action === "submit_request") {
        setMessage("No coverage yet. Please submit a delivery request.");
      } else if (json?.action === "re_reserve") {
        setMessage("Your reservation expired. Please re-reserve points.");
      } else {
        setMessage(json.error || "Failed to create payment intent");
      }
      return;
    }
    setIntent(json);
    setMessage("✅ Payment intent created. Continue with payment.");
  }

  // Demo helper (only used if provider==='demo')
  async function simulatePaySuccess() {
    if (!intent?.paymentIntentId) return alert("Create payment intent first.");
    const res = await fetch("/api/payments/webhook", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "demo",
        type: "payment.succeeded",
        payment_intent_id: intent.paymentIntentId,
        amount_cents: intent.amountCents,
        purchaseTier: tier,
      }),
    });
    const json = await res.json();
    if (!res.ok) return alert(json.error || "Webhook failed");
    alert("Payment committed. Points redeemed and new points awarded on the net charge.");
  }

  // Submit delivery request (if no coverage)
  async function submitDeliveryRequest() {
    setMessage("");
    const payload = {
      tier,
      delivery_slot_at: localInputToISO(slotLocal),
      area_tag: areaTag || null,
      address: { name, email, address1, city, state, postal },
      notes: "Customer requested coverage via checkout",
    };
    const res = await fetch("/api/delivery-requests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) { setMessage(json.error || "Could not submit request"); return; }
    setMessage("✅ Request submitted. We’ll notify you once coverage is available.");
  }

  // UI computations
  const discountCents = reservation?.valueCents || 0;
  const totalCents = Math.max(0, cartTotalCents - discountCents);
  const willEarn = pointsFor(totalCents, tier);

  // Reset when tier changes
  useEffect(() => { setRedeemPts(0); setReservation(null); setIntent(null); }, [tier]);

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Checkout</h1>

      {/* Plan selector */}
      <section className="border rounded-2xl p-4">
        <h2 className="font-semibold mb-3">Choose your plan</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {TIER_ORDER.map((t) => (
            <label key={t}
              className={`border rounded-xl p-3 flex items-start gap-3 cursor-pointer ${tier===t?"ring-2 ring-black":""}`}>
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
      </section>

      {/* Delivery time + area */}
      <section className="border rounded-2xl p-4">
        <h2 className="font-semibold mb-3">Delivery time & area</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">
            Delivery slot (20-min steps)
            <input
              type="datetime-local"
              value={slotLocal}
              onChange={(e) => setSlotLocal(e.target.value)}
              step={60 * 20}
              className="block border rounded-xl px-3 py-2 w-full mt-1"
            />
          </label>
          <label className="text-sm">
            Area tag
            <input
              type="text"
              value={areaTag}
              onChange={(e) => setAreaTag(e.target.value)}
              placeholder="e.g., queens-astoria"
              className="block border rounded-xl px-3 py-2 w-full mt-1"
            />
          </label>
        </div>
        <div className="mt-2 text-sm">
          {availability.loading && <span className="text-gray-500">Checking availability…</span>}
          {!availability.loading && availability.checked && areaTag && (
            availability.available
              ? <span className="text-green-700">Coverage available in <b>{areaTag}</b>. You can proceed to payment.</span>
              : <span className="text-amber-700">No active driver/executive in <b>{areaTag}</b> right now.</span>
          )}
        </div>
      </section>

      {/* Contact & address */}
      <section className="border rounded-2xl p-4">
        <h2 className="font-semibold mb-3">Contact & delivery address</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">
            Full name
            <input value={name} onChange={(e) => setName(e.target.value)} className="block border rounded-xl px-3 py-2 w-full mt-1" />
          </label>
          <label className="text-sm">
            Email (for receipt)
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="block border rounded-xl px-3 py-2 w-full mt-1" />
          </label>
          <label className="text-sm md:col-span-2">
            Address line 1
            <input value={address1} onChange={(e) => setAddress1(e.target.value)} className="block border rounded-xl px-3 py-2 w-full mt-1" />
          </label>
          <label className="text-sm">
            City
            <input value={city} onChange={(e) => setCity(e.target.value)} className="block border rounded-xl px-3 py-2 w-full mt-1" />
          </label>
          <label className="text-sm">
            State/Region
            <input value={state} onChange={(e) => setState(e.target.value)} className="block border rounded-xl px-3 py-2 w-full mt-1" />
          </label>
          <label className="text-sm">
            Postal code
            <input value={postal} onChange={(e) => setPostal(e.target.value)} className="block border rounded-xl px-3 py-2 w-full mt-1" />
          </label>
        </div>
      </section>

      {/* Loyalty + totals */}
      <section className="border rounded-2xl p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold">{title}</div>
            <div className="text-sm text-gray-600">{features.join(" • ")}</div>
            <div className="text-sm text-green-700 mt-1">
              You’ll earn <strong>{pointsFor(Math.max(0, cartTotalCents - (reservation?.valueCents || 0)), tier)}</strong> points on this purchase.
            </div>
          </div>
          <div className="text-2xl font-bold">${centsToUSD(cartTotalCents)}</div>
        </div>

        <div className="mt-2 border-t pt-3">
          <div className="font-semibold mb-1">Use your points</div>
          <div className="text-sm text-gray-600 mb-2">
            Balance: <strong>{balance.toLocaleString()}</strong> pts • Redeem in {REDEEM_STEP}-pt steps (1,000 pts = $5).
          </div>
          <RedeemPicker value={redeemPts} onChange={(p)=>{ setRedeemPts(p); reservePoints(p); }} max={maxRedeemPts} />

          {reservation && (
            <div className="mt-2 text-sm flex items-center gap-3">
              <span className="px-2 py-1 border rounded-xl bg-gray-50">
                Reserved: {reservation.pointsReserved.toLocaleString()} pts (−${centsToUSD(reservation.valueCents)})
              </span>
              <span className="text-gray-600">Expires in {countdown}s</span>
              {countdown === 0 && (
                <button className="text-xs border rounded-xl px-2 py-1" onClick={()=>reservePoints(redeemPts || REDEEM_STEP)}>Re-reserve</button>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-4 pt-2">
            <div className="text-sm">Discount: <strong>${centsToUSD(reservation?.valueCents || 0)}</strong></div>
            <div className="text-xl font-bold">Total: ${centsToUSD(totalCents)}</div>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className={`text-sm ${message.startsWith("✅") ? "text-green-700" : "text-amber-700"}`}>{message}</div>
        <div className="flex gap-2">
          <button
            onClick={createIntent}
            disabled={(areaTag && availability.checked && !availability.available)}
            className="border rounded-xl px-4 py-2 hover:shadow disabled:opacity-50"
          >
            Create Payment Intent
          </button>
          {(intent?.provider === "demo") && (
            <button onClick={simulatePaySuccess} className="border rounded-xl px-4 py-2 hover:shadow">
              DEMO: Simulate Paid
            </button>
          )}
          {(areaTag && availability.checked && !availability.available) && (
            <button onClick={submitDeliveryRequest} className="border rounded-xl px-4 py-2 hover:shadow">
              Submit request for delivery
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

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

function isoToLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToISO(local) {
  if (!local) return null;
  return new Date(local).toISOString();
}
function cryptoRandomId() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const a = new Uint32Array(4); crypto.getRandomValues(a);
    return [...a].map(x=>x.toString(16).padStart(8,"0")).join("");
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
