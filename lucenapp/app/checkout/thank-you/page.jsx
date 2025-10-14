'use client';

import { useSearchParams } from 'next/navigation';

export default function ThankYouPage() {
  const params = useSearchParams();
  const sessionId = params.get('session_id');

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Thanks for your purchase!</h1>
      <p className="text-gray-700">
        Your payment was processed successfully.
      </p>
      {sessionId && (
        <p className="text-sm text-gray-500">Stripe session: <code>{sessionId}</code></p>
      )}
      <a href="/" className="inline-block border rounded-xl px-4 py-2 hover:shadow">Go home</a>
    </main>
  );
}
