import { createClient } from "../lib/supabase/server";
import CaptionGenerator from "./components/CaptionGenerator";
import VoteButtons from "./components/VoteButtons";
import { VIBES, type VibeKey } from "./components/vibes";
import { categoryStyle } from "./components/categories";
import { pickSpotOfTheDay } from "./components/daily";
import PendingPost from "./components/PendingPost";
import DeletePostButton from "./components/DeletePostButton";

export const metadata = { title: "Feed · NYC Spots" };

export const dynamic = "force-dynamic";


type SpotInfo = {
    name: string;
    neighborhood: string | null;
    category: string | null;
    image_url: string | null;
};
type Author = { id: string; first_name: string | null; avatar_url: string | null };
type Post = {
    batchId: string;
    createdAt: string;
    userId: string;
    vibe: string;
    context: string | null;
    image: string | null;
    isUpload: boolean;
    spot: SpotInfo | null;
    captions: { id: number; caption: string }[];
};

export default async function Feed({
                                       searchParams,
                                   }: {
    searchParams: Promise<{ sort?: string; spot?: string }>;
}) {
    const { sort, spot } = await searchParams;
    const sortTop = sort === "top";
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const [{ data: spots }, { data: generations }, { data: scores }, { data: myVotes }] =
        await Promise.all([
            supabase.from("nyc_spots").select("id, name").order("name"),
            supabase
                .from("generations")
                .select(
                    "id, caption, vibe, created_at, user_id, batch_id, image_url, user_context, nyc_spots(name, neighborhood, category, image_url)"
                )
                .order("created_at", { ascending: false })
                .limit(300),
            supabase.rpc("caption_scores"),
            supabase.from("votes").select("generation_id, value"), // RLS: only my own votes
        ]);

    const scoreMap = new Map<number, number>(
        (scores ?? []).map((s: { generation_id: number; score: number }) => [s.generation_id, Number(s.score)])
    );
    const scoreOf = (id: number) => scoreMap.get(id) ?? 0;
    const myVoteMap = new Map<number, number>((myVotes ?? []).map((v) => [v.generation_id, v.value]));

    // Group the 3 captions from each request into one post.
    const posts = new Map<string, Post>();
    for (const g of generations ?? []) {
        const spotInfo = (Array.isArray(g.nyc_spots) ? g.nyc_spots[0] : g.nyc_spots) as SpotInfo | null;
        let post = posts.get(g.batch_id);
        if (!post) {
            post = {
                batchId: g.batch_id,
                createdAt: g.created_at,
                userId: g.user_id,
                vibe: g.vibe,
                context: g.user_context,
                image: g.image_url ?? spotInfo?.image_url ?? null,
                isUpload: !!g.image_url,
                spot: spotInfo,
                captions: [],
            };
            posts.set(g.batch_id, post);
        }
        post.captions.push({ id: g.id, caption: g.caption });
    }

    const postList = [...posts.values()];
    for (const p of postList) p.captions.sort((a, b) => scoreOf(b.id) - scoreOf(a.id));
    const best = (p: Post) => Math.max(...p.captions.map((c) => scoreOf(c.id)));
    if (sortTop) postList.sort((a, b) => best(b) - best(a));

    const authorIds = [...new Set(postList.map((p) => p.userId))];
    let authors: Author[] = [];
    if (authorIds.length) {
        const { data } = await supabase.from("profiles").select("id, first_name, avatar_url").in("id", authorIds);
        authors = data ?? [];
    }
    const authorMap = new Map(authors.map((a) => [a.id, a]));
    const featured = pickSpotOfTheDay(spots ?? []);

    return (
        <>
            <div className="feed">
                <PendingPost />
                <div>
                    <p className="eyebrow">Caption the City</p>
                    <h1 className="title">The Feed</h1>
                    <p className="muted" style={{ margin: 0 }}>
                        Post a photo from your week in NYC, let the AI caption it, vote on the best line.
                    </p>
                </div>
                <div className="tabs">
                    <a href="/" className={`tab${!sortTop ? " active" : ""}`}>🆕 New</a>
                    <a href="/?sort=top" className={`tab${sortTop ? " active" : ""}`}>🔥 Top</a>
                </div>
            </div>

            <div className="home-layout">
                <div className="feed">
                    {postList.length === 0 && (
                        <div className="panel muted">No posts yet. Upload a photo to start the feed!</div>
                    )}

                    {postList.map((p) => {
                        const author = authorMap.get(p.userId);
                        const vibe = VIBES[p.vibe as VibeKey];
                        const leaderId = best(p) > 0 ? p.captions[0].id : null;

                        return (
                            <article key={p.batchId} id={`post-${p.batchId}`} className="panel post">
                                <header className="post-head">
                                    {author?.avatar_url && <img src={author.avatar_url} alt="" referrerPolicy="no-referrer" />}
                                    <span className="post-author">{author?.first_name ?? "Someone"}</span>
                                    <span>
                    {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                                    <span className="chip">{p.isUpload ? "📸 Original photo" : `📍 ${p.spot?.name ?? "Spot"}`}</span>
                                    {vibe && <span className="chip">{vibe.emoji} {vibe.label}</span>}
                                    {p.userId === user?.id && (
                                        <DeletePostButton batchId={p.batchId} imageUrl={p.isUpload ? p.image : null} />
                                    )}
                                </header>

                                {p.image ? (
                                    <img src={p.image} alt="" className="post-image" />
                                ) : (
                                    <div className="post-image post-image-empty">{categoryStyle(p.spot?.category).icon}</div>
                                )}

                                {p.context && <p className="post-context">&ldquo;{p.context}&rdquo;</p>}

                                <ol className="caption-list">
                                    {p.captions.map((c) => (
                                        <li key={c.id} className={`caption-row${c.id === leaderId ? " leader" : ""}`}>
                                            {c.id === leaderId && <span className="crown">👑</span>}
                                            <p className="caption-line">{c.caption}</p>
                                            <VoteButtons
                                                generationId={c.id}
                                                initialScore={scoreOf(c.id)}
                                                initialVote={(myVoteMap.get(c.id) ?? 0) as 1 | -1 | 0}
                                                layout="row"
                                            />
                                        </li>
                                    ))}
                                </ol>
                            </article>
                        );
                    })}
                </div>

                <aside>
                    <CaptionGenerator
                        spots={spots ?? []}
                        initialSpotId={Number(spot) || featured?.id}
                        featuredSpotId={featured?.id}
                        initialMode={spot ? "spot" : "photo"}
                    />
                </aside>
            </div>
        </>
    );
}