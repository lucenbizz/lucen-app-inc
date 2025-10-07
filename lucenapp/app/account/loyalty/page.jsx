// /app/account/loyalty/page.jsx
"use client";
import { useEffect, useState } from "react";
import LoyaltyWidget from "../../components/LoyaltyWidget";

function fmt(ts){ try{ const d=new Date(ts); return d.toLocaleString('en-US', { timeZone: 'America/New_York' }); } catch { return ts; } }

export default function LoyaltyPage(){
  const [items, setItems] = useState([]);
  const [from, setFrom] = useState(0);
  const [loading, setLoading] = useState(false);

  async function load(more=false){
    setLoading(true);
    try{
      const res = await fetch(`/api/loyalty/events?limit=50&from=${more?from:0}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setItems(more ? [...items, ...(json.items||[])] : (json.items||[]));
      setFrom(json.nextFrom || 0);
    } catch(e){ alert(e.message); }
    finally{ setLoading(false); }
  }

  useEffect(()=>{ load(false); },[]);

  return (
    <main className="p-6 space-y-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Loyalty</h1>
      <LoyaltyWidget/>

      <div className="border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="py-2 px-3">When</th>
              <th className="py-2 px-3">Type</th>
              <th className="py-2 px-3">Points</th>
              <th className="py-2 px-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {items.map(ev => (
              <tr key={ev.id} className="border-t">
                <td className="py-2 px-3 whitespace-nowrap text-gray-600">{fmt(ev.at)}</td>
                <td className="py-2 px-3 font-mono">{ev.type}</td>
                <td className="py-2 px-3 font-semibold">{ev.points>0?`+${ev.points}`:ev.points}</td>
                <td className="py-2 px-3 text-gray-700">{ev.reason || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button disabled={loading} onClick={()=>load(true)} className="border rounded-xl px-3 py-2 hover:shadow disabled:opacity-50">Load more</button>
      </div>
    </main>
  );
}
