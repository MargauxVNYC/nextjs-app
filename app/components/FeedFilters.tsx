"use client";

import { useRouter } from "next/navigation";
import { VIBES, type VibeKey } from "./vibes";

type Filters = { sort?: string; type?: string; range?: string; vibe?: string };

export default function FeedFilters({
                                        current,
                                        count,
                                    }: {
    current: Filters;
    count: number;
}) {
    const router = useRouter();
    const anyFilter = !!(current.sort || current.type || current.range || current.vibe);

    function change(key: keyof Filters, value: string) {
        const next = { ...current, [key]: value || undefined };
        const qs = new URLSearchParams(
            Object.entries(next).filter(([, v]) => v) as [string, string][]
        ).toString();
        router.push(qs ? `/?${qs}` : "/");
    }

    return (
        <section className="panel filter-row" aria-label="Filter the feed">
            <label className="filter-field">
                <span>Sort</span>
                <select className="select" value={current.sort ?? ""} onChange={(e) => change("sort", e.target.value)}>
                    <option value="">🆕 Newest</option>
                    <option value="top">🔥 Top voted</option>
                </select>
            </label>

            <label className="filter-field">
                <span>Show</span>
                <select className="select" value={current.type ?? ""} onChange={(e) => change("type", e.target.value)}>
                    <option value="">All posts</option>
                    <option value="photo">📸 Photos</option>
                    <option value="spot">📍 Spots</option>
                    <option value="mine">👤 My posts</option>
                </select>
            </label>

            <label className="filter-field">
                <span>When</span>
                <select className="select" value={current.range ?? ""} onChange={(e) => change("range", e.target.value)}>
                    <option value="">All time</option>
                    <option value="today">Today</option>
                    <option value="week">This week</option>
                </select>
            </label>

            <label className="filter-field">
                <span>Vibe</span>
                <select className="select" value={current.vibe ?? ""} onChange={(e) => change("vibe", e.target.value)}>
                    <option value="">Any vibe</option>
                    {(Object.keys(VIBES) as VibeKey[]).map((k) => (
                        <option key={k} value={k}>
                            {VIBES[k].emoji} {VIBES[k].label}
                        </option>
                    ))}
                </select>
            </label>

            <span className="filter-count">
        {count} post{count === 1 ? "" : "s"}
                {anyFilter && (
                    <a href="/" className="filter-clear">Clear</a>
                )}
      </span>
        </section>
    );
}