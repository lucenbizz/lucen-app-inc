export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
export async function GET(_req, { params }) {
const supabase = createRouteHandlerClient({ cookies });
const { data: { session } } = await supabase.auth.getSession();
if (!session) return NextResponse.json({ error: "Not authenticated" }, {
status: 401 });
const tag = params?.tag;
const { data, error } = await supabase
.from("service_areas")
.select("tag, name, center_lat, center_lng, radius_km, active")
.eq("tag", tag)
.single();
if (error) return NextResponse.json({ error: error.message }, { status:
404 });
return NextResponse.json({ area: data });
}
export async function PATCH(req, { params }) {
const supabase = createRouteHandlerClient({ cookies });
const { data: { session } } = await supabase.auth.getSession();
if (!session) return NextResponse.json({ error: "Not authenticated" }, {
status: 401 });
const tag = params?.tag;
const body = await req.json().catch(() => ({}));
const patch = {};
for (const k of ["name","center_lat","center_lng","radius_km","active"]) if
(k in body) patch[k] = body[k];
const { error } = await
supabase.from("service_areas").update(patch).eq("tag", tag);
if (error) return NextResponse.json({ error: error.message }, { status:
400 });
return NextResponse.json({ ok: true });
}
export async function DELETE(_req, { params }) {
const supabase = createRouteHandlerClient({ cookies });
const { data: { session } } = await supabase.auth.getSession();
if (!session) return NextResponse.json({ error: "Not authenticated" }, {
status: 401 });
const tag = params?.tag;
const { error } = await supabase.from("service_areas").delete().eq("tag",
tag);
if (error) return NextResponse.json({ error: error.message }, { status:
400 });
return NextResponse.json({ ok: true });
} 