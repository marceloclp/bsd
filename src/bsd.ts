import type { BsdType } from "./bsd-type";
import type { BsdReader } from "./reader";

/** Transform function signature, used to mutate the decoded value. */
export type BsdMod<T, R> = (value: T, reader: BsdReader) => R;
/** Check function signature, used to validate a schema. */
export type BsdCheck<T> = BsdMod<T, boolean | void>;
/** Decode function signature, entrypoint for a schema. */
export type BsdDecode<T> = (reader: BsdReader) => T;

/** Any BSD schema. */
export type BsdAny = Bsd<any> | BsdNumber | BsdBytes | BsdStruct;
/** `BsdStruct` decoded shape. */
export type BsdShape = Record<string, any>;

/** Returns the richest safe schema interface for a decoded value type. */
export type BsdFor<T> = [T] extends [number | bigint]
    ? BsdNumber<Extract<T, number | bigint>>
    : [T] extends [Uint8Array]
      ? BsdBytes
      : [T] extends [Record<string, any>]
        ? BsdStruct<T>
        : Bsd<T>;

/** Resolves a `Bsd` inner type. */
export type BsdInfer<T> = T extends Bsd<infer U> ? U : T;

export interface BsdDecodeOptions {
    /**
     * When set to true, the decoder will throw a `BsdIssue` if there are
     * remaining bytes in the buffer after decoding.
     */
    strict?: boolean;
}

export interface Bsd<T> {
    /**
     * Decodes the complete input (all bytes).
     *
     * @returns {T} When the schema is successfully decoded.
     * @throws {DecodeError} When the schema is not satisfied.
     */
    decode(input: Uint8Array, options?: BsdDecodeOptions): T;

    /**
     * Returns the decoded value without advancing the reader's cursor (byte
     * offset).
     *
     * This is useful for inspecting certain values, or to consume the same
     * range multiple times, with different transformations.
     *
     * ```typescript
     * // Composite ID of 24 low bits and 8 high bits:
     * const Id = struct({
     *     id: u32()
     *         .peek()
     *         .transform((v) => v & 0xffffff),
     *     key: u32().transform((v) => v >>> 24),
     * });
     * // Inspecting a schema:
     * const Data = struct({
     *     rowsLength: u32().peek(),
     *     rows: array(u32(), struct({})),
     * });
     * // Keeping both the raw data and the potentially
     * // incorrect transformed data:
     * const PossibleStr = struct({
     *     raw: bytes(12).peek(),
     *     value: bytes(12).ascii(),
     * });
     * ```
     */
    peek(): BsdFor<T>;

    /**
     * Pads the end of the schema by increasing the reader's byte offset. This
     * is useful for skipping over padding bytes used for alignment.
     *
     * ```typescript
     * // Each item is separated by 4 bytes:
     * const ListItem = struct({}).pad(4);
     * const List = array(10, ListItem);
     * // List that might be padded depending on its length:
     * const List = array(u32(), struct({})).pad((arr) => {
     *     return arr.length ? 4 : 0;
     * });
     * ```
     */
    pad(bytes: number | BsdMod<T, number>): BsdFor<T>;

    /**
     * Performs a check. If the check function returns `false`, an `BsdIssue` is
     * thrown. If the check function returns `true` or `undefined`, no error is
     * thrown.
     *
     * Binary schemas shouldn't need to use checks. This feature is intended for
     * use when decoding a schema whose shape is unknown (research purposes).
     *
     * If you require validation, you should pipe your decoded schema to a
     * proper validation library.
     *
     * ```typescript
     * // Checks that a value is within a range:
     * const Length = u32().check((v) => v >= 0 && v < 1000);
     * // Checks that a value is an enum:
     * const Color = u8().check((v) => Colors.has(v));
     * ```
     *
     * To use custom error messages, you should throw a BsdIssue by calling
     * `reader.fail()`. The example below also illustrates why returning
     * `undefined` is treated as a successful check.
     *
     * ```typescript
     * const Color = u8().check((v, r) => {
     *     if (!Colors.has(v)) {
     *         throw r.fail(`Invalid color: ${v}`);
     *     }
     * });
     * ```
     */
    check(check: BsdCheck<T>): BsdFor<T>;

