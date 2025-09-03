import Link from "next/link";
import Image from "next/image";
import SignOutButton from "./SignOutButton";
import { getUserAndProfile } from "../lib/supabaseServerClient.js";

export default async function Header() {
  const { user, profile } = await getUserAndProfile();
  const isAdmin = profile?.role === "admin";

  const NavLink = ({ href, children }) => (
    <Link
      href={href}
      className="relative px-2 py-1 text-sm text-[#e7e7e7]/90 hover:text-white transition-colors"
    >
      <span>{children}</span>
      <span className="absolute left-2 right-2 -bottom-[2px] h-[2px] bg-gradient-to-r from-[var(--gold-600)] to-[var(--gold-400)] scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 backdrop-blur border-b border-[var(--border)]/80 bg-[#0a0a0a]/65 gold-glow">
      <div className="container-safe flex items-center justify-between py-3">
        <Link href="/" className="flex items-center gap-2 group">
          <Image
            src="/icon-32.png" alt="Lucen" width={28} height={28}
            className="rounded"
          />
          <span className="font-semibold tracking-wide gold-text">Lucen</span>
        </Link>

        <nav className="flex items-center gap-2 group">
          <NavLink href="/">Home</NavLink>
          <Nav href="/plans">Plans</Nav>
          {user ? (
            <>
              <NavLink href="/dashboard">Dashboard</NavLink>
              {isAdmin && <NavLink href="/admin">Admin</NavLink>}
              {profile?.vip_badge && <span className="badge gold" title="VIP">VIP</span>}
              <SignOutButton />
            </>
          ) : (
            <Link href="/auth/sign-in" className="btn btn-primary">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
