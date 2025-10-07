// /components/PricingGrid.jsx
"use client";

import Link from "next/link";
import { TIER_ORDER, TIER_RATES_CENTS, TIER_DISPLAY, centsToUSD } from "@/lib/payout";

export default function PricingGrid() {
  return (
    <section className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Choose your ebook tier</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TIER_ORDER.map((tier) => (
          <PlanCard key={tier} tier={tier} />
        ))}
      </div>
    </section>
  );
}

function PlanCard({ tier }) {
  const priceUSD = centsToUSD(TIER_RATES_CENTS[tier]);
  const { title, features } = TIER_DISPLAY[tier];
  return (
    <div className="border rounded-2xl p-4 flex flex-col">
      <div className="text-lg font-semibold">{title}</div>
      <div className="text-3xl font-bold mt-2">${priceUSD}</div>
      <ul className="text-sm text-gray-700 mt-3 space-y-1">
        {features.map((f, i) => (
          <li key={i}>• {f}</li>
        ))}
      </ul>
      <Link
        href={`/checkout?tier=${tier}`}
        className="mt-auto inline-block border rounded-xl px-3 py-2 hover:shadow text-center"
      >
        Choose {title}
      </Link>
    </div>
  );
}
 