    /**
     * Syntax sugar for shallow equality checks. This also performs type
     * narrowing.
     *
     * ```typescript
     * // Use for type narrowing:
     * const Color: Bsd<Colors.Red> = u8().is(Colors.Red);
     *
     * // Use to describe rules:
     * const Flag = u8().is(1);
     * ```
     */
    is<const U extends T>(expected: U): BsdFor<U>;

    /**
     * Syntax sugar for checking whether a value is included inside
     * an iterable. You may use arrays, sets or maps. Prefer sets and
     * maps over arrays when the list is large, as we can benefit from
     * constant-time lookups.
     *
     * Also performs type narrowing.
     *
     * ```typescript
     * // Use for type narrowing:
     * const Color: Bsd<Colors> = u8().in(Colors);
     *
     * // Use to describe enums:
     * const Status: Bsd<"A" | "B"> = bytes(1).ascii().in(["A", "B"]);
     * ```
     */
    in<const U extends T>(
        values: Array<U> | Set<U> | Map<U, unknown>,
    ): BsdFor<U>;

    /**
     * Maps the decoded value from the previous step to a new value.
     *
     * ```typescript
     * // A fixed-length UTF16-LE string whose length is twice
     * // the value of its preceding length field:
     * const Utf16LEString = bytes(u32().transform((x) => x * 2)).utf16le();
     *
     * // Unpack an integer into a float:
     * const PackedFloat = u32().transform(unpack);
     * ```
     */
    transform<U>(fn: BsdMod<T, U>): BsdFor<U>;

    /**
     * Consumes the decoded value to generate a new schema.
     * This is useful when working with variable-length data
     * that has more than one control value.
     *
     * ```typescript
     * // A null-terminated variable-length UTF16-LE string:
     * const VariableUtf16LEString = find(u16(), (v) => v < 0x20)
     *     .transform((v, r) => v - r.byteOffset)
     *     .pipe((v) => bytes(v).utf16le());
     * ```
     */
    pipe<const S extends BsdAny>(pipe: BsdMod<T, S> | S): BsdFor<BsdInfer<S>>;

    readonly "~type": BsdType<T>;
}

export interface BsdNumber<
    T extends number | bigint = number | bigint,
> extends Bsd<T> {
    /**
     * Checks if the decoded numeric value is greater than the expected value.
     *
     * ```typescript
     * const MinPrice = u8().gt(10);
     * ```
     */
    gt(value: number | bigint): BsdFor<T>;

    /**
     * Checks if the decoded numeric value is greater than or equal to the
     * expected value.
     *
     * ```typescript
     * const MinPrice = u8().gte(10);
     * ```
     */
    gte(value: number | bigint): BsdFor<T>;

    /**
     * Checks if the decoded numeric value is lesser than the expected value.
     *
     * ```typescript
     * const MaxPrice = u8().lt(10);
     * ```
     */
    lt(value: number | bigint): BsdFor<T>;

    /**
     * Checks if the decoded numeric value is lesser than or equal to the
     * expected value.
     *
     * ```typescript
     * const MaxPrice = u8().lte(10);
     * ```
     */
    lte(value: number | bigint): BsdFor<T>;

    /**
     * Checks if the decoded numeric value is positive.
     *
     * ```typescript
     * const Price = u8().positive();
     * ```
     */
    positive(): BsdFor<T>;

    /**
     * Checks if the decoded numeric value is negative.
     *
     * ```typescript
     * const Offset = u8().negative();
     * ```
     */
    negative(): BsdFor<T>;
}

