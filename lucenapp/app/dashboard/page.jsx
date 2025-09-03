import { redirect } from "next/navigation";
import { getUser } from "../lib/supabaseServerClient.js";
import PlanBadge from "../components/PlanBadge.jsx";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const viewport = { themeColor: "#0a0a0a" };

export default async function Page() {
  const { user } = await getUser();
  if (!user) redirect("/auth/sign-in?next=/dashboard");

  return (
    <main className="container-safe py-6 space-y-6">
      <h1 className="text-2xl font-bold gold-text">Lucen Admin Dashboard</h1>
      <PlanBadge />
      <DashboardClient />
    </main>
  );
}
