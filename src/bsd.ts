import { asInternal, toAscii, toLatin1, toUtf16le, toUtf8 } from "./common";
import { BsdIssue, BsdReader } from "./reader";

export type BsdCheck<T> = (value: T, reader: BsdReader) => boolean | void;

export type BsdTransform<T, R> = (value: T, reader: BsdReader) => R;

/** A custom schema decoder. */
export type BsdDecoder<T> = (reader: BsdReader) => T;

/** Any schema accepted by Eke combinators. */
export type BsdAny = Bsd<any> | BsdBytes | BsdNumber | BsdStruct;

export type BsdShape = Record<string, any>;

/** Returns the richest safe schema interface for a decoded value type. */
export type BsdFor<T> = [T] extends [number | bigint]
    ? BsdNumber<Extract<T, number | bigint>>
    : [T] extends [Uint8Array]
      ? BsdBytes
      : Bsd<T>;

/** Resolves a Bsd type to its inferred output type. */
export type BsdInfer<S extends BsdAny> = S extends Bsd<infer T> ? T : never;

/** Common immutable fluent API implemeted by every binary schema decoder. */
export interface Bsd<T> {
    /**
     * Decodes the complete input (all bytes).
     *
     * @returns {T} When the schema is successfully decoded.
     * @throws {DecodeError} When the schema is not satisfied.
     * @throws {DecodeError} When there are trailling bytes.
     */
    decode(input: Uint8Array): T;

    tee(fn: (value: T, reader: BsdReader) => void): Bsd<T>;

    pad(byteLength: number): BsdFor<T>;
    pad(fn: (value: T, reader: BsdReader) => number): BsdFor<T>;

    /**
     * Creates a new `Bsd<T>` instance where decoding the schema will not
     * advance the internal reader.
     *
     * @example
     *     ```typescript
     *   const Message = bsd.struct({
     *     // Decode the message bytes using latin1:
     *     ascii: bsd.bytes(24).latin1().skip(),
     *     // Decode the same message bytes again, this time using utf8:
     *     utf8: bsd.bytes(24).utf8(),
     *   });
     *   ```;
     */
    peek(): Bsd<T>;

    /**
     * Creates a new `Bsd<T>` schema that skips a fixed number of bytes after
     * decoding. This is useful when you want to skip padding bytes.
     *
     * @example
     *     ```typescript
     *   const Item = bsd.struct({
     *     // Decodes the item id, then skips 4 bytes of padding:
     *     id: bsd.u32().skip(4),
     *     // Grade is at +8 bytes:
     *     grade: bsd.u8(),
     *   });
     *   ```;
     */
    skip(
        byteLength: number | BsdNumber | ((reader: BsdReader) => BsdNumber),
    ): Bsd<T>;

    advance(fn: (value: T, reader: BsdReader) => number): Bsd<T>;

    /**
     * Creates a new `Bsd<T>` schema which performs a check (a validation step).
     * If the check returns `false`, the schema is rejected and a `DecodeError`
     * is thrown. Returning `void` or `undefined` is equivalent to `true`.
     */
    check(check: BsdCheck<T>): Bsd<T>;

    /**
     * Performs shallow equality and narrows the output to the literal value
     * `U`. This is syntax sugar for `check()`.
     */
    is<const U extends T>(expected: U): BsdFor<U>;

    /**
     * Checks if the decoded value is one of the provided values. Any iterable
     * is supported. If you are checking against very long list of items, it's
     * best to use a `Set` or `Map` for constant lookup.
     *
     * @example
     *     ```typescript
     *   const Item = bsd.struct({
     *     // Using an array:
     *     type: bsd.u32().in([0, 1, 2, 3]),
     *     // Using a set:
     *     type: bsd.u32().in(new Set([0, 1, 2, 3])),
     *   });
     *   ```;
     */
    in<const U extends T>(values: Array<U> | Set<U> | Map<U, any>): BsdFor<U>;

    /**
     * Maps the decoded value to another output type.
     *
     * @example
     *     ```typescript
     *     const Item = struct({
     *         // Decodes the name as a UTF-8 string:
     *         name: bytes(32).transform(toUtf8),
     *     });
     *     ```;
     */
    transform<R>(transform: BsdTransform<T, R>): BsdFor<R>;

    pipe<const R extends BsdAny>(transform: BsdTransform<T, R> | R): R;
}

export interface BsdNumber<
    T extends number | bigint = number | bigint,
