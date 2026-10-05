import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { VIBES, type VibeKey } from "../../components/vibes";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export async function POST(request: Request) {
    const supabase = await createClient();

    // Only signed-in users can generate.
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const spotId = Number(body?.spotId);
    const vibe = body?.vibe as VibeKey;
    if (!spotId || !vibe || !(vibe in VIBES)) {
        return NextResponse.json({ error: "Pick a spot and a vibe." }, { status: 400 });
    }

    const { data: spot } = await supabase
        .from("nyc_spots")
        .select("name, neighborhood, category, notes")
        .eq("id", spotId)
        .single();
    if (!spot) {
        return NextResponse.json({ error: "Spot not found." }, { status: 404 });
    }

    // The exact prompt is saved alongside the caption.
    const prompt = [
        "You write short, funny captions for photos of places in New York City.",
        "The audience is Columbia College students who are very online and still discovering the city.",
        "",
        `Place: ${spot.name}`,
        `Neighborhood: ${spot.neighborhood ?? "unknown"}`,
        `Category: ${spot.category ?? "unknown"}`,
        `Details: ${spot.notes ?? "none"}`,
        "",
        `Write in the voice of ${VIBES[vibe].voice}.`,
        "Rules: one caption only, under 20 words, no hashtags, no quotation marks,",
        "at most one emoji, playful rather than mean, nothing offensive.",
        "Return only the caption text.",
    ].join("\n");

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": process.env.GEMINI_API_KEY!,
            },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 1.1,
                    maxOutputTokens: 1024,
                },
            }),
        }
    );

    if (!res.ok) {
        console.error("Gemini error", res.status, await res.text());
        return NextResponse.json(
            { error: `The AI request failed (${res.status}). Try again in a moment.` },
            { status: 502 }
        );
    }

    const data = await res.json();
    const caption = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? "")
        .join("")
        .trim()
        .replace(/^["“]|["”]$/g, "");

    if (!caption) {
        return NextResponse.json(
            { error: "The AI came back empty. Try again." },
            { status: 502 }
        );
    }

    // user_id fills in automatically from the session; RLS checks it matches.
    const { data: row, error } = await supabase
        .from("generations")
        .insert({ spot_id: spotId, vibe, prompt, caption, model: MODEL })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(row);
}