'use client';

export default function Error({ error, reset }) {
  return (
    <main className="min-h-[60vh] grid place-items-center p-6 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-gray-400 mt-2">
      
      </p>
      <div className="mt-4 flex gap-2 justify-center">
        <button className="btn btn-primary" onClick={() => reset()}>Try again</button>
        <a className="btn btn-outline" href="/">Go home</a>
      </div>
    </main>
  );
}