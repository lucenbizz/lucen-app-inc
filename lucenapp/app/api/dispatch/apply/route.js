export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
export async function POST(req){
const supabase = createRouteHandlerClient({ cookies });
const { data: { session } } = await supabase.auth.getSession();
if (!session) return NextResponse.json({ error: "Not authenticated" }, {
status: 401 });
// NEW: Executive/Admin guard
const { data: isExec, error: execErr } = await supabase.rpc('is_executive');
if (execErr) return NextResponse.json({ error: execErr.message ||
'Forbidden' }, { status: 403 });
if (!isExec) return NextResponse.json({ error: 'Forbidden' }, { status:
403 });
const body = await req.json().catch(()=>({}));
const { plan } = body;
if (!Array.isArray(plan) || plan.length === 0) return NextResponse.json({
error: "Missing plan[]" }, { status: 400 });
let applied = 0;
for (const p of plan){
if (!p?.order_id || !p?.assigned_to_user_id) continue;
const { error } = await supabase
.from("orders")
.update({ assigned_to_user_id: p.assigned_to_user_id, assigned_to_label:
p.assigned_to_label || null, assigned_at: new Date().toISOString() })
.eq("id", p.order_id)
.is("assigned_to_user_id", null)
.eq("status", "confirmed");
if (!error) applied++;
}
return NextResponse.json({ ok:true, applied });
} 