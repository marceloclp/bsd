import { describe, expect, it } from "bun:test";

import { BsdType } from "./bsd-type";
import {
    bslice,
    check,
    copy,
    eq,
    fixedLength,
    frame,
    gt,
    gte,
    inIter,
    lt,
    lte,
    maxLength,
    minLength,
    omit,
    pad,
    peek,
    pick,
    pipe,
    reserve,
    toAscii,
    toUtf16,
    toUtf8,
} from "./mods";
import { BsdIssue } from "./reader";
import { bytes } from "./schemas/bytes";
import { i8, u8, u16 } from "./schemas/number";
import { struct } from "./schemas/struct";

describe(peek, () => {
    it("restores the cursor to the schema offset", () => {
        const input = Uint8Array.of(0x34, 0x12);
        const schema = struct({
            first: u16().peek(),
            second: u16(),
        });
        const result = schema.decode(input);

        expect(result).toEqual({
            first: 0x1234,
            second: 0x1234,
        });
    });

    it("preserves the decoded value", () => {
        const input = Uint8Array.of(7);
        const schema = u8().peek();
        const result = schema.decode(input);

        expect(result).toBe(7);
    });

    it("leaves the input unconsumed during strict decoding", () => {
        const input = Uint8Array.of(7);
        const schema = u8().peek();

        expect(() => schema.decode(input, { strict: true })).toThrow(BsdIssue);
    });
});

describe(pad, () => {
    it("skips a fixed number of bytes after decoding", () => {
        const input = Uint8Array.of(1, 9, 9, 2);
        const schema = struct({
            first: u8().pad(2),
            second: u8(),
        });
        const result = schema.decode(input);

        expect(result).toEqual({
            first: 1,
            second: 2,
        });
    });

    it("computes padding from the decoded value and reader", () => {
        const input = Uint8Array.of(2, 9, 9, 7);
        let callbackOffset = -1;
        const schema = struct({
            first: u8().pad((value, reader) => {
                callbackOffset = reader.byteOffset;
                return value;
            }),
            second: u8(),
        });
        const result = schema.decode(input);

        expect(callbackOffset).toBe(1);
        expect(result).toEqual({
            first: 2,
            second: 7,
        });
    });

    it("throws when padding moves beyond the active limit", () => {
        const input = Uint8Array.of(1);
        const schema = u8().pad(1);

        expect(() => schema.decode(input)).toThrow(BsdIssue);
    });
});

describe(check, () => {
    it("accepts true", () => {
        const input = Uint8Array.of(7);
        const schema = u8().check(() => true);
        const result = schema.decode(input);

        expect(result).toBe(7);
    });

    it("accepts undefined", () => {
        const input = Uint8Array.of(7);
        const schema = u8().check(() => {});
        const result = schema.decode(input);

        expect(result).toBe(7);
    });

    it("throws BsdIssue when the callback returns false", () => {
        const input = Uint8Array.of(7);
        const schema = u8().check(() => false);

        expect(() => schema.decode(input)).toThrow(
            new BsdIssue(0, 1, [], "custom check failed"),
        );
    });

    it("supports contextual callback errors", () => {
        const input = Uint8Array.of(7);
        const schema = struct({
            value: u8().check((value, reader) => {
                throw reader.fail(`invalid value: ${value}`);
            }),
        });

        try {
            schema.decode(input);
            throw new Error("expected decoding to fail");
        } catch (error) {
            expect(error).toBeInstanceOf(BsdIssue);
            expect((error as BsdIssue).message).toBe("invalid value: 7");
            expect((error as BsdIssue).path).toEqual(["value"]);
        }
    });

    it("receives the decoded value and current reader", () => {
        const input = Uint8Array.of(7);
        let callbackValue = -1;
        let callbackOffset = -1;
        const schema = u8().check((value, reader) => {
            callbackValue = value;
            callbackOffset = reader.byteOffset;
        });

        schema.decode(input);

        expect(callbackValue).toBe(7);
        expect(callbackOffset).toBe(1);
    });
});

