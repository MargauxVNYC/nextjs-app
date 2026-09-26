"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function ProfilePage() {
    const supabase = createClient();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [status, setStatus] = useState("");

    useEffect(() => {
        async function load() {
            const { data } = await supabase.auth.getUser();
            setUser(data.user);

            if (data.user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("first_name, last_name, avatar_url")
                    .eq("id", data.user.id)
                    .single();
                setFirstName(profile?.first_name ?? "");
                setLastName(profile?.last_name ?? "");
                setAvatarUrl(profile?.avatar_url ?? null);
            }
            setLoading(false);
        }
        load();
    }, []);

    async function save() {
        if (!user) return;
        setStatus("Saving...");
        const { error } = await supabase
            .from("profiles")
            .update({
                first_name: firstName.trim() || null,
                last_name: lastName.trim() || null,
            })
            .eq("id", user.id);
        setStatus(error ? `Error: ${error.message}` : "Saved!");
    }

    async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setStatus("Uploading photo...");

        // Store the file in Storage (not the database), in the user's own folder.
        const ext = file.name.split(".").pop();
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(path, file);

        if (uploadError) {
            setStatus(`Upload error: ${uploadError.message}`);
            return;
        }

        // Save only the public URL in the profiles table.
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);

        const { error: updateError } = await supabase
            .from("profiles")
            .update({ avatar_url: data.publicUrl })
            .eq("id", user.id);

        if (updateError) {
            setStatus(`Error saving photo: ${updateError.message}`);
            return;
        }

        setAvatarUrl(data.publicUrl);
        setStatus("Photo updated!");
    }

    if (loading) return <p style={{ padding: 24 }}>Loading...</p>;

    if (!user) {
        return (
            <p style={{ padding: 24 }}>
                Please sign in with Google to view your profile.
            </p>
        );
    }

    const needsName = !firstName.trim() || !lastName.trim();

    return (
        <main style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
            <h1 style={{ fontSize: 28, marginBottom: 16 }}>Your Profile</h1>

            {needsName && (
                <div
                    style={{
                        border: "1px solid #e0a800",
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 16,
                    }}
                >
                    Welcome! Please add your first and last name to finish setting up
                    your profile.
                </div>
            )}

            <div style={{ marginBottom: 20 }}>
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt="Your profile photo"
                        style={{
                            width: 120,
                            height: 120,
                            borderRadius: "50%",
                            objectFit: "cover",
                            display: "block",
                            marginBottom: 8,
                        }}
                    />
                ) : (
                    <div
                        style={{
                            width: 120,
                            height: 120,
                            borderRadius: "50%",
                            border: "1px dashed #888",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#888",
                            marginBottom: 8,
                        }}
                    >
                        No photo
                    </div>
                )}
                <label style={{ cursor: "pointer" }}>
                    Upload a photo:{" "}
                    <input type="file" accept="image/*" onChange={uploadPhoto} />
                </label>
            </div>

            <p style={{ color: "#888", marginBottom: 16 }}>{user.email}</p>

            <label style={label}>
                First name
                <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    style={input}
                />
            </label>

            <label style={label}>
                Last name
                <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    style={input}
                />
            </label>

            <button onClick={save} style={button}>
                Save
            </button>
            {status && <p style={{ marginTop: 12 }}>{status}</p>}
        </main>
    );
}

const label: React.CSSProperties = {
    display: "block",
    marginBottom: 12,
};

const input: React.CSSProperties = {
    display: "block",
    width: "100%",
    marginTop: 4,
    padding: 8,
    borderRadius: 6,
    border: "1px solid #ccc",
    background: "transparent",
    color: "inherit",
};

const button: React.CSSProperties = {
    padding: "8px 16px",
    borderRadius: 6,
    border: "1px solid #ccc",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
};