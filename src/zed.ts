import type { ZedError } from "./error";
import type { ZedReader } from "./reader";

type Mask<T extends Record<string, unknown>> = {
    [K in keyof T]?: true;
};

type MaskPick<T extends Record<string, unknown>, M extends Mask<T>> = {
    [K in keyof T as M[K] extends true ? K : never]: T[K];
};

type MaskOmit<T extends Record<string, unknown>, M extends Mask<T>> = {
    [K in keyof T as M[K] extends true ? never : K]: T[K];
};

export type ZedInfer<T> =
    T extends Record<string, any>
    ? { [K in keyof T]: ZedInfer<T[K]> }
    : T extends (infer U)[]
    ? ZedInfer<U>[]
    : T;

export type ZedUnwrap<T extends Record<string, ZedAny>> = {
    [K in keyof T]: T[K] extends ZedType<infer U> ? U : never;
};

export type ZedInferNext<T> =
    T extends Uint8Array
    ? ZedBytes
    : T extends readonly (infer U)[]
    ? ZedArray<U>
    : T extends number | bigint
    ? ZedNumber<T>
    : T extends string
    ? ZedString
    : T extends Record<string, any>
    ? ZedStruct<T>
    : ZedType<T>;

/**
 *
 */
export type ZedDecoder<T> = (reader: ZedReader) => T;

/**
 *
 */
export type ZedCheck<T> = (value: T, reader: ZedReader) => boolean | void;

/**
 *
 */
export type ZedTransform<T, R> = (value: T, reader: ZedReader) => R;

export interface ZedType<T = any> {
    /**
     * Decodes a `Uint8Array` using this schema.
     *
     * @throws {ZedError} if the number of bytes is different
     *          than the expected length of the entire schema
     * @returns {T} the decoded value
     */
    decode(bytes: Uint8Array): T;

    /**
     * Walks back the offset caused by the member's
     * decoding step.
     *
     * This is useful when decoding ints that have
     * low/high bits, so you can decode the same
     * window multiple times, to extract both values.
     *
     * @example
     * ```typescript
     * ```
     */
    undo(): ZedInferNext<T>;

    /**
     * Advances the reader past a fixed or dynamic number of
     * bytes after decoding this member.
     *
     * Useful when you want to skip reserved bytes or padding.
     *
     * @example
     * ```typescript
     * struct({
     *   // With a fixed number of bytes:
     *   id: u8().skip(4),
     *   // Code starts from the 5th byte:
     *   code: u8(),
     * });
     *
     * struct({
     *   // With a variable number of bytes:
     *   id: u8().skip(u8()),
     *   // Code starts from +1 + the next byte value:
     *   code: u8(),
     * });
     *
     * // Bigint lengths are supported as values or schemas:
     * u8().skip(4n);
     * u8().skip(u64());
     * ```
     */
    skip(
        bytes: number | bigint | ZedNumber<number> | ZedNumber<bigint>,
    ): ZedInferNext<T>;

    /**
     * Performs a custom check on the decoded member. If the
     * `check` function returns `false`, a {@link ZedError} is
     * thrown.
     *
     * To customize the error message, you can add an issue from
     * inside the `check` function using {@link ZedReader.addIssue}.
     *
     * Alternatively, you may pass a named function, and the name of
     * the function will be used as the error message.
     *
     * @example
     * ```typescript
     * // Regular check without a custom error message:
     * u8().check((v) => v < 128);
     *
     * // Custom error message via named function (isLt128):
     * u8().check(function isLt128(v) {
     *   return v < 128;
     * });
     *
     * // Custom error message via `addIssue`:
     * u8().check((v, reader) => {
     *   if (v < 128) reader.addIssue(`Expected to be less than 128`);
     * });
     * ```
     */
    check(check: ZedCheck<T>): ZedInferNext<T>;

    /**
     * Performs a shallow equality check on the decoded member.
     * This is syntax sugar for `check((v) => v === expected)`.
     *
     * @example
     * ```typescript
     * // Using check():
     * u8().check((v) => v === 128);
     *
     * // Using is():
     * u8().is(128);
     * ```
     */
    is(expected: T): ZedInferNext<T>;

    /**
     * Checks if the decoded member is one of the provided
     * values of the iterable. Arrays will be checked in O(n),
     * so prefer using a `Set/Map` for large ranges.
     *
     * @example
     * ```typescript
     * // Using check() - creates a new array on every check:
     * u8().check((v) => [128, 129, 130].includes(v));
     *
     * // Using in() - optimized:
     * u8().in([128, 129, 130]);
     * ```
     */
    in<const R extends T>(iter: Array<T> | Set<T> | Map<T, any>): ZedInferNext<R>;

