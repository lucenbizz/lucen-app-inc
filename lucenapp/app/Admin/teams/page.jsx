// /app/admin/teams/page.jsx
"use client";

import { useEffect, useState } from "react";
import RoleGate from "../../components/RoleGate";
import { useRoles } from "../../hooks/useRoles";

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
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/teams">Teams</a>
        </>
      )}
      {isAdmin && (
        <>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/settings">Settings</a>
        </>
      )}
    </nav>
  );
}

export default function TeamsPage(){
  return (
    <RoleGate minRole="executive" fallback={<main className="p-6">No access.</main>}>
      <TeamsInner/>
    </RoleGate>
  );
}

function TeamsInner(){
  const [execId, setExecId] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load(){
    setLoading(true);
    try{
      const sp = new URLSearchParams();
      if (execId) sp.set("execId", execId);
      const res = await fetch(`/api/teams?${sp.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setItems(json.items || []);
    } catch(e){ alert(e.message); } finally { setLoading(false); }
  }

  useEffect(()=>{ load(); }, []); // initial

  async function assign(e){
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const execUserId = fd.get("execUserId");
    const staffUserId = fd.get("staffUserId");
    const res = await fetch("/api/teams/assign", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ execUserId, staffUserId })
    });
    const json = await res.json();
    if (!res.ok) return alert(json.error || "Assign failed");
    e.currentTarget.reset();
    load();
  }

  async function toggle(execUserId, staffUserId, active){
    const res = await fetch("/api/teams/toggle", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ execUserId, staffUserId, active })
    });
    const json = await res.json();
    if (!res.ok) return alert(json.error || "Toggle failed");
    load();
  }

  async function remove(execUserId, staffUserId){
    if (!confirm("Remove this mapping?")) return;
    const res = await fetch("/api/teams/remove", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ execUserId, staffUserId })
    });
    const json = await res.json();
    if (!res.ok) return alert(json.error || "Remove failed");
    load();
  }

  return (
    <main className="p-6 space-y-4 max-w-6xl mx-auto">
      <LocalAdminNav/>

      <h1 className="text-2xl font-bold">Teams (Exec ↔ Staff)</h1>

      <form onSubmit={assign} className="border rounded-2xl p-4 grid md:grid-cols-3 gap-3">
        <label className="text-sm">Executive User ID
          <input name="execUserId" placeholder="uuid…" className="block border rounded-xl px-3 py-2 w-full" required />
        </label>
        <label className="text-sm">Staff User ID
          <input name="staffUserId" placeholder="uuid…" className="block border rounded-xl px-3 py-2 w-full" required />
        </label>
        <div className="flex items-end">
          <button className="border rounded-xl px-3 py-2 hover:shadow">Assign</button>
        </div>
      </form>

      <div className="border rounded-2xl p-3 bg-gray-50 grid md:grid-cols-3 gap-3 items-end">
        <label className="text-sm">Filter by Exec User ID
          <input value={execId} onChange={e=>setExecId(e.target.value)} placeholder="uuid…" className="block border rounded-xl px-3 py-2 w-full" />
        </label>
        <div className="md:col-span-2 flex gap-2 justify-end">
          <button onClick={load} className="border rounded-xl px-3 py-2 hover:shadow">Search</button>
          <button onClick={()=>{ setExecId(""); load(); }} className="border rounded-xl px-3 py-2 hover:shadow">Reset</button>
        </div>
      </div>

      <div className="border rounded-2xl overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="py-2 px-3">Executive</th>
              <th className="py-2 px-3">Staff</th>
              <th className="py-2 px-3">Active</th>
              <th className="py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r)=>(
              <tr key={`${r.exec_user_id}-${r.staff_user_id}`} className="border-t">
                <td className="py-2 px-3 font-mono text-xs">{r.exec_user_id}</td>
                <td className="py-2 px-3 font-mono text-xs">{r.staff_user_id}</td>
                <td className="py-2 px-3">{r.active ? <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">active</span> : <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800">inactive</span>}</td>
                <td className="py-2 px-3">
                  <div className="flex gap-2">
                    <button onClick={()=>toggle(r.exec_user_id, r.staff_user_id, !r.active)} className="text-xs border rounded-xl px-2 py-1 hover:shadow">{r.active ? "Deactivate" : "Activate"}</button>
                    <button onClick={()=>remove(r.exec_user_id, r.staff_user_id)} className="text-xs border rounded-xl px-2 py-1 hover:shadow">Remove</button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length===0 && <tr><td colSpan={4} className="py-6 text-center text-gray-500">No mappings</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
