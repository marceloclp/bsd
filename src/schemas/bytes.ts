import type { BsdFor, BsdNumber } from "../bsd";
import { BsdType } from "../bsd-type";
import { BSD_LENGTH, BSD_READ } from "../constants";

/**
 * Creates a zero-copy subarray from the current buffer.
 *
 * ```typescript
 * // Returns a Uint8Array view of the next 32 bytes:
 * bytes(32);
 *
 * // Returns a Uint8Array copy of the next 32 bytes:
 * bytes(32).copy();
 *
 * // Returns a Uint8Array view of the next <n> bytes:
 * bytes(u32());
 *
 * // Returns the UTF-8 decoded string:
 * bytes(32).utf8();
 * ```
 */
export function bytes(
    byteLength: number | BsdNumber<number>,
): BsdFor<Uint8Array> {
    return BsdType.make((reader) => {
        let n: number;
        if (typeof byteLength === "number") {
            n = byteLength;
        } else {
            reader.path.push(BSD_LENGTH);
            n = byteLength[BSD_READ](reader);
            reader.path.pop();
        }

        return reader.bytes(n);
    });
}

/**
 * Returns a zero-copy subarray from the current buffer, with
 * the remaining, unread bytes.
 *
 * ```typescript
 * // Returns the remaining bytes after the first 4 bytes:
 * const Frame = padded(4, remaining());
 *
 * // Returns the frame between the first 4 and last 4 bytes:
 * const Offsetted = padded(4, remaining(-4));
 * ```
 */
export function remaining(offset = 0): BsdFor<Uint8Array> {
    return BsdType.make((reader) => {
        if (
            reader.byteOffset + offset > reader.remaining ||
            reader.byteOffset + offset < 0
        ) {
            throw reader.fail(`remaining(${offset}) out of bounds`);
        }
        return reader.bytes(reader.remaining + offset);
    });
}
