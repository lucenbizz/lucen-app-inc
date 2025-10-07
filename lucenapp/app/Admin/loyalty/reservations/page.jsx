// /app/admin/loyalty/reservations/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import RoleGate from "../../../components/RoleGate";
import { useRoles } from "../../../hooks/useRoles";
import { centsToUSD } from "../../../lib/payout";

function fmt(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString("en-US", { timeZone: "America/New_York" });
  } catch {
    return ts;
  }
}

function StatusChip({ r }) {
  const active = r.status === "held" && new Date(r.expires_at).getTime() > Date.now();
  const text =
    r.status === "held" ? (active ? "held (active)" : "held (expired)") : r.status;
  const cls =
    r.status === "committed"
      ? "bg-green-100 text-green-800"
      : r.status === "canceled"
      ? "bg-gray-100 text-gray-800"
      : r.status === "expired"
      ? "bg-amber-100 text-amber-800"
      : active
      ? "bg-blue-100 text-blue-800"
      : "bg-amber-100 text-amber-800";
  return <span className={`px-2 py-0.5 rounded-full text-xs ${cls}`}>{text}</span>;
}

function LocalAdminNav() {
  const { isAdmin, isExecutive, ready } = useRoles();
  if (!ready) return null;
  return (
    <nav className="flex gap-2 flex-wrap mb-4">
      <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/orders">Orders</a>
      {(isExecutive || isAdmin) && (
        <>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/areas/coverage">Coverage</a>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/dispatch/simulator">Dispatch</a>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/audit">Audit</a>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/loyalty/reservations">Loyalty Holds</a>
        </>
      )}
      {isAdmin && (
        <>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/areas">Areas</a>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/areas/new">New Area</a>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/settings">Settings</a>
        </>
      )}
    </nav>
  );
}

export default function ReservationsPage() {
  return (
    <RoleGate minRole="executive" fallback={<main className="p-6">No access.</main>}>
      <ReservationsInner />
    </RoleGate>
  );
}

function ReservationsInner() {
  const [status, setStatus] = useState("any"); // any|held|committed|canceled|expired
  const [userId, setUserId] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load(reset = true) {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ limit: String(limit) });
      if (status) sp.set("status", status);
      if (userId) sp.set("userId", userId.trim());
      if (activeOnly) sp.set("activeOnly", "true");
      if (!reset && offset) sp.set("offset", String(offset));
      const res = await fetch(`/api/loyalty/reservations?${sp.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setCount(json.count || 0);
      setItems((v) => (reset ? json.items || [] : [...v, ...(json.items || [])]));
      setOffset(json.nextOffset || 0);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cancelHold(id) {
    if (!confirm("Cancel this reservation hold?")) return;
    const res = await fetch(`/api/loyalty/reservations/${id}/cancel`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) return alert(json.error || "Cancel failed");
    // refresh
    load(true);
  }

  return (
    <main className="p-6 space-y-4 max-w-6xl mx-auto">
      <LocalAdminNav />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Loyalty Reservations</h1>
        <div className="text-sm text-gray-500">{count} total</div>
      </div>

      <div className="border rounded-2xl p-3 grid md:grid-cols-6 gap-3 items-end bg-gray-50">
        <label className="text-sm">Status
          <select className="block border rounded-xl px-3 py-2 w-full" value={status} onChange={(e)=>setStatus(e.target.value)}>
            <option value="any">Any</option>
            <option value="held">Held</option>
            <option value="committed">Committed</option>
            <option value="canceled">Canceled</option>
            <option value="expired">Expired</option>
          </select>
        </label>
        <label className="text-sm">User ID
          <input className="block border rounded-xl px-3 py-2 w-full" placeholder="uuid…" value={userId} onChange={(e)=>setUserId(e.target.value)} />
        </label>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={activeOnly} onChange={(e)=>setActiveOnly(e.target.checked)} />
          <span>Active only</span>
        </label>
        <div className="md:col-span-3 flex justify-end gap-2">
          <button onClick={()=>load(true)} className="border rounded-xl px-3 py-2 hover:shadow">Search</button>
          <button onClick={()=>{
            setStatus("any"); setUserId(""); setActiveOnly(true); load(true);
          }} className="border rounded-xl px-3 py-2 hover:shadow">Reset</button>
        </div>
      </div>

      <div className="border rounded-2xl overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="py-2 px-3">Created</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3">Expires</th>
              <th className="py-2 px-3">User</th>
              <th className="py-2 px-3">Points</th>
              <th className="py-2 px-3">Discount</th>
              <th className="py-2 px-3">OrderTemp</th>
              <th className="py-2 px-3">PaymentIntent</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => {
              const active = r.status === "held" && new Date(r.expires_at).getTime() > Date.now();
              return (
                <tr key={r.id} className="border-t">
                  <td className="py-2 px-3 whitespace-nowrap text-gray-600">{fmt(r.created_at)}</td>
                  <td className="py-2 px-3"><StatusChip r={r} /></td>
                  <td className="py-2 px-3 whitespace-nowrap">{fmt(r.expires_at)}</td>
                  <td className="py-2 px-3 font-mono text-xs">{r.user_id}</td>
                  <td className="py-2 px-3">{r.points_reserved.toLocaleString()} pts</td>
                  <td className="py-2 px-3">${centsToUSD(r.value_cents)}</td>
                  <td className="py-2 px-3 font-mono text-xs">{r.order_temp_id}</td>
                  <td className="py-2 px-3 font-mono text-xs">{r.payment_intent_id || "—"}</td>
                  <td className="py-2 px-3">
                    {r.status === "held" && active && (
                      <button onClick={()=>cancelHold(r.id)} className="text-xs border rounded-xl px-2 py-1 hover:shadow">
                        Cancel hold
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={9} className="py-6 text-center text-gray-500">No reservations</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">Showing {items.length} of {count}</div>
        <button
          disabled={loading || items.length >= count}
          onClick={()=>load(false)}
          className="border rounded-xl px-3 py-2 hover:shadow disabled:opacity-50">
          Load more
        </button>
      </div>
    </main>
  );
}
