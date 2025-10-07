// /app/admin/users/page.jsx  (NEW)
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
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/payouts/staff">Staff Payouts</a>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/teams">Teams</a>
          <a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/users">Users</a>
        </>
      )}
    </nav>
  );
}

function Badge({ kind }) {
  const map = {
    missing: "bg-gray-100 text-gray-700",
    pending: "bg-amber-100 text-amber-800",
    restricted: "bg-red-100 text-red-800",
    complete: "bg-green-100 text-green-800",
  };
  const cls = map[kind] || map.missing;
  const label = (kind||"missing").toUpperCase();
  return <span className={`px-2 py-0.5 text-xs rounded-full ${cls}`}>{label}</span>;
}

async function api(path, opts){
  const res = await fetch(path, opts);
  const json = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

function Row({ u, refresh }){
  const [busy, setBusy] = useState(false);
  const [showSet, setShowSet] = useState(false);
  const [acct, setAcct] = useState(u.stripe_account_id || "");

  async function setId(){
    if (!acct) return alert("Enter acct_ id");
    setBusy(true);
    try{
      await api(`/api/admin/users/${u.id}/stripe/set-id`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ accountId: acct }) });
      setShowSet(false);
      refresh();
    }catch(e){ alert(e.message); } finally { setBusy(false); }
  }
  async function createExpress(){
    setBusy(true);
    try{
      const { accountId, onboardingUrl } = await api(`/api/admin/users/${u.id}/stripe/connect/create`, { method:"POST" });
      navigator.clipboard?.writeText(onboardingUrl || "");
      alert(`Express account created (${accountId}). Onboarding URL copied.`);
      refresh();
    }catch(e){ alert(e.message); } finally { setBusy(false); }
  }
  async function onboardingLink(){
    setBusy(true);
    try{
      const { onboardingUrl } = await api(`/api/admin/users/${u.id}/stripe/connect/link`, { method:"POST" });
      navigator.clipboard?.writeText(onboardingUrl || "");
      alert(`Onboarding URL copied.`);
    }catch(e){ alert(e.message); } finally { setBusy(false); }
  }
  async function syncStripe(){
    setBusy(true);
    try{
      await api(`/api/admin/users/${u.id}/stripe/connect/sync`, { method:"POST" });
      refresh();
    }catch(e){ alert(e.message); } finally { setBusy(false); }
  }
  async function setWeekly(){
    const anchor = prompt("Weekly anchor day (mon/tue/wed/thu/fri/sat/sun)", "fri") || "fri";
    setBusy(true);
    try{
      await api(`/api/admin/users/${u.id}/stripe/connect/schedule`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ anchor }) });
      alert(`Payout schedule set to weekly (${anchor}).`);
    }catch(e){ alert(e.message); } finally { setBusy(false); }
  }

  const acctId = u.stripe_account_id;
  const openStripeHref = acctId ? `https://dashboard.stripe.com/connect/accounts/${acctId}` : null;

  return (
    <tr className="border-t">
      <td className="py-2 px-3">
        <div className="font-medium">{u.name || "—"}</div>
        <div className="text-xs text-gray-500">{u.email || "—"}</div>
      </td>
      <td className="py-2 px-3"><Badge kind={u.stripe_badge}/></td>
      <td className="py-2 px-3">
        {acctId ? <span className="font-mono text-xs">{acctId}</span> : <span className="text-xs text-gray-400">—</span>}
        <div className="text-[10px] text-gray-500">{u.stripe_status_synced_at ? new Date(u.stripe_status_synced_at).toLocaleString() : "never"}</div>
      </td>
      <td className="py-2 px-3 text-right">
        <div className="flex gap-2 justify-end flex-wrap">
          {!acctId && <button disabled={busy} onClick={createExpress} className="text-xs border rounded-xl px-2 py-1 hover:shadow disabled:opacity-50">Create Express</button>}
          {acctId && <button disabled={busy} onClick={onboardingLink} className="text-xs border rounded-xl px-2 py-1 hover:shadow disabled:opacity-50">Onboarding link</button>}
          <button disabled={busy} onClick={()=>setShowSet(s=>!s)} className="text-xs border rounded-xl px-2 py-1 hover:shadow disabled:opacity-50">{acctId ? "Change ID" : "Set ID"}</button>
          {acctId && <button disabled={busy} onClick={syncStripe} className="text-xs border rounded-xl px-2 py-1 hover:shadow disabled:opacity-50">Sync</button>}
          {acctId && <a target="_blank" rel="noreferrer" href={openStripeHref} className="text-xs border rounded-xl px-2 py-1 hover:shadow">Open in Stripe</a>}
          {acctId && <button disabled={busy} onClick={setWeekly} className="text-xs border rounded-xl px-2 py-1 hover:shadow disabled:opacity-50">Weekly schedule</button>}
        </div>
        {showSet && (
          <div className="mt-2 flex items-center gap-2">
            <input value={acct} onChange={e=>setAcct(e.target.value)} placeholder="acct_..." className="border rounded-xl px-2 py-1 text-xs w-48"/>
            <button disabled={busy} onClick={setId} className="text-xs border rounded-xl px-2 py-1 hover:shadow disabled:opacity-50">Save</button>
            <button disabled={busy} onClick={()=>setShowSet(false)} className="text-xs border rounded-xl px-2 py-1 hover:shadow disabled:opacity-50">Cancel</button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function AdminUsersPage(){
  return (
    <RoleGate minRole="executive" fallback={<main className="p-6">No access.</main>}>
      <UsersInner/>
    </RoleGate>
  );
}

function UsersInner(){
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("any"); // any|missing|pending|restricted|complete
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load(){
    setLoading(true);
    try{
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (status !== "any") sp.set("status", status);
      const { items } = await api(`/api/admin/users?${sp.toString()}`);
      setItems(items || []);
    } catch(e){ alert(e.message); } finally { setLoading(false); }
  }
  useEffect(()=>{ load(); }, []);

  return (
    <main className="p-6 space-y-4 max-w-5xl mx-auto">
      <LocalAdminNav/>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="text-sm text-gray-500">{items.length} shown</div>
      </div>

      <div className="border rounded-2xl p-3 bg-gray-50 grid md:grid-cols-4 gap-3 items-end">
        <label className="text-sm">Search
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="name or email" className="block border rounded-xl px-3 py-2 w-full"/>
        </label>
        <label className="text-sm">Payout status
          <select value={status} onChange={e=>setStatus(e.target.value)} className="block border rounded-xl px-3 py-2 w-full">
            <option value="any">Any</option>
            <option value="missing">Missing</option>
            <option value="pending">Pending</option>
            <option value="restricted">Restricted</option>
            <option value="complete">Complete</option>
          </select>
        </label>
        <div className="md:col-span-2 flex justify-end gap-2">
          <button onClick={load} className="border rounded-xl px-3 py-2 hover:shadow disabled:opacity-50" disabled={loading}>
            {loading ? "Loading..." : "Apply"}
          </button>
        </div>
      </div>

      <div className="border rounded-2xl overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="py-2 px-3">User</th>
              <th className="py-2 px-3">Payout status</th>
              <th className="py-2 px-3">Stripe</th>
              <th className="py-2 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(u => <Row key={u.id} u={u} refresh={load} />)}
            {items.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-gray-500">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
