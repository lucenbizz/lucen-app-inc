// /components/OrderStatusBadge.jsx
"use client";

export default function OrderStatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  const map = {
    paid:     "bg-blue-100 text-blue-800",
    scheduled:"bg-amber-100 text-amber-800",
    fulfilled:"bg-green-100 text-green-800",
    cancelled:"bg-gray-100 text-gray-700",
  };
  const cls = map[s] || "bg-gray-100 text-gray-700";
  return <span className={`px-2 py-0.5 text-xs rounded-full ${cls}`}>{s || "—"}</span>;
}
