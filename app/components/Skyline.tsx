const buildings: [number, number, number][] = [
    [0, 40, 70], [42, 30, 95], [74, 50, 60], [126, 26, 120], [154, 44, 85],
    [200, 36, 135], [238, 54, 75], [294, 30, 110], [326, 46, 90], [374, 34, 150],
    [410, 52, 80], [464, 28, 105], [494, 48, 70], [544, 56, 95],
];

export default function Skyline() {
    const H = 160;
    return (
        <svg
            className="skyline"
            viewBox={`0 0 600 ${H}`}
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <defs>
                <linearGradient id="skyline-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fbbf24" stopOpacity="0.45" />
                    <stop offset="1" stopColor="#fb7185" stopOpacity="0.08" />
                </linearGradient>
            </defs>

            <circle cx="470" cy="42" r="20" fill="#fbbf24" opacity="0.35" />

            {/* Spire on the tallest tower */}
            <polygon points={`388,${H - 150} 391,${H - 175} 394,${H - 150}`} fill="url(#skyline-fill)" />

            {buildings.map(([x, w, h], i) => (
                <g key={i}>
                    <rect x={x} y={H - h} width={w} height={h} fill="url(#skyline-fill)" />
                    {Array.from({ length: Math.floor((h - 12) / 14) }).flatMap((_, r) =>
                        Array.from({ length: Math.floor((w - 8) / 10) }).map((_, c) =>
                            (i + r * 3 + c) % 4 === 0 ? (
                                <rect
                                    key={`${r}-${c}`}
                                    x={x + 6 + c * 10}
                                    y={H - h + 8 + r * 14}
                                    width={4}
                                    height={6}
                                    fill="#fde68a"
                                    opacity="0.7"
                                />
                            ) : null
                        )
                    )}
                </g>
            ))}
        </svg>
    );
}