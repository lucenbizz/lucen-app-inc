// app/components/ClientBoundary.jsx
'use client';

import React from 'react';

class InnerBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error(`ClientBoundary (${this.props.label}) error:`, error, info);
    }
  }

  reset() {
    this.setState({ hasError: false, error: null });
    if (typeof this.props.onReset === 'function') this.props.onReset();
  }

  render() {
    const { hasError, error } = this.state;
    const { children, label = 'Section' } = this.props;

    if (hasError) {
      return (
        <div className="card p-4">
          <div className="text-red-400 font-semibold mb-2">
            {label} failed to load.
          </div>
          {process.env.NODE_ENV !== 'production' && (
            <pre className="text-xs bg-black/40 p-2 rounded overflow-auto">
              {String(error?.message || error)}
              {error?.stack ? '\n\n' + error.stack : ''}
            </pre>
          )}
          <button className="btn btn-sm mt-2" onClick={this.reset}>
            Retry
          </button>
        </div>
      );
    }

    return children;
  }
}

export default function ClientBoundary({ children, label }) {
  return <InnerBoundary label={label}>{children}</InnerBoundary>;
}