export interface BsdBytes extends Bsd<Uint8Array> {
    /**
     * Decodes a schema inside a frame of bytes. This is useful
     * when decoding arrays of variable-length rows.
     *
     * ```typescript
     * // ListItem is a null-terminated string with variable length:
     * const ListItem = find(u16(), (v) => v < 0x20)
     *     .transform((v, r) => v - r.byteOffset)
     *     .pipe((v) => bytes(v).utf16le());
     *
     * // List is an array of ListItems, where we only know the
     * // total byte length of the list, not the individual items:
     * const List = bytes(u32()).frame(repeat(ListItem));
     * ```
     *
     * @param {S | BsdMod<Uint8Array, S>} schema The schema or a function that
     *   returns the schema that will be decoded inside the frame
     */
    frame<const S extends BsdAny>(
        schema: S | BsdMod<Uint8Array, S>,
    ): BsdFor<BsdInfer<S>>;

    /**
     * Returns a new `Uint8Array` view of the original `ArrayBuffer` store
     * for this array, referencing the elements at begin, inclusive, up
     * to end, exclusive.
     *
     * ```typescript
     * // Removes left and right padding from a frame:
     * const UnpaddedFrame = bytes(24).slice(4, 20);
     * ```
     *
     * @param start The beginning of the specified portion of the array.
     * @param end The end of the specified portion of the array. This is
     *   exclusive of the element at the index 'end'.
     */
    slice(start?: number, end?: number): BsdFor<Uint8Array>;

    /**
     * By default, `bytes()` will return a zero-copy subarray. Mutating
     * that subarray will also mutate the original buffer.
     *
     * For most cases, mutating the original buffer is fine, as the buffer
     * will be discarded in favor of the decoded data. When you want to
     * mutate the subarray without affecting the original buffer, you can
     * call `copy()` to get a deep copy of the subarray.
     */
    copy(): BsdFor<Uint8Array>;

    /**
     * Marks this byte subarray as reserved bytes.
     *
     * This is useful when you still want to declaratively express the
     * reserved bytes in the schema, for readability and documentation,
     * but you do not care about the contents.
     */
    reserved(): BsdFor<void>;

    /**
     * Decodes the bytes as a strict seven-bits ASCII string.
     *
     * ```typescript
     * const Header = bytes(4).ascii();
     * ```
     */
    ascii(): BsdFor<string>;

    /**
     * Decodes the bytes as a strict UTF-8 string.
     *
     * ```typescript
     * const Name = bytes(u32()).utf8();
     * ```
     */
    utf8(): BsdFor<string>;

    /**
     * Decodes the bytes as a strict UTF-16 string.
     *
     * ```typescript
     * const Name = bytes(u32()).utf16();
     * ```
     */
    utf16(): BsdFor<string>;
}

type Mask<T extends BsdShape> = { [K in keyof T]?: true };
type MaskOmit<T extends BsdShape, M extends Mask<T>> = {
    [K in keyof M]: K extends keyof T ? T[K] : never;
};
type MaskPick<T extends BsdShape, M extends Mask<T>> = {
    [K in keyof M]: K extends keyof T ? T[K] : never;
};

export interface BsdStruct<T extends BsdShape = BsdShape> extends Bsd<T> {
    /**
     * Removes the specified fields from the decoded data.
     * This performs the operation in-place (the original object is
     * modified, rather than returning a new object).
     *
     * ```typescript
     * // Struct with an unknown field that we want to
     * // express for the sake of readability, but we
     * // do not wish to keep:
     * const Body = struct({
     *     field04: bytes(4).reserved(),
     *     id: u32(),
     * }).omit({ field04: true });
     * ```
     */
    omit<M extends Mask<T>>(mask: M): BsdFor<MaskOmit<T, M>>;

    /**
     * Keeps only the specified fields in the decoded data.
     * This performs the operation in-place (the original object
     * is modified, rather than returning a new object).
     *
     * ```typescript
     * // Struct where we only care about the `id` field:
     * const Body = struct({
     *     id: u32(),
     *     age: u8(),
     *     name: bytes(8).ascii(),
     * }).pick({ id: true });
     * ```
     */
    pick<M extends Mask<T>>(mask: M): BsdFor<MaskPick<T, M>>;
}
