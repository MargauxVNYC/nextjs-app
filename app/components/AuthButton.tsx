"use client";

import { createClient } from "../../lib/supabase/client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

export default function AuthButton() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoaded(true);
    });
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
    window.location.href = "/login";
  }

  if (!loaded) return null;

  if (user) {
    const meta = user.user_metadata ?? {};
    const name = meta.full_name ?? meta.name ?? user.email;
    const avatar = meta.avatar_url ?? meta.picture;

    return (
        <div className="user-chip">
          {avatar && <img src={avatar} alt="" referrerPolicy="no-referrer" />}
          <div className="user-text">
            <div className="user-name">{name}</div>
            <div className="user-status">Signed in with Google</div>
          </div>
          <button onClick={signOut} className="chip-btn">
            Sign out
          </button>
        </div>
    );
  }

  return (
      <button onClick={signIn} className="btn btn-accent btn-lg">
        Sign in with Google
      </button>
  );
}