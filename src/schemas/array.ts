import {
    BsdType,
    type BsdAny,
    type BsdFor,
    type BsdInfer,
    type BsdNumber,
} from "../bsd";
import { asInternal } from "../common";
import type { BsdReader } from "../reader";

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

export function repeatWhile<S extends BsdAny>(schema: S, until: (value: BsdInfer<S>, reader: BsdReader) => boolean) {
    return BsdType.make((reader) => {
        const schemaInternal = asInternal(schema);

        const values: BsdInfer<S>[] = [];
        while (reader.byteOffset < reader.limit) {
            reader.path.push(values.length);

            const schemaOffset = reader.schemaOffset;
            const byteOffset = reader.byteOffset;

            const value = schemaInternal.read(reader);
            reader.path.pop();

            try {
                if (!until(value, reader)) {
                    // Undo:
                    reader.schemaOffset = schemaOffset;
                    reader.byteOffset = byteOffset;
                    break;
                }
            } catch {
                reader.schemaOffset = schemaOffset;
                reader.byteOffset = byteOffset;
            }
        }

        return values;
    });
}
