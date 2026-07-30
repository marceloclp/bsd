import { describe, expect, it } from "bun:test";
import { BsdIssue } from "../reader";
import { bytes } from "./bytes";
import { literal } from "./common";
import { u8, u16 } from "./number";
import { struct } from "./struct";
import { union } from "./union";

describe(union, () => {
    it("returns the first matching branch", () => {
        const input = Uint8Array.of(1);
        const schema = union(u8().is(1), u8());
        const result = schema.decode(input);
        expect(result).toBe(1);
    });

    it("returns the second matching branch", () => {
        const input = Uint8Array.of(2);
        const schema = union(u8().is(1), u8());
        const result = schema.decode(input);
        expect(result).toBe(2);
    });

    it("restores the cursor before trying the next branch", () => {
        const schema = union(
            struct({ tag: u8().is(1), value: u16() }),
            struct({ tag: u8().is(2), value: u8() }),
        );

        const input = Uint8Array.of(2, 9);
        const result = schema.decode(input);

        expect(result).toEqual({ tag: 2, value: 9 });
    });

    it("supports discriminated object results", () => {
        const Long = struct({ type: literal("long"), value: u16() });
        const Short = struct({ type: literal("short"), value: u8() });

        const input = Uint8Array.of(0x34, 0x12);
        expect(union(Long, Short).decode(input)).toEqual({ type: "long", value: 0x1234 });
        expect(union(Short, Long).decode(input)).toEqual({ type: "short", value: 0x34 });
    });

    it("restores nested path state between branches", () => {
        const schema = struct({
            payload: union(
                struct({ tag: u8().is(1), body: bytes(2) }),
                struct({ tag: u8().is(2), body: bytes(1) }),
            ),
        });

        const input = Uint8Array.of(2, 9);
        const result = schema.decode(input);

        expect(result).toEqual({
            payload: { tag: 2, body: Uint8Array.of(9) },
        });
    });

    it("throws a contextual issue when every branch fails", () => {
        const schema = struct({
            value: union(u8().is(1), u8().is(2)),
        });

        try {
            schema.decode(Uint8Array.of(3));
            throw new Error("expected decoding to fail");
        } catch (error) {
            expect(error).toBeInstanceOf(BsdIssue);
            expect((error as BsdIssue).message).toBe(
                "union() failed to match any schema",
            );
            expect((error as BsdIssue).schemaOffset).toBe(0);
            expect((error as BsdIssue).byteOffset).toBe(0);
            expect((error as BsdIssue).path).toEqual(["value"]);
        }
    });
});
