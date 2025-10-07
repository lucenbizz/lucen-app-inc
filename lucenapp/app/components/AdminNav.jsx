"use client";
import Link from "next/link";
import { useRoles } from "@/hooks/useRoles";
export default function AdminNav() {
const { isAdmin, isExecutive, isStaff, ready } = useRoles();
if (!ready) return null;
return (
<nav className="flex gap-2 flex-wrap mb-4">
<Link className="border rounded-xl px-3 py-2 hover:shadow" href="/admin/
orders">Orders</Link>
{(isExecutive || isAdmin) && (
<>
<Link className="border rounded-xl px-3 py-2 hover:shadow" href="/
admin/areas/coverage">Coverage</Link>
<Link className="border rounded-xl px-3 py-2 hover:shadow" href="/
admin/dispatch/simulator">Dispatch</Link>
<Link className="border rounded-xl px-3 py-2 hover:shadow" href="/
admin/areas">Areas</Link>
</>
)}
{isAdmin && (
<>
<Link className="border rounded-xl px-3 py-2 hover:shadow" href="/
admin/areas/new">New Area</Link>
<Link className="border rounded-xl px-3 py-2 hover:shadow" href="/
admin/settings">Settings</Link>
</>
)}
</nav>
);
} 
