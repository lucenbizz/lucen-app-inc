export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { localDateWithMinutesToISO } from "../../../lib/timeSlots";
function toRad(d){return (d*Math.PI)/180} const R=6371;
function haversineKm(aLat,aLng,bLat,bLng){const dLat=toRad((bLat||0)-(aLat||
0));const dLng=toRad((bLng||0)-(aLng||0));const x=Math.sin(dLat/
2)**2+Math.cos(toRad(aLat||0))*Math.cos(toRad(bLat||0))*Math.sin(dLng/
2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
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
const { date, tz="America/New_York", slotMinutes=null, preferArea=true,
onePerSlot=true } = body;
if (!date) return NextResponse.json({ error: "Missing date" }, { status:
400 });
const dayStart = localDateWithMinutesToISO(date, 0, tz);
const dayEnd = localDateWithMinutesToISO(date, 24*60, tz);
const { data: shifts, error: shiftErr } = await supabase
.from("staff_shifts").select("user_id, start_minutes, end_minutes, work_date").eq("work_date", date);
if (shiftErr) return NextResponse.json({ error: shiftErr.message }, { status:
500 });
const onDutyIds = [...new Set((shifts||[]).map(s=>s.user_id))];
const { data: profiles } = await
supabase.from("staff_profiles").select("user_id, display_name,area_tags").in("user_id", onDutyIds.length?onDutyIds:
["00000000-0000-0000-0000-000000000000"]);
const profileById = Object.fromEntries((profiles||[]).map(p=>[p.user_id,p]));
const { data: areas } = await supabase.from("service_areas").select("tag, center_lat, center_lng, radius_km, active").eq("active", true);
let oQuery = supabase
.from("orders")
.select("id, service_area_tag, address_lat, address_lng, delivery_slot_minutes, delivery_slot_start, status, assigned_to_user_id")
.is("assigned_to_user_id", null)
.eq("status", "confirmed")
.gte("delivery_slot_start", dayStart)
.lt("delivery_slot_start", dayEnd)
.order("delivery_slot_minutes", { ascending: true });
if (slotMinutes != null) {
oQuery = oQuery.eq("delivery_slot_minutes", Number(slotMinutes));
}
const { data: orders, error: oErr } = await oQuery;
if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });
let busy = [];
const { data: busyRows } = await supabase
.from("orders")
.select("assigned_to_user_id, delivery_slot_minutes")
.not("assigned_to_user_id", "is", null)
.gte("delivery_slot_start", dayStart)
.lt("delivery_slot_start", dayEnd);
busy = busyRows || [];
const busySet = new Set(busy.map(b=>`${b.delivery_slot_minutes}|$
{b.assigned_to_user_id}`));
function resolveArea(o){
if (o.service_area_tag) return o.service_area_tag;
if (o.address_lat!=null && o.address_lng!=null && (areas||[]).length){
for (const a of areas){
const d = haversineKm(o.address_lat, o.address_lng, a.center_lat,
a.center_lng);
if (d <= Number(a.radius_km)) return a.tag;
}
}
return "*";
}
const buckets = new Map();
for (const o of orders||[]){
const tag = resolveArea(o);
const key = `${o.delivery_slot_minutes||0}|${tag}`;
if (!buckets.has(key)) buckets.set(key, []);
buckets.get(key).push(o);
}
const plan = [];
const perArea = {}; const perDriver = {}; const details = [];
for (const [key, list] of buckets){
const [minsStr, areaTag] = key.split("|");
const slot = Number(minsStr);
const onDuty = (shifts||[]).filter(s => slot >= s.start_minutes && slot <
s.end_minutes).map(s=>s.user_id);
let free = onDuty.filter(uid => !busySet.has(`${slot}|${uid}`));
let pool = free.map(uid => ({ uid, label: profileById[uid]?.display_name ||
"Staff", match: (profileById[uid]?.area_tags||[]).includes(areaTag) }));
if (preferArea) {
const exact = pool.filter(p=>p.match);
if (exact.length) pool = exact;
}
let assignedHere = 0;
if (pool.length === 0){
for (const o of list){ plan.push({ order_id:o.id, slot_minutes:slot,
area_tag:areaTag, assigned_to_user_id:null, reason:"no free staff" }); }
} else {
const maxPerSlot = onePerSlot ? Math.min(list.length, pool.length) :
list.length;
for (let i=0;i<maxPerSlot;i++){
const o = list[i];
const pick = pool[i % pool.length];
plan.push({ order_id:o.id, slot_minutes:slot, area_tag:areaTag,
assigned_to_user_id:pick.uid, assigned_to_label:pick.label });
busySet.add(`${slot}|${pick.uid}`);
assignedHere++;
perDriver[pick.uid] = (perDriver[pick.uid]||0)+1;
}
for (let i=maxPerSlot;i<list.length;i++){
const o = list[i];
plan.push({ order_id:o.id, slot_minutes:slot, area_tag:areaTag,
assigned_to_user_id:null, reason:"guard or capacity" });
}
}
const unassigned = list.length - assignedHere;
perArea[areaTag] = perArea[areaTag] || { assigned:0, unassigned:0 };
perArea[areaTag].assigned += assignedHere; perArea[areaTag].unassigned +=
unassigned;
details.push({ slot_minutes:slot, area_tag:areaTag, assigned:assignedHere,
unassigned });
}
const assigned = plan.filter(p=>p.assigned_to_user_id).length;
const unassigned = plan.length - assigned;
return NextResponse.json({ ok:true, date, slotMinutes, preferArea,
onePerSlot, assigned, unassigned, perArea, perDriver, details, plan });
}