export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { localDateWithMinutesToISO } from "../../../../lib/timeSlots";
const CUTOFF_MINUTES = 120; // must be >= 2h before current slot
const MAX_RESCHEDULES = 2;
export async function PATCH(req, { params }) {
const supabase = createRouteHandlerClient({ cookies });
const { data: { session } } = await supabase.auth.getSession();
if (!session) return NextResponse.json({ error: "Not signed in" }, { status:
401 });
const id = params?.id;
if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
const { date, minutes, tz = "America/New_York" } = await req.json() || {};
if (!date || typeof minutes !== "number") {
return NextResponse.json({ error: "Provide { date: YYYY-MM-DD, minutes:number }" }, { status: 400 });
}
const { data: order, error: selErr } = await supabase
.from("orders")
.select("id, status, delivery_slot_start, reschedule_count")
.eq("id", id)
.single();
if (selErr) return NextResponse.json({ error: selErr.message }, { status:
404 });
if (["fulfilled","canceled","en_route"].includes(order.status)) {
return NextResponse.json({ error: `Cannot reschedule when status is $
{order.status}` }, { status: 400 });
}
const now = new Date();
const oldStart = order.delivery_slot_start ? new
Date(order.delivery_slot_start) : null;
if (oldStart && (oldStart.getTime() - now.getTime())/60000 < CUTOFF_MINUTES) {
return NextResponse.json({ error: `Reschedule cutoff is ${CUTOFF_MINUTES}
minutes before your slot.` }, { status: 400 });
}
if ((order.reschedule_count || 0) >= MAX_RESCHEDULES) {
return NextResponse.json({ error: `Max ${MAX_RESCHEDULES} reschedules
reached.` }, { status: 400 });
}
const startIso = localDateWithMinutesToISO(date, minutes, tz);
const endIso = localDateWithMinutesToISO(date, minutes + 20, tz);
const { error: updErr } = await supabase
.from("orders")
.update({
delivery_slot_start: startIso,
delivery_slot_end: endIso,
delivery_slot_minutes: minutes,
reschedule_count: (order.reschedule_count || 0) + 1,
last_rescheduled_at: new Date().toISOString(),
reminder_sent: false
})
.eq("id", id);
if (updErr) return NextResponse.json({ error: updErr.message }, { status:
400 });
return NextResponse.json({ ok: true, startIso, endIso });
} 