import { BsdType, type Bsd, type BsdNumber } from "../bsd";
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

export function u8(): BsdNumber<number> {
    return new BsdType(_u8) as unknown as BsdNumber<number>;
}

export function u16(): BsdNumber<number> {
    return new BsdType(_u16) as unknown as BsdNumber<number>;
}

export function u24(): BsdNumber<number> {
    return new BsdType(_u24) as unknown as BsdNumber<number>;
}

export function u32(): BsdNumber<number> {
    return new BsdType(_u32) as unknown as BsdNumber<number>;
}

export function u64(): BsdNumber<bigint> {
    return new BsdType(_u64) as unknown as BsdNumber<bigint>;
}

export function i8(): BsdNumber<number> {
    return new BsdType(_i8) as unknown as BsdNumber<number>;
}

export function i16(): BsdNumber<number> {
    return new BsdType(_i16) as unknown as BsdNumber<number>;
}

export function i24(): BsdNumber<number> {
    return new BsdType(_i24) as unknown as BsdNumber<number>;
}

export function i32(): BsdNumber<number> {
    return new BsdType(_i32) as unknown as BsdNumber<number>;
}

export function i64(): BsdNumber<bigint> {
    return new BsdType(_i64) as unknown as BsdNumber<bigint>;
}

export function f32(): BsdNumber<number> {
    return new BsdType(_f32) as unknown as BsdNumber<number>;
}

export function f64(): BsdNumber<number> {
    return new BsdType(_f64) as unknown as BsdNumber<number>;
}

export function bool(): Bsd<boolean> {
    return new BsdType(_bool);
}
