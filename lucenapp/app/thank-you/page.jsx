// /app/thank-you/page.jsx  (single file)
'use client';
export const dynamic = 'force-dynamic';

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

export default function ThankYouPageWrapper() {
  return (
    <Suspense fallback={<div className="p-6">Loading receipt…</div>}>
      <ThankYouInner />
    </Suspense>
  );
}

function ThankYouInner() {
  const sp = useSearchParams();
  const orderId = sp.get("orderId");
  const tier = sp.get("tier");
  const amount = sp.get("amount");
  const slot = sp.get("slot");
  const area = sp.get("area");

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Thanks for your purchase!</h1>
      <div className="border rounded-2xl p-4">
        <div className="text-sm text-gray-600">Order ID</div>
        <div className="font-mono">{orderId || "—"}</div>
        <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-gray-600">Tier</div>
            <div className="font-medium">{tier || "—"}{area ? ` · ${area}` : ""}</div>
          </div>
          <div>
            <div className="text-gray-600">Amount</div>
            <div className="font-medium">{amount || "—"}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-gray-600">Scheduled slot</div>
            <div className="font-medium">
              {slot ? new Date(slot).toLocaleString("en-US", { timeZone: "America/New_York" }) : "—"}
            </div>
          </div>
        </div>
      </div>
      <a href="/account/orders" className="inline-block border rounded-xl px-4 py-2 hover:shadow">
        View my orders
      </a>
    </main>
  );
}
