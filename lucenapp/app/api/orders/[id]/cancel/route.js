export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
export async function PATCH(req, { params }) {
const supabase = createRouteHandlerClient({ cookies });
const { data: { session } } = await supabase.auth.getSession();
if (!session) return NextResponse.json({ error: "Not authenticated" }, {
status: 401 });
const [{ data: isAdmin }, { data: isExec }] = await Promise.all([
supabase.rpc('is_admin').catch(()=>({ data:false })),
supabase.rpc('is_executive').catch(()=>({ data:false })),
]);
if (!(isAdmin || isExec)) return NextResponse.json({ error: 'Forbidden' }, {
status: 403 });
const { reason } = await req.json().catch(() => ({}));
if (!reason || !String(reason).trim()) return NextResponse.json({ error:
'Cancellation reason required' }, { status: 400 });
const id = params.id;
const { error } = await supabase
.from('orders')
.update({ status: 'canceled', canceled_at: new Date().toISOString(),
cancellation_reason: reason })
.eq('id', id);
if (error) return NextResponse.json({ error: error.message }, { status:
400 });
return NextResponse.json({ ok: true });
} 