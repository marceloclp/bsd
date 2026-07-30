import type { BsdAny, BsdDecode, BsdFor, BsdInfer, BsdNumber } from "../bsd";
import { BsdType } from "../bsd-type";

/**
 * Use this when you need to create a completely custom schema,
 * with full control over the internals.
 *
 * You must ensure that the custom decoder correctly:
 * - Pushes the correct path, if applicable, before decoding
 * - Updates the reader's byte offset after decoding
 * - Removes the path part, if applicable, after decoding
 */
export function custom<T>(decoder: BsdDecode<T>): BsdFor<T> {
    return BsdType.make(decoder);
}

/**
 * Produces a value without consuming bytes. This is particularly useful when
 * defining a schema brand/type inside unions, as it allows for type-narrowing
 * when checking the output.
 *
 * ```typescript
 * const User = union(
 *     struct({ type: literal("user"), id: u16() }),
 *     struct({ type: literal("admin"), id: u8() }),
 * );
 *
 * switch (user.type) {
 *     case "admin":
 *         break;
 *     case "user":
 *         break;
 * }
 * ```
 */
export function literal<const T>(value: T): BsdFor<T> {
    return BsdType.make(() => value);
}

/**
 * Produces the current absolute reader cursor position without consuming bytes.
 * This is useful when you want to output the starting position of a schema for
 * debugging purposes.
 */
export function offset(): BsdNumber<number> {
    return BsdType.make((reader) => reader.byteOffset);
}

// /**
//  * Produces a dynamic two-step schema. The first step decodes a runtime-resolved
//  * value schema and uses its value to build the schema that consumes the
//  * following bytes. This is useful when decoding variable-length data.
//  *
//  * ```typescript
//  * // Variable-length utf16-le string prefixed by its length:
//  * const FixedString = eager(u32(), (n) => bytes(n * 2).ascii());
//  *
//  * // Rows where start & end offsets are unknown:
//  * const Row = eager(findStart, (start) => struct({}));
//  * ```;
//  */
// export function eager<T extends BsdAny, T1 extends BsdAny>(
//     value: T1 | ((reader: BsdReader) => T1),
//     fn1: (value: BsdInfer<T1>, reader: BsdReader) => T,
// ): BsdFor<BsdInfer<T>> {
//     return BsdType.make((reader) => {
//         let v: any =
//             typeof value === "function"
//                 ? asInternal(value(reader)).read(reader)
//                 : asInternal(value).read(reader);
//         return asInternal(fn1(v, reader)).read(reader);
//     });
// }

/**
 * Finds the offset BEFORE the first occurence of a value in the buffer that
 * satisfies the given predicate. This is useful when searching for the end
 * offset of a variable-length sequence (e.g., a null terminated string). This
 * schema does not consume the buffer.
 *
 * ```typescript
 * const Str = find(u16(), (v) => v < 0x20)
 *     .pipe((o, r) => bytes(o - r.byteOffset))
 *     .utf16()
 *     .padded(2);
 * ```
 */
export function find<S extends BsdAny>(
    schema: S,
    is: (value: BsdInfer<S>) => boolean,
) {
    return BsdType.make((reader) => {
        const byteOffset = reader.byteOffset;
        const schemaOffset = reader.schemaOffset;

        let position = byteOffset;
        const s = schema["~type"];

        while (true) {
            try {
                const v = s.read(reader);
                if (is(v)) {
                    break;
                } else {
                    position = reader.byteOffset;
                }
            } catch {
                break;
            }
        }

        reader.byteOffset = byteOffset;
        reader.schemaOffset = schemaOffset;

        return position;
    });
}

/**
 * Skips the first `n` bytes, as they represent padding between two values,
 * usually due to alignment or because one is variable-length.
 *
 * ```typescript
 * const Data = padded(4, u16());
 * ```
 */
export function padded<const S extends BsdAny>(
    byteLength: number,
    schema: S,
): BsdFor<S> {
    return BsdType.make((reader) => {
        reader.byteOffset += byteLength;
        return schema["~type"].read(reader) as BsdInfer<S>;
    });
}
