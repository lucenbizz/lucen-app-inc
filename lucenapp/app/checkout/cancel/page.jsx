// app/checkout/cancel/page.jsx
'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';

export default function CancelPage() {
  return (
    <Suspense fallback={<Shell><p className="text-gray-400">Loading…</p></Shell>}>
      <CancelInner />
    </Suspense>
  );
}

function CancelInner() {
  return (
    <Shell>
      <div className="w-full max-w-2xl border border-gray-800 rounded-2xl p-8 bg-black/70 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-yellow-400 flex items-center justify-center">
            <span className="text-black font-bold">!</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-yellow-400">Payment canceled</h1>
        </div>

        <p className="mt-4 text-gray-300">
          Your Stripe checkout was canceled before completion. You can try again or pick a different plan.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <a
            href="/plans"
            className="text-center px-5 py-2 rounded-xl bg-yellow-400 text-black font-semibold hover:bg-yellow-300 transition-all hover:shadow-[0_0_10px_rgba(255,215,0,0.7)]"
          >
            Choose plan again
          </a>
          <a
            href="/"
            className="text-center px-5 py-2 rounded-xl border border-gray-700 hover:border-yellow-400 hover:bg-yellow-400/10 transition-all"
          >
            Back to home
          </a>
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
