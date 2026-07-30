import { describe, expect, it } from "bun:test";

import { BSD_LENGTH } from "../constants";
import { BsdIssue } from "../reader";
import { array, repeat } from "./array";
import { bytes } from "./bytes";
import { u8, u16 } from "./number";

describe(array, () => {
    it("decodes an empty array", () => {
        const input = Uint8Array.of();
        const result = array(0, u16()).decode(input);
        expect(result).toEqual([]);
    });

    it("decodes a fixed element count array", () => {
        const input = Uint8Array.of(1, 2, 3);
        const result = array(3, u8()).decode(input);
        expect(result).toEqual([1, 2, 3]);
    });

    it("decodes and omits a schema-backed count", () => {
        const input = Uint8Array.of(2, 1, 0, 2, 0);
        const result = array(u8(), u16()).decode(input);
        expect(result).toEqual([1, 2]);
    });

    it("attributes count-schema failures to the array length", () => {
        const input = Uint8Array.of(1);
        const schema = array(u16(), u8());

        try {
            schema.decode(input);
            throw new Error("expected decoding to fail");
        } catch (error) {
            expect(error).toBeInstanceOf(BsdIssue);
            expect((error as BsdIssue).path).toEqual([BSD_LENGTH]);
        }
    });

    it("composes nested arrays", () => {
        const input = Uint8Array.of(1, 2, 3, 4);
        const result = array(2, array(2, u8())).decode(input);
        expect(result).toEqual([
            [1, 2],
            [3, 4],
        ]);
    });

    it("records the failing element index", () => {
        const input = Uint8Array.of(1, 99, 3);
        const schema = array(3, u8().lte(10));
        try {
            schema.decode(input);
            throw new Error("expected decoding to fail");
        } catch (error) {
            expect(error).toBeInstanceOf(BsdIssue);
            expect((error as BsdIssue).path).toEqual([1]);
        }
    });
});

describe(repeat, () => {
    it("consumes elements to the active limit of the frame root", () => {
        const input = Uint8Array.of(1, 0, 2, 0);
        const result = repeat(u16()).decode(input);
        expect(result).toEqual([1, 2]);
    });

    it("consumes elements to the active limit of a frame view", () => {
        const input = Uint8Array.of(1, 0, 2, 0);
        const result = bytes(3).frame(repeat(u8())).decode(input);
        expect(result).toEqual([1, 0, 2]);
    });

    it("records the failing element index", () => {
        const input = Uint8Array.of(1, 99);
        const schema = repeat(u8().lte(10));
        try {
            schema.decode(input);
            throw new Error("expected decoding to fail");
        } catch (error) {
            expect(error).toBeInstanceOf(BsdIssue);
            expect((error as BsdIssue).path).toEqual([1]);
        }
    });
});
