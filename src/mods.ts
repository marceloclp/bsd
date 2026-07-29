import type { BsdAny, BsdCheck, BsdInfer, BsdMod } from "./bsd";
import type { BsdReader } from "./reader";

export function reserve() {}

export function peek<T>(value: T, reader: BsdReader): T {
    reader.byteOffset = reader.schemaOffset;
    return value;
}

export function copy(value: Uint8Array): Uint8Array {
    return new Uint8Array(value);
}

export function pad<T>(bytes: number | BsdMod<T, number>) {
    return (value: T, reader: BsdReader): T => {
        reader.byteOffset +=
            typeof bytes === "function" ? bytes(value, reader) : bytes;
        return value;
    };
}

export function check<T>(fn: BsdCheck<T>) {
    return (value: T, reader: BsdReader): T => {
        if (fn(value, reader) === false) {
            throw reader.fail("custom check failed");
        }
        return value;
    };
}

export function inIter<T, const U extends T>(
    values: Array<U> | Set<U> | Map<U, any>,
) {
    return (value: T, reader: BsdReader): U => {
        if (Array.isArray(values)) {
            if (values.includes(value as U)) {
                return value as U;
            }
            throw reader.fail(`expected one of ${values}, got ${value}`);
        } else if (values instanceof Set) {
            if (values.has(value as U)) {
                return value as U;
            }
            throw reader.fail(
                `expected one of ${values.keys().toArray()}, got ${value}`,
            );
        } else if (values instanceof Map) {
            if (values.has(value as U)) {
                return value as U;
            }
            throw reader.fail(
                `expected one of ${values.keys().toArray()}, got ${value}`,
            );
        }
        return value as U;
    };
}

export function pipe<T, const U extends BsdAny>(pipe: U | BsdMod<T, U>) {
    return (value: T, reader: BsdReader): BsdInfer<U> => {
        const next = typeof pipe === "function" ? pipe(value, reader) : pipe;
        return next["~type"].read(reader);
    };
}

export function gt<T extends number | bigint>(expected: number | bigint) {
    return (value: T, reader: BsdReader): T => {
        if (value > expected) {
            return value;
        }
        throw reader.fail(`expected ${value} to be greater than ${expected}`);
    };
}

export function gte<T extends number | bigint>(expected: number | bigint) {
    return (value: T, reader: BsdReader): T => {
        if (value >= expected) {
            return value;
        }
        throw reader.fail(
            `expected ${value} to be greater than or equal to ${expected}`,
        );
    };
}

export function lt<T extends number | bigint>(expected: number | bigint) {
    return (value: T, reader: BsdReader): T => {
        if (value < expected) {
            return value;
        }
        throw reader.fail(`expected ${value} to be less than ${expected}`);
    };
}

export function lte<T extends number | bigint>(expected: number | bigint) {
    return (value: T, reader: BsdReader): T => {
        if (value <= expected) {
            return value;
        }
        throw reader.fail(
            `expected ${value} to be less than or equal to ${expected}`,
        );
    };
}

export function eq<T>(expected: T) {
    return (value: T, reader: BsdReader): T => {
        if (value === expected) {
            return value;
        }
        throw reader.fail(`expected ${value} to be equal to ${expected}`);
    };
}

export function frame<const U extends BsdAny>(
    schema: U | BsdMod<Uint8Array, U>,
) {
    return (value: Uint8Array, reader: BsdReader): BsdInfer<U> => {
        const next =
            typeof schema === "function" ? schema(value, reader) : schema;
        return next["~type"].decode(value);
    };
}

export function bslice(start?: number, end?: number) {
    return (value: Uint8Array): Uint8Array => {
        return value.subarray(start, end);
    };
}

const utf8 = new TextDecoder("utf-8", { fatal: true });
const utf16 = new TextDecoder("utf-16", { fatal: true });

export function toUtf8(value: Uint8Array): string {
    return utf8.decode(value);
}

export function toUtf16(value: Uint8Array): string {
    return utf16.decode(value);
}

export function toAscii(b: Uint8Array): string {
    return Buffer.from(b.buffer, b.byteOffset, b.byteLength).toString("ascii");
}

export function omit(mask: Record<string, true>) {
    return (value: Record<string, any>) => {
        for (const k in mask) {
            delete value[k];
        }
        return value;
    };
}

export function pick(mask: Record<string, true>) {
    return (value: Record<string, any>) => {
        for (const k in value) {
            if (!(k in mask)) {
                delete value[k];
            }
        }
        return value;
    };
}
