import type {
    Bsd,
    BsdAny,
    BsdCheck,
    BsdDecode,
    BsdDecodeOptions,
    BsdFor,
    BsdInfer,
    BsdMod,
    BsdNumber,
    BsdShape,
    BsdStruct,
} from "./bsd";
import { BSD_READ } from "./constants";
import {
    bslice,
    check,
    copy,
    eq,
    fixedLength,
    frame,
    gt,
    gte,
    inIter,
    lt,
    lte,
    maxLength,
    minLength,
    omit,
    pad,
    peek,
    pick,
    pipe,
    reserve,
    toAscii,
    toUtf16,
    toUtf8,
} from "./mods";
import { BsdReader } from "./reader";

export class BsdType<T> implements Bsd<T> {
    constructor(
        private readonly decoder: BsdDecode<any>,
        private readonly modifiers: readonly BsdMod<any, any>[] = [],
    ) {}

    /**
     * @internal
     *
     * Decodes a schema using the reader from the previous
     * schema. This is used when decoding nested schemas.
     */
    [BSD_READ](reader: BsdReader) {
        const initialOffset = reader.byteOffset;
        reader.schemaOffset = initialOffset;

        let value = this.decoder(reader);
        for (const mod of this.modifiers) {
            // Reset the reader's schema offset back to
            // the initial position, before decoding:
            reader.schemaOffset = initialOffset;
            value = mod(value, reader);
        }

        return value;
    }

    /**
     * This is the main entrypoint for decoding a schema.
     *
     * Takes a `Uint8Array`, and attempts to decode the schema.
     * If the `strict` flag is passed, this will throw if there
     * are remaining bytes in the buffer.
     *
     * @see {@link Bsd}
     */
    decode(input: Uint8Array, opts?: BsdDecodeOptions): T {
        const reader = new BsdReader(input);
        const value = this[BSD_READ](reader);

        if (opts?.strict && reader.remaining > 0) {
            throw reader.fail(`unexpected ${reader.remaining} bytes remaining`);
        }

        return value;
    }

    /** @see {@link Bsd} */
    peek(): BsdFor<T> {
        return this.addModifier<T>(peek);
    }

    /** @see {@link Bsd} */
    pad(bytes: number | BsdMod<T, number>): BsdFor<T> {
        return this.addModifier(pad(bytes));
    }

    /** @see {@link Bsd} */
    check(fn: BsdCheck<T>): BsdFor<T> {
        return this.addModifier(check(fn));
    }

    /** @see {@link Bsd} */
    minLength(bytes: number): BsdFor<T> {
        return this.addModifier(minLength(bytes));
    }

    /** @see {@link Bsd} */
    maxLength(bytes: number): BsdFor<T> {
        return this.addModifier(maxLength(bytes));
    }

    /** @see {@link Bsd} */
    fixedLength(bytes: number): BsdFor<T> {
        return this.addModifier(fixedLength(bytes));
    }

    /** @see {@link Bsd} */
    is<const U extends T>(expected: U): BsdFor<U> {
        return this.addModifier(eq(expected));
    }

    /** @see {@link Bsd} */
    in<const U extends T>(values: Array<U> | Set<U> | Map<U, any>): BsdFor<U> {
        return this.addModifier(inIter(values));
    }

    /** @see {@link Bsd} */
    transform<R>(transform: BsdMod<T, R>): BsdFor<R> {
        return this.addModifier(transform);
    }

    /** @see {@link Bsd} */
    pipe<const U extends BsdAny>(fn: U | BsdMod<T, U>): BsdFor<BsdInfer<U>> {
        return this.addModifier(pipe(fn));
    }

    /** @see {@link BsdNumber} */
    gt<U extends number | bigint>(this: BsdType<U>, expected: U): BsdFor<U> {
        return this.addModifier(gt(expected));
    }

    /** @see {@link BsdNumber} */
    gte<U extends number | bigint>(this: BsdType<U>, expected: U): BsdFor<U> {
        return this.addModifier(gte(expected));
    }

    /** @see {@link BsdNumber} */
    lt<U extends number | bigint>(this: BsdType<U>, expected: U): BsdFor<U> {
        return this.addModifier(lt(expected));
    }

    /** @see {@link BsdNumber} */
    lte<U extends number | bigint>(this: BsdType<U>, expected: U): BsdFor<U> {
        return this.addModifier(lte(expected));
    }

    /** @see {@link BsdNumber} */
    positive<U extends number | bigint>(this: BsdType<U>): BsdFor<U> {
        return this.addModifier(gt(0));
    }

    /** @see {@link BsdNumber} */
    negative<U extends number | bigint>(this: BsdType<U>): BsdFor<U> {
        return this.addModifier(lt(0));
    }

    /** @see {@link BsdBytes} */
    frame<const S extends BsdAny>(
        this: BsdType<Uint8Array>,
        schema: S | BsdMod<Uint8Array, S>,
    ): BsdFor<BsdInfer<S>> {
        return this.addModifier(frame(schema));
    }

    /** @see {@link BsdBytes} */
    slice(
        this: BsdType<Uint8Array>,
        start?: number,
        end?: number,
    ): BsdFor<Uint8Array> {
        return this.addModifier(bslice(start, end));
    }

    /** @see {@link BsdBytes} */
    copy(this: BsdType<Uint8Array>): BsdFor<Uint8Array> {
        return this.addModifier(copy);
    }

    /** @see {@link BsdBytes} */
    reserved(this: BsdType<Uint8Array>): BsdFor<void> {
        return this.addModifier(reserve);
    }

    /** @see {@link BsdBytes} */
    ascii(this: BsdType<Uint8Array>): BsdFor<string> {
        return this.addModifier(toAscii);
    }

    /** @see {@link BsdBytes} */
    utf8(this: BsdType<Uint8Array>): BsdFor<string> {
        return this.addModifier(toUtf8);
    }

    /** @see {@link BsdBytes} */
    utf16(this: BsdType<Uint8Array>): BsdFor<string> {
        return this.addModifier(toUtf16);
    }

    /** @see {@link BsdStruct} */
    omit<U extends BsdShape>(this: BsdType<U>, mask: Record<string, true>) {
        return this.addModifier(omit(mask));
    }

    /** @see {@link BsdStruct} */
    pick<U extends BsdShape>(this: BsdType<U>, mask: Record<string, true>) {
        return this.addModifier(pick(mask));
    }

    private addModifier<R>(mod: BsdMod<any, R>): BsdFor<R> {
        return new BsdType(this.decoder, [...this.modifiers, mod]) as any;
    }

    static make<T>(decoder: BsdDecode<T>): BsdFor<T> {
        return new BsdType(decoder, []) as any;
    }
}
