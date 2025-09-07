'use client';
import useOnline from '../lib/useOnline';
export default function ConnectionBar() {
  const online = useOnline();
  if (online) return null;
  return <div className="w-full bg-red-600 text-white text-center py-1">You are offline</div>;
}
