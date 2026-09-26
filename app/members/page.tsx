import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Gate: logged-out visitors are sent home before anything renders.
    if (!user) {
        redirect("/");
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("id", user.id)
        .single();

    const name = profile?.first_name
        ? `${profile.first_name} ${profile.last_name ?? ""}`.trim()
        : user.email;

    return (
        <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                {profile?.avatar_url && (
                    <img
                        src={profile.avatar_url}
                        alt={name ?? "Profile photo"}
                        style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }}
                    />
                )}
                <div>
                    <h1 style={{ fontSize: 28, margin: 0 }}>Members Lounge</h1>
                    <p style={{ margin: "4px 0 0", color: "#888" }}>Welcome back, {name}!</p>
                </div>
            </div>

            <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
                <h2 style={{ fontSize: 18, marginTop: 0 }}>Members-only picks</h2>
                <p style={{ margin: 0 }}>
                    You can see this page because you are signed in. Visitors who are not
                    logged in are redirected to the home page.
                </p>
            </div>
        </main>
    );
}