describe(minLength, () => {
    it("accepts schemas that consume at least the bound", () => {
        const schema = bytes(2).minLength(2);

        expect(schema.decode(Uint8Array.of(1, 2))).toEqual(Uint8Array.of(1, 2));
    });

    it("rejects schemas that consume less than the bound", () => {
        const schema = u8().minLength(2);

        expect(() => schema.decode(Uint8Array.of(1))).toThrow(BsdIssue);
    });
});

describe(maxLength, () => {
    it("accepts schemas that consume less than the bound", () => {
        const schema = u8().maxLength(2);

        expect(schema.decode(Uint8Array.of(1))).toBe(1);
    });

    it("rejects the bound because it is exclusive", () => {
        const schema = bytes(2).maxLength(2);

        expect(() => schema.decode(Uint8Array.of(1, 2))).toThrow(BsdIssue);
    });
});

describe(fixedLength, () => {
    it("accepts schemas that consume exactly the bound", () => {
        const schema = struct({ first: u8(), second: u8() }).fixedLength(2);

        expect(schema.decode(Uint8Array.of(1, 2))).toEqual({
            first: 1,
            second: 2,
        });
    });

    it("rejects schemas that consume a different number of bytes", () => {
        const schema = u8().fixedLength(2);

        expect(() => schema.decode(Uint8Array.of(1))).toThrow(BsdIssue);
    });

    it("measures from the start of a nested schema", () => {
        const schema = struct({
            prefix: u8(),
            value: u16().fixedLength(2),
        });

        expect(schema.decode(Uint8Array.of(9, 0x34, 0x12))).toEqual({
            prefix: 9,
            value: 0x1234,
        });
    });

    it("includes prior cursor modifiers in the consumed length", () => {
        const schema = u8().pad(1).fixedLength(2);

        expect(schema.decode(Uint8Array.of(1, 0))).toBe(1);
    });
});

describe(eq, () => {
    it("accepts a shallow-equal value", () => {
        const input = Uint8Array.of(2);
        const schema = u8().is(2);
        const result = schema.decode(input);

        expect(result).toBe(2);
    });

    it("rejects a different value", () => {
        const input = Uint8Array.of(2);
        const schema = u8().is(1);

        expect(() => schema.decode(input)).toThrow(BsdIssue);
    });
});

describe(inIter, () => {
    it("accepts an array member", () => {
        const input = Uint8Array.of(2);
        const schema = u8().in([1, 2]);
        const result = schema.decode(input);

        expect(result).toBe(2);
    });

    it("accepts a Set member", () => {
        const input = Uint8Array.of(2);
        const schema = u8().in(new Set([1, 2]));
        const result = schema.decode(input);

        expect(result).toBe(2);
    });

    it("accepts a Map key", () => {
        const input = Uint8Array.of(2);
        const schema = u8().in(
            new Map([
                [1, "one"],
                [2, "two"],
            ]),
        );
        const result = schema.decode(input);

        expect(result).toBe(2);
    });

    it("rejects a missing value", () => {
        const input = Uint8Array.of(3);
        const schema = u8().in(new Set([1, 2]));

        expect(() => schema.decode(input)).toThrow(BsdIssue);
    });
});

describe(BsdType.prototype.transform.bind(BsdType.prototype), () => {
    it("maps the decoded value", () => {
        const input = Uint8Array.of(7);
        const schema = u8().transform((value) => value * 2);
        const result = schema.decode(input);

        expect(result).toBe(14);
    });

    it("receives the current reader", () => {
        const input = Uint8Array.of(7);
        const schema = u8().transform((value, reader) => ({
            value,
            byteOffset: reader.byteOffset,
            schemaOffset: reader.schemaOffset,
        }));
        const result = schema.decode(input);

        expect(result).toEqual({
            value: 7,
            byteOffset: 1,
            schemaOffset: 0,
        });
    });

    it("routes transformed values to their type-specific modifiers", () => {
        const input = Uint8Array.of(65);
        const schema = u8()
            .transform((value) => Uint8Array.of(value))
            .ascii();
        const result = schema.decode(input);

        expect(result).toBe("A");
    });

    it("does not mutate the original schema", () => {
        const input = Uint8Array.of(7);
        const original = u8();
        const transformed = original.transform((value) => value * 2);

        expect(original.decode(input)).toBe(7);
        expect(transformed.decode(input)).toBe(14);
    });

    it("executes modifiers from left to right", () => {
        const input = Uint8Array.of(1);
        const schema = u8()
            .transform((value) => value + 1)
            .is(2)
            .transform((value) => value * 3);
        const result = schema.decode(input);

        expect(result).toBe(6);
    });
});

