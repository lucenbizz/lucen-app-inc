"use client";
import { useEffect, useMemo, useState } from "react";
import { generateTwentyMinuteSlots } from "../../lib/timeSlots";
export default function AdminSlotsPage() {
return <SlotsInner />;
} 
function SlotsInner() {
const [date, setDate] = useState(() => {
const now = new Date();
const yyyy = now.getFullYear();
const mm = String(now.getMonth() + 1).padStart(2, "0");
const dd = String(now.getDate()).padStart(2, "0");
return `${yyyy}-${mm}-${dd}`;
});
const [orders, setOrders] = useState([]);
const [loading, setLoading] = useState(false);
const slots = useMemo(() => generateTwentyMinuteSlots(), []);
useEffect(() => {
async function load() {
setLoading(true);
try {
const res = await fetch(`/api/orders?date=${date}&tz=America/New_York`);
const json = await res.json();
setOrders(json.orders || []);
} catch (e) {
setOrders([]);
} finally {
setLoading(false);
}
}
load();
}, [date]);
const counts = useMemo(() => {
const map = new Map();
for (const s of slots) map.set(s.minutes, 0);
for (const o of orders) {
const m = typeof o.delivery_slot_minutes === "number" ?
o.delivery_slot_minutes : o.minutes;
if (typeof m === "number" && map.has(m)) map.set(m, map.get(m) + 1);
}
return map; // minutes -> count
}, [orders, slots]);
return (
<main className="p-6 space-y-4">
<div className="flex items-center justify-between">
<h1 className="text-2xl font-bold">Slots – {date}</h1>
<div className="flex items-center gap-2">
<input type="date" value={date} onChange={(e) =>
setDate(e.target.value)} className="border rounded-xl px-3 py-2" />
<a
href={`/api/orders/export?date=${date}&tz=America/New_York`}
className="border rounded-xl px-3 py-2 hover:shadow"
>
Export CSV
</a>
</div>
</div>
{loading && <div className="text-sm text-gray-500">Loading…</div>}
<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:gridcols-8 gap-2">
{slots.map((s) => {
const c = counts.get(s.minutes) || 0;
const strong = c > 0;
return (
<div key={s.minutes} className={["rounded-xl border px-2 py-2",
strong ? "border-black shadow" : "border-gray-200"].join(" ")}>
<div className="font-mono text-sm">{s.label}</div>
<div className="text-[11px]">{c} order{c === 1 ? "" : "s"}</div>
</div>
);
})}
</div>
</main>
);
} 