> extends Bsd<T> {
    peek(): BsdNumber<T>;
    skip(
        byteLength: number | BsdNumber | ((reader: BsdReader) => BsdNumber),
    ): BsdNumber<T>;
    check(check: BsdCheck<T>): BsdNumber<T>;
    gt(value: number | bigint): BsdNumber<T>;
    gte(value: number | bigint): BsdNumber<T>;
    lt(value: number | bigint): BsdNumber<T>;
    lte(value: number | bigint): BsdNumber<T>;
    positive(): BsdNumber<T>;
    negative(): BsdNumber<T>;
}

export interface BsdBytes extends Bsd<Uint8Array> {
    peek(): BsdBytes;
    skip(
        byteLength: number | BsdNumber | ((reader: BsdReader) => BsdNumber),
    ): BsdBytes;
    check(check: BsdCheck<Uint8Array>): BsdBytes;

    frame<S extends BsdAny>(schema: S): S;

    /**
     * Decodes the bytes as a strict seven-bits ASCII string.
     *
     * @example
     *     ```typescript
     *   const Item = bsd.struct({
     *     // Decodes the name bytes as an ASCII string:
     *     name: bsd.bytes(32).ascii(),
     *   });
     *   ```;
     */
    ascii(): Bsd<string>;

    /**
     * Decodes the bytes by mapping each byte directly to the same-valued
     * Unicode code unit.
     *
     * @example
     *     ```typescript
     *   const Item = bsd.struct({
     *     // Decodes the name bytes as a Latin-1 string:
     *     name: bsd.bytes(32).latin1(),
     *   });
     *   ```;
     */
    latin1(): Bsd<string>;

    /**
     * Decodes the bytes as a strict UTF-8 string. Rejects malformed inputs.
     *
     * @example
     *     ```typescript
     *   const Item = bsd.struct({
     *     // Decodes the name bytes as a UTF-8 string:
     *     name: bsd.bytes(32).utf8(),
     *   });
     *   ```;
     */
    utf8(): Bsd<string>;

    /**
     * Decodes the bytes as a little-endian UTF-16 string.
     *
     * @example
     *     ```typescript
     *   const Item = bsd.struct({
     *     // Decodes the name bytes as a UTF-16 string:
     *     name: bsd.bytes(32).utf16le(),
     *   });
     *   ```;
     */
    utf16le(): Bsd<string>;

    slice(): any;
}

type Mask<T extends BsdShape> = {
    [K in keyof T]?: true;
};

type Omit<T extends BsdShape, M extends Mask<T>> = {
    [K in keyof T]: T[K];
};

export interface BsdStruct<T extends BsdShape = BsdShape> extends Bsd<T> {
    peek(): BsdStruct<T>;
    skip(
        byteLength: number | BsdNumber | ((reader: BsdReader) => BsdNumber),
    ): BsdStruct<T>;
    check(check: BsdCheck<T>): BsdStruct<T>;

    omit<M extends Mask<T>>(mask: M): BsdStruct<Omit<T, M>>;
    // pick<const K extends keyof T>()
}

export interface BsdInternal<T> {
    read(reader: BsdReader): T;
}

export class BsdType<T> implements Bsd<T> {
    constructor(
        private readonly decoder: BsdDecoder<any>,
        private readonly modifiers: readonly BsdTransform<any, any>[] = [],
    ) {}

    private read(reader: BsdReader) {
        const initialOffset = reader.byteOffset;
        reader.schemaOffset = initialOffset;

        let value = this.decoder(reader);
        for (const mod of this.modifiers) {
            // Start each modifier from the initial offset
            // (where the value was decoded from):
            reader.schemaOffset = initialOffset;
            value = mod(value, reader);
        }

        reader.schemaOffset = initialOffset;
        return value;
    }

    decode(input: Uint8Array): T {
        const reader = new BsdReader(input);
        const value = this.read(reader);
        return value;
    }

    tee(fn: BsdTransform<T, void>): Bsd<T> {
        return this.addModifier((value, reader) => {
            fn(value, reader);
            return value;
        });
    }

    pad(fn: number | BsdTransform<T, number>): BsdFor<T> {
        return this.addModifier((value, reader) => {
            reader.byteOffset +=
                typeof fn === "function" ? fn(value, reader) : fn;
            return value;
        });
    }

    peek() {
        return this.addModifier((value, reader) => {
            // Undo the offset change after decoding:
            reader.byteOffset = reader.schemaOffset;
            // Forward the decoded value:
            return value;
        });
    }

