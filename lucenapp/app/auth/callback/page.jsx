// app/auth/callback/page.jsx
import { redirect } from 'next/navigation';
import { getUser } from '../../lib/supabaseServerClient';
import { isAdmin } from '../../lib/roles';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }) {
  const { user, profile } = await getUser();
  if (!user) redirect('/auth/sign-in');

  // Respect ?next=... if it’s safe and inside your site
  const nextParam = typeof searchParams?.next === 'string' ? searchParams.next : '';
  const isInsideSite = nextParam.startsWith('/') && !nextParam.startsWith('//');

  const defaultDest = isAdmin(profile, user) ? '/Admin' : '/dashboard';
  redirect(isInsideSite ? nextParam : defaultDest);
}
