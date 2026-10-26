import type { Metadata } from "next";
import { createClient } from "../../lib/supabase/server";
import AuthButton from "../components/AuthButton";

export const metadata: Metadata = { title: "Not on the list · NYC Spots" };

export default async function NotAllowedPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return (
        <main className="login-wrap">
            <div className="panel login-card">
                <div className="lock">🚪</div>
                <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>You&apos;re not on the list (yet)</h1>
                <p className="muted" style={{ margin: "0 0 8px" }}>
                    <strong>{user?.email}</strong> isn&apos;t approved for NYC Spots.
                </p>
                <p className="soft" style={{ margin: "0 0 24px", fontSize: 14 }}>
                    NYC Spots is open to Columbia and Barnard accounts. Ask an admin to add your email.
                </p>
                <AuthButton />
            </div>
        </main>
    );
}