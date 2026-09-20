import { supabase } from "../../lib/supabaseClient";

export const dynamic = "force-dynamic";

export default async function SpotsPage() {
  const { data: spots, error } = await supabase
    .from("nyc_spots")
    .select("*")
    .order("id");

  if (error) {
    return <p style={{ padding: 24 }}>Error loading spots: {error.message}</p>;
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>My NYC Spots</h1>
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        {spots?.map((spot) => (
          <li
            key={spot.id}
            style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}
          >
            <h2 style={{ fontSize: 18, margin: 0 }}>{spot.name}</h2>
            <p style={{ margin: "4px 0", color: "#666" }}>
              {spot.neighborhood} · {spot.category}
            </p>
            <p style={{ margin: 0 }}>{spot.notes}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
