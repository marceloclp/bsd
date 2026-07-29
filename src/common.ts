import type { BsdAny, BsdInfer, BsdInternal, BsdNumber } from "./bsd";
import type { BsdReader } from "./reader";

export function toAscii(bytes: Uint8Array): string {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("latin1");
}

/** Converts bytes to same-valued Unicode code units. */
export function toLatin1(bytes: Uint8Array): string {
    return bytes.reduce((str, byte) => str + String.fromCharCode(byte), "");
}

const utf8 = new TextDecoder("utf-8", { fatal: true });

export function toUtf8(bytes: Uint8Array): string {
    return utf8.decode(bytes);
}

export function toUtf16le(bytes: Uint8Array): string {
    const units = new Uint16Array(bytes.length / 2);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < units.length; i++) {
        units[i] = view.getUint16(i * 2, true);
    }
    return units.reduce((str, v) => str + String.fromCharCode(v), "");
}

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

export function asInternal<S extends BsdAny>(
    schema: S,
): BsdInternal<BsdInfer<S>> {
    return schema as any;
}
