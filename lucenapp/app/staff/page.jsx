'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '../lib/supabaseClient';

export default function StaffPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const [pending, setPending] = useState([]);
  const [mine, setMine] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      setError('');

      const { data: { user }, error: uerr } = await supabase.auth.getUser();
      if (uerr) {
        setError(uerr.message || 'Auth error');
        setLoading(false);
        return;
      }
      if (!user) {
        router.replace('/auth/sign-in?next=/staff');
        return;
      }
      if (canceled) return;

      setUser(user);

      const { data: prof, error: perr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (perr) setError(perr.message || 'Failed to load role');
      else setRole(prof?.role || 'user');

      setLoading(false);
    })();
    return () => { canceled = true; };
  }, [router]);

  const fetchLists = async (uid) => {
    setError('');

    const { data: pRows, error: pErr } = await supabase
      .from('deliveries')
      .select('*')
      .eq('status', 'pending')
      .is('assigned_to', null)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (pErr) setError(pErr.message);
    setPending(pRows || []);

    const { data: mRows, error: mErr } = await supabase
      .from('deliveries')
      .select('*')
      .eq('assigned_to', uid)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (mErr) setError((prev) => prev || mErr.message);
    setMine(mRows || []);
  };

  useEffect(() => { if (user?.id) fetchLists(user.id); }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel('deliveries-staff')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => {
        fetchLists(user.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const claim = async (id) => {
    if (!user?.id || busy) return;
    setBusy(true); setError('');
    const { error } = await supabase
      .from('deliveries')
      .update({ assigned_to: user.id, status: 'in_progress' })
      .eq('id', id)
      .eq('status', 'pending');
    if (error) setError(error.message);
    setBusy(false);
  };

  const markDelivered = async (id) => {
    if (!user?.id || busy) return;
    setBusy(true); setError('');
    const { error } = await supabase
      .from('deliveries')
      .update({ status: 'delivered' })
      .eq('id', id)
      .eq('assigned_to', user.id);
    if (error) setError(error.message);
    setBusy(false);
  };

  const markInProgress = async (id) => {
    if (!user?.id || busy) return;
    setBusy(true); setError('');
    const { error } = await supabase
      .from('deliveries')
      .update({ status: 'in_progress' })
      .eq('id', id)
      .eq('assigned_to', user.id);
    if (error) setError(error.message);
    setBusy(false);
  };

  const markCanceled = async (id) => {
    if (!user?.id || busy) return;
    setBusy(true); setError('');
    const { error } = await supabase
      .from('deliveries')
      .update({ status: 'canceled' })
      .eq('id', id)
      .eq('assigned_to', user.id);
    if (error) setError(error.message);
    setBusy(false);
  };

  const notAllowed = useMemo(() => {
    if (loading) return false;
    return !(role === 'admin' || role === 'staff');
  }, [loading, role]);

  if (loading) {
    return (
      <main className="container-safe p-6">
        <div className="card p-6">Loading…</div>
      </main>
    );
  }

  if (notAllowed) {
    return (
      <main className="container-safe p-6">
        <div className="card p-6">
          <h1 className="text-xl font-semibold gold-text">Not authorized</h1>
          <p className="text-sm text-[#bdbdbd] mt-2">This page is for staff and admins only.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container-safe p-4 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold gold-text">Staff Console</h1>
        <div className="text-sm text-[#bdbdbd]">
          Signed in as <span className="text-white font-medium">{user?.email}</span>
          {role ? <span className="ml-2 badge gold uppercase">{role}</span> : null}
        </div>
      </header>

      {/* errors */}
      {error && (
        <div className="card p-3 border border-red-600 bg-red-950/20 text-sm">{error}</div>
      )}

      <section className="grid md:grid-cols-2 gap-6">
        {/* Pending */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Unassigned (Pending)</h2>
            <span className="badge gold">{pending.length}</span>
          </div>

          {pending.length === 0 ? (
            <div className="text-sm text-[#9a9a9a]">No pending deliveries.</div>
          ) : (
            <ul className="space-y-3">
              {pending.map((d) => (
                <li key={d.id} className="rounded-lg border border-[#222] bg-[#0f0f0f] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium">#{d.id}</div>
                      <div className="text-xs text-[#9a9a9a]">Status: <span className="badge">pending</span></div>
                      {d.time_slot && <div className="text-sm">{String(d.time_slot)}</div>}
                      {d.address && <div className="text-sm">{String(d.address)}</div>}
                    </div>
                    <button disabled={busy} onClick={() => claim(d.id)} className="btn btn-primary shrink-0">
                      Claim
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Mine */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">My Deliveries</h2>
            <span className="badge gold">{mine.length}</span>
          </div>

          {mine.length === 0 ? (
            <div className="text-sm text-[#9a9a9a]">No assigned deliveries yet.</div>
          ) : (
            <ul className="space-y-3">
              {mine.map((d) => (
                <li key={d.id} className="rounded-lg border border-[#222] bg-[#0f0f0f] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium">#{d.id}</div>
                      <div className="text-xs text-[#9a9a9a]">Status: <span className="badge">{String(d.status)}</span></div>
                      {d.time_slot && <div className="text-sm">{String(d.time_slot)}</div>}
                      {d.address && <div className="text-sm">{String(d.address)}</div>}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {d.status !== 'in_progress' && (
                        <button disabled={busy} onClick={() => markInProgress(d.id)} className="btn btn-outline">
                          Start
                        </button>
                      )}
                      {d.status !== 'delivered' && (
                        <button disabled={busy} onClick={() => markDelivered(d.id)} className="btn btn-primary">
                          Delivered
                        </button>
                      )}
                      {d.status !== 'canceled' && (
                        <button disabled={busy} onClick={() => markCanceled(d.id)} className="btn">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
