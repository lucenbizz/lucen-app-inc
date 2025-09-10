// app/dashboard/page.jsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import RequireAuth from '../components/RequireAuth';
import PlanBadge from '../components/PlanBadge';
import DashboardClient from './DashboardClient';
import ClientBoundary from '../components/ClientBoundary';

export default function Page() {
  return (
    <RequireAuth>
      <main className="container-safe py-6 space-y-6">
        <h1 className="text-2xl font-bold gold-text">Lucen Admin Dashboard</h1>

        {/* If either child throws on the client/hydration, only that panel fails */}
        <ClientBoundary label="PlanBadge">
          <PlanBadge />
        </ClientBoundary>

        <ClientBoundary label="Dashboard">
          <DashboardClient />
        </ClientBoundary>
      </main>
    </RequireAuth>
  );
}
