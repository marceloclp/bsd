# BSD

[Docs](https://bsd.marceloclp.sh/)

BSD (**Binary Schema Decoder**) is a type-safe, composable binary decoder for
TypeScript. Schemas consume a `Uint8Array` sequentially and return statically
inferred values.

BSD supports little-endian numbers, byte ranges, strings, arrays, structs,
unions, validation, transformations, and dynamic schema composition. It
decodes binary data; it does not encode it.

## Quick start

Install the package:

```sh
bun add @marceloclp/bsd
```

Alternatively:

```sh
npm install @marceloclp/bsd
```

Define a schema and decode a `Uint8Array`:

```ts
import { bytes, struct, u8, u16, type BsdInfer } from "@marceloclp/bsd";

const Profile = struct({
    version: u8().is(1),
    id: u16(),
    name: bytes(u8()).utf8(),
});

type Profile = BsdInfer<typeof Profile>;

const input = Uint8Array.of(
    1, // version
    42,
    0, // id: 42
    3, // name length
    65,
    100,
    97, // "Ada"
);

const profile: Profile = Profile.decode(input, { strict: true });
// { version: 1, id: 42, name: "Ada" }
```

Schemas consume fields in declaration order. `{ strict: true }` rejects
trailing bytes after the schema finishes.

## Contributing

Contributions are welcome. To work on BSD:

1. Fork the repository and clone your fork.
2. Install [Bun](https://bun.sh/) and run `bun install`.
3. Create a branch for your change.
4. Add or update tests.
5. Run the verification commands:

```sh
bun test
bun run typecheck
bun run lint
bun run build
```

For documentation changes, also run:

```sh
bun run docs:validate
bun run docs:build
```

Open a pull request describing the problem, the implementation, and any
behavioral or API changes. Keep changes focused and include failing regression
tests when fixing bugs.
