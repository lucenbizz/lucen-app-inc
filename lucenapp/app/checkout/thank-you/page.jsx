'use client';
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ThankYouPageWrapper() {
  return (
    <Suspense fallback={<main className="max-w-2xl mx-auto p-8">Loading…</main>}>
      <ThankYouInner />
    </Suspense>
  );
}

function ThankYouInner() {
  const sp = useSearchParams();
  const orderId = sp.get('order');

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-4">
      <h1 className="text-2xl font-bold">Thank you!</h1>
      <p>Your order has been placed and is scheduled. We just sent your confirmation.</p>
      {orderId && (
        <p className="text-sm text-gray-600">
          Reference ID: <span className="font-mono">{orderId}</span>
        </p>
      )}
    </main>
  );
}
