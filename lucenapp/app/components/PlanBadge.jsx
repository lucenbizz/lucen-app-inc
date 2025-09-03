import Link from "next/link";
import { getUserAndProfile } from "../lib/supabaseServerClient.js";
import ManageBillingButton from "./ManageBillingButton.jsx";

function PlanChip({ children }) {
  return <span className="badge gold">{children}</span>;
}

export default async function PlanBadge() {
  // Defensive fetch
  let user = null, profile = null;
  try {
    const res = await getUserAndProfile();
    user = res.user; profile = res.profile;
  } catch {
    return null;
  }
  if (!user) return null;

  const plan = profile?.plan ?? null;            // 'bronze' | 'silver' | 'gold' | 'black' | null
  const ebooksQuota = profile?.ebooks_quota;     // number | null (null = all)
  const priority = !!profile?.priority_delivery;
  const vip = !!profile?.vip_badge;

  const perks = [];
  if (ebooksQuota === null) perks.push("All ebooks");
  else perks.push(`${ebooksQuota} ebook${ebooksQuota === 1 ? "" : "s"}`);
  if (priority) perks.push("Priority delivery");
  if (vip) perks.push("VIP badge");

  const title = plan ? plan[0].toUpperCase() + plan.slice(1) : "No plan yet";

  return (
    <section className="card gold-border p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">
            <span className="gold-text">Your Plan:</span>{" "}
            <span className="align-middle">{title}</span>
            {vip && <span className="ml-2 badge gold" aria-label="VIP">VIP</span>}
          </h2>
          <p className="text-sm text-[#cfcfcf]">
            Signed in as <span className="text-white font-medium">{user.email}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {perks.map((p, i) => <PlanChip key={i}>{p}</PlanChip>)}
            {!plan && <PlanChip>Starter access</PlanChip>}
          </div>
        </div>

        <div className="flex gap-2">
          {!plan && <Link href="/plans" className="btn btn-primary">Choose a plan</Link>}
          {plan && plan !== "black" && <Link href="/plans" className="btn btn-outline">Upgrade</Link>}
          {plan && <Link href="/plans" className="btn">View plans</Link>}
          {plan && <ManageBillingButton className="btn btn-outline">Manage billing</ManageBillingButton>}
        </div>
      </div>
    </section>
  );
}
