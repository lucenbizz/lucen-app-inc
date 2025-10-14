// app/checkout/thank-you/page.jsx
'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ThankYouPage() {
  return (
    <Suspense fallback={<Shell><p className="text-gray-400">Loading…</p></Shell>}>
      <ThankYouInner />
    </Suspense>
  );
}

function ThankYouInner() {
  const params = useSearchParams();
  const sessionId = params.get('session_id');
  const [loading, setLoading] = useState(!!sessionId);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const r = await fetch(`/api/payments/checkout/session?id=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || 'Failed to load session');
        setData(j);
      } catch (e) {
        setErr(e.message || 'Failed to load session');
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  const shortId = useMemo(() => {
    if (!sessionId) return '';
    return sessionId.length > 10
      ? `${sessionId.slice(0, 8)}…${sessionId.slice(-6)}`
      : sessionId;
  }, [sessionId]);

  const amount = data?.amount_total != null ? (data.amount_total / 100).toFixed(2) : null;
  const email  = data?.customer_details?.email || null;

  return (
    <Shell>
      <div className="w-full max-w-2xl border border-gray-800 rounded-2xl p-8 bg-black/70 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-yellow-400 flex items-center justify-center">
            <span className="text-black font-bold">✓</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-yellow-400">Thank you for your purchase</h1>
        </div>

        <p className="mt-4 text-gray-300">
          Your payment was processed successfully. We’ve sent a confirmation email with your receipt and next steps.
        </p>

        {sessionId && (
          <div className="mt-4 text-sm text-gray-400 space-y-1">
            <div>
              Stripe session:&nbsp;
              <code className="px-2 py-1 rounded bg-black/60 border border-gray-800">{shortId}</code>
            </div>
            {loading && <div>Loading details…</div>}
            {err && <div className="text-red-400">Error: {err}</div>}
            {data && (
              <>
                {amount && <div>Amount paid: <span className="text-yellow-300 font-semibold">${amount}</span></div>}
                {email && <div>Receipt sent to: <span className="text-yellow-300 font-semibold">{email}</span></div>}
              </>
            )}
          </div>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <a
            href="/"
            className="text-center px-5 py-2 rounded-xl border border-gray-700 hover:border-yellow-400 hover:bg-yellow-400/10 transition-all"
          >
            Back to home
          </a>
          <a
            href="/account/orders"
            className="text-center px-5 py-2 rounded-xl bg-yellow-400 text-black font-semibold hover:bg-yellow-300 transition-all hover:shadow-[0_0_10px_rgba(255,215,0,0.7)]"
          >
            View your order
          </a>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          Tip: If you don’t see your order right away, give it a few seconds—Stripe webhooks may take a moment to finalize fulfillment.
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      {children}
    </main>
  );
}
