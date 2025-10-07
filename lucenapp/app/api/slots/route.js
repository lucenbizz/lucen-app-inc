export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateTwentyMinuteSlots, localDateWithMinutesToISO } from "../../lib/timeSlots";
const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE_KEY
);
export async function GET(req) {
const { searchParams } = new URL(req.url);
const date = searchParams.get("date"); // YYYY-MM-DD
const tz = searchParams.get("tz") || "America/New_York";
const capEnabled = searchParams.get("cap") === "1";
if (!date) return NextResponse.json({ error: "Missing ?date" }, { status:
400 });
const slots = generateTwentyMinuteSlots();
if (!capEnabled) {
const payload = slots.map((s) => ({
label: s.label,
minutes: s.minutes,
startIso: localDateWithMinutesToISO(date, s.minutes, tz),
endIso: localDateWithMinutesToISO(date, s.minutes + 20, tz),
available: true,
}));
return NextResponse.json({ date, tz, slots: payload });
}
const payload = slots.map((s) => ({
label: s.label,
minutes: s.minutes,
startIso: localDateWithMinutesToISO(date, s.minutes, tz),
endIso: localDateWithMinutesToISO(date, s.minutes + 20, tz),
available: true,
}));
return NextResponse.json({ date, tz, slots: payload });
}
export async function POST(req) {
// Reserve + attach to an order (optional orderId)
const body = await req.json();
const { date, minutes, orderId } = body || {};
if (typeof date !== "string" || typeof minutes !== "number") {
return NextResponse.json({ error: "Invalid body" }, { status: 400 });
}
const startIso = localDateWithMinutesToISO(date, minutes);
const endIso = localDateWithMinutesToISO(date, minutes + 20);
if (orderId) {
const { error } = await supabase
.from("orders")
.update({
delivery_slot_start: startIso,
delivery_slot_end: endIso,
delivery_slot_minutes: minutes,
})
.eq("id", orderId);
if (error) return NextResponse.json({ error: error.message }, { status:
400 });
}
return NextResponse.json({ ok: true, startIso, endIso });
} 