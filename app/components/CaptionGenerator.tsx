"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VIBES, type VibeKey } from "./vibes";

export default function CaptionGenerator({
                                             spots,
                                             initialSpotId,
                                             featuredSpotId,
                                         }: {
    spots: { id: number; name: string }[];
    initialSpotId?: number;
    featuredSpotId?: number;
}) {
    const router = useRouter();
    const startId =
        spots.find((s) => s.id === initialSpotId)?.id ?? spots[0]?.id ?? 0;
    const [spotId, setSpotId] = useState(startId);
    const [vibe, setVibe] = useState<VibeKey>("online");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function generate() {
        setLoading(true);
        setError("");
        const res = await fetch("/api/captions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spotId, vibe }),
        });
        const data = await res.json().catch(() => ({}));
        setLoading(false);

        if (!res.ok) {
            setError(data.error ?? "Something went wrong.");
            return;
        }
        router.refresh();
    }

    return (
        <div className="panel generator">
            <h2 className="panel-title">✨ Generate a caption</h2>

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
                disabled={loading || !spotId}
            >
                {loading ? "Writing…" : "Generate caption"}
            </button>
            {error && <p className="error-text">{error}</p>}
        </div>
    );
}