// /app/api/users/lookup/route.js
// Batch-lookup names/emails for user IDs using the SQL RPC above.
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

function parseIds(q) {
  if (!q) return [];
  return q
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s))
    .slice(0, 200);
}

export async function GET(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ids = parseIds(searchParams.get("ids"));
  if (!ids.length) return NextResponse.json({ items: [] });

  const { data, error } = await supabase.rpc("user_public_batch", { uids: ids });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data || [] });
}
 