"use client";
import RoleGate from "../../../components/RoleGate";
import { useRoles } from "../../../hooks/useRoles";
import GeoSearchBox from "../../../components/GeoSearchBox";
import { useEffect, useRef, useState } from "react";
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
export default function NewAreaPage() {
return (
<RoleGate minRole="admin" fallback={<main className="p-6">Admin only.</
main>}>
<InnerNewArea/>
</RoleGate>
);
}
function InnerNewArea(){
const [name, setName] = useState("");
const [tag, setTag] = useState("");
const [center, setCenter] = useState({ lat: 40.7128, lng: -74.0060 });
const [radiusKm, setRadiusKm] = useState(5);
const [active, setActive] = useState(true);
const [saving, setSaving] = useState(false);
const [overlaps, setOverlaps] = useState([]);
async function validateOverlap(lat, lng, radius) {
const sp = new URLSearchParams({ lat, lng, radius });
const res = await fetch(`/api/areas/validate?${sp.toString()}`);
const json = await res.json();
return json?.overlaps || [];
}
async function save() {
setSaving(true);
try {
const res = await fetch('/api/areas', { method: 'POST', headers: {
'Content-Type': 'application/json' }, body: JSON.stringify({ name, tag,
center_lat: center.lat, center_lng: center.lng, radius_km: Number(radiusKm),
active }) });
const json = await res.json();
if (!res.ok) throw new Error(json.error || 'Save failed');
window.location.href = '/admin/areas';
} catch (e) {
alert(e.message);
} finally { setSaving(false); }
}
useEffect(() => {
(async () => { setOverlaps(await validateOverlap(center.lat, center.lng,
radiusKm)); })();
}, [center.lat, center.lng, radiusKm]);
return (
<main className="p-6 space-y-4 max-w-3xl mx-auto">
<LocalAdminNav/>
<h1 className="text-2xl font-bold">New Service Area</h1>
<div className="grid gap-3">
<label className="block">
<span className="text-sm text-gray-600">Name</span>
<input className="border rounded-xl px-3 py-2 w-full" value={name}
onChange={e=>setName(e.target.value)} />
</label>
<label className="block">
<span className="text-sm text-gray-600">Tag (unique, slug)</span>
<input className="border rounded-xl px-3 py-2 w-full" value={tag}
onChange={e=>setTag(e.target.value)} />
</label>
<div>
<span className="text-sm text-gray-600">Center</span>
<GeoSearchBox onPick={(p)=>setCenter({ lat:p.lat, lng:p.lng })} />
<div className="text-xs text-gray-500 mt-1">Selected:
{center.lat.toFixed(5)}, {center.lng.toFixed(5)}</div>
</div>
<label className="block">
<span className="text-sm text-gray-600">Radius (km)</span>
<input type="number" min={0.5} step={0.5}
className="border rounded-xl px-3 py-2 w-40" value={radiusKm}
onChange={e=>setRadiusKm(Number(e.target.value))} />
</label>
<label className="inline-flex items-center gap-2 text-sm"><input
type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} />
Active</label>
{overlaps.length>0 && (
<div className="text-xs text-amber-700 bg-amber-50 border borderamber-200 rounded-xl p-2">
Overlaps with: {overlaps.join(', ')}
</div>
)}
<div className="pt-2">
<button disabled={saving} onClick={save} className="border rounded-xl
px-3 py-2 hover:shadow">{saving? 'Saving…':'Save Area'}</button>
</div>
</div>
</main>
);
} 