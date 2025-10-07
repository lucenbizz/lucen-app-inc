// /app/api/admin/orders/bulk-reschedule/route.js
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [{ data: isExec }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("is_executive").catch(() => ({ data: false })),
    supabase.rpc("is_admin").catch(() => ({ data: false })),
  ]);
  if (!(isExec || isAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { ids, slotIso, areaTag } = await req.json().catch(() => ({}));
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: "ids required" }, { status: 400 });
  if (!slotIso) return NextResponse.json({ error: "slotIso required" }, { status: 400 });

  // Use the existing admin slot RPC per row (keeps logic in SQL). Batch in chunks.
  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const calls = slice.map(id =>
      supabase.rpc("orders_admin_update_slot", { p_order_id: id, p_slot: slotIso, p_area_tag: areaTag || null })
    );
    const results = await Promise.all(calls);
    const err = results.find(r => r.error);
    if (err?.error) return NextResponse.json({ error: err.error.message }, { status: 400 });
  }

  try {
    await supabase.from("audit_log").insert({
      actor_id: session.user.id,
      action: "orders.bulk_reschedule",
      meta: { count: ids.length, slotIso, areaTag: areaTag || null },
    });
  } catch {}

  return NextResponse.json({ ok: true, count: ids.length });
}
 