"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

export default function AuthCallback() {
  const [message, setMessage] = useState("Signing you in...");

  useEffect(() => {
    async function finish() {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const idToken = params.get("id_token");
      const state = params.get("state");
      const rawNonce = sessionStorage.getItem("oauth_nonce");
      const savedState = sessionStorage.getItem("oauth_state");

      if (!idToken || !rawNonce || state !== savedState) {
        setMessage("Sign-in failed: missing or invalid token. Please try again.");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
        nonce: rawNonce,
      });

      sessionStorage.removeItem("oauth_nonce");
      sessionStorage.removeItem("oauth_state");

      if (error) {
        setMessage(`Sign-in failed: ${error.message}`);
        return;
      }

      // Check whether this user has filled in their name yet.
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", userData.user!.id)
          .single();

      if (!profile?.first_name || !profile?.last_name) {
        window.location.href = "/profile?setup=1";
      } else {
        window.location.href = "/";
      }

      window.location.href = "/";
    }

    finish();
  }, []);

  return <p style={{ padding: 24 }}>{message}</p>;
}