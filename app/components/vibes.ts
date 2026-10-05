export const VIBES = {
    online: {
        label: "Chronically online",
        emoji: "📱",
        voice:
            "a chronically online Gen Z college student: internet slang, meme formats, deadpan irony, lowercase energy",
    },
    midwest: {
        label: "Midwest in the big city",
        emoji: "🌽",
        voice:
            "a friendly Midwesterner who just moved to NYC: wide-eyed, earnest, comparing everything to back home",
    },
    jaded: {
        label: "Jaded New Yorker",
        emoji: "🗽",
        voice:
            "a jaded lifelong New Yorker who has seen it all: dry, unimpressed, but secretly loves the city",
    },
    broke: {
        label: "Broke college student",
        emoji: "💸",
        voice:
            "a broke Columbia student on a dining-hall budget: obsessed with prices, deals, and free stuff",
    },
} as const;

export type VibeKey = keyof typeof VIBES;