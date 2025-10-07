"use client";
import { useEffect, useMemo, useState } from "react";
import RoleGate from "../../components/RoleGate";
import { useRoles } from "../../hooks/useRoles";
function ymd(d = new Date()) { const y=d.getFullYear(); const
m=String(d.getMonth()+1).padStart(2,"0"); const
da=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${da}`; }
function fmt(ts){ try{ const d=new Date(ts); return d.toLocaleString('en-US', {
timeZone: 'America/New_York' }); } catch { return ts; } }
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
audit">Audit</a>
</>
)}
{isAdmin && (
<>
<a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/
areas">Areas</a>
<a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/
areas/new">New Area</a>
<a className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/
settings">Settings</a>
</>
)}
</nav>
);
}
export default function AuditPage(){
return (
<RoleGate minRole="executive" fallback={<main className="p-6">No access.</
main>}>
<AuditInner/>
</RoleGate>
);
}
function AuditInner(){
const [from, setFrom] = useState(() => ymd(new Date(Date.now() -
2*24*3600*1000))); // last 3 days default
const [to, setTo] = useState(() => ymd());
const [action, setAction] = useState("");
const [entity, setEntity] = useState("");
const [entityId, setEntityId] = useState("");
const [actor, setActor] = useState("");
const [items, setItems] = useState([]);
const [count, setCount] = useState(0);
const [loading, setLoading] = useState(false);
const [offset, setOffset] = useState(0);
async function load(reset=true){
if (reset) { setOffset(0); setItems([]); }
setLoading(true);
try{
const sp = new URLSearchParams({ limit: '50' });
if (from) sp.set('from', from);
if (to) sp.set('to', to);
if (action) sp.set('action', action);
if (entity) sp.set('entity', entity);
if (entityId) sp.set('entityId', entityId);
if (actor) sp.set('actor', actor);
if (!reset && offset) sp.set('offset', String(offset));
const res = await fetch(`/api/audit?${sp.toString()}`);
const json = await res.json();
if (!res.ok) throw new Error(json.error || 'Failed');
setCount(json.count || 0);
setItems(v => reset ? (json.items || []) : [...v, ...(json.items||[])]);
setOffset(json.nextOffset || 0);
} catch (e) {
alert(e.message);
} finally { setLoading(false); }
}
useEffect(()=>{ load(true); }, []);
return (
<main className="p-6 space-y-4 max-w-6xl mx-auto">
<LocalAdminNav/>
<div className="flex items-center justify-between gap-2 flex-wrap">
<h1 className="text-2xl font-bold">Audit Log</h1>
<div className="text-sm text-gray-500">{count} events</div>
</div>
<div
className="border rounded-2xl p-3 grid md:grid-cols-5 gap-3 items-end bggray-50">
<label className="text-sm">From
<input type="date" className="block border rounded-xl px-3 py-2 wfull" value={from} onChange={e=>setFrom(e.target.value)} />
</label>
<label className="text-sm">To
<input type="date" className="block border rounded-xl px-3 py-2 wfull" value={to} onChange={e=>setTo(e.target.value)} />
</label>
<label className="text-sm">Action
<input placeholder="assign, cancel, fulfill…" className="block border
rounded-xl px-3 py-2 w-full" value={action}
onChange={e=>setAction(e.target.value)} />
</label>
<label className="text-sm">Entity
<select className="block border rounded-xl px-3 py-2 w-full"
value={entity} onChange={e=>setEntity(e.target.value)}>
<option value="">Any</option>
<option value="orders">orders</option>
<option value="service_areas">service_areas</option>
</select>
</label>
<label className="text-sm">Entity ID
<input placeholder="#" className="block border rounded-xl px-3 py-2 wfull" value={entityId} onChange={e=>setEntityId(e.target.value)} />
</label>
<label className="text-sm md:col-span-2">Actor
<input placeholder="name or email" className="block border rounded-xl
px-3 py-2 w-full" value={actor} onChange={e=>setActor(e.target.value)} />
</label>
<div className="md:col-span-3 flex gap-2 justify-end">
<button onClick={()=>load(true)} className="border rounded-xl px-3
py-2 hover:shadow">Search</button>
<button onClick={()=>{ setFrom(ymd(new
Date(Date.now()-2*24*3600*1000))); setTo(ymd()); setAction(""); setEntity("");
setEntityId(""); setActor(""); load(true); }} className="border rounded-xl px-3
py-2 hover:shadow">Reset</button>
</div>
</div>
<div className="border rounded-2xl overflow-hidden">
<table className="w-full text-sm">
<thead>
<tr className="bg-gray-50 text-left text-gray-600">
<th className="py-2 px-3">Time</th>
<th className="py-2 px-3">Actor</th>
<th className="py-2 px-3">Action</th>
<th className="py-2 px-3">Entity</th>
<th className="py-2 px-3">Entity ID</th>
<th className="py-2 px-3">Details</th>
</tr>
</thead>
<tbody>
{items.map((ev) => (
<tr key={ev.id} className="border-t">
<td className="py-2 px-3 whitespace-nowrap textgray-600">{fmt(ev.at)}</td>
<td className="py-2 px-3">{ev.actor_label || ev.actor || '—'}</
td>
<td className="py-2 px-3 font-mono">{ev.action}</td>
<td className="py-2 px-3 font-mono">{ev.entity}</td>
<td className="py-2 px-3 font-mono">{ev.entity_id || '—'}</td>
<td className="py-2 px-3 text-gray-700">
<MetaPreview meta={ev.meta} />
</td>
</tr>
))}
</tbody>
</table>
</div>
<div className="flex justify-between items-center">
<div className="text-sm text-gray-500">Showing {items.length} of {count}
</div>
<button disabled={loading || items.length >= count}
onClick={()=>load(false)} className="border rounded-xl px-3 py-2 hover:shadow
disabled:opacity-50">Load more</button>
</div>
</main>
);
}
function MetaPreview({ meta }){
if (!meta) return <span className="text-gray-400">—</span>;
try {
const obj = typeof meta === 'string' ? JSON.parse(meta) : meta;
const parts = [];
if (obj.assignment) parts.push(`assign ${obj.assignment.from||'—'} → $
{obj.assignment.to||'—'} (${obj.assignment.label||''})`);
if (obj.status) parts.push(`status ${obj.status.from||'—'} → $
{obj.status.to||'—'}`);
if (obj.reschedule) parts.push(`reschedule ${obj.reschedule.from?.slice(0,
16)} → ${obj.reschedule.to?.slice(0,16)}`);
if (obj.payout) parts.push(`payout ${obj.payout.tier_from||'—'}→$
{obj.payout.tier_to||'—'} $${(obj.payout.cents_to||0)/100}`);
const line = parts.join(' • ');
if (line) return <span>{line}</span>;
const s = JSON.stringify(obj);
return <span title={s}>{s.slice(0,140)}{s.length>140?'…':''}</span>;
} catch {
const s = String(meta);
return <span title={s}>{s.slice(0,140)}{s.length>140?'…':''}</span>;
}
} 