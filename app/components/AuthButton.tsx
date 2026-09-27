"use client";

import { createClient } from "../../lib/supabase/client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

export default function AuthButton() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (user) {
    return (
        <button onClick={signOut} style={btn}>
          Sign out ({user.email})
        </button>
    );
  }

  return (
      <button onClick={signIn} style={btn}>
        Sign in with Google
      </button>
  );
}

const btn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 6,
  border: "1px solid #ccc",
  cursor: "pointer",
  background: "transparent",
  color: "inherit",
};