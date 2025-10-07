// /app/api/payouts/exec/export/route.js
export const runtime = 'nodejs';

import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

function toCSV(rows) {
  const header = [
    "id","created_at","order_id","exec_user_id","exec_name","exec_email",
    "amount_cents","amount_usd","includes_delivery","majority_bps","status"
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const line = [
      r.id,
      r.created_at,
      r.order_id,
      r.exec_user_id || "",
      (r.exec_user?.name || "").replaceAll(",", " "),
      (r.exec_user?.email || "").replaceAll(",", " "),
      r.amount_cents,
      (Number(r.amount_cents||0)/100).toFixed(2),
      r.includes_delivery ? "true" : "false",
      r.majority_bps,
      r.status,
    ].map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(",");
    lines.push(line);
  }
  return lines.join("\n");
}

export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return new Response("Not authenticated", { status: 401 });

  const [{ data: isExec }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("is_executive").catch(() => ({ data: false })),
    supabase.rpc("is_admin").catch(() => ({ data: false })),
  ]);
  if (!(isExec || isAdmin)) return new Response("Forbidden", { status: 403 });

  const { ids } = await req.json().catch(() => ({}));
  if (!Array.isArray(ids) || ids.length === 0) return new Response("ids required", { status: 400 });

  const { data: payouts, error } = await supabase
    .from("exec_payouts")
    .select("*")
    .in("id", ids);
  if (error) return new Response(error.message, { status: 400 });

  const userIds = [...new Set(payouts.map(p => p.exec_user_id).filter(Boolean))];
  let usersById = {};
  if (userIds.length) {
    const { data: users, error: uErr } = await supabase.rpc("user_public_batch", { uids: userIds });
    if (!uErr && users) usersById = Object.fromEntries(users.map(u => [u.id, u]));
  }

  const rows = payouts.map(p => ({ ...p, exec_user: usersById[p.exec_user_id] }));
  const csv = toCSV(rows);

  const fileName = `exec_payouts_${new Date().toISOString().replace(/[:.]/g,"-")}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
