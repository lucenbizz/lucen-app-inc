// /app/admin/payouts/exec/page.jsx  (UPDATED: adds "Run Weekly Payouts" modal for both roles)
"use client";

import { useEffect, useMemo, useState } from "react";
import RoleGate from "../../../components/RoleGate";
import { useRoles } from "../../../hooks/useRoles";
import { centsToUSD } from "../../../lib/pricing";
import UserBadge from "../../../components/UserBadge";

// Local nav kept local per your preference
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

export default function ExecPayoutsPage(){
  return (
    <RoleGate minRole="executive" fallback={<main className="p-6">No access.</main>}>
      <ExecPayoutsInner/>
    </RoleGate>
  );
}

function ExecPayoutsInner(){
  const [status, setStatus] = useState("any");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  // selection state
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
      const res = await fetch(`/api/payouts/exec?${sp.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setItems(v => reset ? (json.items || []) : [...v, ...(json.items||[])]);
      setCount(json.count || 0);
      setOffset(json.nextOffset || 0);
      if (reset) { setSelected(new Set()); setModeAll(false); setExcluded(new Set()); }
    } catch(e){ alert(e.message); } finally { setLoading(false); }
  }
  useEffect(()=>{ load(true); }, []);

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
    const res = await fetch(`/api/payouts/exec/ids?${sp.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load ids");
    if (json.capped) {
      const go = confirm(`There are ${json.total} results. Selection will be capped to ${json.ids.length}. Continue?`);
      if (!go) throw new Error("Cancelled");
    }
    return json.ids || [];
  }
  async function resolveSelectedIds(){
    if (!modeAll) return Array.from(selected);
    const all = await getAllIdsForFilter();
    if (excluded.size===0) return all;
    const excl = new Set(excluded);
    return all.filter(id => !excl.has(id));
  }

  async function bulk(action){
    try{
      const ids = await resolveSelectedIds();
      if (ids.length === 0) return alert("No rows selected.");
      if (!confirm(`Confirm ${action.replace('_',' ')} for ${ids.length} payout(s)?`)) return;
      const res = await fetch("/api/payouts/exec/bulk", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ action, ids })
      });
      const json = await res.json();
      if (!res.ok) return alert(json.error || "Bulk action failed");
      clearSelection(); load(true);
    } catch(e){ if (e?.message !== "Cancelled") alert(e.message); }
  }

  async function exportSelectedCSV(){
    try{
      const ids = await resolveSelectedIds();
      if (ids.length === 0) return alert("No rows selected.");
      const res = await fetch("/api/payouts/exec/export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      if (!res.ok) return alert(await res.text() || "Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: `exec_payouts_selected_${Date.now()}.csv` });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch(e){ if (e?.message !== "Cancelled") alert(e.message); }
  }
  async function exportFilterCSV(){
    const sp = new URLSearchParams();
    if (status !== "any") sp.set("status", status);
    if (startDate) sp.set("startDate", startDate);
    if (endDate) sp.set("endDate", endDate);
    const res = await fetch(`/api/payouts/exec/export-by-filter?${sp.toString()}`);
    if (!res.ok) return alert(await res.text() || "Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `exec_payouts_filter_${Date.now()}.csv` });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // ===== Weekly payouts modal (covers STAFF + EXEC in one go) =====
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [weeklyStart, setWeeklyStart] = useState(""); // YYYY-MM-DD
  const [weeklyEnd, setWeeklyEnd] = useState("");     // YYYY-MM-DD (exclusive recommended)
  const [dryRun, setDryRun] = useState(true);
  const [weeklyResult, setWeeklyResult] = useState(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  async function runWeekly() {
    if (!weeklyStart || !weeklyEnd) return alert("Pick start and end dates");
    setWeeklyLoading(true);
    setWeeklyResult(null);
    try{
      const res = await fetch("/api/payouts/run-weekly", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ startDate: weeklyStart, endDate: weeklyEnd, dryRun: dryRun })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Run failed");
      setWeeklyResult(json);
    } catch(e){ alert(e.message); } finally { setWeeklyLoading(false); }
  }

  function RowSummary({ title, data }){
    if (!data) return null;
    return (
      <div className="border rounded-xl p-3">
        <div className="font-semibold mb-2">{title}</div>
        <div className="text-sm mb-2">Total: ${centsToUSD(data.totalCents || 0)}</div>
        <div className="text-sm font-medium mb-1">Transfers</div>
        <ul className="text-sm space-y-1 max-h-56 overflow-auto">
          {(data.transfers || []).map((t, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="truncate">
                {(t.name || t.email || t.userId || "User")} — ${centsToUSD(t.totalCents)} ({t.count})
              </span>
              <span className="text-xs text-gray-600">{t.transferId || t.error || ""}</span>
            </li>
          ))}
          {(!data.transfers || data.transfers.length===0) && <li className="text-gray-500 text-sm">None</li>}
        </ul>
        {data.missing?.length ? (
          <>
            <div className="text-sm font-medium mt-3">Missing Stripe account</div>
            <ul className="text-sm space-y-1 max-h-40 overflow-auto">
              {data.missing.map((m,i)=>(
                <li key={i} className="truncate">{(m.name || m.email || m.userId)} — ${centsToUSD(m.totalCents)} ({m.count})</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <main className="p-6 space-y-4 max-w-6xl mx-auto">
      <LocalAdminNav/>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Executive Payouts</h1>
        <div className="text-sm text-gray-500">{count} total</div>
      </div>

      {/* Filters */}
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
          <button onClick={()=>setWeeklyOpen(true)} className="border rounded-xl px-3 py-2 hover:shadow">Run Weekly Payouts</button>
        </div>
      </div>

      {/* ... existing table & selection toolbar remain unchanged ... */}

      {/* Weekly modal */}
      {weeklyOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-3xl space-y-4">
            <h2 className="text-lg font-semibold">Weekly payouts (Staff + Exec)</h2>
            <div className="grid md:grid-cols-4 gap-3">
              <label className="text-sm">Week start (YYYY-MM-DD)
                <input type="date" className="block border rounded-xl px-3 py-2 w-full mt-1"
                  value={weeklyStart} onChange={e=>setWeeklyStart(e.target.value)} />
              </label>
              <label className="text-sm">Week end (YYYY-MM-DD)
                <input type="date" className="block border rounded-xl px-3 py-2 w-full mt-1"
                  value={weeklyEnd} onChange={e=>setWeeklyEnd(e.target.value)} />
              </label>
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={dryRun} onChange={e=>setDryRun(e.target.checked)} />
                <span>Dry run (no Stripe transfers)</span>
              </label>
              <div className="flex justify-end items-end">
                <button disabled={weeklyLoading} onClick={runWeekly} className="border rounded-xl px-3 py-2 hover:shadow disabled:opacity-50">
                  {weeklyLoading ? "Running..." : (dryRun ? "Preview totals" : "Run & transfer")}
                </button>
              </div>
            </div>

            {weeklyResult && (
              <div className="grid md:grid-cols-2 gap-3">
                <RowSummary title="Staff" data={weeklyResult.staff}/>
                <RowSummary title="Executives" data={weeklyResult.exec}/>
              </div>
            )}

            <div className="flex justify-end">
              <button className="border rounded-xl px-3 py-2 hover:shadow" onClick={()=>{setWeeklyOpen(false); setWeeklyResult(null);}}>Close</button>
            </div>
            <p className="text-xs text-gray-500">
              Tip: In Stripe, set each connected account’s payout schedule to <b>weekly</b> with your anchor day. This modal controls
              how much you transfer to them for the selected week.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
