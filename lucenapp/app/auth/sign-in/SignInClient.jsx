"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "../../lib/supabaseClient";

export default function SignInClient({ next = "/dashboard" }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const fn = mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
      const { error } = await fn;
      if (error) throw error;
      router.replace(next);
      router.refresh();
    } catch (ex) {
      setErr(ex.message || "Auth error");
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-[70vh] grid place-items-center p-6">
      <div className="card gold-border max-w-sm w-full p-6 space-y-6">
        <h1 className="text-2xl font-bold gold-text">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <input className="input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email" required />
          <input className="input" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" required />
          {err && <div className="text-red-400 text-sm">{err}</div>}
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Working…" : (mode === "signin" ? "Sign in" : "Sign up")}
          </button>
        </form>
        <p className="text-sm text-[#bdbdbd]">
          {mode === "signin" ? (
            <>No account? <button className="underline" onClick={() => setMode("signup")}>Sign up</button></>
          ) : (
            <>Already have an account? <button className="underline" onClick={() => setMode("signin")}>Sign in</button></>
          )}
        </p>
      </div>
    </main>
  );
}
