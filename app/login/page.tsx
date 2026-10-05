import AuthButton from "../components/AuthButton";
import Skyline from "../components/Skyline";

export default function LoginPage() {
    return (
        <main className="login">
            <section className="login-art">
                <div className="brand" style={{ padding: 0, marginBottom: 32 }}>
                    <span className="brand-mark">NYC</span>
                    <span>Spots</span>
                </div>
                <h1 className="title title-xl">Your city,<br />curated.</h1>
                <p className="muted" style={{ maxWidth: 420, fontSize: 18 }}>
                    Restaurants, museums, parks, and landmarks: handpicked spots across New York.
                </p>
                <Skyline />
            </section>

            <section className="login-panel">
                <div className="panel login-card">
                    <div className="lock">🔒</div>
                    <h2 style={{ fontSize: 22, margin: "0 0 8px" }}>Sign in to continue</h2>
                    <p className="soft" style={{ margin: "0 0 24px", fontSize: 14 }}>
                        Your Google account is your profile. No extra setup needed.
                    </p>
                    <AuthButton />
                </div>
            </section>
        </main>
    );
}