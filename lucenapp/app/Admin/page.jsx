// app/Admin/page.jsx
import { redirect } from 'next/navigation';
import { getUser } from '../lib/supabaseServerClient';
import { isAdmin } from '../lib/roles';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { user, profile } = await getUser();
  if (!user) redirect('/auth/sign-in?next=/Admin');

  if (!isAdmin(profile, user)) {
    // Keep curious users out
    redirect('/forbidden');
  }

  return (
    <main className="container-safe p-6 space-y-4">
      <h1 className="text-2xl font-bold gold-text">Admin</h1>
      {/* ...admin content... */}
    </main>
  );
}

