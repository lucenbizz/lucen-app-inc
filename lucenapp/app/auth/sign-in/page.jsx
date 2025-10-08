import { redirect } from 'next/navigation';

export default function LegacySignInAlias() {
  redirect('/sign-in');
  return null;
}
