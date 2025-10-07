"use client";
import { useEffect, useMemo, useRef, useState } from "react";
export default function GeoSearchBox({ onPick, placeholder = "Search address or place…" }) {
const [q, setQ] = useState("");
const [results, setResults] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const abortRef = useRef(null);
async function search(term) {
if (!term || term.trim().length < 3) { setResults([]); return; }
abortRef.current?.abort();
const ctrl = new AbortController();
abortRef.current = ctrl;
setLoading(true); setError(null);
try {
const url = new URL("https://nominatim.openstreetmap.org/search");
url.searchParams.set("format", "jsonv2");
url.searchParams.set("q", term);
url.searchParams.set("limit", "8");
const res = await fetch(url.toString(), {
method: "GET",
headers: { "Accept-Language": "en" },
signal: ctrl.signal,
});
if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
const json = await res.json();
setResults(json || []);
} catch (e) {
if (e.name !== "AbortError") setError(e.message);
} finally { setLoading(false); }
}
// Basic debounce
useEffect(() => {
const t = setTimeout(() => search(q), 300);
return () => clearTimeout(t);
}, [q]);
return (
<div className="w-full">
<div className="flex gap-2 items-center">
<input
value={q}
onChange={(e) => setQ(e.target.value)}
placeholder={placeholder}
className="border rounded-xl px-3 py-2 w-full"
/>
<button className="border rounded-xl px-3 py-2" onClick={() =>
search(q)}>Search</button>
</div>
{loading && <div className="text-xs text-gray-500 mt-1">Searching…</div>}
{error && <div className="text-xs text-red-600 mt-1">{error}</div>}
{results.length > 0 && (
<ul className="mt-2 border rounded-2xl divide-y max-h-64 overflow-auto">
{results.map((r) => (
<li key={r.place_id} className="p-2 hover:bg-gray-50 cursorpointer" onClick={() => {
const lat = Number(r.lat), lon = Number(r.lon);
onPick && onPick({ lat, lng: lon, label: r.display_name });
setResults([]);
}}>
<div className="text-sm">{r.display_name}</div>
<div className="text-xs text-gray-500">{latLngText(r)}</div>
</li>
))}
</ul>
)}
</div>
);
}
function latLngText(r) {
const lat = Number(r.lat).toFixed(5);
const lon = Number(r.lon).toFixed(5);
return `${lat}, ${lon}`;
} 