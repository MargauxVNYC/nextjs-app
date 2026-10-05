export function categoryStyle(category?: string | null) {
    const c = (category ?? "").toLowerCase();
    if (c.includes("restaurant") || c.includes("food")) return { icon: "🍝", color: "#fb7185" };
    if (c.includes("grocery") || c.includes("market")) return { icon: "🛒", color: "#34d399" };
    if (c.includes("museum")) return { icon: "🖼️", color: "#a78bfa" };
    if (c.includes("park")) return { icon: "🌳", color: "#4ade80" };
    if (c.includes("attraction") || c.includes("landmark")) return { icon: "🌉", color: "#38bdf8" };
    return { icon: "📍", color: "#fbbf24" };
}