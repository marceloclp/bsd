import type { BsdFor, BsdNumber } from "../bsd";
import { BsdType } from "../bsd-type";

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
export function bytes(byteLength: number | BsdNumber): BsdFor<Uint8Array> {
    return BsdType.make((reader) => {
        let n: number;
        if (typeof byteLength === "number") {
            n = byteLength;
        } else {
            reader.path.push("_length");
            n = byteLength["~type"].read(reader);
            reader.path.pop();
        }

        return reader.bytes(n);
    });
}

/**
 * Returns a zero-copy subarray from the current buffer, with
 * the remaining, un-read bytes. Optionally, a number of trailing
 * bytes can be specified to exclude from the result.
 */
export function remaining(trailingBytes = 0): BsdFor<Uint8Array> {
    return BsdType.make((reader) =>
        reader.bytes(reader.remaining - trailingBytes),
    );
}
