import { defineConfig } from "oxfmt";

export default defineConfig({
    printWidth: 80,
    semi: true,
    jsdoc: {
        bracketSpacing: false,
        capitalizeDescriptions: true,
        commentLineStrategy: "keep",
        descriptionTag: false,
        descriptionWithDot: false,
        lineWrappingStyle: "balance",
    },
    sortImports: true,
    tabWidth: 4,
});
