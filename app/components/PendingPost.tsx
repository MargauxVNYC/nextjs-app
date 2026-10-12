"use client";

import { useEffect, useState } from "react";

type Pending = { preview: string | null; label: string };

export default function PendingPost() {
    const [pending, setPending] = useState<Pending | null>(null);

    useEffect(() => {
        function onPending(e: Event) {
            setPending((e as CustomEvent<Pending>).detail);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }

        function onDone(e: Event) {
            const id = (e as CustomEvent<{ batchId?: string }>).detail?.batchId;
            if (!id) {
                setPending(null);
                return;
            }
            // Keep the placeholder until the real post shows up, then highlight it.
            let tries = 0;
            const timer = setInterval(() => {
                const el = document.getElementById(`post-${id}`);
                if (el || ++tries > 25) {
                    clearInterval(timer);
                    setPending(null);
                    if (el) {
                        el.classList.add("just-posted");
                        el.scrollIntoView({ behavior: "smooth", block: "start" });
                        setTimeout(() => el.classList.remove("just-posted"), 2500);
                    }
                }
            }, 200);
        }

        window.addEventListener("nycspots:pending", onPending);
        window.addEventListener("nycspots:done", onDone);
        return () => {
            window.removeEventListener("nycspots:pending", onPending);
            window.removeEventListener("nycspots:done", onDone);
        };
    }, []);

    if (!pending) return null;

    return (
        <article className="panel post pending" aria-live="polite">
            <div className="post-head">
                <span className="post-author">✨ {pending.label}</span>
            </div>
            {pending.preview ? (
                <img src={pending.preview} alt="" className="post-image" />
            ) : (
                <div className="post-image post-image-empty shimmer" />
            )}
            <ol className="caption-list">
                {[0, 1, 2].map((i) => (
                    <li key={i} className="caption-row">
                        <span className="skeleton-line" style={{ width: `${82 - i * 14}%` }} />
                    </li>
                ))}
            </ol>
        </article>
    );
}