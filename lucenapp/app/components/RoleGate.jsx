"use client";
import { useRoles } from "../hooks/useRoles";
const order = { staff: 1, executive: 2, admin: 3 };
export default function RoleGate({ minRole = "staff", children, fallback =
null }) {
const { isAdmin, isExecutive, isStaff, ready } = useRoles();
if (!ready) return null; // or a spinner if you prefer
const level = isAdmin ? 3 : isExecutive ? 2 : isStaff ? 1 : 0;
return level >= (order[minRole] || 0) ? children : (fallback || null);
} 