describe(pipe, () => {
    it("decodes a static schema after the source schema", () => {
        const input = Uint8Array.of(9, 0x34, 0x12);
        const schema = u8().pipe(u16());
        const result = schema.decode(input);

        expect(result).toBe(0x1234);
    });

    it("selects a schema from the decoded value", () => {
        const shortInput = Uint8Array.of(1, 7);
        const longInput = Uint8Array.of(2, 0x34, 0x12);
        const schema = u8().pipe((tag) => (tag === 1 ? u8() : u16()));

        expect(schema.decode(shortInput)).toBe(7);
        expect(schema.decode(longInput)).toBe(0x1234);
    });

    it("passes the current reader to the schema factory", () => {
        const input = Uint8Array.of(1, 7);
        let callbackOffset = -1;
        const schema = u8().pipe((_, reader) => {
            callbackOffset = reader.byteOffset;
            return u8();
        });
        const result = schema.decode(input);

        expect(callbackOffset).toBe(1);
        expect(result).toBe(7);
    });
});

describe(gt, () => {
    it("accepts values greater than the bound", () => {
        const input = Uint8Array.of(2);
        const schema = u8().gt(1);
        const result = schema.decode(input);

        expect(result).toBe(2);
    });

    it("rejects the bound", () => {
        const input = Uint8Array.of(1);
        const schema = u8().gt(1);

        expect(() => schema.decode(input)).toThrow(BsdIssue);
    });

    it("implements positive()", () => {
        const input = Uint8Array.of(1);
        const invalidInput = Uint8Array.of(0);
        const schema = u8().positive();
        const result = schema.decode(input);

        expect(result).toBe(1);
        expect(() => schema.decode(invalidInput)).toThrow(BsdIssue);
    });
});

describe(gte, () => {
    it("accepts the bound and rejects smaller values", () => {
        const input = Uint8Array.of(2);
        const invalidInput = Uint8Array.of(1);
        const schema = u8().gte(2);
        const result = schema.decode(input);

        expect(result).toBe(2);
        expect(() => schema.decode(invalidInput)).toThrow(BsdIssue);
    });
});

describe(lt, () => {
    it("accepts values less than the bound", () => {
        const input = Uint8Array.of(1);
        const schema = u8().lt(2);
        const result = schema.decode(input);

        expect(result).toBe(1);
    });

    it("rejects the bound", () => {
        const input = Uint8Array.of(2);
        const schema = u8().lt(2);

        expect(() => schema.decode(input)).toThrow(BsdIssue);
    });

    it("implements negative()", () => {
        const input = Uint8Array.of(0xff);
        const invalidInput = Uint8Array.of(0);
        const schema = i8().negative();
        const result = schema.decode(input);

        expect(result).toBe(-1);
        expect(() => schema.decode(invalidInput)).toThrow(BsdIssue);
    });
});

describe(lte, () => {
    it("accepts the bound and rejects greater values", () => {
        const input = Uint8Array.of(2);
        const invalidInput = Uint8Array.of(3);
        const schema = u8().lte(2);
        const result = schema.decode(input);

        expect(result).toBe(2);
        expect(() => schema.decode(invalidInput)).toThrow(BsdIssue);
    });
});

