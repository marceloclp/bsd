import type { BsdFor } from "../bsd";
import { BsdType } from "../bsd-type";
import type { BsdReader } from "../reader";

const _u8 = (reader: BsdReader) => reader.uint(8);
const _u16 = (reader: BsdReader) => reader.uint(16);
const _u24 = (reader: BsdReader) => reader.uint(24);
const _u32 = (reader: BsdReader) => reader.uint(32);
const _u64 = (reader: BsdReader) => reader.biguint(64);
const _i8 = (reader: BsdReader) => reader.int(8);
const _i16 = (reader: BsdReader) => reader.int(16);
const _i24 = (reader: BsdReader) => reader.int(24);
const _i32 = (reader: BsdReader) => reader.int(32);
const _i64 = (reader: BsdReader) => reader.bigint(64);
const _f32 = (reader: BsdReader) => reader.float(32);
const _f64 = (reader: BsdReader) => reader.float(64);
const _bool = (reader: BsdReader) => reader.bool();

export function u8(): BsdFor<number> {
    return BsdType.make(_u8);
}

export function u16(): BsdFor<number> {
    return BsdType.make(_u16);
}

export function u24(): BsdFor<number> {
    return BsdType.make(_u24);
}

export function u32(): BsdFor<number> {
    return BsdType.make(_u32);
}

export function u64(): BsdFor<bigint> {
    return BsdType.make(_u64);
}

export function i8(): BsdFor<number> {
    return BsdType.make(_i8);
}

export function i16(): BsdFor<number> {
    return BsdType.make(_i16);
}

export function i24(): BsdFor<number> {
    return BsdType.make(_i24);
}

export function i32(): BsdFor<number> {
    return BsdType.make(_i32);
}

export function i64(): BsdFor<bigint> {
    return BsdType.make(_i64);
}

export function f32(): BsdFor<number> {
    return BsdType.make(_f32);
}

export function f64(): BsdFor<number> {
    return BsdType.make(_f64);
}

export function bool(): BsdFor<boolean> {
    return BsdType.make(_bool);
}
