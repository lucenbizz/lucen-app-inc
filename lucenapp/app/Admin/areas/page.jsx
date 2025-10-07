"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AreaMap from "../../components/AreaMap";
function ymd(d = new Date()) {
const y = d.getFullYear();
const m = String(d.getMonth() + 1).padStart(2, "0");
const da = String(d.getDate()).padStart(2, "0");
return `${y}-${m}-${da}`;
}
export default function AdminAreasPage() {
const [date, setDate] = useState(ymd());
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);
const [q, setQ] = useState("");
const [activeFilter, setActiveFilter] = useState("all"); // all|active|
inactive
const [hoverTag, setHoverTag] = useState(null);
async function load() {
setLoading(true);
try {
const res = await fetch(`/api/areas?date=${date}&tz=America/New_York`);
const json = await res.json();
setData(json.areas || []);
} catch {
setData([]);
} finally { setLoading(false); }
}
useEffect(() => { load(); }, [date]);
const filtered = useMemo(() => {
return (data || []).filter(a => {
const matchQ = q ? (`${a.tag} ${a.name}
`.toLowerCase().includes(q.toLowerCase())) : true;
const matchActive = activeFilter === "all" ? true : (activeFilter ===
"active" ? a.active : !a.active);
return matchQ && matchActive;
});
}, [data, q, activeFilter]);
async function toggleActive(tag, active) {
const res = await fetch(`/api/areas/${tag}`, { method: "PATCH", headers: {
"Content-Type": "application/json" }, body: JSON.stringify({ active: !
active }) });
const json = await res.json();
if (!res.ok) return alert(json.error || "Failed to update");
load();
}
return (
<main className="p-6 space-y-4 max-w-6xl mx-auto">
<div className="flex items-center justify-between gap-2 flex-wrap">
<h1 className="text-2xl font-bold">Service Areas</h1>
<div className="flex items-center gap-2">
<input type="date" value={date} onChange={(e) =>
setDate(e.target.value)} className="border rounded-xl px-3 py-2" />
<Link href="/admin/areas/new" className="border rounded-xl px-3 py-2
hover:shadow">New area</Link>
</div>
</div>
<div className="flex items-start gap-4 flex-col lg:flex-row">
{/* Table */}
<div className="flex-1 border rounded-2xl overflow-x-auto">
<div className="p-3 flex items-center gap-2">
<input value={q} onChange={(e) => setQ(e.target.value)}
placeholder="Search tag or name…" className="border rounded-xl px-3 py-2 w-64" /
>
<select value={activeFilter} onChange={(e) =>
setActiveFilter(e.target.value)} className="border rounded-xl px-3 py-2">
<option value="all">All</option>
<option value="active">Active</option>
<option value="inactive">Inactive</option>
</select>
</div>
<table className="w-full text-sm">
<thead>
<tr className="text-left text-gray-500 border-b">
<th className="py-2 px-3">Tag</th>
<th className="py-2 px-3">Name</th>
<th className="py-2 px-3">Radius (km)</th>
<th className="py-2 px-3">Center</th>
<th className="py-2 px-3">Active</th>
<th className="py-2 px-3">Drivers on duty</th>
<th className="py-2 px-3">Orders today</th>
<th className="py-2 px-3">Conflicts</th>
<th className="py-2 px-3">Actions</th>
</tr>
</thead>
<tbody>
{filtered.length === 0 ? (
<tr><td className="py-3 px-3" colSpan={9}>No areas.</td></tr>
) : filtered.map((a) => (
<tr key={a.tag} className="border-b last:border-b-0"
onMouseEnter={() => setHoverTag(a.tag)} onMouseLeave={() => setHoverTag(null)}>
<td className="py-2 px-3 font-mono">{a.tag}</td>
<td className="py-2 px-3">{a.name || "—"}</td>
<td className="py-2 px-3">{a.radius_km}</td>
<td className="py-2 px-3">{a.center_lat?.toFixed(4)},
{a.center_lng?.toFixed(4)}</td>
<td className="py-2 px-3">
<button className="border rounded-xl px-2 py-1 text-xs"
onClick={() => toggleActive(a.tag, a.active)}>{a.active ? "Active" : "Inactive"}
</button>
</td>
<td className="py-2 px-3">{a.on_duty_today ?? 0}</td>
<td className="py-2 px-3">{a.orders_today ?? 0}</td>
<td className="py-2 px-3">{a.overlaps ? <span
title="Overlapping radius with other areas"> {a.overlaps}</span> : "—"}</td>
<td className="py-2 px-3">
<div className="flex items-center gap-2">
<Link className="border rounded-xl px-2 py-1 text-xs"
href={`/admin/areas/${a.tag}`}>Edit</Link>
<button className="border rounded-xl px-2 py-1 text-xs"
onClick={async () => {
if (!confirm(`Delete area ${a.tag}?`)) return;
const res = await fetch(`/api/areas/${a.tag}`, {
method: "DELETE" });
const json = await res.json();
if (!res.ok) return alert(json.error || "Failed to delete");
load();
}}>Delete</button>
</div>
</td>
</tr>
))}
</tbody>
</table>
</div>
{/* Map preview */}
<div className="w-full lg:w-[520px] shrink-0">
<AreaMap
center={filtered[0] ? { lat: filtered[0].center_lat, lng:
filtered[0].center_lng } : { lat: 40.7128, lng: -74.006 }}
radiusKm={filtered[0]?.radius_km || 10}
editable={false}
areas={(data || []).filter(a => a.active)}
highlightTag={hoverTag}
height={520}
/>
<div className="text-xs text-gray-500 mt-2">Hover a row to highlight
on the map. Dragging is available in the editor.</div>
</div>
</div>
</main>
);
} 