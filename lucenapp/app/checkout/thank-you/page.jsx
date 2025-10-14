// app/checkout/thank-you/page.jsx
'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ThankYouPage() {
  return (
    <Suspense fallback={<PageShell><p className="text-gray-400">Loading…</p></PageShell>}>
      <ThankYouInner />
    </Suspense>
  );
}

function ThankYouInner() {
  const params = useSearchParams();
  const sessionId = params.get('session_id');

  const shortId = useMemo(() => {
    if (!sessionId) return '';
    return sessionId.length > 10
      ? `${sessionId.slice(0, 8)}…${sessionId.slice(-6)}`
      : sessionId;
  }, [sessionId]);

  return (
    <PageShell>
      <div className="w-full max-w-2xl border border-gray-800 rounded-2xl p-8 bg-black/70 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-yellow-400 flex items-center justify-center">
            <span className="text-black font-bold">✓</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-yellow-400">
            Thank you for your purchase
          </h1>
        </div>

        <p className="mt-4 text-gray-300">
          Your payment was processed successfully. We’ve sent a confirmation email with your
          receipt and next steps.
        </p>

        {sessionId && (
          <div className="mt-4 text-sm text-gray-400">
            Stripe session:&nbsp;
            <code className="px-2 py-1 rounded bg-black/60 border border-gray-800">
              {shortId}
            </code>
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
          Tip: If you don’t see your order right away, give it a few seconds—Stripe webhooks may
          take a moment to finalize fulfillment.
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({ children }) {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      {children}
    </main>
  );
}
