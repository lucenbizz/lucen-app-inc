export default function LoadingDashboard() {
  return (
    <main className="container-safe py-6">
      <div className="animate-pulse space-y-3">
        <div className="h-6 w-48 bg-[#1a1a1a] rounded" />
        <div className="h-40 bg-[#111] rounded-xl border border-[#222]" />
      </div>
    </main>
  );
}
