// /app/admin/orders/page.jsx  (UPDATED: adds StaffPicker for assignment + selection + bulk reschedule)
"use client";

import { useEffect, useMemo, useState } from "react";
import RoleGate from "../../components/RoleGate";
import { useRoles } from "../../hooks/useRoles";
import UserBadge from "../../components/UserBadge";
import OrderStatusBadge from "../../components/OrderStatusBadge";
import StaffPicker from "../../components/StaffPicker";
import { centsToUSD } from "../../lib/pricing";

function LocalAdminNav(){
  const { isAdmin, isExecutive, ready } = useRoles();
  if (!ready) return null;
  return (
    <nav className="flex gap-2 flex-wrap mb-4">
      <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/orders">Orders</a>
      {(isExecutive || isAdmin) && (
        <>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/audit">Audit</a>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/loyalty/reservations">Loyalty Holds</a>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/payouts/exec">Exec Payouts</a>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/payouts/staff">Staff Payouts</a>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/teams">Teams</a>
        </>
      )}
      {isAdmin && <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/settings">Settings</a>}
    </nav>
  );
}

function isoToLocalInputValue(iso){
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n)=> String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputValueToISO(v){
  if (!v) return null;
  const d = new Date(v); // local -> ISO
  return d.toISOString();
}
async function api(path, opts) {
  const res = await fetch(path, opts);
  const json = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

export default function AdminOrdersPage(){
  return (
    <RoleGate minRole="executive" fallback={<main className="p-6">No access.</main>}>
      <OrdersInner/>
    </RoleGate>
  );
}

function OrdersInner(){
  // filters
  const [status, setStatus] = useState("any");
  const [assigned, setAssigned] = useState("any"); // any|assigned|unassigned
  const [areaTag, setAreaTag] = useState("");
  const [q, setQ] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // data
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  // selection (supports select-all across results)
  const [selected, setSelected] = useState(()=>new Set());
  const [modeAll, setModeAll] = useState(false);
  const [excluded, setExcluded] = useState(()=>new Set());
  const selectedCount = modeAll ? (count - excluded.size) : selected.size;
  const allOnPageSelected = useMemo(()=>items.length>0 && items.every(i => (modeAll ? !excluded.has(i.id) : selected.has(i.id))), [items, selected, excluded, modeAll]);

  function buildQuery(limit, useOffset=true){
    const sp = new URLSearchParams({ limit: String(limit ?? 50) });
    if (status !== "any") sp.set("status", status);
    if (assigned !== "any") sp.set("assigned", assigned);
    if (areaTag) sp.set("areaTag", areaTag);
    if (q) sp.set("q", q);
    if (startDate) sp.set("startDate", startDate);
    if (endDate) sp.set("endDate", endDate);
    if (useOffset && offset) sp.set("offset", String(offset));
    return sp;
  }

  async function load(reset=true){
    setLoading(true);
    try{
      const sp = buildQuery(50, !reset);
      const { items, count, nextOffset } = await api(`/api/admin/orders?${sp.toString()}`);
      setItems(v => reset ? (items || []) : [...v, ...(items || [])]);
      setCount(count || 0);
      setOffset(nextOffset || 0);
      if (reset) { setSelected(new Set()); setModeAll(false); setExcluded(new Set()); }
    } catch(e){ alert(e.message); } finally { setLoading(false); }
  }
  useEffect(()=>{ load(true); }, []); // initial
  function applyFilters(){ setOffset(0); load(true); }
  function resetFilters(){
    setStatus("any"); setAssigned("any"); setAreaTag(""); setQ(""); setStartDate(""); setEndDate("");
    setOffset(0); load(true);
  }

  function toggleOne(id){
    if (modeAll) { const ex = new Set(excluded); if (ex.has(id)) ex.delete(id); else ex.add(id); setExcluded(ex); }
    else { const s = new Set(selected); if (s.has(id)) s.delete(id); else s.add(id); setSelected(s); }
  }
  function togglePage(){
    if (modeAll) { const ex = new Set(excluded); if (allOnPageSelected) items.forEach(i => ex.add(i.id)); else items.forEach(i => ex.delete(i.id)); setExcluded(ex); }
    else { const s = new Set(selected); if (allOnPageSelected) items.forEach(i => s.delete(i.id)); else items.forEach(i => s.add(i.id)); setSelected(s); }
  }
  function selectAllAcrossResults(){ setModeAll(true); setSelected(new Set()); setExcluded(new Set()); }
  function clearSelection(){ setModeAll(false); setSelected(new Set()); setExcluded(new Set()); }

  async function getAllIdsForFilter(){
    const sp = new URLSearchParams();
    if (status !== "any") sp.set("status", status);
    if (assigned !== "any") sp.set("assigned", assigned);
    if (areaTag) sp.set("areaTag", areaTag);
    if (q) sp.set("q", q);
    if (startDate) sp.set("startDate", startDate);
    if (endDate) sp.set("endDate", endDate);
    const { ids, total, capped } = await api(`/api/admin/orders/ids?${sp.toString()}`);
    if (capped) {
      const go = confirm(`There are ${total} matching orders. Selection will be capped to ${ids.length}. Continue?`);
      if (!go) throw new Error("Cancelled");
    }
    return ids || [];
  }
  async function resolveSelectedIds(){ if (!modeAll) return Array.from(selected); const all = await getAllIdsForFilter(); if (excluded.size===0) return all; const excl = new Set(excluded); return all.filter(id => !excl.has(id)); }

  async function assign(orderId, staffUserId){
    await api("/api/orders/assign", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ orderId, staffUserId }) });
    load(true);
  }
  async function unassign(orderId){
    if (!confirm("Unassign this order?")) return;
    await api("/api/orders/unassign", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ orderId }) });
    load(true);
  }
  async function markDelivered(orderId){
    if (!confirm("Mark as delivered? This finalizes payouts.")) return;
    await api("/api/orders/mark-fulfilled", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ orderId }) });
    load(true);
  }

  // Bulk reschedule modal
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSlotLocal, setBulkSlotLocal] = useState("");
  const [bulkArea, setBulkArea] = useState("");

  async function doBulkReschedule(){
    const slotIso = localInputValueToISO(bulkSlotLocal);
    if (!slotIso) return alert("Pick a date and time");
    const ids = await resolveSelectedIds();
    if (ids.length === 0) return alert("No orders selected.");
    if (!confirm(`Reschedule ${ids.length} order(s)?`)) return;
    await api("/api/admin/orders/bulk-reschedule", {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ ids, slotIso, areaTag: bulkArea || null })
    });
    setBulkOpen(false); setBulkSlotLocal(""); setBulkArea("");
    clearSelection();
    load(true);
  }

  function Row({ o }){
    const [editing, setEditing] = useState(false);
    const [slotLocal, setSlotLocal] = useState(isoToLocalInputValue(o.delivery_slot_at));
    const [area, setArea] = useState(o.area_tag || "");
    const [showAssign, setShowAssign] = useState(false);

    async function saveSlot(){
      const slotIso = localInputValueToISO(slotLocal);
      if (!slotIso) return alert("Please pick a date & time");
      await api("/api/orders/update-slot", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ orderId: o.id, slotIso, areaTag: area })
      });
      setEditing(false);
      load(true);
    }

    return (
      <tr className="border-t">
        <td className="py-2 px-3">
          <input type="checkbox" checked={modeAll ? !excluded.has(o.id) : selected.has(o.id)} onChange={()=>toggleOne(o.id)}/>
        </td>
        <td className="py-2 px-3 whitespace-nowrap">
          {!editing ? (
            <>
              <div>{o.delivery_slot_at ? new Date(o.delivery_slot_at).toLocaleString("en-US",{ timeZone:"America/New_York" }) : "—"}</div>
              <button onClick={()=>setEditing(true)} className="text-xs border rounded-xl px-2 py-1 mt-1 hover:shadow">Edit</button>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                type="datetime-local"
                value={slotLocal}
                onChange={e=>setSlotLocal(e.target.value)}
                step={60*20}
                className="border rounded-xl px-3 py-2"
              />
              <div className="flex items-center gap-2">
                <input
                  value={area}
                  onChange={e=>setArea(e.target.value)}
                  placeholder="area_tag (e.g. queens-astoria)"
                  className="border rounded-xl px-3 py-2"
                />
                <button onClick={saveSlot} className="text-xs border rounded-xl px-2 py-1 hover:shadow">Save</button>
                <button onClick={()=>{setEditing(false); setSlotLocal(isoToLocalInputValue(o.delivery_slot_at)); setArea(o.area_tag || "");}} className="text-xs border rounded-xl px-2 py-1 hover:shadow">Cancel</button>
              </div>
            </div>
          )}
        </td>
        <td className="py-2 px-3">{o.area_tag || "—"}</td>
        <td className="py-2 px-3">
          <div className="font-medium">{o.shipping_name || "Customer"}</div>
          <div className="text-xs text-gray-500">
            {[o.shipping_address1, o.shipping_city].filter(Boolean).join(", ") || "—"}
          </div>
        </td>
        <td className="py-2 px-3 font-mono text-xs">{o.id}</td>
        <td className="py-2 px-3">${centsToUSD(o.price_cents)}</td>
        <td className="py-2 px-3"><OrderStatusBadge status={o.status}/></td>
        <td className="py-2 px-3">
          {o.assigned_staff_id ? <UserBadge userId={o.assigned_staff_id}/> : <span className="text-xs text-gray-500">Unassigned</span>}
        </td>
        <td className="py-2 px-3 text-right">
          <div className="flex gap-2 justify-end">
            {!o.assigned_staff_id ? (
              <>
                <button onClick={()=>setShowAssign(s=>!s)} className="text-xs border rounded-xl px-2 py-1 hover:shadow">Assign</button>
                {showAssign && (
                  <div className="absolute mt-8 right-6 w-80 z-20 border rounded-xl bg-white shadow p-3">
                    <div className="text-xs text-gray-600 mb-2">Assign to staff</div>
                    <StaffPicker onSelect={(u)=>assign(o.id, u.id)} />
                  </div>
                )}
              </>
            ) : (
              <button onClick={()=>unassign(o.id)} className="text-xs border rounded-xl px-2 py-1 hover:shadow">Unassign</button>
            )}
            {(o.status === "paid" || o.status === "scheduled") && o.assigned_staff_id && (
              <button onClick={()=>markDelivered(o.id)} className="text-xs border rounded-xl px-2 py-1 hover:shadow">Mark delivered</button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <main className="p-6 space-y-4 max-w-7xl mx-auto">
      <LocalAdminNav/>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="text-sm text-gray-500">{count} results</div>
      </div>

      <div className="border rounded-2xl p-3 bg-gray-50 grid md:grid-cols-7 gap-3 items-end">
        <label className="text-sm">Status
          <select className="block border rounded-xl px-3 py-2 w-full" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="any">Any</option>
            <option value="paid">Paid</option>
            <option value="scheduled">Scheduled</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label className="text-sm">Assigned
          <select className="block border rounded-xl px-3 py-2 w-full" value={assigned} onChange={e=>setAssigned(e.target.value)}>
            <option value="any">Any</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </label>
        <label className="text-sm">Area tag
          <input className="block border rounded-xl px-3 py-2 w-full" value={areaTag} onChange={e=>setAreaTag(e.target.value)} placeholder="e.g. queens-astoria"/>
        </label>
        <label className="text-sm">Search
          <input className="block border rounded-xl px-3 py-2 w-full" value={q} onChange={e=>setQ(e.target.value)} placeholder="name, city, address"/>
        </label>
        <label className="text-sm">Start date
          <input type="date" className="block border rounded-xl px-3 py-2 w-full" value={startDate} onChange={e=>setStartDate(e.target.value)} />
        </label>
        <label className="text-sm">End date
          <input type="date" className="block border rounded-xl px-3 py-2 w-full" value={endDate} onChange={e=>setEndDate(e.target.value)} />
        </label>
        <div className="md:col-span-1 flex justify-end gap-2">
          <button onClick={applyFilters} className="border rounded-xl px-3 py-2 hover:shadow">Apply</button>
          <button onClick={resetFilters} className="border rounded-xl px-3 py-2 hover:shadow">Reset</button>
          <button onClick={()=>load(true)} className="border rounded-xl px-3 py-2 hover:shadow">Refresh</button>
        </div>
      </div>

      {/* Bulk toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-gray-500">
          {selectedCount > 0 ? (modeAll
            ? <>All <strong>{count - excluded.size}</strong> selected</>
            : <>Selected: <strong>{selectedCount}</strong></>
          ) : <span>&nbsp;</span>}
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && !modeAll && items.length>0 && selected.size === items.length && count > items.length && (
            <button className="border rounded-xl px-3 py-2 hover:shadow" onClick={selectAllAcrossResults}>Select all {count}</button>
          )}
          {selectedCount > 0 && (
            <>
              <button className="border rounded-xl px-3 py-2 hover:shadow" onClick={()=>setBulkOpen(true)}>Reschedule selected</button>
              <button className="border rounded-xl px-3 py-2 hover:shadow" onClick={clearSelection}>Clear</button>
            </>
          )}
        </div>
      </div>

      <div className="border rounded-2xl overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="py-2 px-3"><input type="checkbox" checked={allOnPageSelected} onChange={togglePage}/></th>
              <th className="py-2 px-3">Slot</th>
              <th className="py-2 px-3">Area</th>
              <th className="py-2 px-3">Customer / Address</th>
              <th className="py-2 px-3">Order</th>
              <th className="py-2 px-3">Price</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3">Assigned</th>
              <th className="py-2 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(o => <Row key={o.id} o={o} />)}
            {items.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-gray-500">No orders</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">Showing {items.length} of {count}</div>
        <button disabled={loading || items.length >= count} onClick={()=>load(false)} className="border rounded-xl px-3 py-2 hover:shadow disabled:opacity-50">Load more</button>
      </div>

      {/* Bulk Reschedule Modal */}
      {bulkOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-lg font-semibold">Reschedule selected orders</h2>
            <label className="text-sm block">New slot (20-min steps)
              <input
                type="datetime-local"
                value={bulkSlotLocal}
                onChange={e=>setBulkSlotLocal(e.target.value)}
                step={60*20}
                className="block border rounded-xl px-3 py-2 w-full mt-1"
              />
            </label>
            <label className="text-sm block">Area tag (optional)
              <input
                value={bulkArea}
                onChange={e=>setBulkArea(e.target.value)}
                placeholder="e.g. queens-astoria"
                className="block border rounded-xl px-3 py-2 w-full mt-1"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button className="border rounded-xl px-3 py-2 hover:shadow" onClick={()=>setBulkOpen(false)}>Cancel</button>
              <button className="border rounded-xl px-3 py-2 hover:shadow" onClick={doBulkReschedule}>Reschedule</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