    /**
     * Applies a custom transformation to the decoded member. This
     * behaves exactly to Zod's own `transform()` method.
     *
     * @example
     * ```typescript
     * // Doubles the value of the u8() after decoding:
     * u8().transform((v) => v * 2);
     *
     * // Returns the sum of all bytes:
     * bytes(10).transform((v) => v.reduce((a, b) => a + b, 0));
     * ```
     */
    transform<R>(transform: ZedTransform<T, R>): ZedInferNext<R>;
}

export interface ZedNumber<T extends number | bigint = number | bigint> extends ZedType<T> {
    /**
     * Checks if the decoded member is greater than the
     * provided value. This is syntax sugar for a custom
     * `check()` call.
     *
     * @example
     * ```typescript
     * // Using check():
     * u8().check((v) => v > 128);
     *
     * // Using gt():
     * u8().gt(128);
     * ```
     */
    gt(value: T): ZedNumber<T>;

    /**
     * Checks if the decoded member is less than the
     * provided value. This is syntax sugar for a custom
     * `check()` call.
     *
     * @example
     * ```typescript
     * // Using check():
     * u8().check((v) => v < 128);
     *
     * // Using lt():
     * u8().lt(128);
     * ```
     */
    lt(value: T): ZedNumber<T>;

    /**
     * Checks if the decoded member is greater than or equal
     * to the provided value. This is syntax sugar for a custom
     * `check()` call.
     *
     * @example
     * ```typescript
     * // Using check():
     * u8().check((v) => v >= 128);
     *
     * // Using gte():
     * u8().gte(128);
     * ```
     */
    gte(value: T): ZedNumber<T>;

    /**
     * Checks if the decoded member is less than or equal
     * to the provided value. This is syntax sugar for a custom
     * `check()` call.
     *
     * @example
     * ```typescript
     * // Using check():
     * u8().check((v) => v <= 128);
     *
     * // Using lte():
     * u8().lte(128);
     * ```
     */
    lte(value: T): ZedNumber<T>;

    /**
     * Checks if the decoded member is positive. This is
     * syntax sugar for a custom `check()` call.
     *
     * @example
     * ```typescript
     * // Using check():
     * u8().check((v) => v > 0);
     *
     * // Using positive():
     * u8().positive();
     * ```
     */
    positive(): ZedNumber<T>;

    /**
     * Checks if the decoded member is negative. This is
     * syntax sugar for a custom `check()` call.
     *
     * @example
     * ```typescript
     * // Using check():
     * u8().check((v) => v < 0);
     *
     * // Using negative():
     * u8().negative();
     * ```
     */
    negative(): ZedNumber<T>;
}

export interface ZedString extends ZedType<string> {}

export interface ZedBytes extends ZedType<Uint8Array> {
    /**
     * Decodes the bytes as an ASCII string.
     *
     * @example
     * ```typescript
     * const name = bytes(5).ascii().decode(
     *   new Uint8Array([0x6a, 0x6f, 0x68, 0x6e]),
     * );
     * console.log(name); // "john"
     * ```
     */
    ascii(): ZedString;

    /**
     * Decodes the bytes as a UTF-8 string.
     *
     * @example
     * ```typescript
     * const name = bytes(5).utf8().decode(
     *   new Uint8Array([0x6a, 0x6f, 0x68, 0x6e]),
     * );
     * console.log(name); // "john"
     * ```
     */
    utf8(): ZedString;

    /**
     * Decodes the bytes as a UTF-16 string using
     * little-endian byte order.
     *
     * @example
     * ```typescript
     * const name = bytes(5).utf16le().decode(
     *   new Uint8Array([0x6a, 0x6f, 0x68, 0x6e]),
     * );
     * console.log(name); // "john"
     * ```
     */
    utf16le(): ZedString;
}

export interface ZedStruct<
    T extends Record<string, unknown> = Record<string, any>,
    > extends ZedType<T> {
    /**
     * Allows picking a subset of the struct's fields.
     * This is syntax sugar for a custom transform, and
     * is preferable as it does not allocate a new object.
     *
     * @example
     * ```typescript
     * // Using transform():
     * struct({ id: u8(), code: u8() }).transform((v) => ({ id: v.id }));
     *
     * // Using pick():
     * struct({ id: u8(), code: u8() }).pick({ id: true });
     * ```
     */
    pick<M extends Mask<T>>(mask: M): ZedStruct<MaskPick<T, M>>;

    /**
     * Omits the specified fields from the struct. This
     * is syntax sugar for a custom transform, and
     * is preferable as it does not allocate a new object.
     *
     * @example
     * ```typescript
     * // Using transform():
     * struct({ id: u8(), code: u8() }).transform((v) => ({ code: v.code }));
     *
     * // Using omit():
     * struct({ id: u8(), code: u8() }).omit({ id: true });
     * ```
     */
    omit<M extends Mask<T>>(mask: M): ZedStruct<MaskOmit<T, M>>;
}

export interface ZedArray<T = any> extends ZedType<T[]> {}

export type ZedAny =
    | ZedArray
    | ZedStruct
    | ZedString
    | ZedNumber
    | ZedBytes
    | ZedType;
