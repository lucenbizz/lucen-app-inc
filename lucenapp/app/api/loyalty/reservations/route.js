// /app/api/loyalty/reservations/route.js
export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Exec/Admin guard (RLS also protects, but we return 403 early for clarity)
  const [{ data: isExec }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("is_executive").catch(() => ({ data: false })),
    supabase.rpc("is_admin").catch(() => ({ data: false })),
  ]);
  if (!(isExec || isAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") || "any").toLowerCase(); // held|committed|canceled|expired|any
  const userId = searchParams.get("userId") || null;
  const activeOnly = (searchParams.get("activeOnly") || "").toLowerCase() === "true";
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  let q = supabase
    .from("loyalty_reservations")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== "any") q = q.eq("status", status);
  if (userId) q = q.eq("user_id", userId);
  if (activeOnly) {
    q = q.eq("status", "held").gt("expires_at", new Date().toISOString());
  }

  const { data, error, count } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    items: data || [],
    count: count || 0,
    nextOffset: offset + (data?.length || 0),
  });
}
