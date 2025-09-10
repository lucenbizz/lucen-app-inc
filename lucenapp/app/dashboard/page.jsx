// app/dashboard/page.jsx
import { redirect } from 'next/navigation';
import { getUser } from '../lib/supabaseServerClient';
import { isAdmin } from '../lib/roles';
import PlanBadge from '../components/PlanBadge';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  const { user, profile } = await getUser();
  if (!user) redirect('/auth/sign-in?next=/dashboard');

  // Auto-redirect admins to the Admin area
  if (isAdmin(profile, user)) redirect('/Admin');

  return (
    <main className="container-safe py-6 space-y-6">
      <h1 className="text-2xl font-bold gold-text">Dashboard</h1>
      <PlanBadge />
      <DashboardClient />
    </main>
  );
}

