// Today's date in New York, e.g. "2026-10-05"
export function todayInNYC() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// The New York date of any timestamp
export function nycDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// Same spot for everyone all day; changes at midnight NYC time.
export function pickSpotOfTheDay<T extends { id: number }>(spots: T[], day = todayInNYC()) {
    if (!spots.length) return null;
    const sorted = [...spots].sort((a, b) => a.id - b.id);
    let hash = 0;
    for (const ch of day) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return sorted[hash % sorted.length];
}