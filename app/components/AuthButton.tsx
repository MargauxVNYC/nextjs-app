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
    // Raw nonce goes to Supabase; its SHA-256 hash goes to Google.
    const rawNonce = crypto.randomUUID();
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(rawNonce)
    );
    const hashedNonce = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const state = crypto.randomUUID();

    sessionStorage.setItem("oauth_nonce", rawNonce);
    sessionStorage.setItem("oauth_state", state);

    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      redirect_uri: `${window.location.origin}/auth/callback`,
      response_type: "id_token",
      scope: "openid email profile",
      nonce: hashedNonce,
      state,
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
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
