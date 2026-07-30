import { describe, expect, it } from "bun:test";

import { BsdIssue } from "../reader";
import {
    bool,
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
} from "./number";

describe.each([
    [u8, [0xab], 0xab],
    [u16, [0x34, 0x12], 0x1234],
    [u24, [0x56, 0x34, 0x12], 0x123456],
    [u32, [0x78, 0x56, 0x34, 0x12], 0x12345678],
    [u64, [8, 7, 6, 5, 4, 3, 2, 1], 0x0102030405060708n],
    [i8, [0xff], -1],
    [i16, [0xfe, 0xff], -2],
    [i24, [0xfd, 0xff, 0xff], -3],
    [i32, [0xfc, 0xff, 0xff, 0xff], -4],
    [i64, [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], -1n],
])("", (fn, input, expected) => {
    describe(fn.name, () => {
        it(`decodes correctly`, () => {
            expect(fn().decode(Uint8Array.from(input))).toBe(expected);
        });

        it("throws on out of bounds", () => {
            expect(() => fn().decode(Uint8Array.of())).toThrow(BsdIssue);
        });
    });
});

describe(f32, () => {
    it("decodes IEEE 754 floats", () => {
        const input = new Uint8Array(4);
        new DataView(input.buffer).setFloat32(0, 1.5, true);
        expect(f32().decode(input)).toBe(1.5);
    });
});

describe(f64, () => {
    it("decodes IEEE 754 floats", () => {
        const input = new Uint8Array(8);
        new DataView(input.buffer).setFloat64(0, Math.PI, true);
        expect(f64().decode(input)).toBe(Math.PI);
    });
});

describe(bool, () => {
    it("decodes a falsy byte (0)", () => {
        const input = Uint8Array.of(0);
        const result = bool().decode(input);
        expect(result).toBe(false);
    });

    it("decodes a truthy byte (1)", () => {
        const input = Uint8Array.of(1);
        const result = bool().decode(input);
        expect(result).toBe(true);
    });

    it("throws when the byte is not 0 or 1", () => {
        const input = Uint8Array.of(2);
        expect(() => bool().decode(input)).toThrow(BsdIssue);
    });
});
