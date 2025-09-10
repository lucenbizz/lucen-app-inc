// app/dashboard/page.jsx
import { redirect } from 'next/navigation';
import { getUser } from '../lib/supabaseServerClient';
import PlanBadge from '../components/PlanBadge';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const viewport = { themeColor: '#0a0a0a' };

export default async function Page() {
  const { user, profile } = await getUser(); // must read from server cookies
  if (!user) redirect('/auth/sign-in?next=/dashboard');

  const isAdmin =
    profile?.is_admin === true ||
    profile?.role === 'admin' ||
    (user.email?.toLowerCase?.() === 'zayhubbard4@yahoo.com');

  if (isAdmin) redirect('/Admin');

  return (
    <main className="container-safe py-6 space-y-6">
      <h1 className="text-2xl font-bold gold-text">Your Dashboard</h1>
      <PlanBadge />
      <DashboardClient />
    </main>
  );
}


