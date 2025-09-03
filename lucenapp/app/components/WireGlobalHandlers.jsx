'use client';
import { useEffect } from 'react';
export default function WireGlobalHandlers() {
  useEffect(() => {
    const noop = () => {};
    window.addEventListener('req:start', noop);
    window.addEventListener('req:end', noop);
    return () => {
      window.removeEventListener('req:start', noop);
      window.removeEventListener('req:end', noop);
    };
  }, []);
  return null;
}
