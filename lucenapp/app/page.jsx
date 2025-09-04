import { getUser } from "./lib/supabaseServerClient";
import { redirect } from "next/navigation";

export default async function Home() {
  const { user } = await getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="container-safe py-10 space-y-4">
      <h1 className="text-3xl font-bold">Welcome to Lucen!</h1>
      <p className="text-muted max-w-prose">
        Premium self-improvement ebooks, flexible scheduling, and referral rewards.
      </p>
      <div className="flex gap-3">
        <a className="btn btn-primary" href="/auth/sign-in">Get started</a>
        <a className="btn btn-outline" href="/dashboard">View dashboard</a>
      </div>
    </main>
  );
}
