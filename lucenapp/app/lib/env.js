// lib/env.js
const required = ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'];
for (const k of required) {
  if (!process.env[k]) throw new Error(`Missing env: ${k}`);
}
export const Env = Object.freeze({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  origin: process.env.NEXT_PUBLIC_APP_ORIGIN || '',
});
