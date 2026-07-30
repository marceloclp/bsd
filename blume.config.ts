import { defineConfig } from "blume";

export default defineConfig({
    title: "BSD",
    description:
        "Decode binary data with readable, composable TypeScript schemas.",
    logo: "/favicon.svg",
    content: {
        root: "docs",
    },
    github: {
        owner: "marceloclp",
        repo: "bsd",
        branch: "master",
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