describe(frame, () => {
    it("decodes a static schema inside the byte frame", () => {
        const input = Uint8Array.of(0x34, 0x12);
        const schema = bytes(2).frame(u16());
        const result = schema.decode(input);

        expect(result).toBe(0x1234);
    });

    it("selects the framed schema from the bytes and outer reader", () => {
        const input = Uint8Array.of(0x34, 0x12);
        let callbackBytes: Uint8Array<ArrayBufferLike> = new Uint8Array();
        let callbackOffset = -1;
        const schema = bytes(2).frame((value, reader) => {
            callbackBytes = value;
            callbackOffset = reader.byteOffset;
            return u16();
        });
        const result = schema.decode(input);

        expect(callbackBytes).toEqual(input);
        expect(callbackOffset).toBe(2);
        expect(result).toBe(0x1234);
    });

    it("isolates nested reads from bytes outside the frame", () => {
        const input = Uint8Array.of(0x34, 0x12);
        const schema = bytes(1).frame(u16());

        expect(() => schema.decode(input)).toThrow(BsdIssue);
    });
});

describe(bslice, () => {
    it("returns a zero-copy subview", () => {
        const input = Uint8Array.of(1, 2, 3, 4);
        const schema = bytes(4).slice(1, 3);
        const result = schema.decode(input);

        expect(result).toEqual(Uint8Array.of(2, 3));
        expect(result.buffer).toBe(input.buffer);
    });
});

describe(copy, () => {
    it("returns an independent allocation", () => {
        const input = Uint8Array.of(1, 2);
        const schema = bytes(2).copy();
        const result = schema.decode(input);

        expect(result).toEqual(input);
        expect(result.buffer).not.toBe(input.buffer);

        result[0] = 9;
        expect(input[0]).toBe(1);
    });
});

describe(reserve, () => {
    it("returns undefined after consuming the bytes", () => {
        const input = Uint8Array.of(1, 2);
        const schema = bytes(2).reserved();
        const result = schema.decode(input, { strict: true });

        expect(result).toBeUndefined();
    });
});

describe(toAscii, () => {
    it("decodes ASCII bytes", () => {
        const input = Uint8Array.of(65, 66, 67);
        const schema = bytes(3).ascii();
        const result = schema.decode(input);

        expect(result).toBe("ABC");
    });
});

describe(toUtf8, () => {
    it("decodes UTF-8 bytes", () => {
        const input = new TextEncoder().encode("hello");
        const schema = bytes(input.byteLength).utf8();
        const result = schema.decode(input);

        expect(result).toBe("hello");
    });

    it("throws on malformed UTF-8", () => {
        const input = Uint8Array.of(0xc2);
        const schema = bytes(1).utf8();

        expect(() => schema.decode(input)).toThrow(TypeError);
    });
});

describe(toUtf16, () => {
    it("decodes UTF-16 bytes", () => {
        const input = Uint8Array.of(65, 0);
        const schema = bytes(2).utf16();
        const result = schema.decode(input);

        expect(result).toBe("A");
    });

    it("throws on malformed UTF-16", () => {
        const input = Uint8Array.of(65);
        const schema = bytes(1).utf16();

        expect(() => schema.decode(input)).toThrow(TypeError);
    });
});

describe(omit, () => {
    it("removes selected fields after decoding them", () => {
        const input = Uint8Array.of(1, 2, 3);
        const schema = struct({
            id: u8(),
            code: u8(),
            flags: u8(),
        }).omit({ code: true });
        const result = schema.decode(input, { strict: true });

        expect(result).toEqual({
            id: 1,
            flags: 3,
        });
    });
});

describe(pick, () => {
    it("retains selected fields after decoding all fields", () => {
        const input = Uint8Array.of(1, 2, 3);
        const schema = struct({
            id: u8(),
            code: u8(),
            flags: u8(),
        }).pick({ id: true, flags: true });
        const result = schema.decode(input, { strict: true });

        expect(result).toEqual({
            id: 1,
            flags: 3,
        });
    });
});
