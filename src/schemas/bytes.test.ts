import { describe, expect, it } from "bun:test";
import { BsdIssue } from "../reader";
import { bytes, remaining } from "./bytes";
import { u8, u16 } from "./number";
import { padded } from "./common";
import { BSD_LENGTH } from "../constants";

describe(bytes, () => {
    it("decodes a fixed-length zero-copy range", () => {
        const input = Uint8Array.of(1, 2, 3);
        const result = bytes(2).decode(input);

        expect(result).toEqual(Uint8Array.of(1, 2));
        expect(result.buffer).toBe(input.buffer);
        result[0] = 9;
        expect(input[0]).toBe(9);
    });

    it("decodes a schema-backed length prefix", () => {
        const input = Uint8Array.of(2, 10, 20);
        const result = bytes(u8()).decode(input);
        expect(result).toEqual(Uint8Array.of(10, 20));
    });

    it("attributes length-prefix failures to _length", () => {
        const input = Uint8Array.of(1);
        try {
            bytes(u16()).decode(input);
            throw new Error("expected decoding to fail");
        } catch (error) {
            expect(error).toBeInstanceOf(BsdIssue);
            expect((error as BsdIssue).path).toEqual([BSD_LENGTH]);
        }
    });

    it("supports zero-copy slicing and explicit copying", () => {
        const input = Uint8Array.of(1, 2, 3, 4);
        const sliced = bytes(4).slice(1, 3).decode(input);
        const copied = bytes(4).copy().decode(input);

        expect(sliced).toEqual(Uint8Array.of(2, 3));
        expect(sliced.buffer).toBe(input.buffer);
        expect(copied).toEqual(input);
        expect(copied.buffer).not.toBe(input.buffer);
    });

    it("reserved bytes are consumed but omitted", () => {
        const input = Uint8Array.of(1, 2, 3);
        const schema = bytes(2).reserved();
        expect(schema.decode(input)).toBeUndefined();
        expect(() => schema.decode(input, { strict: true })).toThrow(BsdIssue);
    });

    it("decodes ASCII text", () => {
        const input = Uint8Array.of(65, 66, 67);
        const result = bytes(3).ascii().decode(input);
        expect(result).toBe("ABC");
    });

    it("decodes UTF-8 text", () => {
        const input = Uint8Array.of(0xc2, 0xa3);
        const result = bytes(2).utf8().decode(input);
        expect(result).toBe("£");
    });

    it("decodes UTF-16 text", () => {
        const input = Uint8Array.of(0x41, 0);
        const result = bytes(2).utf16().decode(input);
        expect(result).toBe("A");
    });

    it("throws when decoding UTF-8 malformed text", () => {
        const input = Uint8Array.of(0xc2);
        const schema = bytes(1).utf8();
        expect(() => schema.decode(input)).toThrow(TypeError);
    });

    it("throws when decoding UTF-16 malformed text", () => {
        const input = Uint8Array.of(0x41);
        const schema = bytes(1).utf16();
        expect(() => schema.decode(input)).toThrow(TypeError);
    });

    it("frames isolate nested decoding", () => {
        const input = Uint8Array.of(0x34, 0x12);
        const result = bytes(2).frame(u16()).decode(input);
        expect(result).toBe(0x1234);
    });

    it("throws when frame isolate fails decoding", () => {
        const input = Uint8Array.of(0x34);
        const schema = bytes(1).frame(u16());
        expect(() => schema.decode(input)).toThrow(BsdIssue);
    });
});

describe(remaining, () => {
    it("conumes the active range", () => {
        const input = Uint8Array.of(1, 2, 3);
        const decoded = remaining().decode(input);
        expect(decoded).toEqual(Uint8Array.of(1, 2, 3));
    });

    it("consumes the frame range", () => {
        const input = Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
        const decoded = padded(2, bytes(4)).frame(remaining()).decode(input);
        expect(decoded).toEqual(Uint8Array.of(3, 4, 5, 6));
    });

    it("throws an out of bounds when the offset exceeds the remaining bytes", () => {
        const input = Uint8Array.of(1);
        expect(() => remaining(-2).decode(input)).toThrow(BsdIssue);
        expect(() => remaining(2).decode(input)).toThrow(BsdIssue);
    });
});
