import { defineConfig } from "blume";

export default defineConfig({
    title: "Eke",
    description: "Type-safe, composable binary decoding for TypeScript.",
    content: {
        root: "docs",
    },
    theme: {
        accent: "teal",
        radius: "md",
        mode: "system",
    },
    search: {
        provider: "orama",
    },
    markdown: {
        imageZoom: true,
        code: {
            icons: true,
            wrap: false,
        },
    },
    ai: {
        llmsTxt: true,
    },
});
