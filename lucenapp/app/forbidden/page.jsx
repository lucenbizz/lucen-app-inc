export default function ForbiddenPage() {
  return (
    <main className="container-safe p-8">
      <div className="card p-6">
        <h1 className="text-2xl font-bold gold-text">Access denied</h1>
        <p className="text-sm text-[#bdbdbd] mt-2">
          This section is only for staff and admins.
        </p>
        <a href="/dashboard" className="btn mt-4">Go to Dashboard</a>
      </div>
    </main>
  );
}
