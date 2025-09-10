// app/error.jsx
'use client';

import React from 'react';

export default function GlobalError({ error, reset }) {
  // Helpful logging for server & client
  if (typeof window !== 'undefined') {
    // client
    // eslint-disable-next-line no-console
    console.error('GlobalError (client):', error);
  } else {
    // eslint-disable-next-line no-console
    console.error('GlobalError (server):', error);
  }

  const hardReload = () => {
    try {
      // force a full reload (bypasses React state)
      window.location.reload();
    } catch {
      // no-op
    }
  };

  const goHome = () => {
    try {
      window.location.assign('/');
    } catch {
      // no-op
    }
  };

  return (
    <main className="min-h-[60vh] grid place-items-center p-6 text-center">
      <div className="card p-6 max-w-xl">
        <h2 className="text-xl font-semibold">Something went wrong</h2>

        {/* Show details only in dev to avoid leaking info in prod */}
        {process.env.NODE_ENV !== 'production' && (
          <pre className="text-xs text-left bg-black/40 p-3 rounded mt-3 overflow-auto">
            {String(error?.message || error)}
            {error?.stack ? '\n\n' + error.stack : ''}
          </pre>
        )}

        <div className="mt-4 flex gap-2 justify-center">
          <button className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <button className="btn" onClick={hardReload}>
            Hard reload
          </button>
          <button className="btn btn-outline" onClick={goHome}>
            Go home
          </button>
        </div>
      </div>
    </main>
  );
}
