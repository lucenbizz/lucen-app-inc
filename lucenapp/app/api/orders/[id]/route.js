export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(req) {
const supabase = createRouteHandlerClient({ cookies });
const { data: { session } } = await supabase.auth.getSession();
if (!session) return NextResponse.json({ error: "Not authenticated" }, {
status: 401 });
const { searchParams } = new URL(req.url);
const date = searchParams.get("date");
const tz = searchParams.get("tz") || "America/New_York";
if (!date) return NextResponse.json({ error: "Missing ?date" }, { status:
400 });
const dayStart = localDateWithMinutesToISO(date, 0, tz);
const dayEnd = localDateWithMinutesToISO(date, 24 * 60, tz);
const { data, error } = await supabase
.from("orders")
.select(`
 id, customer_name, address, status, fulfilled_at,
 delivery_slot_start, delivery_slot_end, delivery_slot_minutes,
 reschedule_count, last_rescheduled_at,
 assigned_to_user_id, assigned_to_label, assigned_at,
 payout_tier, payout_cents,
 canceled_at, canceled_by_label, cancellation_reason
 `)
.gte("delivery_slot_start", dayStart)
.lt("delivery_slot_start", dayEnd)
.order("delivery_slot_start", { ascending: true });
if (error) return NextResponse.json({ error: error.message }, { status:
500 });
const orders = (data || []).map(o => ({
...o,
minutes: typeof o.delivery_slot_minutes === "number" ?
o.delivery_slot_minutes : null,
label: typeof o.delivery_slot_minutes === "number"
? `${String(Math.floor(o.delivery_slot_minutes/60)).padStart(2,"0")}:$
{String(o.delivery_slot_minutes%60).padStart(2,"0")}`
: null,
}));
return NextResponse.json({ date, tz, orders });
} 