export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
const TIER_RATES = { bronze: 700, silver: 1200, gold: 2000, black: 5000 };
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
const { tier, cents } = await req.json().catch(() => ({}));
const key = String(tier || '').toLowerCase();
if (!TIER_RATES[key]) return NextResponse.json({ error: 'Invalid tier' }, {
status: 400 });
const baseline = TIER_RATES[key];
const payload = { payout_tier: key, payout_cents: typeof cents === 'number' ?
cents : baseline };
const { error } = await supabase
.from('orders')
.update(payload)
.eq('id', params.id);
if (error) return NextResponse.json({ error: error.message }, { status:
400 });
return NextResponse.json({ ok: true });
} 