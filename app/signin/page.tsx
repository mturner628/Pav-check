# ================================
# File: app/signin/page.tsx
# ================================
"use client";
import { createSupabaseBrowser } from "@/src/lib/supabaseClient";
import { useEffect, useState } from "react";

export default function SignInPage() {
  const supabase = createSupabaseBrowser();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [err, setErr] = useState<string | null>(null);

  async function onEmailPassword() {
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(error.message);
    else window.location.href = "/dashboard";
  }

  async function onSignUp() {
    setErr(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setErr(error.message);
    else window.location.href = "/dashboard";
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) window.location.href = "/dashboard";
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
      <div className="space-y-2">
        <input className="w-full rounded border px-3 py-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full rounded border px-3 py-2" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button className="rounded bg-black text-white px-3 py-2 text-sm" onClick={onEmailPassword}>Sign in</button>
          <button className="rounded bg-gray-200 px-3 py-2 text-sm" onClick={onSignUp}>Sign up</button>
        </div>
        <p className="text-xs text-gray-500">First user becomes <b>admin</b>.</p>
      </div>
    </div>
  );
}
