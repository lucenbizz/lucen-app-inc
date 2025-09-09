// app/lib/roles.js
export function isAdmin(profile, user) {
  // Preferred: explicit role or staff flags from your "profiles" table
  if (profile?.role === 'admin' || profile?.is_admin || profile?.is_staff) return true;

  // Safety net: env allowlist (comma-separated emails)
  const allow = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const email = (user?.email || '').toLowerCase();
  return allow.includes(email);
}

export function isStaff(profile) {
  return !!(profile?.is_staff || profile?.role === 'staff' || profile?.role === 'admin');
}
