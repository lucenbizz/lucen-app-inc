// app/admin/layout.jsx
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '../lib/supabaseServerClient';

export const metadata = { title: 'Admin — Lucen' };

export default async function AdminLayout({ children }) {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/sign-in?next=/admin');

  const { data: prof } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!prof || prof.role !== 'admin') {
    redirect('/forbidden');
  }

  return <section className="min-h-screen">{children}</section>;
}
