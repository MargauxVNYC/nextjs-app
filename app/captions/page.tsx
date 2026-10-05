import { createClient } from "../../lib/supabase/server";
import CaptionGenerator from "../components/CaptionGenerator";
import VoteButtons from "../components/VoteButtons";
import { VIBES, type VibeKey } from "../components/vibes";
import { categoryStyle } from "../components/categories";
import { pickSpotOfTheDay } from "../components/daily";

export const dynamic = "force-dynamic";

type SpotInfo = {
    name: string;
    neighborhood: string | null;
    category: string | null;
    image_url: string | null;
};

type Author = { id: string; first_name: string | null; avatar_url: string | null };

export default async function CaptionsPage({
                                               searchParams,
                                           }: {
    searchParams: Promise<{ sort?: string; spot?: string }>;
}) {
    const { sort, spot } = await searchParams;
    const sortTop = sort === "top";
    const supabase = await createClient();

    const [{ data: spots }, { data: generations }, { data: scores }, { data: myVotes }] =
        await Promise.all([
            supabase.from("nyc_spots").select("id, name").order("name"),
            supabase
                .from("generations")
                .select("id, caption, vibe, created_at, user_id, nyc_spots(name, neighborhood, category, image_url)")
                .order("created_at", { ascending: false })
                .limit(100),
            supabase.rpc("caption_scores"), // totals only: who voted stays private
            supabase.from("votes").select("generation_id, value"), // RLS returns only MY votes
        ]);

    const scoreMap = new Map<number, number>(
        (scores ?? []).map((s: { generation_id: number; score: number }) => [s.generation_id, Number(s.score)])
    );
    const myVoteMap = new Map<number, number>(
        (myVotes ?? []).map((v) => [v.generation_id, v.value])
    );

    const list = [...(generations ?? [])];
    if (sortTop) {
        list.sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0));
    }

    const authorIds = [...new Set(list.map((g) => g.user_id))];
    let authors: Author[] = [];
    if (authorIds.length) {
        const { data } = await supabase
            .from("profiles")
            .select("id, first_name, avatar_url")
            .in("id", authorIds);
        authors = data ?? [];
    }
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    return (
        <>
            <p className="eyebrow">Caption the City</p>
            <h1 className="title">Caption the City</h1>
            <p className="muted">Pick a spot, pick a vibe, let the AI cook. Then vote on the best.</p>

            <div className="caption-layout">
                <CaptionGenerator
                    spots={spots ?? []}
                    initialSpotId={Number(spot) || pickSpotOfTheDay(spots ?? [])?.id}
                    featuredSpotId={pickSpotOfTheDay(spots ?? [])?.id}
                />

                <div className="feed">
                    <div className="tabs">
                        <a href="/captions" className={`tab${!sortTop ? " active" : ""}`}>🆕 New</a>
                        <a href="/captions?sort=top" className={`tab${sortTop ? " active" : ""}`}>🔥 Top</a>
                    </div>

                    {list.length === 0 && (
                        <div className="panel muted">No captions yet. Be the first!</div>
                    )}

                    {list.map((g) => {
                        const spot = (Array.isArray(g.nyc_spots) ? g.nyc_spots[0] : g.nyc_spots) as SpotInfo | null;
                        const vibe = VIBES[g.vibe as VibeKey];
                        const author = authorMap.get(g.user_id);
                        const myVote = (myVoteMap.get(g.id) ?? 0) as 1 | -1 | 0;

                        return (
                            <article key={g.id} className="panel caption-card">
                                {spot?.image_url ? (
                                    <img src={spot.image_url} alt={spot.name} className="caption-thumb" />
                                ) : (
                                    <span className="caption-thumb">{categoryStyle(spot?.category).icon}</span>
                                )}

                                <div>
                                    <div className="caption-meta">
                                        <strong style={{ color: "var(--text)" }}>{spot?.name}</strong>
                                        {vibe && <span>· {vibe.emoji} {vibe.label}</span>}
                                    </div>
                                    <p className="caption-text">{g.caption}</p>
                                    <div className="author">
                                        {author?.avatar_url && (
                                            <img src={author.avatar_url} alt="" referrerPolicy="no-referrer" />
                                        )}
                                        <span>
                      {author?.first_name ?? "Someone"} ·{" "}
                                            {new Date(g.created_at).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                            })}
                    </span>
                                    </div>
                                </div>

                                <VoteButtons
                                    generationId={g.id}
                                    initialScore={scoreMap.get(g.id) ?? 0}
                                    initialVote={myVote}
                                />
                            </article>
                        );
                    })}
                </div>
            </div>
        </>
    );
}