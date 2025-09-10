'use client';
import { useEffect, useMemo, useState } from 'react';
import supabase from '../lib/supabaseClient';
import useOnline from '../lib/useOnline';

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

  // table data + counts
  const [data, setData] = useState({ bookings: [], plans: [], ebooks: [], delivery_slots: [] });
  const [total, setTotal] = useState({ bookings: 0, plans: 0, ebooks: 0, delivery_slots: 0 });

  // pagination prefs
  const [page, setPage] = useState({ bookings: 1, plans: 1, ebooks: 1, delivery_slots: 1 });
  const [pageSize, setPageSize] = useState({
    bookings: DEFAULT_PAGE_SIZE,
    plans: DEFAULT_PAGE_SIZE,
    ebooks: DEFAULT_PAGE_SIZE,
    delivery_slots: DEFAULT_PAGE_SIZE,
  });
  const [compactPref, setCompactPref] = useState({
    bookings: false, plans: false, ebooks: false, delivery_slots: false,
  });

  // restore pagination + compact prefs
  useEffect(() => {
    const p = {}, s = {}, c = {};
    SECTIONS.forEach((t) => {
      const pv = parseInt(ls.get(`page-${t}`, '1'), 10);
      const sv = parseInt(ls.get(`pageSize-${t}`, String(DEFAULT_PAGE_SIZE)), 10);
      p[t] = Number.isNaN(pv) ? 1 : pv;
      s[t] = Number.isNaN(sv) ? DEFAULT_PAGE_SIZE : sv;
      c[t] = ls.get(`compactMode-${t}`, 'false') === 'true';
    });
    setPage(p); setPageSize(s); setCompactPref(c);
  }, []);

  // fetch a table page
  const fetchTable = async (table, currentPage, rowsPerPage) => {
    const sort = DEFAULT_SORT[table];
    const from = (currentPage - 1) * rowsPerPage;
    const to = from + rowsPerPage - 1;

    start();
    try {
      const { data: rows, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .order(sort.column, { ascending: !!sort.asc })
        .range(from, to);

      if (!error) setData((prev) => ({ ...prev, [table]: rows || [] }));
      if (typeof count === 'number') {
        setTotal((prev) => ({ ...prev, [table]: count }));
      } else {
        const { count: headCount } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        if (typeof headCount === 'number') {
          setTotal((prev) => ({ ...prev, [table]: headCount }));
        }
      }
    } finally {
      end();
    }
  };

  // fetch when page size changes (and on initial restore)
  useEffect(() => {
    SECTIONS.forEach((t) => fetchTable(t, page[t], pageSize[t]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize.bookings, pageSize.plans, pageSize.ebooks, pageSize.delivery_slots]);

  // refetch when page changes (and persist page)
  useEffect(() => {
    SECTIONS.forEach((t) => {
      fetchTable(t, page[t], pageSize[t]);
      ls.set(`page-${t}`, String(page[t]));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.bookings, page.plans, page.ebooks, page.delivery_slots]);

  // realtime: refresh affected table on change
  useEffect(() => {
    const channels = SECTIONS.map((t) =>
      supabase
        .channel(`${t}-changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table: t }, () => {
          fetchTable(t, page[t], pageSize[t]);
        })
        .subscribe()
    );
    return () => channels.forEach((ch) => supabase.removeChannel(ch));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.bookings, page.plans, page.ebooks, page.delivery_slots, pageSize.bookings, pageSize.plans, pageSize.ebooks, pageSize.delivery_slots]);

  // compute columns for simple generic tables
  const columns = useMemo(() => {
    const cols = {};
    SECTIONS.forEach((t) => {
      const rows = data[t];
      cols[t] = rows.length ? Object.keys(rows[0]) : [];
    });
    return cols;
  }, [data]);

  return (
    <div className="container-safe p-4 space-y-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lucen Dashboard</h1>
        <span className={`text-sm px-2 py-1 rounded-full border ${online ? 'border-green-500' : 'border-red-500'}`}>
          {online ? 'Online' : 'Offline'}
        </span>
      </header>

      {SECTIONS.map((section) => (
        <div key={section} className="bg-[#111] rounded-xl border border-[#222] shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold capitalize gold-text">
                {section.replace('_', ' ')}
              </h2>
              <span className="badge gold">
                Sorted by: {DEFAULT_SORT[section].column} {DEFAULT_SORT[section].asc ? '↑' : '↓'} (locked)
              </span>
            </div>
            <div className="text-sm text-gray-400">Total: {total[section]}</div>
          </div>

          <div className="overflow-auto card">
            <table className="table text-sm">
              <thead className="bg-[#181818] sticky top-0">
                <tr>
                  {columns[section].map((c) => (
                    <th key={c} className="text-left px-3 py-2 border-b border-[#222] text-gray-300">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data[section].length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-gray-400" colSpan={columns[section].length || 1}>
                      No records.
                    </td>
                  </tr>
                ) : (
                  data[section].map((row, idx) => (
                    <tr key={row.id ?? `${section}-${idx}`} className="odd:bg-[#0e0e0e] even:bg-[#0b0b0b]">
                      {columns[section].map((c) => (
                        <td key={c} className="px-3 py-2 border-b border-[#151515]">
                          {row[c] != null ? (typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c])) : ''}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          <Pagination
            table={section}
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            total={total}
            compactPref={compactPref}
            setCompactPref={setCompactPref}
          />
        </div>
      ))}
    </div>
  );
}

/** Pagination with memory, jump, rows/page, number strip, compact + auto-compact, results range */
function Pagination({ table, page, setPage, pageSize, setPageSize, total, compactPref, setCompactPref }) {
  const totalPages = Math.max(1, Math.ceil((total[table] || 0) / (pageSize[table] || DEFAULT_PAGE_SIZE)));
  const [jumpPage, setJumpPage] = useState(page[table]);
  const [compact, setCompact] = useState(compactPref[table]);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);

  useEffect(() => setJumpPage(page[table]), [page[table]]);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const effectiveCompact = isMobile ? true : compact;

  const goToPage = (target) => {
    let t = parseInt(target, 10);
    if (Number.isNaN(t)) return;
    t = Math.max(1, Math.min(totalPages, t));
    setPage((prev) => ({ ...prev, [table]: t }));
    ls.set(`page-${table}`, t.toString());
  };

  const handlePageSizeChange = (e) => {
    const newSize = parseInt(e.target.value, 10);
    const size = Number.isNaN(newSize) ? DEFAULT_PAGE_SIZE : newSize;
    setPageSize((prev) => ({ ...prev, [table]: size }));
    ls.set(`pageSize-${table}`, size.toString());
    goToPage(1);
  };

  const toggleCompact = () => {
    setCompact((v) => {
      const nv = !v;
      setCompactPref((prev) => ({ ...prev, [table]: nv }));
      ls.set(`compactMode-${table}`, String(nv));
      return nv;
    });
  };

  const start = total[table] === 0 ? 0 : (page[table] - 1) * pageSize[table] + 1;
  const end = Math.min(page[table] * pageSize[table], total[table] || 0);

  const pages = (() => {
    const cur = page[table];
    const maxButtons = 5;
    let s = Math.max(1, cur - Math.floor(maxButtons / 2));
    let e = s + maxButtons - 1;
    if (e > totalPages) {
      e = totalPages;
      s = Math.max(1, e - maxButtons + 1);
    }
    const arr = [];
    for (let i = s; i <= e; i++) arr.push(i);
    return arr;
  })();

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={effectiveCompact} onChange={toggleCompact} />
          Compact mode {isMobile && <span className="text-gray-400">(forced on mobile)</span>}
        </label>
        <span className="ml-auto text-gray-400">
          {start} – {end} of {total[table] || 0}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* First */}
        {!effectiveCompact && (
          <button
            disabled={page[table] === 1}
            onClick={() => goToPage(1)}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            ⏮ First
          </button>
        )}

        {/* Prev */}
        <button
          disabled={page[table] === 1}
          onClick={() => goToPage(page[table] - 1)}
          className="px-2 py-1 border rounded disabled:opacity-50"
        >
          ◀ Prev
        </button>

        {/* Page strip */}
        {!effectiveCompact && (
          <div className="flex items-center gap-1">
            {pages.map((p) => (
              <button
                key={p}
                onClick={() => goToPage(p)}
                className={`px-2 py-1 border rounded ${
                  p === page[table]
                    ? "bg-blue-500 text-white border-blue-600"
                    : "bg-[#0f0f0f] hover:bg-[#151515]"
                }`}
              >
                {p}
              </button>
            ))}
            {totalPages > 5 && page[table] < totalPages - 2 && (
              <>
                <span className="px-1">…</span>
                <button
                  onClick={() => goToPage(totalPages)}
                  className="px-2 py-1 border rounded bg-[#0f0f0f] hover:bg-[#151515]"
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>
        )}

        {/* Next */}
        <button
          disabled={page[table] >= totalPages}
          onClick={() => goToPage(page[table] + 1)}
          className="px-2 py-1 border rounded disabled:opacity-50"
        >
          Next ▶
        </button>

        {/* Last */}
        {!effectiveCompact && (
          <button
            disabled={page[table] >= totalPages}
            onClick={() => goToPage(totalPages)}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            Last ⏭
          </button>
        )}

        {/* Jump to page */}
        {!effectiveCompact && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={String(jumpPage)}
              onChange={(e) => setJumpPage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && goToPage(jumpPage)}
              className="w-16 px-2 py-1 border rounded bg-[#121212]"
              min={1}
              max={totalPages}
            />
            <button
              onClick={() => goToPage(jumpPage)}
              className="px-2 py-1 border rounded bg-[#0f0f0f] hover:bg-[#151515]"
            >
              Go
            </button>
          </div>
        )}

        {/* Rows per page */}
        {!effectiveCompact && (
          <div className="flex items-center gap-1">
            <span>Rows:</span>
            <select
              value={pageSize[table]}
              onChange={handlePageSizeChange}
              className="px-2 py-1 border rounded bg-[#121212]"
            >
              {[10, 25, 50].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
