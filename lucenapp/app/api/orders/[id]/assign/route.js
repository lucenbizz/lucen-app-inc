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
const { action, userId } = await req.json().catch(() => ({}));
// role flags
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const [{ data: isAdmin }, { data: isExec }, { data: isStaff }] = await
Promise.all([
supabase.rpc('is_admin').catch(()=>({ data:false })),
supabase.rpc('is_executive').catch(()=>({ data:false })),
supabase.rpc('is_staff').catch(()=>({ data:false })),
]);
const id = params.id;
const { data: order, error: oErr } = await
supabase.from('orders').select('id, status, assigned_to_user_id').eq('id',
id).single();
if (oErr || !order) return NextResponse.json({ error: oErr?.message || 'Not found' }, { status: 404 });
if (!['pending','confirmed','en_route'].includes(order.status)) {
return NextResponse.json({ error: 'Order not assignable in current status' }, { status: 400 });
}
let targetUser = null;
if (action === 'claim') targetUser = me;
else if (action === 'unassign') targetUser = null;
else if (action === 'assign') targetUser = userId || null;
else return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
// staff can only self-assign/unassign self; exec/admin can assign anyone
if (!(isAdmin || isExec)) {
if (targetUser !== null && targetUser !== me) {
return NextResponse.json({ error: 'Only executive/admin can assign others' }, { status: 403 });
}
if (action === 'unassign' && order.assigned_to_user_id &&
order.assigned_to_user_id !== me) {
return NextResponse.json({ error: 'You can only unassign yourself' }, {
status: 403 });
}
}
const payload = {
assigned_to_user_id: targetUser,
assigned_to_label: null,
assigned_at: targetUser ? new Date().toISOString() : null,
};
const q = supabase.from('orders').update(payload).eq('id', id);
if (action === 'claim') q.is('assigned_to_user_id', null);
const { error } = await q;
if (error) return NextResponse.json({ error: error.message }, { status:
400 });
return NextResponse.json({ ok: true });
}
