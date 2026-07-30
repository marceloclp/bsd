import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const workspace = await mkdtemp(join(tmpdir(), "bsd-package-"));

async function run(command: string[], cwd = root) {
    const process = Bun.spawn(command, {
        cwd,
        stdout: "inherit",
        stderr: "inherit",
    });
    const exitCode = await process.exited;

    if (exitCode !== 0) {
        throw new Error(`${command.join(" ")} exited with code ${exitCode}`);
    }
}

try {
    await run([
        "bun",
        "pm",
        "pack",
        "--ignore-scripts",
        "--filename",
        join(workspace, "bsd.tgz"),
        "--quiet",
    ]);

    await Bun.write(
        join(workspace, "package.json"),
        JSON.stringify({
            private: true,
            type: "module",
            dependencies: {
                "@marceloclp/bsd": "file:./bsd.tgz",
            },
        }),
    );
    await run(["bun", "install", "--ignore-scripts"], workspace);

    await Bun.write(
        join(workspace, "runtime.mjs"),
        `
import { bytes, struct, u16 } from "@marceloclp/bsd";

const schema = struct({
    id: u16(),
    code: bytes(2).ascii(),
});
const result = schema.decode(Uint8Array.of(0x34, 0x12, 66, 83));

if (result.id !== 0x1234 || result.code !== "BS") {
    throw new Error("package runtime smoke test failed");
}
`,
    );
    await Bun.write(
        join(workspace, "types.ts"),
        `
import {
    bytes,
    struct,
    u16,
    type BsdInfer,
} from "@marceloclp/bsd";

const schema = struct({
    id: u16(),
    code: bytes(2).ascii(),
});
type Result = BsdInfer<typeof schema>;

const result: Result = schema.decode(Uint8Array.of(0x34, 0x12, 66, 83));
const id: number = result.id;
const code: string = result.code;
void [id, code];
`,
    );

    await run(["bun", "run", "./runtime.mjs"], workspace);
    await run(["node", "./runtime.mjs"], workspace);
    await run(
        [
            "node",
            join(root, "node_modules", "typescript", "bin", "tsc"),
            "--noEmit",
            "--strict",
            "--skipLibCheck",
            "--target",
            "ESNext",
            "--module",
            "NodeNext",
            "--moduleResolution",
            "NodeNext",
            "./types.ts",
        ],
        workspace,
    );
} finally {
    await rm(workspace, { recursive: true, force: true });
}
