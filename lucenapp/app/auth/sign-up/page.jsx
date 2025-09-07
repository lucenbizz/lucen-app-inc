'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '../../lib/supabaseClient'; // adjust path if different

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const router = useRouter();

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus('Creating your account…');

    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) throw error;

      setStatus('Check your email to confirm your account.');
      // optionally route to a “check your email” page:
      // router.replace('/auth/check-email');
    } catch (err) {
      setStatus(err.message || 'Sign up failed');
    }
  };

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Create your account</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="you@example.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded border bg-[#111]"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded border bg-[#111]"
        />
        <button className="btn btn-primary w-full" type="submit">Sign up</button>
      </form>
      <p className="text-sm text-gray-400 mt-3">{status}</p>
    </main>
  );
}
