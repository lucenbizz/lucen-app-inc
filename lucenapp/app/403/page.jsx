export default function ForbiddenPage() {
return (
<main className="max-w-xl mx-auto p-8 space-y-3">
<h1 className="text-2xl font-bold">Access denied</h1>
<p className="text-gray-600">You don’t have permission to view this
page.</p>
<a href="/" className="inline-block mt-2 border rounded-xl px-4 py-2
hover:shadow">Go home</a>
</main>
);
}