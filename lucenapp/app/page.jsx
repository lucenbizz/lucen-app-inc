// app/page.jsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getUser } from "./lib/supabaseServerClient";
import { redirect } from "next/navigation";

export default async function Home() {
  const { user } = await getUser();
  if (user) redirect("/dashboard");
  redirect("/auth/sign-up?next=/dashboard");
}
