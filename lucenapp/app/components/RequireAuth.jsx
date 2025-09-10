// app/components/RequireAuth.jsx
import { redirect } from 'next/navigation';
import { getUser } from '../lib/supabaseServerClient';

export default async function RequireAuth({ children }) {
  const { user } = await getUser();
  if (!user) redirect('/auth/sign-in?next=/dashboard');
  return <>{children}</>;
}
