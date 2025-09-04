import { cleanEnv, str, url } from 'envalid';

export const env = cleanEnv(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: str(),
  // Server-only (don't reference in client files):
  SUPABASE_SERVICE_ROLE_KEY: str({ default: '', devDefault: '' }),
});
