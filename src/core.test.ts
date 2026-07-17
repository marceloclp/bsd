import { describe, expect, test } from "bun:test";
import { Zed } from "./core";
import { ZedError } from "./error";
import type {
    ZedArray,
    ZedBytes,
    ZedInferNext,
    ZedNumber,
    ZedString,
    ZedStruct,
} from "./zed";

function numberSchema(): ZedNumber {
    return new Zed(reader => reader.uint(8)) as ZedNumber;
}

function bytesSchema(length: number): ZedBytes {
    return new Zed(reader => {
        const start = reader.offset;
        const end = start + length;
        if (end > reader.length) reader.addIssue("bytes() out of bounds");
        reader.offset = end;
        return reader.buffer.subarray(start, end);
    }) as ZedBytes;
}

describe(Zed, () => {
    test("routes transformed values to their specialized API", () => {
        const schema = numberSchema()
            .transform(value => Uint8Array.of(value))
            .ascii();

        expect(schema.decode(Uint8Array.of(65))).toBe("A");
    });

    test("accepts checks that return void and rejects false", () => {
        expect(numberSchema().check(() => {}).decode(Uint8Array.of(1))).toBe(1);
        expect(() => numberSchema().check(() => false).decode(Uint8Array.of(1)))
            .toThrow(ZedError);
    });

    test("positive requires a value greater than zero", () => {
        expect(numberSchema().positive().decode(Uint8Array.of(1))).toBe(1);
        expect(() => numberSchema().positive().decode(Uint8Array.of(0)))
            .toThrow(ZedError);
    });

    test("pick retains only selected struct fields", () => {
        const schema = new Zed(reader => ({
            id: reader.uint(8),
            code: reader.uint(8),
        })) as ZedStruct<{ id: number; code: number }>;

        expect(schema.pick({ id: true }).decode(Uint8Array.of(1, 2)))
            .toEqual({ id: 1 });
    });

    test("rejects invalid skip lengths", () => {
        expect(() => numberSchema().skip(0.5).decode(Uint8Array.of(1, 2)))
            .toThrow(ZedError);
    });

    test("decodes bytes using byte-specific methods", () => {
        expect(bytesSchema(2).utf8().decode(Uint8Array.of(0xc2, 0xa3))).toBe("£");
    });
});

function assertSpecializedApi(
    number: ZedInferNext<number>,
    bytes: ZedInferNext<Uint8Array>,
    string: ZedInferNext<string>,
    struct: ZedInferNext<{ id: number; code: string }>,
    array: ZedInferNext<number[]>,
): void {
    number.gt(0);
    // @ts-expect-error Number schemas do not expose byte methods.
    number.ascii();

    bytes.ascii();
    // @ts-expect-error Byte schemas do not expose number methods.
    bytes.gt(0);

    string.transform(value => value.length);
    // @ts-expect-error String schemas do not expose struct methods.
    string.pick({});

    const picked = struct.pick({ id: true });
    const decoded: { id: number } = picked.decode(Uint8Array.of());
    void decoded;

    array.transform(values => values.length);
    // @ts-expect-error Array schemas do not expose struct methods.
    array.omit({});
}

void assertSpecializedApi;

const _numberType: ZedNumber = null as unknown as ZedInferNext<number>;
const _bytesType: ZedBytes = null as unknown as ZedInferNext<Uint8Array>;
const _stringType: ZedString = null as unknown as ZedInferNext<string>;
const _structType: ZedStruct<{ id: number }> = null as unknown as ZedInferNext<{ id: number }>;
const _arrayType: ZedArray<number> = null as unknown as ZedInferNext<number[]>;
void [_numberType, _bytesType, _stringType, _structType, _arrayType];
