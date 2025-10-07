export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function dayStartISO(d, tz = 'America/New_York') {

const [y,m,da] = d.split('-').map(Number);
const dt = new Date(Date.UTC(y, m-1, da, 0, 0, 0));
return dt.toISOString();
}
function dayEndISO(d) {
const [y,m,da] = d.split('-').map(Number);
const dt = new Date(Date.UTC(y, m-1, da, 23, 59, 59, 999));
return dt.toISOString();
}
export async function GET(req) {
const supabase = createRouteHandlerClient({ cookies });
const { data: { session } } = await supabase.auth.getSession();
if (!session) return NextResponse.json({ error: 'Not authenticated' }, {
status: 401 });
// Exec/Admin guard
const { data: isExec } = await supabase.rpc('is_executive').catch(() => ({
data: false }));
const { data: isAdmin } = await supabase.rpc('is_admin').catch(() => ({ data:
false }));
if (!(isExec || isAdmin)) return NextResponse.json({ error: 'Forbidden' }, {
status: 403 });
const { searchParams } = new URL(req.url);
const dateFrom = searchParams.get('from'); // YYYY-MM-DD
const dateTo = searchParams.get('to'); // YYYY-MM-DD
const action = searchParams.get('action'); // substring match
const entity = searchParams.get('entity');
const entityId = searchParams.get('entityId');
const actor = searchParams.get('actor'); // substring match on actor_label
const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) ||
50));
const offset = Math.max(0, Number(searchParams.get('offset')) || 0);
let q = supabase
.from('audit_log')
.select('*', { count: 'exact' })
.order('at', { ascending: false })
.range(offset, offset + limit - 1);
if (dateFrom && !dateTo) {
q = q.gte('at', dayStartISO(dateFrom));
}
if (dateTo && !dateFrom) {
q = q.lte('at', dayEndISO(dateTo));
}
if (dateFrom && dateTo) {
q = q.gte('at', dayStartISO(dateFrom)).lte('at', dayEndISO(dateTo));
}
if (action) q = q.ilike('action', `%${action}%`);
if (entity) q = q.eq('entity', entity);
if (entityId) q = q.eq('entity_id', String(entityId));
if (actor) q = q.ilike('actor_label', `%${actor}%`);
const { data, error, count } = await q;
if (error) return NextResponse.json({ error: error.message }, { status:
500 });
return NextResponse.json({ items: data || [], count: count || 0, nextOffset:
offset + (data?.length || 0) });
} 