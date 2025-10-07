// /components/LoyaltyWidget.jsx
"use client";
import { useEffect, useState } from "react";
import { MULTIPLIERS } from "../lib/loyalty";

export default function LoyaltyWidget() {
  const [s, setS] = useState(null);
  useEffect(() => {
    (async () => {
      const res = await fetch('/api/loyalty/summary');
      const json = await res.json();
      setS(json.summary || null);
    })();
  }, []);
  if (!s) return null;

  const balance = s.points_balance || 0;
  const nextRewardEvery = 1000; // pts
  const rewardValueCents = 500; // $5
  const progress = Math.min(100, Math.round((balance % nextRewardEvery) / nextRewardEvery * 100));

  return (
    <div className="border rounded-2xl p-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-600">Your points</div>
          <div className="text-3xl font-bold">{balance.toLocaleString()}</div>
        </div>
        <div className="text-sm text-gray-600">
          <div>Lifetime: {(s.lifetime_points||0).toLocaleString()}</div>
          <div>Streak: {s.streak_days||0} day(s)</div>
        </div>
      </div>
      <div className="mt-3">
        <div className="text-xs text-gray-600 mb-1">Next $ {(rewardValueCents/100).toFixed(2)} at {nextRewardEvery} pts</div>
        <div className="h-2 bg-white border rounded-full overflow-hidden">
          <div className="h-full" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="text-xs text-gray-500 mt-3">
        Multipliers: Bronze ×{MULTIPLIERS.bronze} • Silver ×{MULTIPLIERS.silver} • Gold ×{MULTIPLIERS.gold} • Black ×{MULTIPLIERS.black}
      </div>
    </div>
  );
}
 