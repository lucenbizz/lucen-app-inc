// /app/staff/deliveries/page.jsx
"use client";

import { useEffect, useState } from "react";
import OrderStatusBadge from "../../components/OrderStatusBadge";
import { centsToUSD } from "../../lib/pricing";

async function api(path, opts){
  const res = await fetch(path, opts);
  const json = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

export default function StaffDeliveriesPage(){
  const [onlyMine, setOnlyMine] = useState(true);
  const [hours, setHours] = useState(48);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  async function load(){
    setLoading(true);
    try{
      const sp = new URLSearchParams();
      if (onlyMine) sp.set("onlyMine", "1");
      sp.set("hours", String(hours));
      const { items, count } = await api(`/api/staff/deliveries?${sp.toString()}`);
      setItems(items || []); setCount(count || 0);
    } catch(e){ alert(e.message); } finally { setLoading(false); }
  }

  useEffect(()=>{ load(); }, [onlyMine, hours]);

  async function claim(orderId){
    if (!confirm("Claim this delivery?")) return;
    try { await api("/api/orders/claim", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ orderId }) }); load(); }
    catch(e){ alert(e.message); }
  }

  async function markDelivered(orderId){
    if (!confirm("Mark as delivered? This will finalize payouts.")) return;
    try { await api("/api/orders/mark-fulfilled", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ orderId }) }); load(); }
    catch(e){ alert(e.message); }
  }

  return (
    <main className="p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">My Deliveries</h1>
        <div className="text-sm text-gray-500">{count} upcoming</div>
      </div>

      <div className="border rounded-2xl p-3 bg-gray-50 grid md:grid-cols-4 gap-3 items-end">
        <label className="text-sm">Window (hours)
          <input type="number" min={1} max={168} value={hours} onChange={(e)=>setHours(Number(e.target.value||48))} className="block border rounded-xl px-3 py-2 w-full"/>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={onlyMine} onChange={(e)=>setOnlyMine(e.target.checked)} />
          <span className="text-sm">Show only my assignments</span>
        </label>
        <div className="md:col-span-2 flex justify-end gap-2">
          <button className="border rounded-xl px-3 py-2 hover:shadow" onClick={load}>Refresh</button>
        </div>
      </div>

      <div className="border rounded-2xl overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="py-2 px-3">Slot</th>
              <th className="py-2 px-3">Area</th>
              <th className="py-2 px-3">Customer / Address</th>
              <th className="py-2 px-3">Order</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(o => {
              const slot = o.delivery_slot_at ? new Date(o.delivery_slot_at).toLocaleString("en-US",{ timeZone: "America/New_York" }) : "—";
              const addr = [o.shipping_name, o.shipping_address1, o.shipping_city].filter(Boolean).join(", ");
              const myRow = !!o.assigned_staff_id;
              return (
                <tr key={o.id} className={`border-t ${myRow ? "" : "bg-amber-50/40"}`}>
                  <td className="py-2 px-3 whitespace-nowrap">{slot}</td>
                  <td className="py-2 px-3">{o.area_tag || "—"}</td>
                  <td className="py-2 px-3">
                    <div className="font-medium">{o.shipping_name || "Customer"}</div>
                    <div className="text-xs text-gray-500">{addr || "—"}</div>
                  </td>
                  <td className="py-2 px-3 font-mono text-xs">{o.id}</td>
                  <td className="py-2 px-3"><OrderStatusBadge status={o.status}/></td>
                  <td className="py-2 px-3">
                    <div className="flex gap-2 justify-end">
                      {!o.assigned_staff_id && (
                        <button onClick={()=>claim(o.id)} className="text-xs border rounded-xl px-2 py-1 hover:shadow">Claim</button>
                      )}
                      {!!o.assigned_staff_id && (
                        <button onClick={()=>markDelivered(o.id)} className="text-xs border rounded-xl px-2 py-1 hover:shadow">Mark delivered</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length===0 && <tr><td colSpan={6} className="py-6 text-center text-gray-500">No deliveries in window</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
