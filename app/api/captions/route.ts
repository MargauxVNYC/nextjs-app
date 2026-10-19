import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { VIBES, type VibeKey } from "../../components/vibes";

export const maxDuration = 60; // allow time for retries

const PRIMARY = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
// If one model is overloaded, try the next.
const CAPTION_MODELS = [...new Set([PRIMARY, "gemini-flash-latest", "gemini-3.1-flash-lite"])];
// The safety check uses a fast, lightweight model first.
const CHECK_MODELS = [...new Set(["gemini-3.1-flash-lite", "gemini-flash-lite-latest", PRIMARY])];

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

class GeminiError extends Error {
    status: number;
    constructor(status: number) {
        super(`Gemini ${status}`);
        this.status = status;
    }
}

// Call Gemini with retries (for overload errors) and model fallbacks.
async function callGemini(models: string[], parts: Part[], config: Record<string, unknown>) {
    let lastStatus = 503;
    for (const model of models) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": process.env.GEMINI_API_KEY!,
                    },
                    body: JSON.stringify({
                        contents: [{ role: "user", parts }],
                        generationConfig: config,
                    }),
                }
            );

            if (res.ok) {
                const data = await res.json();
                const text = (data.candidates?.[0]?.content?.parts ?? [])
                    .map((p: { text?: string }) => p.text ?? "")
                    .join("");
                return { text, model };
            }

            lastStatus = res.status;
            console.error(`Gemini error (${model}, attempt ${attempt})`, res.status, await res.text());

            if (res.status === 404) break; // model not available on this key: try the next one
            if (![429, 500, 503].includes(res.status)) throw new GeminiError(res.status);
            if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
    }
    throw new GeminiError(lastStatus);
}

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

// AI safeguard: is this photo appropriate and relevant for the app?
async function checkPhoto(image: { mimeType: string; data: string }, context: string) {
    const prompt = [
        "You are the content checker for NYC Spots, an app where college students post photos",
        "from around New York City and get funny AI captions that other students vote on.",
        "Decide whether this photo is OK to caption.",
        "",
        "ALLOW real photos of places, food, drinks, streets, buildings, parks, transit, shops,",
        "events, views, pets, or people out and about (selfies included), in NYC or any city setting.",
        "",
        "REJECT: nudity or sexual content; violence, gore, or threatening weapons; hateful symbols;",
        "drug use; screenshots, documents, IDs, or images that are mostly text; blank, black, or",
        "unreadable images; images where a child is the main subject.",
        context ? `\nThe student's note about the photo: "${context}"` : "",
        "",
        'Respond with only JSON: {"allowed": true or false, "reason": "if rejected, one short,',
        'friendly sentence to the student explaining why; otherwise an empty string"}',
    ].join("\n");

    const { text } = await callGemini(
        CHECK_MODELS,
        [{ inlineData: image }, { text: prompt }],
        { temperature: 0, maxOutputTokens: 1024, responseMimeType: "application/json" }
    );

    try {
        const verdict = JSON.parse(text);
        return {
            allowed: verdict.allowed === true,
            reason:
                typeof verdict.reason === "string" && verdict.reason
                    ? verdict.reason
                    : "This photo doesn't fit NYC Spots. Try a photo of a place, food, or something from your day.",
        };
    } catch {
        // If the check itself is unclear, fail safe.
        return { allowed: false, reason: "We couldn't check this photo. Please try again." };
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
    const context = typeof body?.context === "string" ? body.context.trim().slice(0, 200) : "";

    if (!vibe || !(vibe in VIBES)) {
        return NextResponse.json({ error: "Pick a vibe." }, { status: 400 });
    }
    if (!imagePath && !requestedSpotId) {
        return NextResponse.json({ error: "Add a photo or pick a spot." }, { status: 400 });
    }

    try {
        let spotId: number | null = null;
        let imageUrl: string | null = null;
        let image: { mimeType: string; data: string } | null = null;
        let subject: string[] = [];

        if (imagePath) {
            if (!imagePath.startsWith(`${user.id}/`)) {
                return NextResponse.json({ error: "That photo isn't yours." }, { status: 403 });
            }
            imageUrl = supabase.storage.from("uploads").getPublicUrl(imagePath).data.publicUrl;
            image = await loadImage(imageUrl);
            if (!image) {
                return NextResponse.json({ error: "Couldn't read your photo. Try another one." }, { status: 400 });
            }

            // Step 1: safeguard check before any captioning.
            const verdict = await checkPhoto(image, context);
            if (!verdict.allowed) {
                await supabase.storage.from("uploads").remove([imagePath]); // don't keep rejected photos
                return NextResponse.json({ error: `🚫 ${verdict.reason}`, rejected: true }, { status: 422 });
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

        // Step 2: generate the captions.
        const parts: Part[] = [...(image ? [{ inlineData: image }] : []), { text: prompt }];
        const { text, model } = await callGemini(CAPTION_MODELS, parts, {
            temperature: 1.1,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
        });

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
                model, // whichever model actually answered
            }))
        );

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ count: captions.length, batchId });
    } catch (e) {
        if (e instanceof GeminiError) {
            const message =
                e.status === 429
                    ? "The AI is getting a lot of requests. Wait a few seconds and try again."
                    : "Google's AI is overloaded right now. Give it a minute and try again.";
            return NextResponse.json({ error: message }, { status: 503 });
        }
        throw e;
    }
}