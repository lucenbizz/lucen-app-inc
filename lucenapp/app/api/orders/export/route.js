import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
export const runtime = 'nodejs';

function toHHMM(mins){ if(mins==null||Number.isNaN(mins)) return ""; const
h=String(Math.floor(mins/60)).padStart(2,"0"); const
m=String(mins%60).padStart(2,"0"); return `${h}:${m}`; }
function csvEscape(v){ if(v==null) return ""; const s=String(v); if(/[",\n]/.test(s)){ return '"' + s.replace(/"/g,'""') + '"'; } return s; }
export async function GET(req){
const supabase = createRouteHandlerClient({ cookies });
const { data: { session } } = await supabase.auth.getSession();
if (!session) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { "Content-Type": "application/json" }});
// NEW: Executive/Admin guard
const { data: isExec, error: execErr } = await supabase.rpc('is_executive');
if (execErr) return new Response(JSON.stringify({ error: execErr.message ||
'Forbidden' }), { status: 403, headers: { "Content-Type": "application/json" }});
if (!isExec) return new Response(JSON.stringify({ error: 'Forbidden' }), {
status: 403, headers: { "Content-Type": "application/json" }});
const { searchParams } = new URL(req.url);
const date = searchParams.get("date");
const area = searchParams.get("area");
const slotStart = searchParams.get("slotStart");
const slotLen = searchParams.get("slotLen");
if (!date) return new Response(JSON.stringify({ error: "Missing ?date" }), {
status: 400, headers: { "Content-Type": "application/json" }});
let query = supabase
.from("orders")
.select(`
 id, status,
 customer_name, address,
 service_area_tag,
 delivery_slot_start, delivery_slot_end, delivery_slot_minutes,
 assigned_to_user_id, assigned_to_label, assigned_at,
 payout_tier, payout_cents,
 reschedule_count, last_rescheduled_at,
 fulfilled_at,
 canceled_at, canceled_by_label, cancellation_reason
 `)
.eq("delivery_date", date);
if (slotStart != null && slotLen != null){
const ms = Number(slotStart); const me = ms + Number(slotLen);
query = query.gte("delivery_slot_minutes", ms).lt("delivery_slot_minutes",
me);
}
if (area && area !== "all" && area !== "*"){
query = query.eq("service_area_tag", area);
}
const { data, error } = await query
.order("delivery_slot_minutes", { ascending: true })
.order("id", { ascending: true });
if (error) return new Response(JSON.stringify({ error: error.message }), {
status: 500, headers: { "Content-Type": "application/json" }});
const headers = [
"id","status","customer_name","address","service_area_tag",
"delivery_slot_minutes","delivery_slot_hhmm","delivery_slot_start","delivery_slot_end",
"assigned_to_label","assigned_at","payout_tier","payout_cents",
"reschedule_count","last_rescheduled_at","fulfilled_at",
"canceled_at","canceled_by_label","cancellation_reason"
];
const lines = [];
lines.push(headers.join(","));
for (const o of (data||[])){
const row = [
o.id,
o.status,
o.customer_name,
o.address,
o.service_area_tag,
o.delivery_slot_minutes,
toHHMM(o.delivery_slot_minutes),
o.delivery_slot_start,
o.delivery_slot_end,
o.assigned_to_label,
o.assigned_at,
o.payout_tier,
o.payout_cents,
o.reschedule_count,
o.last_rescheduled_at,
o.fulfilled_at,
o.canceled_at,
o.canceled_by_label,
o.cancellation_reason,
].map(csvEscape);
lines.push(row.join(","));
}
const csv = lines.join("\n");
const filename = `lucen-orders-${date}${area && area!=='all' && area!=='*' ?
`-${area}`: ''}${slotStart!=null?`-${toHHMM(Number(slotStart))}`:''}.csv`;
return new Response(csv, {
status: 200,
headers: {
"Content-Type": "text/csv; charset=utf-8",
"Content-Disposition": `attachment; filename=\"${filename}\"`,
"Cache-Control": "no-store",
}
});
}
