// /app/admin/payouts/staff/page.jsx  (UPDATED: select-all across results + Export CSV)
"use client";

import { useEffect, useState, useMemo } from "react";
import RoleGate from "../../../components/RoleGate";
import { useRoles } from "../../../hooks/useRoles";
import { centsToUSD } from "../../../lib/pricing";
import UserBadge from "../../../components/UserBadge";

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

export default function StaffPayoutsPage(){
  return (
    <RoleGate minRole="executive" fallback={<main className="p-6">No access.</main>}>
      <StaffPayoutsInner/>
    </RoleGate>
  );
}

function StaffPayoutsInner(){
  const [status, setStatus] = useState("any");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState(()=>new Set());
  const [modeAll, setModeAll] = useState(false);
  const [excluded, setExcluded] = useState(()=>new Set());
  const selectedCount = modeAll ? (count - excluded.size) : selected.size;
  const allOnPageSelected = useMemo(()=>items.length>0 && items.every(i => (modeAll ? !excluded.has(i.id) : selected.has(i.id))), [items, selected, excluded, modeAll]);

  function buildQuery(limit, useOffset=true){
    const sp = new URLSearchParams({ limit: String(limit ?? 50) });
    if (status !== "any") sp.set("status", status);
    if (startDate) sp.set("startDate", startDate);
    if (endDate) sp.set("endDate", endDate);
    if (useOffset && offset) sp.set("offset", String(offset));
    return sp;
  }

  async function load(reset=true){
    setLoading(true);
    try{
      const sp = buildQuery(50, !reset);
      const res = await fetch(`/api/payouts/staff?${sp.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setItems(v => reset ? (json.items || []) : [...v, ...(json.items||[])]);
      setCount(json.count || 0);
      setOffset(json.nextOffset || 0);
      if (reset) { setSelected(new Set()); setModeAll(false); setExcluded(new Set()); }
    } catch(e){ alert(e.message); } finally { setLoading(false); }
  }

  useEffect(()=>{ load(true); }, []); // initial

  function applyFilters(){ load(true); }
  function resetFilters(){ setStatus("any"); setStartDate(""); setEndDate(""); setOffset(0); load(true); }

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
    if (startDate) sp.set("startDate", startDate);
    if (endDate) sp.set("endDate", endDate);
    const res = await fetch(`/api/payouts/staff/ids?${sp.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load ids");
    if (json.capped) {
      if (!confirm(`There are ${json.total} results. The selection is capped to ${json.ids.length}. Continue with the first ${json.ids.length}?`)) {
        throw new Error("Cancelled");
      }
    }
    return json.ids || [];
  }
  async function resolveSelectedIds(){ if (!modeAll) return Array.from(selected); const all = await getAllIdsForFilter(); if (excluded.size===0) return all; const excl = new Set(excluded); return all.filter(id => !excl.has(id)); }

  async function bulk(action){
    try{
      const ids = await resolveSelectedIds();
      if (ids.length === 0) return alert("No rows selected.");
      if (!confirm(`Confirm ${action.replace('_',' ')} for ${ids.length} payout(s)?`)) return;
      const res = await fetch("/api/payouts/staff/bulk", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ action, ids }) });
      const json = await res.json();
      if (!res.ok) return alert(json.error || "Bulk action failed");
      clearSelection(); load(true);
    } catch(e){ if (e?.message !== "Cancelled") alert(e.message); }
  }

  async function exportSelectedCSV(){
    try{
      const ids = await resolveSelectedIds();
      if (ids.length === 0) return alert("No rows selected.");
      const res = await fetch("/api/payouts/staff/export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      if (!res.ok) return alert(await res.text() || "Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: `staff_payouts_selected_${Date.now()}.csv` });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch(e){ if (e?.message !== "Cancelled") alert(e.message); }
  }

  async function exportFilterCSV(){
    const sp = new URLSearchParams();
    if (status !== "any") sp.set("status", status);
    if (startDate) sp.set("startDate", startDate);
    if (endDate) sp.set("endDate", endDate);
    const res = await fetch(`/api/payouts/staff/export-by-filter?${sp.toString()}`);
    if (!res.ok) return alert(await res.text() || "Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `staff_payouts_filter_${Date.now()}.csv` });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  return (
    <main className="p-6 space-y-4 max-w-6xl mx-auto">
      {/* LocalAdminNav omitted; keep your existing */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Staff Payouts</h1>
        <div className="text-sm text-gray-500">{count} total</div>
      </div>

      <div className="border rounded-2xl p-3 bg-gray-50 grid md:grid-cols-5 gap-3 items-end">
        <label className="text-sm">Status
          <select className="block border rounded-xl px-3 py-2 w-full" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="any">Any</option><option value="pending">Pending</option>
            <option value="approved">Approved</option><option value="paid">Paid</option><option value="void">Void</option>
          </select>
        </label>
        <label className="text-sm">Start date
          <input type="date" className="block border rounded-xl px-3 py-2 w-full" value={startDate} onChange={e=>setStartDate(e.target.value)} />
        </label>
        <label className="text-sm">End date
          <input type="date" className="block border rounded-xl px-3 py-2 w-full" value={endDate} onChange={e=>setEndDate(e.target.value)} />
        </label>
        <div className="md:col-span-2 flex justify-end gap-2">
          <button onClick={applyFilters} className="border rounded-xl px-3 py-2 hover:shadow">Apply</button>
          <button onClick={resetFilters} className="border rounded-xl px-3 py-2 hover:shadow">Reset</button>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        {selectedCount > 0 && (
          <>
            <span className="text-sm">{modeAll ? <>All <strong>{count - excluded.size}</strong> selected</> : <>Selected: <strong>{selectedCount}</strong></>}</span>
            {!modeAll && items.length>0 && selected.size === items.length && count > items.length && (
              <button className="border rounded-xl px-3 py-2 hover:shadow" onClick={selectAllAcrossResults}>Select all {count}</button>
            )}
            <button className="border rounded-xl px-3 py-2 hover:shadow" onClick={exportSelectedCSV}>Export CSV (selected)</button>
            <button className="border rounded-xl px-3 py-2 hover:shadow" onClick={()=>bulk("approve")}>Approve</button>
            <button className="border rounded-xl px-3 py-2 hover:shadow" onClick={()=>bulk("mark_paid")}>Mark Paid</button>
            <button className="border rounded-xl px-3 py-2 hover:shadow" onClick={()=>bulk("void")}>Void</button>
            <button className="border rounded-xl px-3 py-2 hover:shadow" onClick={clearSelection}>Clear</button>
          </>
        )}
        <button className="border rounded-xl px-3 py-2 hover:shadow" onClick={exportFilterCSV}>Export CSV (filter)</button>
        <button onClick={()=>load(true)} className="border rounded-xl px-3 py-2 hover:shadow">Refresh</button>
      </div>

      <div className="border rounded-2xl overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="py-2 px-3"><input type="checkbox" checked={allOnPageSelected} onChange={togglePage}/></th>
              <th className="py-2 px-3">Created</th>
              <th className="py-2 px-3">Order</th>
              <th className="py-2 px-3">Staff</th>
              <th className="py-2 px-3">Amount</th>
              <th className="py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p)=>(
              <tr key={p.id} className="border-t">
                <td className="py-2 px-3"><input type="checkbox" checked={modeAll ? !excluded.has(p.id) : selected.has(p.id)} onChange={()=>toggleOne(p.id)}/></td>
                <td className="py-2 px-3 whitespace-nowrap text-gray-600">{new Date(p.created_at).toLocaleString("en-US",{timeZone:"America/New_York"})}</td>
                <td className="py-2 px-3 font-mono text-xs">{p.order_id}</td>
                <td className="py-2 px-3"><UserBadge userId={p.staff_user_id}/></td>
                <td className="py-2 px-3 font-semibold">${centsToUSD(p.amount_cents)}</td>
                <td className="py-2 px-3"><span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800">{p.status}</span></td>
              </tr>
            ))}
            {items.length===0 && <tr><td colSpan={6} className="py-6 text-center text-gray-500">No payouts</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">Showing {items.length} of {count}</div>
        <button disabled={loading || items.length >= count} onClick={()=>load(false)} className="border rounded-xl px-3 py-2 hover:shadow disabled:opacity-50">Load more</button>
      </div>
    </main>
  );
}
