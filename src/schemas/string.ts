import { BsdType, type Bsd } from "../bsd";
import type { BsdReader } from "../reader";

const _cstring = (reader: BsdReader) => {
    const buffer = reader.buffer;
    const start = reader.byteOffset;

    let end = start;
    while (end < buffer.length && buffer[end] !== 0) {
        end++;
    }

    reader.byteOffset = Math.min(end + 1, reader.limit);

    return Buffer.from(buffer.subarray(start, end)).toString("utf8");
};

/** Reads a null-terminated UTF-8 string from a byte buffer. */
export function cstring(): Bsd<string> {
    return BsdType.make(_cstring);
}
