"use client";
import { useEffect, useState } from "react";
export function useRoles() {
const [roles, setRoles] = useState({ isAdmin: false, isExecutive: false,
isStaff: false });
const [ready, setReady] = useState(false);
useEffect(() => {
let alive = true;
(async () => {
try {
const res = await fetch('/api/auth/roles');
if (!res.ok) throw new Error('roles fetch failed');
const json = await res.json();
if (alive) setRoles({
isAdmin: !!json.isAdmin,
isExecutive: !!json.isExecutive,
isStaff: !!json.isStaff,
});
} finally { if (alive) setReady(true); }
})();
return () => { alive = false; };
}, []);
return { ...roles, ready };
} 