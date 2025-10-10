// app/admin/layout.jsx (server component)
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export default async function AdminLayout({ children }) {
  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: prof } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)   // or .eq('user_id', user.id) depending on schema
    .maybeSingle();

  if (!prof?.is_admin) redirect('/'); // or show 403

  return <>{children}</>;
}
