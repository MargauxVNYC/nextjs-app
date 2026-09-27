import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
        return NextResponse.redirect(`${origin}/`);
    }

    const supabase = await createClient();

    // Back channel: trade the one-time code for a session.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
        return NextResponse.redirect(`${origin}/`);
    }

    // If the user hasn't filled in their name yet, send them to Profile.
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (user) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", user.id)
            .single();

        if (!profile?.first_name || !profile?.last_name) {
            return NextResponse.redirect(`${origin}/profile`);
        }
    }

    return NextResponse.redirect(`${origin}/`);
}