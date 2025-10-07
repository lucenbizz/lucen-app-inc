// /app/admin/requests/page.jsx
"use client";

import { useEffect, useState } from "react";
import RoleGate from "../../components/RoleGate";         // if you have it; otherwise remove
import { useRoles } from "../../hooks/useRoles";          // if you have it; otherwise remove

function LocalAdminNav(){
  const { isAdmin, isExecutive, ready } = useRoles?.() || { isAdmin:true, isExecutive:true, ready:true };
  if (!ready) return null;
  return (
    <nav className="flex gap-2 flex-wrap mb-4">
      <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/orders">Orders</a>
      {(isExecutive || isAdmin) && (
        <>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/payouts/exec">Exec Payouts</a>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/payouts/staff">Staff Payouts</a>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/users">Users</a>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/requests">Requests</a>
        </>
      )}
    </nav>
  );
}

async function api(path, opts){
  const res = await fetch(path, opts);
  const json = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

export default function RequestsPage(){
  // If you don't have RoleGate, just render <RequestsInner/>
  return (
    <RoleGate minRole="executive" fallback={<main className="p-6">No access.</main>}>
      <RequestsInner/>
    </RoleGate>
  );
}

function RequestsInner(){
  const [status, setStatus] = useState("pending"); // pending|approved|declined|fulfilled|any
  const [area, setArea] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load(){
    setLoading(true);
    try{
      const sp = new URLSearchParams();
      if (status !== "any") sp.set("status", status);
      if (area) sp.set("area", area);
      const { items } = await api(`/api/admin/requests?${sp.toString()}`);
      setItems(items || []);
    } catch(e){ alert(e.message); } finally { setLoading(false); }
  }
  useEffect(()=>{ load(); }, []);

  async function act(id, action){
    try{
      const res = await api(`/api/admin/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id })
      });
      if (res.orderId) alert(`Order created: ${res.orderId}`);
      load();
    } catch(e){ alert(e.message); }
  }

  return (
    <main className="p-6 space-y-4 max-w-6xl mx-auto">
      <LocalAdminNav/>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Delivery Requests</h1>
        <button onClick={load} className="border rounded-xl px-3 py-2 hover:shadow" disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="border rounded-2xl p-3 bg-gray-50 grid md:grid-cols-4 gap-3 items-end">
        <label className="text-sm">Status
          <select value={status} onChange={(e)=>setStatus(e.target.value)} className="block border rounded-xl px-3 py-2 w-full">
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="any">Any</option>
          </select>
        </label>
        <label className="text-sm">Area tag
          <input value={area} onChange={e=>setArea(e.target.value)} placeholder="e.g., queens-astoria" className="block border rounded-xl px-3 py-2 w-full"/>
        </label>
        <div className="md:col-span-2 flex justify-end gap-2">
          <button onClick={load} className="border rounded-xl px-3 py-2 hover:shadow">Apply</button>
          <button onClick={()=>{ setStatus("pending"); setArea(""); load(); }} className="border rounded-xl px-3 py-2 hover:shadow">Reset</button>
        </div>
      </div>

      <div className="border rounded-2xl overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="py-2 px-3">Request</th>
              <th className="py-2 px-3">Customer</th>
              <th className="py-2 px-3">Tier / Area</th>
              <th className="py-2 px-3">Slot</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(r => (
              <tr key={r.id} className="border-t">
                <td className="py-2 px-3">
                  <div className="font-mono text-xs">#{r.id}</div>
                  <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</div>
                </td>
                <td className="py-2 px-3">
                  <div className="text-sm">{r.customer_email || "—"}</div>
                  <div className="text-xs text-gray-500 truncate max-w-[200px]">{r.address?.address1 || "—"}</div>
                </td>
                <td className="py-2 px-3">
                  <div className="font-medium capitalize">{r.tier}</div>
                  <div className="text-xs text-gray-600">{r.area_tag || "—"}</div>
                </td>
                <td className="py-2 px-3">
                  <div className="text-xs">{r.delivery_slot_at ? new Date(r.delivery_slot_at).toLocaleString() : "—"}</div>
                </td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${badgeCls(r.status)}`}>{r.status.toUpperCase()}</span>
                </td>
                <td className="py-2 px-3 text-right">
                  <div className="flex gap-2 justify-end flex-wrap">
                    {r.status === 'pending' && (
                      <>
                        <button onClick={()=>act(r.id, 'approve')} className="text-xs border rounded-xl px-2 py-1 hover:shadow">Approve</button>
                        <button onClick={()=>act(r.id, 'decline')} className="text-xs border rounded-xl px-2 py-1 hover:shadow">Decline</button>
                      </>
                    )}
                    {(r.status === 'pending' || r.status === 'approved') && (
                      <button onClick={()=>act(r.id, 'convert')} className="text-xs border rounded-xl px-2 py-1 hover:shadow">Convert → Order</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-gray-500">No requests</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function badgeCls(s) {
  switch (s) {
    case 'pending': return "bg-amber-100 text-amber-800";
    case 'approved': return "bg-blue-100 text-blue-800";
    case 'declined': return "bg-red-100 text-red-800";
    case 'fulfilled': return "bg-green-100 text-green-800";
    default: return "bg-gray-100 text-gray-800";
  }
}
