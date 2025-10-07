// /components/StaffPicker.jsx
"use client";

import { useEffect, useRef, useState } from "react";

export default function StaffPicker({ onSelect, placeholder = "Search staff by name or email…" }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    function onDocClick(e){
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    async function run(){
      const term = q.trim();
      if (!term) { setItems([]); return; }
      setLoading(true);
      try{
        const res = await fetch(`/api/users/search-staff?q=${encodeURIComponent(term)}&limit=8`, { signal: ctrl.signal });
        const json = await res.json();
        if (res.ok) setItems(json.items || []);
      } finally {
        setLoading(false);
      }
    }
    const t = setTimeout(run, 180);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  return (
    <div ref={boxRef} className="relative w-full">
      <input
        value={q}
        onFocus={()=>setOpen(true)}
        onChange={e => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded-xl px-3 py-2"
      />
      {open && (items.length > 0 || loading) && (
        <div className="absolute z-20 mt-1 w-full border rounded-xl bg-white shadow">
          {loading && <div className="px-3 py-2 text-xs text-gray-500">Searching…</div>}
          {items.map(it => (
            <button
              type="button"
              key={it.id}
              onClick={() => { onSelect?.(it); setOpen(false); setQ(""); setItems([]); }}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
            >
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-xs">
                {(it.name || it.email || "?").slice(0,1).toUpperCase()}
              </span>
              <span className="text-sm">
                <span className="font-medium">{it.name || "—"}</span>
                <span className="text-gray-500"> · {it.email || "—"}</span>
              </span>
            </button>
          ))}
          {!loading && items.length === 0 && <div className="px-3 py-2 text-xs text-gray-500">No matches</div>}
        </div>
      )}
    </div>
  );
}
 