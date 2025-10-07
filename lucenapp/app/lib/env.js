// lib/env.js
function must(k) {
  const v = process.env[k];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing env: ${k}`);
  }
  return String(v).trim();
}

export const SUPABASE_URL = must('NEXT_PUBLIC_SUPABASE_URL')
  .replace(/\/+$/, ''); // no trailing slash

export const SUPABASE_ANON_KEY = must('NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Basic sanity checks
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL)) {
  throw new Error(`NEXT_PUBLIC_SUPABASE_URL must look like https://<project-ref>.supabase.co`);
}
if (!SUPABASE_ANON_KEY.includes('.')) {
  // Supabase JWT keys (anon/service) are dot-separated
  console.warn('WARNING: NEXT_PUBLIC_SUPABASE_ANON_KEY does not look like a JWT – double-check the value.');
}
