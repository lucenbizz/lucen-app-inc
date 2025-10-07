// /components/UserBadge.jsx
"use client";

import { useEffect, useState } from "react";

// simple module cache to avoid refetching the same user
const cache = new Map();

export default function UserBadge({ userId }) {
  const [user, setUser] = useState(() => cache.get(userId) || null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!userId || cache.has(userId)) {
        setUser(cache.get(userId) || null);
        return;
      }
      const res = await fetch(`/api/users/lookup?ids=${encodeURIComponent(userId)}`);
      const json = await res.json();
      const u = json.items?.[0] || null;
      cache.set(userId, u);
      if (!cancelled) setUser(u);
    }
    run();
    return () => { cancelled = true; };
  }, [userId]);

  if (!userId) return <span className="text-xs text-gray-500">—</span>;
  if (!user) return <span className="inline-flex items-center gap-2 text-xs text-gray-500">
    <span className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" /> loading…
  </span>;

  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-xs">
        {String(user.name || user.email || "?").slice(0,1).toUpperCase()}
      </span>
      <span className="text-sm">
        <span className="font-medium">{user.name || "—"}</span>
        <span className="text-gray-500"> · {user.email || "—"}</span>
      </span>
    </span>
  );
}
 