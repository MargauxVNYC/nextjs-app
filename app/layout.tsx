import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import AuthButton from "./components/AuthButton";
import Sidebar from "./components/Sidebar";
import { createClient } from "../lib/supabase/server";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
    title: "NYC Spots",
    description: "A curated guide to favorite spots in New York City",
};

export default async function RootLayout({
                                             children,
                                         }: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    const allowed = user ? (await supabase.rpc("is_email_allowed")).data !== false : false;

    return (
        <html lang="en">
        <body className={geist.variable}>
        {user && allowed ? (
            <div className="shell">
                <Sidebar />
                <div className="main">
                    <header className="topbar">
                        <span className="topbar-place">📍 New York City</span>
                        <AuthButton />
                    </header>
                    <div className="content">{children}</div>
                </div>
            </div>
        ) : (
            children
        )}
        </body>
        </html>
    );
}