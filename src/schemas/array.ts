import type { BsdAny, BsdFor, BsdInfer, BsdNumber } from "../bsd";
import { BsdType } from "../bsd-type";
import { BSD_LENGTH, BSD_READ } from "../constants";

/**
 * Represents a fixed-length array. The length is the number of
 * elements in the array, not its final byte size.
 *
 * The length must be statically known, either as a hard-coded
 * value, or as an integer previous to the array itself.
 *
 * ```typescript
 * // An array with a static length:
 * array(5, u8());
 *
 * // An array with a static length and padding:
 * array(literal(5).pad(4), u8());
 *
 * // An array with a dynamic length:
 * array(u32(), u8());
 *
 * // An array with a dynamic length and padding:
 * array(u32().pad(4), u8());
 * ```
 *
 * @param count The number of elements in the array.
 * @param schema The schema of each element in the array.
 * @returns A schema that reads a fixed-length array of elements.
 */
export function array<const S extends BsdAny>(
    count: number | BsdNumber,
    schema: S,
): BsdFor<BsdInfer<S>[]> {
    return BsdType.make((reader) => {
        // The fixed length of the array:
        let n: number | bigint;
        if (typeof count === "number") {
            n = count;
        } else {
            reader.path.push(BSD_LENGTH);
            n = count[BSD_READ](reader);
            reader.path.pop();
        }

        const values: BsdInfer<S>[] = [];
        for (let i = 0; i < n; i++) {
            reader.path.push(i);
            values.push(schema[BSD_READ](reader));
            reader.path.pop();
        }

        return values;
    });
}

/**
 * Represents an array whose length can't be determined statically.
 * This will repeat the schema until the current frame ends.
 *
 * ```typescript
 * // A list of strings that consumes the remaining bytes:
 * repeat(bytes(4).ascii());
 *
 * // The same list, but this time contained inside a frame:
 * bytes(32).frame(repeat(bytes(4).ascii()));
 * ```
 */
export function repeat<S extends BsdAny>(schema: S): BsdFor<BsdInfer<S>[]> {
    return BsdType.make((reader) => {
        const values: BsdInfer<S>[] = [];
        while (reader.byteOffset < reader.limit) {
            reader.path.push(values.length);
            values.push(schema[BSD_READ](reader));
            reader.path.pop();
        }

        return values;
    });
}
