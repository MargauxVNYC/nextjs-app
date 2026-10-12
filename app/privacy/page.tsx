export const metadata = { title: "Privacy Policy · NYC Spots" };

export default function PrivacyPage() {
    return (
        <main className="page" style={{ maxWidth: 720 }}>
            <p className="eyebrow">NYC Spots</p>
            <h1 className="title">Privacy Policy</h1>
            <p className="soft">Last updated: October 12, 2026</p>

            <div className="panel privacy">
                <p>
                    NYC Spots is a student class project. Signed-in users post photos of New York City,
                    get AI-written captions, and vote on them. This page explains what data the app
                    collects and how it is used.
                </p>

                <h2>What we collect</h2>
                <ul>
                    <li><strong>Google account info:</strong> your name, email address, and profile photo, received when you sign in with Google.</li>
                    <li><strong>Photos you upload:</strong> stored in our file storage so captions can be generated and shown in the feed.</li>
                    <li><strong>Captions and votes:</strong> the AI captions you generate, any note you add, and your upvotes or downvotes.</li>
                </ul>

                <h2>How it is used</h2>
                <ul>
                    <li>To sign you in and show your name and photo next to your posts.</li>
                    <li>To generate captions: your photo and note are sent to Google&apos;s Gemini AI service for this purpose.</li>
                    <li>To display posts, scores, and leaderboards to other signed-in users.</li>
                </ul>

                <h2>What we don&apos;t do</h2>
                <ul>
                    <li>We don&apos;t sell or share your data with advertisers.</li>
                    <li>Individual votes are private. Other users only see total scores.</li>
                </ul>

                <h2>Where data is stored</h2>
                <p>
                    Data is stored with Supabase (database, sign-in, and file storage) and the app is hosted
                    on Vercel.
                </p>

                <h2>Contact and deletion</h2>
                <p>
                    To ask a question or have your data deleted, email{" "}
                    <a href="mailto:mv2922@barnard.edu" style={{ color: "var(--accent)" }}>mv2922@barnard.edu</a>.
                </p>
            </div>
        </main>
    );
}