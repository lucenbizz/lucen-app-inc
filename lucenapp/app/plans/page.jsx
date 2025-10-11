'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  TIER_RATES_CENTS, TIER_ORDER, TIER_DISPLAY,
  centsToUSD, tierTitle, tierFeatures,
} from '../lib/payout';
import { pointsFor, maxRedeemablePoints, REDEEM_STEP } from '../lib/loyalty';

export default function PlansPage() {
  return (
    <Suspense fallback={<main className="p-6 max-w-4xl mx-auto">Loading…</main>}>
      <PlansInner />
    </Suspense>
  );
}

function PlansInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialTier = (params.get('tier') || 'bronze').toLowerCase();

  // Tier/pricing
  const [tier, setTier] = useState(TIER_ORDER.includes(initialTier) ? initialTier : 'bronze');
  const cartTotalCents = TIER_RATES_CENTS[tier];
  const title = tierTitle(tier);
  const features = tierFeatures(tier);

  // Loyalty (ok if 401; we just show 0)
  const [balance, setBalance] = useState(0);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/loyalty/summary', { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        setBalance(j?.summary?.points_balance || 0);
      } catch {}
    })();
  }, []);
  const maxRedeemPts = useMemo(() => maxRedeemablePoints(balance, cartTotalCents), [balance, cartTotalCents]);
  const [redeemPts, setRedeemPts] = useState(0);
  const [reservation, setReservation] = useState(null); // {id, pointsReserved, valueCents, expiresAt}
  const [countdown, setCountdown] = useState(0);
  const [orderTempId] = useState(() => cryptoRandomId());

  // Areas
  const [areas, setAreas] = useState([]);          // [{tag,name}]
  const [areaTag, setAreaTag] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/areas?fields=basic&active=true', { cache: 'no-store' });
        const j = await r.json();
        const items = Array.isArray(j.items) ? j.items : [];
        setAreas(items);
        if (!areaTag && items.length) setAreaTag(items[0].tag);
      } catch {}
    })();
  }, []); // eslint-disable-line

  // Day dropdown: today → +6 days
  const days = useMemo(() => {
    const out = [];
    const base = new Date(); base.setHours(0,0,0,0);
    for (let i=0;i<7;i++){
      const d = new Date(base.getTime() + i*86400000);
      out.push({ key: ymd(d), label: humanDay(d) });
    }
    return out;
  }, []);
  const [dayKey, setDayKey] = useState('');
  useEffect(() => { if (!dayKey && days.length) setDayKey(days[0].key); }, [days, dayKey]);

  // Time dropdown: every 20 min
  const timeOptions = useMemo(() => {
    const out = [];
    for (let h=0;h<24;h++){
      for (let m=0;m<60;m+=20){
        out.push({ key: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`, label: humanLocalTime(h,m) });
      }
    }
    return out;
  }, []);
  const [timeKey, setTimeKey] = useState('');
  useEffect(() => { if (!timeKey && timeOptions.length) setTimeKey(timeOptions[0].key); }, [timeOptions, timeKey]);

  // Combine to ISO (UTC) aligned to :00 on a 20-min boundary
  const slotAt = useMemo(() => {
    if (!dayKey || !timeKey) return '';
    const [h,m] = timeKey.split(':').map(n=>parseInt(n,10));
    const d = parseYMD(dayKey); d.setHours(h,m,0,0);                 // local time chosen
    if (d.getMinutes() % 20 !== 0) d.setMinutes(d.getMinutes() - (d.getMinutes()%20));
    return d.toISOString();                                          // send ISO (UTC)
  }, [dayKey, timeKey]);

  // Availability probe (open; server hard-gates again in /api/payments/intent)
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(null);
  const [availMsg, setAvailMsg] = useState('');
  useEffect(() => {
    (async () => {
      if (!areaTag || !slotAt) { setAvailable(null); setAvailMsg(''); return; }
      setChecking(true); setAvailable(null); setAvailMsg('');
      try {
        const r = await fetch('/api/coverage/check', {
          method: 'POST', headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ area_tag: areaTag, delivery_slot_at: slotAt }),
        });
        const j = await r.json().catch(()=>({}));
        if (r.ok && j?.ok) { setAvailable(true); setAvailMsg(j?.reason || 'Coverage looks good.'); }
        else { setAvailable(false); setAvailMsg(j?.error || 'Coverage not available.'); }
      } catch { setAvailable(false); setAvailMsg('Coverage check failed.'); }
      finally { setChecking(false); }
    })();
  }, [areaTag, slotAt]);

  // Reserve points
  async function reservePoints(points){
    if (!points) { setReservation(null); return; }
    const r = await fetch('/api/loyalty/reserve', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ orderTempId, requestedPoints: points, priceCents: cartTotalCents })
    });
    const j = await r.json();
    if (!r.ok) { alert(j.error || 'Reserve failed'); return; }
    setReservation({ id: j.reservationId, pointsReserved: j.pointsReserved, valueCents: j.valueCents, expiresAt: j.expiresAt });
  }
  // countdown
  useEffect(() => {
    if (!reservation?.expiresAt) { setCountdown(0); return; }
    const tick = () => {
      const ms = new Date(reservation.expiresAt).getTime() - Date.now();
      setCountdown(Math.max(0, Math.ceil(ms/1000)));
    };
    tick();
    const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [reservation?.expiresAt]);

  // Create intent — try, if 401 redirect to sign-in; on success go to /checkout
  const [intent, setIntent] = useState(null);
  async function createIntent(){
    if (!areaTag) return alert('Choose a service area first.');
    if (!slotAt)  return alert('Choose a delivery time slot first.');

    const payload = {
      area_tag: areaTag,
      delivery_slot_at: slotAt,
      cartTotalCents,
      reservationId: reservation?.id || null,
      orderTempId,
    };

    const res = await fetch('/api/payments/intent', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });

    if (res.status === 401) {
      const next = `/plans?tier=${encodeURIComponent(tier)}`;
      router.push(`/sign-in?next=${encodeURIComponent(next)}`);
      return;
    }

    const json = await res.json().catch(()=>({}));
    if (!res.ok) { alert(json.error || 'Failed to create intent'); return; }
    setIntent(json);

    // Stash clientSecret so checkout can pick it up immediately (optional)
    try {
      if (json?.clientSecret) localStorage.setItem('lastClientSecret', json.clientSecret);
    } catch {}

    // Navigate to checkout with context
    const url = new URL('/checkout', window.location.origin);
    url.searchParams.set('tier', tier);
    url.searchParams.set('area', areaTag);
    url.searchParams.set('slot', slotAt);                // ISO
    url.searchParams.set('pi', json.paymentIntentId);    // demo id
    if (reservation?.id) url.searchParams.set('rsv', reservation.id);

    router.push(url.pathname + url.search);
  }

  // UI totals
  const discountCents = reservation?.valueCents || 0;
  const totalCents = Math.max(0, cartTotalCents - discountCents);
  const willEarn = pointsFor(totalCents, tier);

  // Reset when tier changes
  useEffect(() => { setRedeemPts(0); setReservation(null); setIntent(null); }, [tier]);

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-5 bg-black text-amber-100 rounded-2xl">
      <h1 className="text-2xl font-bold">Choose your ebook plan</h1>

      {/* Tier cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {TIER_ORDER.map((t) => (
          <label key={t}
            className={`border border-amber-500/30 rounded-2xl p-3 flex items-start gap-3 cursor-pointer bg-zinc-900/50 ${tier===t?'ring-2 ring-amber-400':''}`}>
            <input type="radio" name="tier" checked={tier===t} onChange={()=>setTier(t)} className="mt-1" />
            <div>
              <div className="font-medium text-amber-200">{TIER_DISPLAY[t].title}</div>
              <div className="text-sm text-amber-300/80">${centsToUSD(TIER_RATES_CENTS[t])}</div>
              <ul className="text-xs text-amber-200/80 mt-1 space-y-0.5">
                {TIER_DISPLAY[t].features.map((f,i)=><li key={i}>• {f}</li>)}
              </ul>
            </div>
          </label>
        ))}
      </div>

      {/* Area + Day + Time */}
      <div className="border border-amber-500/30 rounded-2xl p-4 space-y-3 bg-zinc-900/50">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <div className="text-sm font-semibold mb-1 text-amber-200">Service area</div>
            <select value={areaTag} onChange={(e)=>setAreaTag(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-amber-500/40 px-3 py-2 outline-none">
              {areas.map(a => <option key={a.tag} value={a.tag}>{a.name}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-sm font-semibold mb-1 text-amber-200">Day</div>
            <select value={dayKey} onChange={(e)=>setDayKey(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-amber-500/40 px-3 py-2 outline-none">
              {days.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-sm font-semibold mb-1 text-amber-200">Time (20-min)</div>
            <select value={timeKey} onChange={(e)=>setTimeKey(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-amber-500/40 px-3 py-2 outline-none">
              {timeOptions.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
        </div>

        <div className="text-xs text-amber-200/70">
          Selected: area=<code className="text-amber-300">{areaTag || '—'}</code>, slot=<code className="text-amber-300">{slotAt || '—'}</code>
        </div>
        <div className="text-sm">
          {checking && <span className="text-amber-300/80">Checking availability…</span>}
          {!checking && available === true && <span className="text-emerald-300">✓ {availMsg}</span>}
          {!checking && available === false && <span className="text-rose-300">✕ {availMsg}</span>}
        </div>
      </div>

      {/* Summary + Loyalty */}
      <div className="border border-amber-500/30 rounded-2xl p-4 space-y-2 bg-zinc-900/50">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold text-amber-100">{title}</div>
            <div className="text-sm text-amber-200/70">{features.join(' • ')}</div>
            <div className="text-sm text-emerald-300 mt-1">
              You’ll earn <strong>{willEarn}</strong> points on this purchase.
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-200">${centsToUSD(cartTotalCents)}</div>
        </div>

        <div className="mt-2 border-t border-amber-500/20 pt-3">
          <div className="font-semibold mb-1 text-amber-200">Use your points</div>
          <div className="text-sm text-amber-200/80 mb-2">
            Balance: <strong>{balance.toLocaleString()}</strong> pts • Redeem in {REDEEM_STEP}-pt steps (1,000 pts = $5).
          </div>
          <RedeemPicker value={redeemPts} onChange={(p)=>{ setRedeemPts(p); reservePoints(p); }} max={maxRedeemPts} />

          {reservation && (
            <div className="mt-2 text-sm flex items-center gap-3">
              <span className="px-2 py-1 border border-amber-500/30 rounded-xl bg-black/40">
                Reserved: {reservation.pointsReserved.toLocaleString()} pts (−${centsToUSD(reservation.valueCents || 0)})
              </span>
              <CountdownBadge seconds={countdown} onRefresh={() => reservePoints(redeemPts || REDEEM_STEP)} />
            </div>
          )}

          <div className="flex items-center justify-end gap-4 pt-2">
            <div className="text-sm text-amber-200/80">Discount: <strong>${centsToUSD(reservation?.valueCents || 0)}</strong></div>
            <div className="text-xl font-bold text-amber-100">Total: ${centsToUSD(totalCents)}</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={createIntent}
          disabled={!areaTag || !slotAt}
          className="border border-amber-500/50 rounded-xl px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create Payment Intent
        </button>
        {intent?.provider === 'demo' && (
          <span className="text-sm text-amber-300/80">Intent: {intent.paymentIntentId}</span>
        )}
      </div>
    </main>
  );
}

/* ---- helpers ---- */
function RedeemPicker({ value, onChange, max }) {
  const steps = []; for (let p=0; p<=max; p+=REDEEM_STEP) steps.push(p);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {steps.map(p => (
        <button key={p} onClick={()=>onChange(p)}
          className={`text-sm border border-amber-500/40 rounded-xl px-3 py-1 ${value===p?'bg-amber-500 text-black':'bg-black/40 hover:bg-black/60 text-amber-100'}`}>
          {p.toLocaleString()} pts
        </button>
      ))}
      {max===0 && <span className="text-xs text-amber-300/70">No redeemable points for this cart.</span>}
    </div>
  );
}
function CountdownBadge({ seconds, onRefresh }) {
  if (!seconds) {
    return <button className="text-xs border border-amber-500/40 rounded-xl px-2 py-1 bg-black/40" onClick={onRefresh}>Re-reserve</button>;
  }
  return <span className="text-amber-200/80">Expires in {seconds}s</span>;
}
function ymd(d){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function parseYMD(s){ const [y,m,d]=s.split('-').map(n=>parseInt(n,10)); return new Date(y,m-1,d,0,0,0,0); }
function humanDay(d){ return new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'2-digit'}).format(d); }
function humanLocalTime(h,m){ const d=new Date(); d.setHours(h,m,0,0); return new Intl.DateTimeFormat('en-US',{hour:'2-digit',minute:'2-digit',hour12:true}).format(d); }
function cryptoRandomId(){ if (typeof crypto!=='undefined' && crypto.getRandomValues){ const a=new Uint32Array(4); crypto.getRandomValues(a); return [...a].map(x=>x.toString(16).padStart(8,'0')).join(''); } return Math.random().toString(36).slice(2)+Date.now().toString(36); }
