export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
export async function PATCH(req, { params }) {
const supabase = createRouteHandlerClient({ cookies });
const { data: { session } } = await supabase.auth.getSession();
if (!session) return NextResponse.json({ error: "Not authenticated" }, {
status: 401 });
const me = session.user.id;
const [{ data: isAdmin }, { data: isExec }] = await Promise.all([
supabase.rpc('is_admin').catch(()=>({ data:false })),
supabase.rpc('is_executive').catch(()=>({ data:false })),
]);
const id = params.id;
const { data: order, error: oErr } = await supabase
.from('orders')
.select('id, status, assigned_to_user_id')
.eq('id', id)
.single();
if (oErr || !order) return NextResponse.json({ error: oErr?.message || 'Not found' }, { status: 404 });
if (!(isAdmin || isExec) && order.assigned_to_user_id !== me) {
return NextResponse.json({ error: 'Only executive/admin or the assignee can fulfill' }, { status: 403 });
}
const { error } = await supabase
.from('orders')
.update({ status: 'fulfilled', fulfilled_at: new Date().toISOString() })
.eq('id', id);
if (error) return NextResponse.json({ error: error.message }, { status:
400 });
return NextResponse.json({ ok: true });
}  