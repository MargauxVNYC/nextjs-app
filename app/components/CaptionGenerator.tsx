"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { VIBES, type VibeKey } from "./vibes";

// Shrink the photo and convert it to JPEG before uploading.
async function toJpeg(file: File, max = 1600): Promise<Blob> {
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        throw new Error("Couldn't read that image. Try a JPG or PNG.");
    }
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) =>
        canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("Couldn't process that image."))),
            "image/jpeg",
            0.85
        )
    );
}

export default function CaptionGenerator({
                                             spots,
                                             initialSpotId,
                                             featuredSpotId,
                                             initialMode = "photo",
                                         }: {
    spots: { id: number; name: string }[];
    initialSpotId?: number;
    featuredSpotId?: number;
    initialMode?: "photo" | "spot";
}) {
    const router = useRouter();
    const supabase = createClient();
    const inputRef = useRef<HTMLInputElement>(null);

    const startId = spots.find((s) => s.id === initialSpotId)?.id ?? spots[0]?.id ?? 0;
    const [mode, setMode] = useState<"photo" | "spot">(initialMode);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [context, setContext] = useState("");
    const [spotId, setSpotId] = useState(startId);
    const [vibe, setVibe] = useState<VibeKey>("online");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");
    const [expanded, setExpanded] = useState(false); // mobile: composer open/closed

    function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        if (!f) return;
        setError("");
        setFile(f);
        setPreview(URL.createObjectURL(f));
    }

    async function generate() {
        setError("");
        setLoading(true);
        setExpanded(false);

        // Show the shimmering placeholder post in the feed.
        window.dispatchEvent(
            new CustomEvent("nycspots:pending", {
                detail: {
                    preview: mode === "photo" ? preview : null,
                    label: mode === "photo" ? "The AI is studying your photo…" : "Writing captions…",
                },
            })
        );

        try {
            let imagePath: string | undefined;

            if (mode === "photo") {
                if (!file) throw new Error("Choose a photo first.");
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                if (!user) throw new Error("Please sign in.");

                setStatus("Uploading your photo…");
                const jpeg = await toJpeg(file);
                imagePath = `${user.id}/${Date.now()}.jpg`; // your own folder: RLS checks this
                const { error: upErr } = await supabase.storage
                    .from("uploads")
                    .upload(imagePath, jpeg, { contentType: "image/jpeg" });
                if (upErr) throw new Error(upErr.message);
            }

            setStatus(mode === "photo" ? "The AI is studying your photo…" : "Writing captions…");
            const res = await fetch("/api/captions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    vibe,
                    context: context.trim() || undefined,
                    ...(mode === "photo" ? { imagePath } : { spotId }),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error ?? "Something went wrong.");

            // Reset the form, then swap the placeholder for the real post.
            setFile(null);
            setPreview(null);
            setContext("");
            if (inputRef.current) inputRef.current.value = "";
            window.dispatchEvent(new CustomEvent("nycspots:done", { detail: { batchId: data.batchId } }));
            router.refresh();
        } catch (e) {
            window.dispatchEvent(new CustomEvent("nycspots:done", { detail: {} }));
            setExpanded(true); // reopen on mobile so the error is visible
            setError(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
            setLoading(false);
            setStatus("");
        }
    }

    return (
        <div className="panel generator">
            <h2 className="panel-title desktop-only">✨ New post</h2>
            <button
                type="button"
                className="btn btn-accent btn-lg mobile-only"
                onClick={() => setExpanded((v) => !v)}
            >
                {expanded ? "✕ Close" : "＋ New post"}
            </button>

            <div className={`composer-body${expanded ? " open" : ""}`}>
                <div className="tabs" style={{ marginBottom: 14 }}>
                    <button
                        type="button"
                        className={`tab${mode === "photo" ? " active" : ""}`}
                        onClick={() => setMode("photo")}
                    >
                        📸 Your photo
                    </button>
                    <button
                        type="button"
                        className={`tab${mode === "spot" ? " active" : ""}`}
                        onClick={() => setMode("spot")}
                    >
                        📍 A spot
                    </button>
                </div>

                {mode === "photo" ? (
                    <>
                        <label className="dropzone">
                            {preview ? (
                                <img src={preview} alt="Your photo" />
                            ) : (
                                <span>
                  📸
                  <br />
                  Choose a photo from your week in NYC
                </span>
                            )}
                            <input
                                ref={inputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={pickFile}
                                hidden
                            />
                        </label>

                        <label className="field-label">What&apos;s the story? (optional)</label>
                        <textarea
                            className="select"
                            rows={2}
                            maxLength={200}
                            placeholder="e.g. my first real bagel, 40 min line"
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                        />
                    </>
                ) : (
                    <>
                        <label className="field-label">Spot</label>
                        <select
                            className="select"
                            value={spotId}
                            onChange={(e) => setSpotId(Number(e.target.value))}
                        >
                            {spots.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.id === featuredSpotId ? "🌟 " : ""}
                                    {s.name}
                                </option>
                            ))}
                        </select>
                        {spotId === featuredSpotId && (
                            <p className="soft" style={{ fontSize: 13, margin: "8px 0 0" }}>
                                🌟 Today&apos;s Spot of the Day
                            </p>
                        )}
                    </>
                )}

                <label className="field-label">Vibe</label>
                <div className="vibe-picker">
                    {(Object.keys(VIBES) as VibeKey[]).map((key) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setVibe(key)}
                            className={`vibe-chip${vibe === key ? " active" : ""}`}
                        >
                            {VIBES[key].emoji} {VIBES[key].label}
                        </button>
                    ))}
                </div>

                <button
                    className="btn btn-accent btn-lg"
                    onClick={generate}
                    disabled={loading || (mode === "photo" ? !file : !spotId)}
                >
                    {loading ? "Working…" : "Generate 3 captions"}
                </button>
                {status && <p className="status-text">{status}</p>}
                {error && <p className="error-text">{error}</p>}
            </div>
        </div>
    );
}