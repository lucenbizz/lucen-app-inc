// /app/api/payouts/staff/export-by-filter/route.js  (NEW)
export const runtime = 'nodejs';

import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

const EXPORT_CAP = 20000;

function applyDateFilters(q, startDate, endDate) {
  if (startDate) q = q.gte("created_at", new Date(`${startDate}T00:00:00.000Z`).toISOString());
  if (endDate) {
    const end = new Date(`${endDate}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    q = q.lt("created_at", end.toISOString());
  }
  return q;
}
function toCSV(rows) {
  const header = ["id","created_at","order_id","staff_user_id","staff_name","staff_email","amount_cents","amount_usd","status"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const line = [
      r.id, r.created_at, r.order_id, r.staff_user_id || "",
      (r.staff_user?.name || "").replaceAll(",", " "),
      (r.staff_user?.email || "").replaceAll(",", " "),
      r.amount_cents, (Number(r.amount_cents||0)/100).toFixed(2), r.status
    ].map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(",");
    lines.push(line);
  }
  return lines.join("\n");
}

export async function GET(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return new Response("Not authenticated", { status: 401 });

  const [{ data: isExec }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("is_executive").catch(() => ({ data: false })),
    supabase.rpc("is_admin").catch(() => ({ data: false })),
  ]);
  if (!(isExec || isAdmin)) return new Response("Forbidden", { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") || "any").toLowerCase();
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";

  let q = supabase
    .from("staff_payouts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(EXPORT_CAP);

  if (status !== "any") q = q.eq("status", status);
  q = applyDateFilters(q, startDate, endDate);

  const { data: payouts, error } = await q;
  if (error) return new Response(error.message, { status: 400 });

  const userIds = [...new Set((payouts || []).map(p => p.staff_user_id).filter(Boolean))];
  let usersById = {};
  if (userIds.length) {
    const { data: users } = await supabase.rpc("user_public_batch", { uids: userIds });
    if (users) usersById = Object.fromEntries(users.map(u => [u.id, u]));
  }

  const rows = (payouts || []).map(p => ({ ...p, staff_user: usersById[p.staff_user_id] }));
  const csv = toCSV(rows);
  const fileName = `staff_payouts_filter_${new Date().toISOString().replace(/[:.]/g,"-")}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
 