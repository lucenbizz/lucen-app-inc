export default function NotFound() {
  return (
    <main className="container-safe py-16 text-center space-y-4">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="text-muted">The page you’re looking for doesn’t exist.</p>
      <a className="btn btn-outline" href="/">Go home</a>
    </main>
  );
}
