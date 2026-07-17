import { describe, expect, test } from "bun:test";
import { ZedError } from "./error";
import {
    f32,
    f64,
    i8,
    i16,
    i24,
    i32,
    i64,
    u8,
    u16,
    u24,
    u32,
    u64,
} from "./types";

describe("numeric types", () => {
    test.each([
        ["u8", u8, [0xab], 0xab],
        ["u16", u16, [0x34, 0x12], 0x1234],
        ["u24", u24, [0x56, 0x34, 0x12], 0x123456],
        ["u32", u32, [0x78, 0x56, 0x34, 0x12], 0x12345678],
        ["i8", i8, [0xff], -1],
        ["i16", i16, [0xfe, 0xff], -2],
        ["i24", i24, [0xfd, 0xff, 0xff], -3],
        ["i32", i32, [0xfc, 0xff, 0xff, 0xff], -4],
    ] as const)("decodes %s", (_name, schema, bytes, expected) => {
        expect(schema().decode(Uint8Array.from(bytes))).toBe(expected);
    });

    test("decodes unsigned and signed 64-bit integers", () => {
        expect(u64().decode(Uint8Array.from([
            0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01,
        ]))).toBe(0x0102030405060708n);
        expect(i64().decode(Uint8Array.from([
            0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        ]))).toBe(-2n);
    });

    test("decodes both floating-point widths", () => {
        const float32 = new Uint8Array(4);
        new DataView(float32.buffer).setFloat32(0, 1.5, true);
        expect(f32().decode(float32)).toBe(1.5);

        const float64 = new Uint8Array(8);
        new DataView(float64.buffer).setFloat64(0, Math.PI, true);
        expect(f64().decode(float64)).toBe(Math.PI);
    });

    test("supports bigint-specific comparisons", () => {
        const two = Uint8Array.of(2, 0, 0, 0, 0, 0, 0, 0);
        expect(u64().gt(1n).decode(two)).toBe(2n);

        const zero = new Uint8Array(8);
        expect(() => u64().positive().decode(zero)).toThrow(ZedError);
    });

    test("skips bigint values and bigint schema results", () => {
        expect(u8().skip(1n).decode(Uint8Array.of(7, 0xff))).toBe(7);

        const dynamic = Uint8Array.of(
            7,
            1, 0, 0, 0, 0, 0, 0, 0,
            0xff,
        );
        expect(u8().skip(u64()).decode(dynamic)).toBe(7);

        expect(() => u8().skip(-1n).decode(Uint8Array.of(7))).toThrow(ZedError);
        expect(() => u8().skip(2n ** 64n).decode(Uint8Array.of(7)))
            .toThrow(ZedError);
    });
});

function assertNumericApis(): void {
    u8().gt(1);
    // @ts-expect-error Number schemas reject bigint comparisons.
    u8().gt(1n);

    u64().gt(1n);
    // @ts-expect-error Bigint schemas reject number comparisons.
    u64().gt(1);

    u64().transform(value => value + 1n).gte(2n);
    u8().transform(value => value + 1).gte(2);

    u8().skip(1n);
    u8().skip(u64());
}

void assertNumericApis;
