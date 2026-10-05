import { createClient } from "../../lib/supabase/server";
import { categoryStyle } from "../components/categories";

export const dynamic = "force-dynamic";

export default async function SpotsPage() {
    const supabase = await createClient();
    const { data: spots, error } = await supabase
        .from("nyc_spots")
        .select("*")
        .order("id");

    if (error) {
        return <p>Error loading spots: {error.message}</p>;
    }

    return (
        <>
            <p className="eyebrow">Explore</p>
            <h1 className="title">NYC Spots</h1>
            <p className="muted">{spots?.length ?? 0} places worth the trip.</p>

            <div className="spot-grid">
                {spots?.map((spot) => {
                    const { icon, color } = categoryStyle(spot.category);
                    return (
                        <article key={spot.id} className="spot-card">
                            <div className="spot-media">
                                {spot.image_url ? <img src={spot.image_url} alt={spot.name} /> : icon}
                                {spot.category && (
                                    <span
                                        className="spot-badge"
                                        style={{ background: `${color}33`, color, borderColor: `${color}66` }}
                                    >
                    {icon} {spot.category}
                  </span>
                                )}
                            </div>
                            <div className="spot-body">
                                <h2 className="spot-name">{spot.name}</h2>
                                <p className="spot-hood">📍 {spot.neighborhood}</p>
                                <p className="spot-notes">{spot.notes}</p>
                            </div>
                        </article>
                    );
                })}
            </div>
        </>
    );
}