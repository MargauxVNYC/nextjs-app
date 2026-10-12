export default function Loading() {
    return (
        <div aria-busy="true" aria-label="Loading">
            <span className="skeleton-line" style={{ width: 120, height: 12, marginBottom: 14 }} />
            <span className="skeleton-line" style={{ width: "45%", height: 36, marginBottom: 28 }} />
            {[0, 1].map((i) => (
                <div key={i} className="panel" style={{ marginBottom: 16 }}>
                    <div className="shimmer" style={{ height: 220, borderRadius: 14, marginBottom: 16 }} />
                    <span className="skeleton-line" style={{ width: "80%", marginBottom: 10 }} />
                    <span className="skeleton-line" style={{ width: "60%" }} />
                </div>
            ))}
        </div>
    );
}