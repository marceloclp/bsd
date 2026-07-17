import { Zed } from "./core";
import { ZedError } from "./error";
import type { ZedReader } from "./reader";
import type {
    ZedAny,
    ZedArray,
    ZedInfer,
    ZedInferNext,
    ZedNumber,
    ZedUnwrap,
} from "./zed";

export function u8(): ZedNumber<number> {
    return new Zed((reader) => reader.uint(8)) as ZedNumber<number>;
}

export function u16(): ZedNumber<number> {
    return new Zed((reader) => reader.uint(16)) as ZedNumber<number>;
}

export function u24(): ZedNumber<number> {
    return new Zed((reader) => reader.uint(24)) as ZedNumber<number>;
}

export function u32(): ZedNumber<number> {
    return new Zed((reader) => reader.uint(32)) as ZedNumber<number>;
}

export function u64(): ZedNumber<bigint> {
    return new Zed((reader) => reader.biguint(64)) as ZedNumber<bigint>;
}

export function i8(): ZedNumber<number> {
    return new Zed((reader) => reader.int(8)) as ZedNumber<number>;
}

export function i16(): ZedNumber<number> {
    return new Zed((reader) => reader.int(16)) as ZedNumber<number>;
}

export function i24(): ZedNumber<number> {
    return new Zed((reader) => reader.int(24)) as ZedNumber<number>;
}

export function i32(): ZedNumber<number> {
    return new Zed((reader) => reader.int(32)) as ZedNumber<number>;
}

export function i64(): ZedNumber<bigint> {
    return new Zed((reader) => reader.bigint(64)) as ZedNumber<bigint>;
}

/** Decodes a little-endian IEEE-754 32-bit float. */
export function f32(): ZedNumber<number> {
    return new Zed((reader) => reader.float(32)) as ZedNumber<number>;
}

/** Decodes a little-endian IEEE-754 64-bit float. */
export function f64(): ZedNumber<number> {
    return new Zed((reader) => reader.float(64)) as ZedNumber<number>;
}

/**
 * Decodes the same schema `n` times, where `n` is either a static
 * value (a number or bigint), or a dynamic `ZedNumber`.
 *
 * ```typescript
 * // Use static values when you know the length of the array in advance:
 * zed.array(32, zed.u8());
 *
 * // Use dynamic values when the length preceeds the array data:
 * zed.array(zed.u8(), zed.u8());
 *
 * // Use skip() when there is metadata or reserved space between
 * // the length of the array and the array data:
 * zed.array(zed.u8().skip(4), zed.u8());
 * ```
 */
export function array<T extends ZedAny>(
    /** The number of elements to decode. */
    n: ZedNumber | number | bigint,
    /** The schema of each element in the array. */
    type: T,
): ZedArray<ZedInfer<T>> {
    return new Zed((reader) => {
        const length =
            typeof n === "number" || typeof n === "bigint"
                ? n
                : decodeLength(reader, n);

        let i = length;
        const array: any[] = [];
        while (i > 0) {
            reader.path.push((length as number) - (i as number));

            // We do not need to handle error here because we
            // want it to propagate up:
            array.push((type as unknown as Zed).decodeInternal(reader));

            reader.path.pop();
            i--;
        }

        return array;
    });
}

function decodeLength(reader: ZedReader, n: ZedNumber): number | bigint {
    // We need to push the path key so a potential error reports
    // the correct location that failed decoding:
    reader.path.push("_dlength");

    // We do not need to handle error here because we want
    // it to propagate up:
    const result = (n as unknown as Zed).decodeInternal(reader);

    reader.path.pop();
    return result;
}

/**
 * Decodes a runtime-resolved value schema and uses its decoded
 * value to build the schema that consumes the following bytes.
 *
 * The controlling value is consumed but omitted from the returned
 * output. The first argument may be a schema directly or a resolver
 * that receives the active reader and chooses a schema from
 * non-consuming lookahead.
 *
 * @example
 * ```typescript
 * // Dynamic-length string, where the length is encoded
 * // before the start of the string:
 * zed.eager(zed.u32(), (n) => zed.bytes(n * 2).utf16le());
 * ```
 */
export function eager<T1 extends ZedAny, T2 extends ZedAny>(
    value: T1 | ((reader: ZedReader) => T1),
    type: (value: ZedInfer<T1>, reader: ZedReader) => T2,
): ZedInferNext<ZedInfer<T2>> {
    return new Zed((reader) => {
        const vType = typeof value === "function" ? value(reader) : value;
        const v = (vType as unknown as Zed).decodeInternal(reader);

        const result = (type(v, reader) as unknown as Zed).decodeInternal(
            reader,
        );

        return result;
    }) as any;
}

export function remaining() {}
