// app/home/page.jsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Lucen — Self Improvement, Ebooks & Scheduling',
  description: 'Premium self-improvement ebooks, flexible scheduling, and referral rewards.',
};

export default function Landing() {
  return (
    <main className="container-safe py-10 space-y-4">
      <h1 className="text-3xl font-bold">Welcome to Lucen!</h1>
      <p className="text-muted max-w-prose">
        Premium self-improvement ebooks, flexible scheduling, and referral rewards.
      </p>

      <div className="flex flex-wrap gap-3">
        {/* Primary CTA goes to sign-up and then to dashboard */}
        <a className="btn btn-primary" href="/auth/sign-up?next=/dashboard">
          Get started free
        </a>
        {/* Secondary actions */}
        <a className="btn btn-outline" href="/auth/sign-in?next=/dashboard">
          Already have an account? Sign in
        </a>
      </div>
    </main>
  );
}