    skip(byteLength: number | BsdNumber | ((reader: BsdReader) => BsdNumber)) {
        return this.addModifier((value, reader) => {
            const bytesSkipped =
                typeof byteLength === "function"
                    ? asInternal(byteLength(reader)).read(reader)
                    : typeof byteLength === "object"
                      ? asInternal(byteLength).read(reader)
                      : byteLength;
            // Add the skipped bytes to the reader's byte offset:
            reader.byteOffset += Number(bytesSkipped);
            // Forward the decoded value:
            return value;
        });
    }

    advance(fn: (value: T, reader: BsdReader) => number) {
        return this.addModifier((value, reader) => {
            reader.byteOffset += fn(value, reader);
            return value;
        });
    }

    check(check: BsdCheck<any>) {
        return this.addModifier((value, reader) => {
            if (check(value, reader) === false) {
                // @todo replace with DecodeError
                throw new Error();
            }
            return value;
        });
    }

    is<const U extends T>(expected: U): BsdFor<U> {
        return this.addModifier((value, reader) => {
            if (value !== expected) {
                throw BsdIssue.from(
                    reader,
                    `expected ${value} to be ${expected}`,
                );
            }
            return value;
        }) as unknown as BsdFor<U>;
    }

    in<const U extends T>(values: Array<U> | Set<U> | Map<U, any>) {
        return this.addModifier((value, reader) => {
            if (Array.isArray(values)) {
                if (!values.includes(value))
                    throw BsdIssue.from(
                        reader,
                        `expected ${value} to be in ${values}`,
                    );
            } else if (!values.has(value)) {
                throw BsdIssue.from(
                    reader,
                    `expected ${value} to be in ${values}`,
                );
            }
            return value;
        }) as unknown as BsdFor<U>;
    }

    transform<R>(transform: BsdTransform<T, R>) {
        return this.addModifier(transform) as unknown as BsdFor<R>;
    }

    pipe<const R extends BsdAny>(transform: BsdTransform<T, R> | R) {
        return this.addModifier((value, reader) => {
            const schema =
                typeof transform === "function"
                    ? asInternal(transform(value, reader))
                    : asInternal(transform);
            return schema.read(reader);
        }) as any;
    }

    gt(expected: number | bigint) {
        return this.addModifier((value: number | bigint, reader) => {
            if (value <= expected) {
                throw BsdIssue.from(
                    reader,
                    `expected ${value} to be greater than ${expected}`,
                );
            }
            return value;
        });
    }

    gte(expected: number | bigint) {
        return this.addModifier((value: number | bigint, reader) => {
            if (value < expected) {
                throw BsdIssue.from(
                    reader,
                    `expected ${value} to be greater than or equal to ${expected}`,
                );
            }
            return value;
        });
    }

    lt(expected: number | bigint) {
        return this.addModifier((value: number | bigint, reader) => {
            if (value >= expected) {
                throw BsdIssue.from(
                    reader,
                    `expected ${value} to be less than ${expected}`,
                );
            }
            return value;
        });
    }

    lte(expected: number | bigint) {
        return this.addModifier((value: number | bigint, reader) => {
            if (value > expected) {
                throw BsdIssue.from(
                    reader,
                    `expected ${value} to be less than or equal to ${expected}`,
                );
            }
            return value;
        });
    }

    positive() {
        return this.gt(0);
    }

    negative() {
        return this.lt(0);
    }

    frame<S extends BsdAny>(schema: S): BsdFor<BsdInfer<S>> {
        return this.addModifier((value) => {
            return schema.decode(value);
        }) as any;
    }

    ascii(): BsdFor<string> {
        return this.addModifier(toAscii);
    }

    latin1(): BsdFor<string> {
        return this.addModifier(toLatin1);
    }

    utf8(): BsdFor<string> {
        return this.addModifier(toUtf8);
    }

    utf16le(): BsdFor<string> {
        return this.addModifier(toUtf16le);
    }

    omit(mask: Record<string, boolean>): BsdAny {
        const keys = Object.keys(mask);
        return this.addModifier((value: Record<string, any>) => {
            // We mutate the object in-place on purpose:
            for (const k of keys) {
                delete value[k];
            }
            return value;
        });
    }

    private addModifier(transform: BsdTransform<any, any>): Bsd<any> {
        return new BsdType(this.decoder, [...this.modifiers, transform]);
    }

    static make<T>(decoder: BsdDecoder<T>): BsdFor<T> {
        return new BsdType(decoder) as unknown as BsdFor<T>;
    }
}
