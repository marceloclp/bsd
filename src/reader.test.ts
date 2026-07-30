import { describe, expect, test } from "bun:test";

import { BsdIssue, BsdReader } from "./reader";

describe(BsdReader, () => {
    test("initializes state from the exact Uint8Array range", () => {
        const backing = Uint8Array.of(0xff, 0x34, 0x12, 0xff);
        const input = backing.subarray(1, 3);
        const reader = new BsdReader(input);

        expect(reader.buffer).toBe(input);
        expect(reader.view.byteOffset).toBe(input.byteOffset);
        expect(reader.view.byteLength).toBe(2);
        expect(reader.limit).toBe(2);
        expect(reader.byteOffset).toBe(0);
        expect(reader.schemaOffset).toBe(0);
        expect(reader.remaining).toBe(2);
        expect(reader.path).toEqual([]);
        expect(reader.uint(16)).toBe(0x1234);
    });

    test.each([
        [8, [0xab], 0xab],
        [16, [0x34, 0x12], 0x1234],
        [24, [0x56, 0x34, 0x12], 0x123456],
        [32, [0x78, 0x56, 0x34, 0x12], 0x12345678],
    ] as const)("reads little-endian u%i", (bits, input, expected) => {
        const reader = new BsdReader(Uint8Array.from(input));

        expect(reader.uint(bits)).toBe(expected);
        expect(reader.byteOffset).toBe(bits / 8);
        expect(reader.remaining).toBe(0);
    });

    test.each([
        [8, [0xff], -1],
        [16, [0xfe, 0xff], -2],
        [24, [0xfd, 0xff, 0xff], -3],
        [32, [0xfc, 0xff, 0xff, 0xff], -4],
    ] as const)("reads little-endian i%i", (bits, input, expected) => {
        const reader = new BsdReader(Uint8Array.from(input));

        expect(reader.int(bits)).toBe(expected);
        expect(reader.byteOffset).toBe(bits / 8);
    });

    test("reads signed and unsigned 64-bit integers", () => {
        const unsigned = Uint8Array.of(8, 7, 6, 5, 4, 3, 2, 1);
        expect(new BsdReader(unsigned).biguint(64)).toBe(0x0102030405060708n);

        const signed = new Uint8Array(8);
        new DataView(signed.buffer).setBigInt64(0, -123456789n, true);
        expect(new BsdReader(signed).bigint(64)).toBe(-123456789n);
    });

    test("reads little-endian 32-bit and 64-bit floats", () => {
        const float32 = new Uint8Array(4);
        new DataView(float32.buffer).setFloat32(0, 1.5, true);
        expect(new BsdReader(float32).float(32)).toBe(1.5);

        const float64 = new Uint8Array(8);
        new DataView(float64.buffer).setFloat64(0, Math.PI, true);
        expect(new BsdReader(float64).float(64)).toBe(Math.PI);
    });

    test("supports non-advancing primitive reads", () => {
        const cases: Array<{
            input: Uint8Array;
            read: (reader: BsdReader, advance: boolean) => unknown;
            expected: unknown;
            byteLength: number;
        }> = [
            {
                input: Uint8Array.of(0x34, 0x12),
                read: (reader, advance) => reader.uint(16, advance),
                expected: 0x1234,
                byteLength: 2,
            },
            {
                input: Uint8Array.of(0xfe, 0xff),
                read: (reader, advance) => reader.int(16, advance),
                expected: -2,
                byteLength: 2,
            },
            {
                input: Uint8Array.of(1, 0, 0, 0, 0, 0, 0, 0),
                read: (reader, advance) => reader.biguint(64, advance),
                expected: 1n,
                byteLength: 8,
            },
            {
                input: Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 0x80),
                read: (reader, advance) => reader.bigint(64, advance),
                expected: -0x8000000000000000n,
                byteLength: 8,
            },
            {
                input: Uint8Array.of(0, 0, 0xc0, 0x3f),
                read: (reader, advance) => reader.float(32, advance),
                expected: 1.5,
                byteLength: 4,
            },
            {
                input: Uint8Array.of(1),
                read: (reader, advance) => reader.bool(advance),
                expected: true,
                byteLength: 1,
            },
            {
                input: Uint8Array.of(1, 2),
                read: (reader, advance) => reader.bytes(2, advance),
                expected: Uint8Array.of(1, 2),
                byteLength: 2,
            },
        ];

        for (const { input, read, expected, byteLength } of cases) {
            const reader = new BsdReader(input);

            expect(read(reader, false)).toEqual(expected);
            expect(reader.byteOffset).toBe(0);
            expect(reader.remaining).toBe(input.byteLength);

            expect(read(reader, true)).toEqual(expected);
            expect(reader.byteOffset).toBe(byteLength);
        }
    });

    test("decodes Boolean flags and rejects other byte values", () => {
        expect(new BsdReader(Uint8Array.of(0)).bool()).toBe(false);
        expect(new BsdReader(Uint8Array.of(1)).bool()).toBe(true);

        const reader = new BsdReader(Uint8Array.of(2));
        expect(() => reader.bool()).toThrow(
            new BsdIssue(0, 1, [], "bool() expected 0 or 1, got 2"),
        );
    });

    test("returns a zero-copy byte range", () => {
        const input = Uint8Array.of(1, 2, 3);
        const reader = new BsdReader(input);
        const empty = reader.bytes(0);

        expect(empty).toEqual(new Uint8Array());
        expect(reader.byteOffset).toBe(0);

        const result = reader.bytes(2);
        expect(result).toEqual(Uint8Array.of(1, 2));
        expect(result.buffer).toBe(input.buffer);
        expect(reader.byteOffset).toBe(2);
        expect(reader.remaining).toBe(1);

        result[0] = 9;
        expect(input[0]).toBe(9);
    });

    test.each([
        ["uint", (reader: BsdReader) => reader.uint(8)],
        ["int", (reader: BsdReader) => reader.int(8)],
        ["biguint", (reader: BsdReader) => reader.biguint(64)],
        ["bigint", (reader: BsdReader) => reader.bigint(64)],
        ["float", (reader: BsdReader) => reader.float(32)],
        ["bool", (reader: BsdReader) => reader.bool()],
        ["bytes", (reader: BsdReader) => reader.bytes(1)],
    ])("%s rejects an out-of-bounds read", (_, read) => {
        const reader = new BsdReader(new Uint8Array());

        expect(() => read(reader)).toThrow(BsdIssue);
        expect(reader.byteOffset).toBe(0);
    });

    test("fail() creates an issue from the current reader context", () => {
        const reader = new BsdReader(Uint8Array.of(1, 2, 3));
        reader.schemaOffset = 1;
        reader.byteOffset = 2;
        reader.path.push("rows", 4, Symbol.for("value"));

        const issue = reader.fail("invalid value");

        expect(issue).toBeInstanceOf(Error);
        expect(issue).toBeInstanceOf(BsdIssue);
        expect(issue.name).toBe("BsdIssue");
        expect(issue.message).toBe("invalid value");
        expect(issue.schemaOffset).toBe(1);
        expect(issue.byteOffset).toBe(2);
        expect(issue.path).toEqual(["rows", 4, Symbol.for("value")]);
    });

    test("remaining tracks manual cursor movement", () => {
        const reader = new BsdReader(Uint8Array.of(1, 2, 3));

        reader.byteOffset = 2;
        expect(reader.remaining).toBe(1);
    });
});
