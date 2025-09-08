export const dynamic = 'force-dynamic'; // optional
import SignInClient from './SignInClient';
export default function Page() {
  return (
    <main className="container-safe p-6">
      <h1 className="text-2xl font-bold mb-4">Sign in</h1>
      <SignInClient />
    </main>
  );
}

