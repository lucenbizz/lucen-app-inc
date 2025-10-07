"use client";
import RoleGate from "../../../components/RoleGate";
import { useRoles } from "../../../hooks/useRoles";
import GeoSearchBox from "../../../components/GeoSearchBox";
import { useEffect, useState } from "react";
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
export default function EditAreaPage({ params }) {
return (
<RoleGate minRole="admin" fallback={<main className="p-6">Admin only.</
main>}>
<InnerEditArea params={params}/>
</RoleGate>
);
}
function InnerEditArea({ params }){
const tag = params.tag;
const [loading, setLoading] = useState(true);
const [form, setForm] = useState({ name: '', tag, center_lat: 0, center_lng:
0, radius_km: 5, active: true });
useEffect(() => {
(async () => {
const res = await fetch(`/api/areas/${tag}`);
const json = await res.json();
setForm(json || form);
setLoading(false);
})();
}, [tag]);
async function save(){
const res = await fetch(`/api/areas/${tag}`, { method: 'PATCH', headers: {
'Content-Type': 'application/json' }, body: JSON.stringify(form) });
const json = await res.json();
if (!res.ok) return alert(json.error || 'Save failed');
alert('Saved.');
}
if (loading) return <main className="p-6">Loading…</main>;
return (
<main className="p-6 space-y-4 max-w-3xl mx-auto">
<LocalAdminNav/>
<h1 className="text-2xl font-bold">Edit Area — {tag}</h1>
<div className="grid gap-3">
<label className="block">
<span className="text-sm text-gray-600">Name</span>
<input className="border rounded-xl px-3 py-2 w-full"
value={form.name} onChange={e=>setForm(v=>({ ...v, name: e.target.value }))} />
</label>
<div>
<span className="text-sm text-gray-600">Center</span>
<GeoSearchBox onPick={(p)=>setForm(v=>({ ...v, center_lat:p.lat,
center_lng:p.lng }))} />
<div className="text-xs text-gray-500 mt-1">Selected:
{Number(form.center_lat).toFixed(5)}, {Number(form.center_lng).toFixed(5)}</div>
</div>
<label className="block">
<span className="text-sm text-gray-600">Radius (km)</span>
<input type="number" min={0.5} step={0.5}
className="border rounded-xl px-3 py-2 w-40" value={form.radius_km}
onChange={e=>setForm(v=>({ ...v, radius_km: Number(e.target.value) }))} />
</label>
<label className="inline-flex items-center gap-2 text-sm"><input
type="checkbox" checked={form.active} onChange={e=>setForm(v=>({ ...v, active:
e.target.checked }))} /> Active</label>
<div className="pt-2">
<button onClick={save} className="border rounded-xl px-3 py-2
hover:shadow">Save</button>
</div>
</div>
</main>
);
}
