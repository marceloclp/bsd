# Eke

Eke is a type-safe, composable binary decoder for TypeScript. It provides
little-endian numeric schemas, dynamic arrays, runtime-resolved schemas,
validation, and typed transformations.

The library is under active development and is not published to a package
registry yet.

## Development

Install dependencies and run the test suite with Bun:

```bash
bun install
bun test
```

Run the reader benchmark with:

```bash
bun run bench:reader
```

## Documentation

The documentation site is powered by [Blume](https://useblume.dev/docs).
The project scripts force Blume to run with Bun, so they do not use a separately
installed Node.js runtime.

```bash
# Start the local documentation server
bun run docs:dev

# Check content and configuration
bun run docs:check
bun run docs:validate

# Create and preview a production build
bun run docs:build
bun run docs:preview
```

The generated site is written to `dist/`.
