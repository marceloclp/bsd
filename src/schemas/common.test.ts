import { describe, expect, it } from "bun:test";

import { BsdIssue } from "../reader";
import { bytes } from "./bytes";
import { custom, find, literal, offset, padded } from "./common";
import { u8, u16 } from "./number";
import { struct } from "./struct";

describe(custom, () => {
    it("delegates decoding to its callback", () => {
        const schema = custom((reader) => ({
            start: reader.byteOffset,
            value: reader.uint(16),
            end: reader.byteOffset,
        }));

        const input = Uint8Array.of(0x34, 0x12);
        const result = schema.decode(input);

        expect(result).toEqual({
            start: 0,
            value: 0x1234,
            end: 2,
        });
    });

    it("custom() can create a contextual issue", () => {
        const input = Uint8Array.of();
        const schema = struct({
            value: custom((reader) => {
                throw reader.fail("invalid custom value");
            }),
        });

        try {
            schema.decode(input);
            throw new Error("expected decoding to fail");
        } catch (error) {
            expect(error).toBeInstanceOf(BsdIssue);
            expect((error as BsdIssue).message).toBe("invalid custom value");
            expect((error as BsdIssue).path).toEqual(["value"]);
        }
    });
});

describe(literal, () => {
    it("emits a value without consuming input", () => {
        const input = Uint8Array.of(1);
        const schema = literal("record");
        expect(schema.decode(input)).toBe("record");
        expect(() => schema.decode(input, { strict: true })).toThrow(BsdIssue);
    });
});

describe(offset, () => {
    it("emits the absolute cursor without consuming input", () => {
        const input = Uint8Array.of(1, 0x34, 0x12);
        const schema = struct({
            first: u8(),
            startsAt: offset(),
            second: u16(),
        });
        const result = schema.decode(input);

        expect(result).toEqual({
            first: 1,
            startsAt: 1,
            second: 0x1234,
        });
    });
});

describe(find, () => {
    it("returns the offset before the first match", () => {
        const input = Uint8Array.of(10, 20, 0);
        const schema = find(u8(), (v) => v === 0);
        const result = schema.decode(input);
        expect(result).toBe(2);
    });

    it("restores the cursor after scanning", () => {
        const input = Uint8Array.of(10, 20, 0);
        const schema = struct({
            end: find(u8(), (v) => v === 0),
            first: u8(),
        });
        const result = schema.decode(input);
        expect(result).toEqual({ end: 2, first: 10 });
    });

    it("returns the end offset when no value matches", () => {
        const input = Uint8Array.of(10, 20);
        const result = find(u8(), (v) => v === 0).decode(input);
        expect(result).toBe(2);
    });

    it("propagates predicate errors", () => {
        class PredicateError extends Error {}

        const input = Uint8Array.of(1, 2);
        const schema = find(u8(), () => {
            throw new PredicateError();
        });

        expect(() => schema.decode(input)).toThrow(new PredicateError());
    });
});

describe(padded, () => {
    it("skips bytes before decoding", () => {
        const input = Uint8Array.of(9, 9, 0x34, 0x12);
        const result = padded(2, u16()).decode(input);
        expect(result).toBe(0x1234);
    });

    it("composes inside a struct", () => {
        const schema = struct({
            tag: u8(),
            value: padded(1, bytes(2)),
        });

        const input = Uint8Array.of(1, 0, 10, 20);
        const result = schema.decode(input);

        expect(result).toEqual({
            tag: 1,
            value: Uint8Array.of(10, 20),
        });
    });

    it("padded() reports reads beyond the input as BsdIssue", () => {
        const input = Uint8Array.of(1);
        const schema = padded(2, u8());
        expect(() => schema.decode(input)).toThrow(BsdIssue);
    });
});
