// app/components/ClientBoundary.jsx
'use client';

import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';

// Minimal fallback UI for a sub-section failure
function SectionFallback({ error, resetErrorBoundary, label = 'Section' }) {
  return (
    <div className="card p-4">
      <div className="text-red-400 font-semibold mb-2">
        {label} failed to load.
      </div>
      {process.env.NODE_ENV !== 'production' && (
        <pre className="text-xs bg-black/40 p-2 rounded overflow-auto">
          {String(error?.message || error)}
        </pre>
      )}
      <button className="btn btn-sm mt-2" onClick={resetErrorBoundary}>
        Retry
      </button>
    </div>
  );
}

export default function ClientBoundary({ children, label }) {
  return (
    <ErrorBoundary
      FallbackComponent={(props) => <SectionFallback {...props} label={label} />}
      onError={(err) => {
        // eslint-disable-next-line no-console
        console.error(`ClientBoundary (${label}) error:`, err);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
