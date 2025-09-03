'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import useOnline, { useOnline as _named } from '../lib/useOnline';

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SORT = {
  bookings: { column: 'slot_time', asc: true },
  plans: { column: 'price', asc: true },
  ebooks: { column: 'name', asc: true },
  delivery_slots: { column: 'time_slot', asc: true },
};
const SECTIONS = ['bookings', 'plans', 'ebooks', 'delivery_slots'];

function useRequestEvents() {
  return {
    start: () => window.dispatchEvent(new CustomEvent('req:start')),
    end: () => window.dispatchEvent(new CustomEvent('req:end')),
  };
}
const ls = {
  get(k, f = null) { try { if (typeof window === 'undefined') return f; const v = localStorage.getItem(k); return v ?? f; } catch { return f; } },
  set(k, v) { try { if (typeof window !== 'undefined') localStorage.setItem(k, v); } catch {} },
};

export default function DashboardClient() {
  const { start, end } = useRequestEvents();
  const online = useOnline();

  const dbRef = useRef(null);
  const [dbReady, setDbReady] = useState(false);
  useEffect(() => { (async () => { try { const { default: db } = await import('../lib/dbClient'); dbRef.current = db; setDbReady(true);} catch(e){console.error(e);} })(); }, []);

  const [data, setData] = useState({ bookings: [], plans: [], ebooks: [], delivery_slots: [] });
  const [total, setTotal] = useState({ bookings: 0, plans: 0, ebooks: 0, delivery_slots: 0 });
  const [page, setPage] = useState({ bookings: 1, plans: 1, ebooks: 1, delivery_slots: 1 });
  const [pageSize, setPageSize] = useState({ bookings: DEFAULT_PAGE_SIZE, plans: DEFAULT_PAGE_SIZE, ebooks: DEFAULT_PAGE_SIZE, delivery_slots: DEFAULT_PAGE_SIZE });
  const [compactPref, setCompactPref] = useState({ bookings: false, plans: false, ebooks: false, delivery_slots: false });

  useEffect(() => {
    const p = {}, s = {}, c = {};
    SECTIONS.forEach((t) => {
      const pv = parseInt(ls.get(`page-${t}`, '1'), 10);
      const sv = parseInt(ls.get(`pageSize-${t}`, String(DEFAULT_PAGE_SIZE)), 10);
      p[t] = Number.isNaN(pv) ? 1 : pv; s[t] = Number.isNaN(sv) ? DEFAULT_PAGE_SIZE : sv;
      c[t] = ls.get(`compactMode-${t}`, 'false') === 'true';
    });
    setPage(p); setPageSize(s); setCompactPref(c);
  }, []);

  const fetchTable = async (table, currentPage, rowsPerPage) => {
    const db = dbRef.current; if (!db) return;
    const sort = DEFAULT_SORT[table]; const from = (currentPage - 1) * rowsPerPage; const to = from + rowsPerPage - 1;
    start();
    try {
      const res = await db.from(table).select('*', { count: 'exact' }).order(sort.column, { ascending: !!sort.asc }).range(from, to);
      const { data: rows, error, count } = res || {};
      if (!error) setData((prev) => ({ ...prev, [table]: rows || [] }));
      let totalCount = typeof count === 'number' ? count : total[table];
      if (typeof count !== 'number') {
        const headRes = await db.from(table).select('*', { count: 'exact', head: true });
        if (!headRes?.error && typeof headRes?.count === 'number') totalCount = headRes.count;
      }
      setTotal((prev) => ({ ...prev, [table]: totalCount }));
    } finally { end(); }
  };

  useEffect(() => { if (!dbReady) return; SECTIONS.forEach((t) => fetchTable(t, page[t], pageSize[t])); }, [dbReady]);
  useEffect(() => {
    if (!dbReady) return;
    SECTIONS.forEach((t) => { fetchTable(t, page[t], pageSize[t]); ls.set(`page-${t}`, String(page[t])); });
  }, [dbReady, page.bookings, page.plans, page.ebooks, page.delivery_slots]);

  const columns = useMemo(() => {
    const cols = {}; SECTIONS.forEach((t) => { const rows = data[t]; cols[t] = rows.length ? Object.keys(rows[0]) : []; }); return cols;
  }, [data]);

  return (
    <div className="container-safe p-4 space-y-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lucen Admin Dashboard</h1>
        <span className={`text-sm px-2 py-1 rounded-full border ${online ? 'border-green-500' : 'border-red-500'}`}>{online ? 'Online' : 'Offline'}</span>
      </header>

      {SECTIONS.map((section) => (
        <div key={section} className="bg-[#111] rounded-xl border border-[#222] shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold capitalize gold-text">{section.replace('_', ' ')}</h2>
              <span className="badge gold">
                Sorted by: {DEFAULT_SORT[section].column} {DEFAULT_SORT[section].asc ? '↑' : '↓'} (locked)
              </span>
            </div>
            <div className="text-sm text-gray-400">Total: {total[section]}</div>
          </div>

          <div className="overflow-auto card">
            <table className="table text-sm">
              <thead className="bg-[#181818] sticky top-0">
                <tr>{columns[section].map((c) => (<th key={c} className="text-left px-3 py-2 border-b border-[#222] text-gray-300">{c}</th>))}</tr>
              </thead>
              <tbody>
                {data[section].length === 0 ? (
                  <tr><td className="px-3 py-4 text-gray-400" colSpan={columns[section].length || 1}>No records.</td></tr>
                ) : (
                  data[section].map((row, idx) => (
                    <tr key={row.id ?? `${section}-${idx}`} className="odd:bg-[#0e0e0e] even:bg-[#0b0b0b]">
                      {columns[section].map((c) => (<td key={c} className="px-3 py-2 border-b border-[#151515]">{row[c] != null ? (typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c])) : ''}</td>))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
