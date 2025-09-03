import { getUser } from "../../lib/supabaseServerClient";
import SignInClient from "./SignInClient";

export default async function Page({ searchParams }) {
  const { user } = await getUser();
  const next = typeof searchParams?.next === "string" ? searchParams.next : "/dashboard";
  if (user) {
    // Already signed in → go where they intended (or dashboard)
    // Using Next's redirect on server:
    const { redirect } = await import("next/navigation");
    redirect(next);
  }
  return <SignInClient next={next} />;
}
