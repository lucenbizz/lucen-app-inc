// app/components/PlanBadge.jsx  (Server Component)
import { headers } from "next/headers";
import { getUserAndProfile } from "../lib/supabaseServerClient.js";
import ManageBillingButton from "./ManageBillingButton.jsx";
import CopyField from "./CopyField.jsx";

function PlanChip({ children }) {
  return <span className="badge gold">{children}</span>;
}

export default async function PlanBadge() {
  let user = null, profile = null;
  try {
    ({ user, profile } = await getUserAndProfile());
  } catch {
    return null;
  }
  if (!user) return null;

  const plan = profile?.plan ?? null;
  const ebooksQuota = profile?.ebooks_quota;
  const priority = !!profile?.priority_delivery;
  const vip = !!profile?.vip_badge;
  const isStudent = !!profile?.is_student;
  const credits = profile?.referral_credit_available ?? 0;

  const perks = [];
  if (ebooksQuota === null) perks.push("All ebooks");
  else perks.push(`${ebooksQuota} ebook${ebooksQuota === 1 ? "" : "s"}`);
  if (priority) perks.push("Priority delivery");
  if (vip) perks.push("VIP badge");
  if (isStudent) perks.push("Student 10%");

  const title = plan ? plan[0].toUpperCase() + plan.slice(1) : "No plan yet";

  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host  = h.get("x-forwarded-host") || h.get("host");
  const origin = `${proto}://${host}`;
  const referralLink = `${origin}/plans?ref=${encodeURIComponent(user.id)}`;

  return (
    <section className="card gold-border p-4 md:p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">
            <span className="gold-text">Your Plan:</span>{" "}
            <span className="align-middle">{title}</span>
            {vip && <span className="ml-2 badge gold" aria-label="VIP">VIP</span>}
            {isStudent && <span className="ml-2 badge gold" aria-label="Student">Student 10%</span>}
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
          {!plan && <a href="/plans" className="btn btn-primary">Choose a plan</a>}
          {plan && plan !== "black" && <a href="/plans" className="btn btn-outline">Upgrade</a>}
          {plan && <a href="/plans" className="btn">View plans</a>}
          {plan && <ManageBillingButton className="btn btn-outline">Manage billing</ManageBillingButton>}
        </div>
      </div>

      {/* Referral credits + link */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="text-sm text-[#bdbdbd]">Referral credits available</div>
          <div className="text-2xl font-bold mt-1">{credits}</div>
          <p className="text-xs text-[#9a9a9a] mt-1">
            Every 2 paid referrals = 10% off your next purchase.
          </p>
        </div>
        <div className="md:col-span-2 card p-4">
          <div className="text-sm text-[#bdbdbd] mb-2">Your referral link</div>
          <CopyField value={referralLink} />
          <p className="text-xs text-[#9a9a9a] mt-2">
            Share this link. When a friend buys, you get progress toward a 10% discount.
          </p>
        </div>
      </div>
    </section>
  );
}
