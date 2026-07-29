import {
    BsdType,
    type BsdAny,
    type BsdFor,
    type BsdInfer,
    type BsdNumber,
} from "../bsd";
import { asInternal } from "../common";

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
        const schemaInternal = asInternal(schema);

        const arrayLength =
            typeof count === "number" ? count : asInternal(count).read(reader);

        const values: BsdInfer<S>[] = [];
        for (let i = 0; i < arrayLength; i++) {
            reader.path.push(i);
            values.push(schemaInternal.read(reader));
            reader.path.pop();
        }

        return values;
    });
}

export function repeat<S extends BsdAny>(schema: S): BsdFor<BsdInfer<S>[]> {
    return BsdType.make((reader) => {
        const schemaInternal = asInternal(schema);

        const values: BsdInfer<S>[] = [];
        while (reader.byteOffset < reader.limit) {
            reader.path.push(values.length);
            values.push(schemaInternal.read(reader));
            reader.path.pop();
        }

        return values;
    });
}

// export function repeatWhile<S extends BsdAny>(
//     schema: S,
//     until: (value: BsdInfer<S>, reader: BsdReader) => boolean,
// ) {
//     return BsdType.make((reader) => {
//         const schemaInternal = asInternal(schema);

//         const values: BsdInfer<S>[] = [];
//         while (reader.byteOffset < reader.limit) {
//             reader.path.push(values.length);

//             const schemaOffset = reader.schemaOffset;
//             const byteOffset = reader.byteOffset;

//             const value = schemaInternal.read(reader);
//             reader.path.pop();

//             try {
//                 if (!until(value, reader)) {
//                     // Undo:
//                     reader.schemaOffset = schemaOffset;
//                     reader.byteOffset = byteOffset;
//                     break;
//                 }
//             } catch {
//                 reader.schemaOffset = schemaOffset;
//                 reader.byteOffset = byteOffset;
//             }
//         }

//         return values;
//     });
// }
