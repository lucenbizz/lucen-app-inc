/* eslint-disable @typescript-eslint/no-unused-vars */
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { localDateWithMinutesToISO } from "../../../lib/timeSlots";
function haversineKm(lat1, lon1, lat2, lon2) {
const toRad = (d) => (d * Math.PI) / 180;
const R = 6371; // km
const dLat = toRad((lat2 || 0) - (lat1 || 0));
const dLon = toRad((lon2 || 0) - (lon1 || 0));
const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1||0))*Math.cos(toRad(lat2||
0))*Math.sin(dLon/2)**2;
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
return R * c;
}
export async function POST(req) {
const supabase = createRouteHandlerClient({ cookies });
const { data: { session } } = await supabase.auth.getSession();
if (!session) return NextResponse.json({ error: "Not authenticated" }, {
status: 401 });
// Require staff/admin
const { data: roles } = await supabase
.from("user_roles").select("role").eq("user_id",
session.user.id).in("role", ["staff","admin"]);
if (!roles || roles.length === 0) return NextResponse.json({ error:
"Forbidden" }, { status: 403 });
const { date, tz = "America/New_York", strategy = "area_round_robin",
annotateAreas = false } = await req.json().catch(() => ({}));
if (!date) return NextResponse.json({ error: "Missing date (YYYY-MM-DD)" }, {
status: 400 });
const dayStart = localDateWithMinutesToISO(date, 0, tz);
const dayEnd = localDateWithMinutesToISO(date, 24 * 60, tz);
// On-duty staff shifts
const { data: shifts, error: shiftErr } = await supabase
.from("staff_shifts")
.select("user_id, work_date, start_minutes, end_minutes, timezone")
.eq("work_date", date);
if (shiftErr) return NextResponse.json({ error: shiftErr.message }, { status:
500 });
const staffIds = [...new Set((shifts || []).map(s => s.user_id))];
if (staffIds.length === 0) return NextResponse.json({ assigned: 0, details:
[], warning: "No on-duty staff for this date" });
// Profiles for labels + area tags
const { data: profiles } = await supabase
.from("staff_profiles")
.select("user_id, display_name, area_tags, home_lat, home_lng")
.in("user_id", staffIds);
const profileById = Object.fromEntries((profiles || []).map(p => [p.user_id,
p]));
// Service areas (optional, for radius matching)
const { data: areas } = await supabase
.from("service_areas")
.select("tag, center_lat, center_lng, radius_km, active")
.eq("active", true);
const areaList = areas || [];
function resolveArea(order) {
if (order.service_area_tag) return order.service_area_tag;
if (order.address_lat != null && order.address_lng != null &&
areaList.length) {
let best = null;
for (const a of areaList) {
const d = haversineKm(order.address_lat, order.address_lng,
a.center_lat, a.center_lng);
if (d <= a.radius_km) { best = a; break; }
}
if (best) return best.tag;
}
return "*"; // unknown area
}
// Orders needing assignment
const { data: orders, error: ordErr } = await supabase
.from("orders")
.select("id, address, address_lat, address_lng, service_area_tag, delivery_slot_start, delivery_slot_minutes, assigned_to_user_id, status")
.gte("delivery_slot_start", dayStart)
.lt("delivery_slot_start", dayEnd)
.is("assigned_to_user_id", null)
.eq("status", "confirmed")
.order("delivery_slot_minutes", { ascending: true });
if (ordErr) return NextResponse.json({ error: ordErr.message }, { status:
500 });
// Existing same-slot assignments (guard uses this so we don't double-book)
const { data: busy, error: busyErr } = await supabase
.from("orders")
.select("assigned_to_user_id, delivery_slot_minutes")
.gte("delivery_slot_start", dayStart)
.lt("delivery_slot_start", dayEnd)
.not("assigned_to_user_id", "is", null);
if (busyErr) return NextResponse.json({ error: busyErr.message }, { status:
500 });
const busySet = new Set((busy || []).map(b => `${b.delivery_slot_minutes}|$
{b.assigned_to_user_id}`));
// Bucket orders by slot+area
const buckets = new Map(); // key: `${m}|${area}` -> orders[]
for (const o of orders || []) {
const area = resolveArea(o);
const key = `${o.delivery_slot_minutes || 0}|${area}`;
if (!buckets.has(key)) buckets.set(key, []);
buckets.get(key).push(o);
}
const details = [];
let assignedCount = 0;
for (const [key, list] of buckets) {
const [minsStr, area] = key.split("|");
const slotMins = Number(minsStr);
// Staff on-duty for this slot
const onDuty = shifts.filter(s => slotMins >= s.start_minutes && slotMins <
s.end_minutes).map(s => s.user_id);
// Filter out staff already busy at this slot (guard)
const freeStaff = onDuty.filter(uid => !busySet.has(`${slotMins}|${uid}`));
// Prefer matching area tag
const preferred = freeStaff.filter(uid => (profileById[uid]?.area_tags ||
[]).includes(area));
const pool = (preferred.length ? preferred : freeStaff).map(uid => ({ uid,
label: profileById[uid]?.display_name || "Staff" }));
if (pool.length === 0) {
details.push({ slot: slotMins, area, assigned: 0, unassigned:
list.length, reason: "no free staff for this slot" });
continue;
}
// Assign at most one per staff in this slot
const maxAssignable = Math.min(list.length, pool.length);
for (let i = 0; i < maxAssignable; i++) {
const o = list[i];
const pick = pool[i % pool.length];
const { error: upErr } = await supabase
.from("orders")
.update({ assigned_to_user_id: pick.uid, assigned_to_label: pick.label,
assigned_at: new Date().toISOString() })
.eq("id", o.id)
.is("assigned_to_user_id", null);
if (!upErr) {
assignedCount++;
busySet.add(`${slotMins}|${pick.uid}`); // guard for subsequent buckets of same slot
}
}
const unassigned = list.length - maxAssignable;
details.push({ slot: slotMins, area, assigned: maxAssignable, unassigned });
// Optionally stamp area tag back on orders where we inferred it
if (annotateAreas) {
const toAnnotate = list
.slice(0, maxAssignable)
.filter(o => !o.service_area_tag)
.map(o => ({ id: o.id, area }));
for (const a of toAnnotate) {
await supabase.from("orders").update({ service_area_tag:
area }).eq("id", a.id);
}
}
}
return NextResponse.json({ ok: true, date, assigned: assignedCount, buckets:
details });
} 