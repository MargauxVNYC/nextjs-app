import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { VIBES, type VibeKey } from "../../components/vibes";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

// Download an image and convert it to the format Gemini accepts.
async function loadImage(url: string) {
    try {
        const res = await fetch(url, { headers: { "User-Agent": "NYCSpots/1.0 (class project)" } });
        const type = res.headers.get("content-type") ?? "";
        if (!res.ok || !type.startsWith("image/")) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 8 * 1024 * 1024) return null;
        return { mimeType: type.split(";")[0], data: buf.toString("base64") };
    } catch {
        return null;
    }
}

export async function POST(request: Request) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const vibe = body?.vibe as VibeKey;
    const imagePath = typeof body?.imagePath === "string" ? body.imagePath : null;
    const requestedSpotId = Number(body?.spotId) || null;
    const context =
        typeof body?.context === "string" ? body.context.trim().slice(0, 200) : "";

    if (!vibe || !(vibe in VIBES)) {
        return NextResponse.json({ error: "Pick a vibe." }, { status: 400 });
    }
    if (!imagePath && !requestedSpotId) {
        return NextResponse.json({ error: "Add a photo or pick a spot." }, { status: 400 });
    }

    let spotId: number | null = null;
    let imageUrl: string | null = null;
    let image: { mimeType: string; data: string } | null = null;
    let subject: string[] = [];

    if (imagePath) {
        // Users may only caption photos from their own upload folder.
        if (!imagePath.startsWith(`${user.id}/`)) {
            return NextResponse.json({ error: "That photo isn't yours." }, { status: 403 });
        }
        imageUrl = supabase.storage.from("uploads").getPublicUrl(imagePath).data.publicUrl;
        image = await loadImage(imageUrl);
        if (!image) {
            return NextResponse.json({ error: "Couldn't read your photo. Try another one." }, { status: 400 });
        }
        subject = ["The attached image is a photo a student took around New York City and uploaded themselves."];
    } else {
        const { data: spot } = await supabase
            .from("nyc_spots")
            .select("id, name, neighborhood, category, notes, image_url")
            .eq("id", requestedSpotId)
            .single();
        if (!spot) {
            return NextResponse.json({ error: "Spot not found." }, { status: 404 });
        }
        spotId = spot.id;
        image = spot.image_url ? await loadImage(spot.image_url) : null;
        subject = [
            `The place: ${spot.name} (${spot.neighborhood ?? "NYC"}, ${spot.category ?? "spot"}).`,
            `Details: ${spot.notes ?? "none"}.`,
            image ? "A photo of it is attached." : "",
        ];
    }

    const specificity = image
        ? "Study the image closely. Every caption must point to something specific you can actually see in it " +
        "(an object, a sign, a color, the weather, a pose, the setting), so it could only fit THIS photo, " +
        "not any photo of New York."
        : "Every caption must reference a specific detail about this place, so it could only fit this spot.";

    // This exact text is saved with every caption.
    const prompt = [
        "You write short, funny captions for photos.",
        "The audience is Columbia College students who are very online and still discovering New York City.",
        ...subject,
        context ? `What the student said about it: "${context}"` : "",
        "",
        specificity,
        "Never identify real people or comment on anyone's looks or body. Playful, never mean or offensive.",
        `Write in the voice of ${VIBES[vibe].voice}.`,
        "Write 3 different captions, each taking a different angle.",
        "Each under 20 words, no hashtags, no quotation marks, at most one emoji.",
        'Respond with only a JSON array of 3 strings, like ["...", "...", "..."].',
    ]
        .filter((line) => line !== "")
        .join("\n");

    const parts = [...(image ? [{ inlineData: image }] : []), { text: prompt }];

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": process.env.GEMINI_API_KEY!,
            },
            body: JSON.stringify({
                contents: [{ role: "user", parts }],
                generationConfig: {
                    temperature: 1.1,
                    maxOutputTokens: 2048,
                    responseMimeType: "application/json",
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
    const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? "")
        .join("");

    let raw: unknown[] = [];
    try {
        const parsed = JSON.parse(text);
        raw = Array.isArray(parsed) ? parsed : [];
    } catch {
        raw = text.split("\n");
    }
    const captions = raw
        .map((c) => String(c).trim().replace(/^["“]|["”]$/g, ""))
        .filter(Boolean)
        .slice(0, 3);

    if (captions.length === 0) {
        return NextResponse.json({ error: "The AI came back empty. Try again." }, { status: 502 });
    }

    // Save each caption as its own row so each can be voted on.
    const batchId = crypto.randomUUID();
    const { error } = await supabase.from("generations").insert(
        captions.map((caption) => ({
            spot_id: spotId,
            image_url: imageUrl,
            user_context: context || null,
            batch_id: batchId,
            vibe,
            prompt,
            caption,
            model: MODEL,
        }))
    );

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ count: captions.length });
}