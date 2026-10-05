"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function VoteButtons({
                                        generationId,
                                        initialScore,
                                        initialVote,
                                    }: {
    generationId: number;
    initialScore: number;
    initialVote: 1 | -1 | 0;
}) {
    const supabase = createClient();
    const [vote, setVote] = useState<1 | -1 | 0>(initialVote);
    const [score, setScore] = useState(initialScore);
    const [busy, setBusy] = useState(false);

    async function cast(value: 1 | -1) {
        if (busy) return;
        const previous = vote;
        const next: 1 | -1 | 0 = previous === value ? 0 : value; // same arrow again = undo

        // Update the screen right away, then save.
        setVote(next);
        setScore((s) => s - previous + next);
        setBusy(true);

        let error: { message: string } | null = null;
        if (next === 0) {
            // Remove my vote
            ({ error } = await supabase.from("votes").delete().eq("generation_id", generationId));
        } else if (previous === 0) {
            // New vote: inserts a new row (user_id fills in automatically)
            ({ error } = await supabase.from("votes").insert({ generation_id: generationId, value: next }));
        } else {
            // Switch my vote from up to down or back
            ({ error } = await supabase.from("votes").update({ value: next }).eq("generation_id", generationId));
        }

        if (error) {
            // Put things back if the save failed
            setVote(previous);
            setScore((s) => s - next + previous);
            console.error("Vote failed:", error.message);
        }
        setBusy(false);
    }

    return (
        <div className="vote">
            <button
                className={`vote-btn up${vote === 1 ? " active" : ""}`}
                onClick={() => cast(1)}
                aria-label="Upvote"
            >
                ▲
            </button>
            <span className="vote-score">{score}</span>
            <button
                className={`vote-btn down${vote === -1 ? " active" : ""}`}
                onClick={() => cast(-1)}
                aria-label="Downvote"
            >
                ▼
            </button>
        </div>
    );
}