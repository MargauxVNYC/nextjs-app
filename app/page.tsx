import { createClient } from "../lib/supabase/server";
import CaptionGenerator from "./components/CaptionGenerator";
import VoteButtons from "./components/VoteButtons";
import HowItWorks from "./components/HowItWorks";
import PendingPost from "./components/PendingPost";
import DeletePostButton from "./components/DeletePostButton";
import { VIBES, type VibeKey } from "./components/vibes";
import { categoryStyle } from "./components/categories";
import { pickSpotOfTheDay, todayInNYC, nycDate } from "./components/daily";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Feed · NYC Spots" };

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
type Params = {
    sort?: string;
    type?: string;
    range?: string;
    vibe?: string;
    spot?: string;
    auto?: string;
};

export default async function Feed({ searchParams }: { searchParams: Promise<Params> }) {
    const params = await searchParams;
    const { sort, type, range, vibe: vibeFilter, spot, auto } = params;
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

    // ----- Filters -----
    const today = todayInNYC();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    let postList = [...posts.values()];
    if (type === "photo") postList = postList.filter((p) => p.isUpload);
    if (type === "spot") postList = postList.filter((p) => !p.isUpload);
    if (type === "mine") postList = postList.filter((p) => p.userId === user?.id);
    if (range === "today") postList = postList.filter((p) => nycDate(p.createdAt) === today);
    if (range === "week") postList = postList.filter((p) => new Date(p.createdAt).getTime() >= weekAgo);
    if (vibeFilter && vibeFilter in VIBES) postList = postList.filter((p) => p.vibe === vibeFilter);

    for (const p of postList) p.captions.sort((a, b) => scoreOf(b.id) - scoreOf(a.id));
    const best = (p: Post) => Math.max(...p.captions.map((c) => scoreOf(c.id)));
    if (sortTop) postList.sort((a, b) => best(b) - best(a));

    // Build a link that changes one filter and keeps the others.
    const linkWith = (changes: Partial<Params>) => {
        const merged = { sort, type, range, vibe: vibeFilter, ...changes };
        const qs = new URLSearchParams(
            Object.entries(merged).filter(([, v]) => v) as [string, string][]
        ).toString();
        return qs ? `/?${qs}` : "/";
    };
    const anyFilter = !!(type || range || vibeFilter || sortTop);

    const authorIds = [...new Set(postList.map((p) => p.userId))];
    let authors: Author[] = [];
    if (authorIds.length) {
        const { data } = await supabase.from("profiles").select("id, first_name, avatar_url").in("id", authorIds);
        authors = data ?? [];
    }
    const authorMap = new Map(authors.map((a) => [a.id, a]));
    const featured = pickSpotOfTheDay(spots ?? []);

    // Vibes that admins have enabled in the chain mix, highest weight first
    const { data: mixRows } = await supabase
        .from("prompt_chain_mix")
        .select("weight, prompt_chains(slug)")
        .eq("is_enabled", true)
        .order("weight", { ascending: false });
    const enabledVibes = (mixRows ?? [])
        .map((m) => {
            const c = Array.isArray(m.prompt_chains) ? m.prompt_chains[0] : m.prompt_chains;
            return (c as { slug: string } | null)?.slug;
        })
        .filter((s): s is string => !!s);

    const chip = (label: string, href: string, active: boolean) => (
        <a key={label} href={href} className={`filter-chip${active ? " active" : ""}`}>
            {label}
        </a>
    );

    return (
        <>
            <p className="eyebrow">Caption the City</p>
            <h1 className="title">The Feed</h1>
            <p className="muted" style={{ margin: 0 }}>
                Post a photo from your week in NYC, let the AI caption it, vote on the best line.
            </p>

            <HowItWorks />

            <div className="home-layout">
                <div className="feed">
                    <section className="panel filter-bar">
                        <div className="filter-group">
                            <span className="filter-label">Sort</span>
                            {chip("🆕 New", linkWith({ sort: undefined }), !sortTop)}
                            {chip("🔥 Top", linkWith({ sort: "top" }), sortTop)}
                        </div>
                        <div className="filter-group">
                            <span className="filter-label">Show</span>
                            {chip("All", linkWith({ type: undefined }), !type)}
                            {chip("📸 Photos", linkWith({ type: "photo" }), type === "photo")}
                            {chip("📍 Spots", linkWith({ type: "spot" }), type === "spot")}
                            {chip("👤 My posts", linkWith({ type: "mine" }), type === "mine")}
                        </div>
                        <div className="filter-group">
                            <span className="filter-label">When</span>
                            {chip("All time", linkWith({ range: undefined }), !range)}
                            {chip("Today", linkWith({ range: "today" }), range === "today")}
                            {chip("This week", linkWith({ range: "week" }), range === "week")}
                        </div>
                        <div className="filter-group">
                            <span className="filter-label">Vibe</span>
                            {chip("Any", linkWith({ vibe: undefined }), !vibeFilter)}
                            {(Object.keys(VIBES) as VibeKey[]).map((k) =>
                                chip(`${VIBES[k].emoji} ${VIBES[k].label}`, linkWith({ vibe: k }), vibeFilter === k)
                            )}
                        </div>
                        <div className="filter-summary">
              <span>
                {postList.length} post{postList.length === 1 ? "" : "s"}
              </span>
                            {anyFilter && <a href="/">Clear filters</a>}
                        </div>
                    </section>

                    <PendingPost />

                    {postList.length === 0 && (
                        <div className="panel muted">
                            {anyFilter ? "No posts match these filters." : "No posts yet. Upload a photo to start the feed!"}
                        </div>
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
                        autoStart={auto === "1" && !!spot}
                        enabledVibes={enabledVibes}
                    />
                </aside>
            </div>
        </>
    );
}