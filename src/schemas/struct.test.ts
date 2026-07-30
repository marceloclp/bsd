import { describe, expect, it } from "bun:test";
import { BsdIssue } from "../reader";
import { array } from "./array";
import { bytes } from "./bytes";
import { u8, u16 } from "./number";
import { struct } from "./struct";

describe(struct, () => {
    it("decodes fields in declaration order", () => {
        const schema = struct({
            version: u8(),
            id: u16(),
            name: bytes(3).ascii(),
        });

        const input = Uint8Array.of(2, 0x34, 0x12, 65, 66, 67);
        const result = schema.decode(input);

        expect(result).toEqual({
            version: 2,
            id: 0x1234,
            name: "ABC",
        });
    });

    it("decodes an empty struct", () => {
        const input = Uint8Array.of();
        const result = struct({}).decode(input);
        expect(result).toEqual({});
    });

    it("decodes nested structs", () => {
        const schema = struct({
            header: struct({ version: u8(), count: u8() }),
            values: array(2, u16()),
        });

        const input = Uint8Array.of(1, 2, 10, 0, 20, 0);
        const result = schema.decode(input);

        expect(result).toEqual({
            header: { version: 1, count: 2 },
            values: [10, 20],
        });
    });

    it("throws with the complete nested failure path", () => {
        const input = Uint8Array.of(1, 99);
        const schema = struct({
            rows: array(2, struct({ value: u8().lte(10) })),
        });

        try {
            schema.decode(input);
            throw new Error("expected decoding to fail");
        } catch (error) {
            expect(error).toBeInstanceOf(BsdIssue);
            expect((error as BsdIssue).path).toEqual(["rows", 1, "value"]);
        }
    });

    it(".pick() retains selected fields", () => {
        const schema = struct({
            id: u8(),
            code: u8(),
            flags: u8(),
        }).pick({ id: true, flags: true });

        const input = Uint8Array.of(1, 2, 3);
        const result = schema.decode(input);

        expect(result).toEqual({ id: 1, flags: 3 });
    });

    it(".omit() removes selected fields", () => {
        const schema = struct({
            magic: bytes(2).ascii(),
            id: u8(),
        }).omit({ magic: true });

        const input = Uint8Array.of(66, 83, 7);
        const result = schema.decode(input);

        expect(result).toEqual({ id: 7 });
    });
});
