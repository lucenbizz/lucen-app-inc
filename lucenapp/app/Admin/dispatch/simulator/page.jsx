"use client";
import { useEffect, useMemo, useState } from "react";
import RoleGate from "../../../components/RoleGate";
import { useRoles } from "../../../hooks/useRoles";
function ymd(d = new Date()) { const y=d.getFullYear(); const
m=String(d.getMonth()+1).padStart(2,"0"); const
da=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${da}`; }
function toHHMM(mins){ const h=String(Math.floor(mins/60)).padStart(2,"0");
const m=String(mins%60).padStart(2,"0"); return `${h}:${m}`; }
function timeToMins(val){ const [h,m] = val.split(":").map(Number); return h*60
+ (m||0); }
function LocalAdminNav(){
const { isAdmin, isExecutive, ready } = useRoles();
if (!ready) return null;
return (
<nav className="flex gap-2 flex-wrap mb-4">
<a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/
orders">Orders</a>
{(isExecutive || isAdmin) && (
<>
<a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/
areas/coverage">Coverage</a>
<a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/
dispatch/simulator">Dispatch</a>
<a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/
areas">Areas</a>
</>
)}
{isAdmin && (
<>
<a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/
areas/new">New Area</a>
<a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/
settings">Settings</a>
</>
)}
</nav>
);
}
export default function SimulatorPage(){
return (
<RoleGate minRole="executive" fallback={<main className="p-6">No access.</
main>}>
<InnerSimulator/>
</RoleGate>
);
}
function InnerSimulator(){
const [date,setDate]=useState(ymd());
const [wholeDay,setWholeDay]=useState(false);
const [slotMinutes,setSlotMinutes]=useState(600);
const [preferArea,setPreferArea]=useState(true);
const [onePerSlot,setOnePerSlot]=useState(true);
const [loading,setLoading]=useState(false);
const [result,setResult]=useState(null);
async function simulate(){
setLoading(true);
try{
const res = await fetch('/api/dispatch/simulate', { method:'POST',
headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date,
tz:'America/New_York', slotMinutes: wholeDay? null : Number(slotMinutes),
preferArea, onePerSlot }) });
const json = await res.json();
setResult(json);
} finally { setLoading(false); }
}
async function applyPlan(){
if (!result?.plan) return;
if (!confirm(`Apply ${result.plan.filter(p=>p.assigned_to_user_id).length}
assignments?`)) return;
const res = await fetch('/api/dispatch/apply', { method:'POST', headers:
{'Content-Type':'application/json'}, body: JSON.stringify({ plan:
result.plan }) });
const json = await res.json();
if (!res.ok) return alert(json.error || 'Failed to apply');
alert(`Applied ${json.applied} assignments.`);
}
return (
<main className="p-6 space-y-4 max-w-6xl mx-auto">
<LocalAdminNav/>
<div className="flex items-center justify-between gap-2 flex-wrap">
<h1 className="text-2xl font-bold">Dispatch Simulator</h1>
<div className="flex items-center gap-2 flex-wrap">
<label className="text-sm text-gray-600">Date</label>
<input type="date" value={date} onChange={e=>setDate(e.target.value)}
className="border rounded-xl px-3 py-2"/>
<label className="text-sm text-gray-600 ml-2">Target</label>
<select value={wholeDay? 'day':'slot'}
onChange={e=>setWholeDay(e.target.value==='day')} className="border rounded-xl
px-3 py-2">
<option value="slot">One slot</option>
<option value="day">Whole day</option>
</select>
{!wholeDay && (
<>
<label className="text-sm text-gray-600">Slot start</label>
<input type="time" value={toHHMM(slotMinutes)}
onChange={e=>setSlotMinutes(timeToMins(e.target.value))} className="border
rounded-xl px-3 py-2"/>
</>
)}
<label className="text-sm text-gray-600 ml-2">Prefer area</label>
<input type="checkbox" checked={preferArea}
onChange={e=>setPreferArea(e.target.checked)} />
<label className="text-sm text-gray-600 ml-2">One per driver per
slot</label>
<input type="checkbox" checked={onePerSlot}
onChange={e=>setOnePerSlot(e.target.checked)} />
<button onClick={simulate} className="border rounded-xl px-3 py-2
hover:shadow">Simulate</button>
</div>
</div>
{loading && <div className="text-sm text-gray-500">Running…</div>}
{result && (
<div className="space-y-4">
<div className="border rounded-2xl p-3 flex items-center gap-6 textsm">
<div><span className="font-medium">Assigned:</span>
{result.assigned}</div>
<div><span className="font-medium">Unassigned:</span>
{result.unassigned}</div>
<button onClick={applyPlan} className="ml-auto border rounded-xl
px-3 py-2 hover:shadow">Apply Plan</button>
</div>
<div className="grid gap-4 md:grid-cols-2">
<div className="border rounded-2xl p-3">
<div className="font-semibold mb-2">By Area</div>
<table className="w-full text-sm">
<thead><tr className="text-left text-gray-500 border-b"><th
className="py-1 px-2">Area</th><th className="py-1 px-2">Assigned</th><th
className="py-1 px-2">Unassigned</th></tr></thead>
<tbody>
{Object.entries(result.perArea || {}).map(([area, v]) => (
<tr key={area} className="border-b last:border-b-0"><td
className="py-1 px-2 font-mono">{area}</td><td className="py-1
px-2">{v.assigned||0}</td><td className="py-1 px-2">{v.unassigned||0}</td></tr>
))}
</tbody>
</table>
</div>
<div className="border rounded-2xl p-3">
<div className="font-semibold mb-2">By Driver</div>
<table className="w-full text-sm">
<thead><tr className="text-left text-gray-500 border-b"><th
className="py-1 px-2">Driver</th><th className="py-1 px-2">Assigned</th></tr></
thead>
<tbody>
{Object.entries(result.perDriver || {}).map(([uid, n]) => (
<tr key={uid} className="border-b last:border-b-0"><td
className="py-1 px-2 font-mono">{uid.slice(0,8)}</td><td className="py-1
px-2">{n}</td></tr>
))}
</tbody>
</table>
</div>
</div>
<div className="border rounded-2xl p-3">
<div className="font-semibold mb-2">Planned Assignments</div>
<table className="w-full text-sm">
<thead>
<tr className="text-left text-gray-500 border-b">
<th className="py-1 px-2">Order</th>
<th className="py-1 px-2">Area</th>
<th className="py-1 px-2">Slot</th>
<th className="py-1 px-2">Driver</th>
<th className="py-1 px-2">Reason</th>
</tr>
</thead>
<tbody>
{(result.plan||[]).map((p) => (
<tr key={p.order_id} className="border-b last:border-b-0">
<td className="py-1 px-2 font-mono">#{p.order_id}</td>
<td className="py-1 px-2 font-mono">{p.area_tag}</td>
<td className="py-1 px-2">{toHHMM(p.slot_minutes)}</td>
<td className="py-1 px-2">{p.assigned_to_user_id ?
p.assigned_to_label || p.assigned_to_user_id.slice(0,8) : "—"}</td>
<td className="py-1 px-2 text-gray-500">{p.reason || ""}</
td>
</tr>
))}
</tbody>
</table>
</div>
</div>
)}
</main>
);
} 