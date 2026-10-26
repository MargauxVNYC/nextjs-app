"use client";

import { useEffect, useState } from "react";

const KEY = "nycspots-hide-how-it-works";

const STEPS = [
    { icon: "📸", title: "Post a photo", text: "Something from your week in NYC, or one of the spots." },
    { icon: "🤖", title: "AI writes 3 captions", text: "It studies your photo and writes in the vibe you pick." },
    { icon: "🗳️", title: "Vote the best", text: "▲ or ▼ any caption. The top one wears the 👑." },
];

export default function HowItWorks() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        try {
            setShow(localStorage.getItem(KEY) !== "1");
        } catch {
            setShow(true);
        }
    }, []);

    function dismiss() {
        setShow(false);
        try {
            localStorage.setItem(KEY, "1");
        } catch {}
    }

    if (!show) return null;

    return (
        <section className="how" aria-label="How it works">
            <button className="how-x" onClick={dismiss} aria-label="Close instructions" title="Close">
                ✕
            </button>

            <p className="eyebrow">How it works</p>
            <h2 className="how-title">Your first caption in three steps</h2>

            <ol className="how-steps">
                {STEPS.map((step, i) => (
                    <li key={step.title} className="how-step">
                        <div className="how-icon">
                            <span>{step.icon}</span>
                            <b className="how-num">{i + 1}</b>
                        </div>
                        <div>
                            <strong>{step.title}</strong>
                            <p>{step.text}</p>
                        </div>
                    </li>
                ))}
            </ol>

            <button className="how-dismiss" onClick={dismiss}>
                Got it, hide this
            </button>
        </section>
    );
}