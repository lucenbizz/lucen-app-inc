import { redirect } from 'next/navigation';
import { getUserAndProfile } from '../lib/supabaseServerClient';

export const viewport = { themeColor: '#0a0a0a' };

export default async function AdminPage() {
  const { user, profile } = await getUserAndProfile();
  if (!user) redirect('/auth/sign-in?next=/admin');
  if (!profile || profile.role !== 'admin') redirect('/dashboard');

  return (
    <main className="container-safe p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="text-sm text-gray-300">Signed in as: {user.email}</p>
      <p className="text-sm text-gray-400">Role: {profile.role}</p>
    </main>
  );
}
