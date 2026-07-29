import {
    BsdType,
    type Bsd,
    type BsdBytes,
    type BsdInternal,
    type BsdNumber,
} from "../bsd";
import type { BsdReader } from "../reader";

/**
 * Helper utility for resolving a dynamic byte length, which automatically
 * pushes a reserved `_length` keyword to the reader's path.
 */
export function resolveLength(length: number | BsdNumber, reader: BsdReader) {
    if (typeof length === "number") {
        return length;
    }

    try {
        reader.path.push("_length");
        const schema = length as unknown as BsdInternal<number>;
        return schema.read(reader);
    } finally {
        reader.path.pop();
    }
}

export function bytes(byteLength: number | BsdNumber): BsdBytes {
    return new BsdType((reader) => {
        const length = resolveLength(byteLength, reader);
        return reader.bytes(length);
    }) as unknown as BsdBytes;
}

const _remaining = (reader: BsdReader) => reader.bytes(reader.remaining);

export function remaining(_trailingBytes = 0): BsdBytes {
    return new BsdType(_remaining) as unknown as BsdBytes;
}

export function reserved(byteLength: number): Bsd<void> {
    return new BsdType((reader) => {
        // Ee only want to advance the reader here:
        reader.bytes(byteLength);
    });
}
