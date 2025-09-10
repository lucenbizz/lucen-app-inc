// app/dashboard/page.jsx
import { redirect } from 'next/navigation';
import { getUser, getProfile } from '../lib/supabaseServerClient';
import PlanBadge from '../components/PlanBadge';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const viewport = { themeColor: '#0a0a0a' };

function isAdminLike(p) {
  return !!(p?.is_admin || p?.role === 'admin');
}

export default async function Page() {
  const { user } = await getUser();
  if (!user) redirect('/auth/sign-in?next=/dashboard');

  // Optional: auto-redirect admins to /Admin
  const { profile } = await getProfile(user.id);
  if (isAdminLike(profile)) redirect('/Admin');

  // Regular signed-in users see the customer dashboard
  return (
    <main className="container-safe py-6 space-y-6">
      <h1 className="text-2xl font-bold gold-text">Your Dashboard</h1>
      <PlanBadge />
      <DashboardClient />
    </main>
  );
}
