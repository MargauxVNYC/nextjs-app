import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { VIBES, type VibeKey } from "../../components/vibes";

export const maxDuration = 60;

// Used only if the llm_models table is empty or unreadable.
const FALLBACK_MODELS = [
    process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
];

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
type Supabase = Awaited<ReturnType<typeof createClient>>;

class GeminiError extends Error {
    status: number;
    constructor(status: number) {
        super(`Gemini ${status}`);
        this.status = status;
    }
}

// Calls Gemini with retries + model fallback, logging EVERY attempt to llm_responses.
async function callGemini(
    supabase: Supabase,
    requestId: number,
    step: "safety_check" | "captions",
    models: string[],
    parts: Part[],
    config: Record<string, unknown>
) {
    let lastStatus = 503;
    for (const model of [...new Set(models)]) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            const started = Date.now();
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": process.env.GEMINI_API_KEY!,
                    },
                    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: config }),
                }
            );
            const latency = Date.now() - started;

            let text = "";
            let raw = "";
            if (res.ok) {
                const data = await res.json();
                text = (data.candidates?.[0]?.content?.parts ?? [])
                    .map((p: { text?: string }) => p.text ?? "")
                    .join("");
                raw = text;
            } else {
                raw = await res.text();
                console.error(`Gemini error (${model}, attempt ${attempt})`, res.status, raw);
            }

            await supabase.from("llm_responses").insert({
                request_id: requestId,
                step,
                model,
                status_code: res.status,
                latency_ms: latency,
                response_text: raw.slice(0, 4000),
            });

            if (res.ok) return { text, model };
            lastStatus = res.status;
            if (res.status === 404) break; // model not available: try the next one
            if (![429, 500, 503].includes(res.status)) throw new GeminiError(res.status);
            if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
    }
    throw new GeminiError(lastStatus);
}

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
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const body = await request.json().catch(() => null);
    const vibe = body?.vibe as VibeKey;
    const imagePath = typeof body?.imagePath === "string" ? body.imagePath : null;
    const requestedSpotId = Number(body?.spotId) || null;
    const context = typeof body?.context === "string" ? body.context.trim().slice(0, 200) : "";

    if (!vibe || !(vibe in VIBES)) return NextResponse.json({ error: "Pick a vibe." }, { status: 400 });
    if (!imagePath && !requestedSpotId) {
        return NextResponse.json({ error: "Add a photo or pick a spot." }, { status: 400 });
    }
    if (imagePath && !imagePath.startsWith(`${user.id}/`)) {
        return NextResponse.json({ error: "That photo isn't yours." }, { status: 403 });
    }

    // ---- Load the AI configuration managed in the admin area ----
    const [{ data: chain }, { data: modelRows }, { data: terms }, { data: examples }] = await Promise.all([
        supabase
            .from("prompt_chains")
            .select("id, prompt_chain_steps(step_order, instructions), prompt_chain_mix(is_enabled)")
            .eq("slug", vibe)
            .maybeSingle(),
        supabase.from("llm_models").select("api_model_id").eq("is_active", true).order("priority"),
        supabase.from("terms").select("term, definition").limit(30),
        supabase.from("generation_examples").select("scene, caption, chain_id").limit(30),
    ]);

    const mix = chain ? (Array.isArray(chain.prompt_chain_mix) ? chain.prompt_chain_mix[0] : chain.prompt_chain_mix) : null;
    if (mix && mix.is_enabled === false) {
        return NextResponse.json({ error: "That vibe is turned off right now. Pick another one." }, { status: 400 });
    }

    const steps = [...(chain?.prompt_chain_steps ?? [])].sort((a, b) => a.step_order - b.step_order);
    const chainInstructions = steps.length
        ? steps.map((s) => s.instructions)
        : [`Write in the voice of ${VIBES[vibe].voice}.`]; // fallback if no chain in the DB

    const models = modelRows?.length ? modelRows.map((m) => m.api_model_id) : FALLBACK_MODELS;
    const relevantExamples = (examples ?? [])
        .filter((e) => e.chain_id === null || e.chain_id === chain?.id)
        .slice(0, 6);

    // ---- Log the request ----
    const { data: req, error: reqError } = await supabase
        .from("generation_requests")
        .insert({ chain_id: chain?.id ?? null, spot_id: requestedSpotId, status: "pending" })
        .select("id")
        .single();
    if (reqError || !req) {
        return NextResponse.json({ error: reqError?.message ?? "Couldn't start the request." }, { status: 500 });
    }
    const requestId = req.id;
    const finish = (fields: Record<string, unknown>) =>
        supabase.from("generation_requests").update(fields).eq("id", requestId);

    try {
        let spotId: number | null = null;
        let imageUrl: string | null = null;
        let imageId: number | null = null;
        let image: { mimeType: string; data: string } | null = null;
        let subject: string[] = [];

        if (imagePath) {
            imageUrl = supabase.storage.from("uploads").getPublicUrl(imagePath).data.publicUrl;

            // Record the upload in the images table.
            const { data: imgRow } = await supabase
                .from("images")
                .insert({ url: imageUrl, storage_path: imagePath, description: context || null })
                .select("id")
                .single();
            imageId = imgRow?.id ?? null;
            await finish({ image_id: imageId });

            image = await loadImage(imageUrl);
            if (!image) {
                await finish({ status: "failed", error: "Couldn't read the uploaded photo." });
                return NextResponse.json({ error: "Couldn't read your photo. Try another one." }, { status: 400 });
            }

            // Step 1: safety check
            const checkPrompt = [
                "You are the content checker for NYC Spots, an app where college students post photos",
                "from around New York City and get funny AI captions that other students vote on.",
                "Decide whether this photo is OK to caption.",
                "ALLOW real photos of places, food, drinks, streets, buildings, parks, transit, shops,",
                "events, views, pets, or people out and about (selfies included).",
                "REJECT: nudity or sexual content; violence, gore, or threatening weapons; hateful symbols;",
                "drug use; screenshots, documents, IDs, or images that are mostly text; blank or unreadable",
                "images; images where a child is the main subject.",
                context ? `The student's note: "${context}"` : "",
                'Respond with only JSON: {"allowed": true or false, "reason": "one short friendly sentence if rejected, otherwise empty"}',
            ].join("\n");

            const check = await callGemini(
                supabase,
                requestId,
                "safety_check",
                [...models].reverse(), // lightest model first for the quick check
                [{ inlineData: image }, { text: checkPrompt }],
                { temperature: 0, maxOutputTokens: 1024, responseMimeType: "application/json" }
            );

            let allowed = false;
            let reason = "We couldn't check this photo. Please try again.";
            try {
                const verdict = JSON.parse(check.text);
                allowed = verdict.allowed === true;
                if (typeof verdict.reason === "string" && verdict.reason) reason = verdict.reason;
            } catch {}

            if (!allowed) {
                await supabase.storage.from("uploads").remove([imagePath]);
                if (imageId) await supabase.from("images").delete().eq("id", imageId);
                await finish({ status: "rejected", error: reason, image_id: null });
                return NextResponse.json({ error: `🚫 ${reason}`, rejected: true }, { status: 422 });
            }

            subject = ["The attached image is a photo a student took around New York City and uploaded themselves."];
        } else {
            const { data: spot } = await supabase
                .from("nyc_spots")
                .select("id, name, neighborhood, category, notes, image_url")
                .eq("id", requestedSpotId)
                .single();
            if (!spot) {
                await finish({ status: "failed", error: "Spot not found." });
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

        // ---- Step 2: build the prompt from the chain, terms, and examples ----
        const prompt = [
            "You write short, funny captions for photos.",
            "The audience is Columbia College students who are very online and still discovering New York City.",
            ...subject,
            context ? `What the student said about it: "${context}"` : "",
            "",
            image
                ? "Study the image closely. Every caption must point to something specific you can actually see in it, so it could only fit THIS photo."
                : "Every caption must reference a specific detail about this place.",
            "",
            ...chainInstructions,
            terms?.length
                ? "\nLocal terms you can use if they fit naturally:\n" +
                terms.map((t) => `- ${t.term}: ${t.definition}`).join("\n")
                : "",
            relevantExamples.length
                ? "\nExamples of the style we want:\n" +
                relevantExamples.map((e) => `Scene: ${e.scene} → Caption: ${e.caption}`).join("\n")
                : "",
            "",
            "Write 3 different captions, each taking a different angle.",
            'Respond with only a JSON array of 3 strings, like ["...", "...", "..."].',
        ]
            .filter((line) => line !== "")
            .join("\n");

        const parts: Part[] = [...(image ? [{ inlineData: image }] : []), { text: prompt }];
        const { text, model } = await callGemini(supabase, requestId, "captions", models, parts, {
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
            await finish({ status: "failed", error: "The AI returned no captions." });
            return NextResponse.json({ error: "The AI came back empty. Try again." }, { status: 502 });
        }

        const batchId = crypto.randomUUID();
        const { error } = await supabase.from("generations").insert(
            captions.map((caption) => ({
                spot_id: spotId,
                image_url: imageUrl,
                image_id: imageId,
                user_context: context || null,
                batch_id: batchId,
                vibe,
                prompt,
                caption,
                model,
            }))
        );
        if (error) {
            await finish({ status: "failed", error: error.message });
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        await finish({ status: "succeeded", batch_id: batchId });
        return NextResponse.json({ count: captions.length, batchId });
    } catch (e) {
        const message =
            e instanceof GeminiError
                ? e.status === 429
                    ? "The AI is getting a lot of requests. Wait a few seconds and try again."
                    : "Google's AI is overloaded right now. Give it a minute and try again."
                : "Something went wrong.";
        await finish({ status: "failed", error: e instanceof Error ? e.message : message });
        return NextResponse.json({ error: message }, { status: e instanceof GeminiError ? 503 : 500 });
    }
}