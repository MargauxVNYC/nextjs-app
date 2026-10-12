import { createClient } from "../../lib/supabase/server";
import Skyline from "../components/Skyline";
import { categoryStyle } from "../components/categories";
import { pickSpotOfTheDay, todayInNYC, nycDate } from "../components/daily";

export const dynamic = "force-dynamic";

type Score = { generation_id: number; score: number; upvotes: number; downvotes: number };
type Author = { id: string; first_name: string | null; avatar_url: string | null };

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: spots }, { data: generations }, { data: scores }] = await Promise.all([
    supabase.from("nyc_spots").select("*"),
    supabase.from("generations").select("id, caption, vibe, created_at, user_id, spot_id"),
    supabase.rpc("caption_scores"),
  ]);

  const spotList = spots ?? [];
  const gens = generations ?? [];
  const spotMap = new Map(spotList.map((s) => [s.id, s]));

  // Vote totals
  const scoreMap = new Map<number, number>();
  let totalVotes = 0;
  for (const s of (scores ?? []) as Score[]) {
    scoreMap.set(s.generation_id, Number(s.score));
    totalVotes += Number(s.upvotes) + Number(s.downvotes);
  }
  const scoreOf = (id: number) => scoreMap.get(id) ?? 0;
  const byScore = (a: { id: number }, b: { id: number }) => scoreOf(b.id) - scoreOf(a.id);

  // Spot of the Day + its best caption today
  const today = todayInNYC();
  const spotOfDay = pickSpotOfTheDay(spotList, today);
  const todaysTop = spotOfDay
      ? gens
          .filter((g) => g.spot_id === spotOfDay.id && nycDate(g.created_at) === today)
          .sort(byScore)[0]
      : undefined;

  // Top captions from the last 7 days
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const topThisWeek = gens
      .filter((g) => new Date(g.created_at).getTime() >= weekAgo)
      .sort(byScore)
      .slice(0, 5);

  // Top captioners: total points across all their captions
  const tally = new Map<string, { points: number; count: number }>();
  for (const g of gens) {
    const t = tally.get(g.user_id) ?? { points: 0, count: 0 };
    t.points += scoreOf(g.id);
    t.count += 1;
    tally.set(g.user_id, t);
  }
  const topCaptioners = [...tally.entries()]
      .sort((a, b) => b[1].points - a[1].points || b[1].count - a[1].count)
      .slice(0, 5);

  // Names and photos for everyone shown
  const authorIds = [
    ...new Set([
      ...topThisWeek.map((g) => g.user_id),
      ...topCaptioners.map(([id]) => id),
      ...(todaysTop ? [todaysTop.user_id] : []),
    ]),
  ];
  let authors: Author[] = [];
  if (authorIds.length) {
    const { data } = await supabase
        .from("profiles")
        .select("id, first_name, avatar_url")
        .in("id", authorIds);
    authors = data ?? [];
  }
  const authorMap = new Map(authors.map((a) => [a.id, a]));
  const nameOf = (id: string) => authorMap.get(id)?.first_name ?? "Someone";

  const fullName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "";
  const firstName = fullName.split(" ")[0] || "there";
  const medal = (i: number) => ["🥇", "🥈", "🥉"][i] ?? `${i + 1}`;
  const pts = (n: number) => `${n} ${Math.abs(n) === 1 ? "pt" : "pts"}`;

  return (
      <>
        <section className="hero">
          <p className="eyebrow">Dashboard</p>
          <h1 className="title">Welcome back, {firstName}</h1>
          <p className="muted" style={{ maxWidth: 480, margin: "0 0 20px" }}>
            A new spot drops every day. Caption it, vote on the best, climb the board.
          </p>
          <a href="/" className="btn btn-accent">Start captioning →</a>
          <Skyline />
        </section>

        {spotOfDay && (
            <section className="panel sotd">
              <div className="sotd-media">
                {spotOfDay.image_url ? (
                    <img src={spotOfDay.image_url} alt={spotOfDay.name} />
                ) : (
                    categoryStyle(spotOfDay.category).icon
                )}
              </div>
              <div className="sotd-body">
                <span className="sotd-badge">🌟 Spot of the Day</span>
                <h2 className="title" style={{ fontSize: 28, margin: 0 }}>{spotOfDay.name}</h2>
                <p className="soft" style={{ margin: 0 }}>
                  📍 {spotOfDay.neighborhood} · {spotOfDay.category}
                </p>

                {todaysTop ? (
                    <>
                      <p className="field-label" style={{ margin: "8px 0 0" }}>Today&apos;s top caption</p>
                      <p className="quote">{todaysTop.caption}</p>
                      <p className="soft" style={{ margin: 0, fontSize: 13 }}>
                        by {nameOf(todaysTop.user_id)} · {pts(scoreOf(todaysTop.id))}
                      </p>
                    </>
                ) : (
                    <p className="muted" style={{ margin: "8px 0" }}>
                      No captions yet today. Be the first to caption it.
                    </p>
                )}

                <a href={`/?spot=${spotOfDay.id}`} className="btn btn-accent" style={{ alignSelf: "flex-start" }}>
                  Caption it →
                </a>
              </div>
            </section>
        )}

        <div className="stats">
          <div className="panel">
            <div className="stat-value">{spotList.length}</div>
            <div className="stat-label">Spots</div>
          </div>
          <div className="panel">
            <div className="stat-value">{gens.length}</div>
            <div className="stat-label">Captions</div>
          </div>
          <div className="panel">
            <div className="stat-value">{totalVotes}</div>
            <div className="stat-label">Votes cast</div>
          </div>
        </div>

        <div className="two-col">
          <div className="panel">
            <h2 className="panel-title">🔥 Top captions this week</h2>
            {topThisWeek.length === 0 && <p className="empty">No captions this week yet.</p>}
            {topThisWeek.map((g, i) => (
                <div key={g.id} className="rank-row">
                  <span className="rank">{medal(i)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{g.caption}</div>
                    <div className="soft" style={{ fontSize: 13 }}>
                      {g.spot_id ? spotMap.get(g.spot_id)?.name : "📸 Photo"} · by {nameOf(g.user_id)}
                    </div>
                  </div>
                  <span className="rank-score">{scoreOf(g.id)}</span>
                </div>
            ))}
          </div>

          <div className="panel">
            <h2 className="panel-title">🏆 Top captioners</h2>
            {topCaptioners.length === 0 && <p className="empty">Nobody on the board yet.</p>}
            {topCaptioners.map(([id, t], i) => {
              const author = authorMap.get(id);
              return (
                  <div key={id} className="rank-row">
                    <span className="rank">{medal(i)}</span>
                    {author?.avatar_url ? (
                        <img src={author.avatar_url} alt="" className="rank-avatar" referrerPolicy="no-referrer" />
                    ) : (
                        <span className="rank-avatar" />
                    )}
                    <div>
                      <div style={{ fontWeight: 600 }}>{nameOf(id)}</div>
                      <div className="soft" style={{ fontSize: 13 }}>
                        {t.count} caption{t.count === 1 ? "" : "s"}
                      </div>
                    </div>
                    <span className="rank-score">{pts(t.points)}</span>
                  </div>
              );
            })}
          </div>
        </div>
      </>
  );
}