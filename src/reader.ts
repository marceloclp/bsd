import { EkeError } from "./error";

/** Integer widths supported by Eke's number-backed readers. */
type IntegerBits = 8 | 16 | 24 | 32;
/** Big-integer widths supported by Eke's bigint-backed readers. */
type BigIntegerBits = 64;
/** IEEE-754 widths supported by Eke's float reader. */
export type FloatBits = 32 | 64;

/** Options shared by direct context reads. */
export type ReadOptions = {
    /** Should this read operation advance the reader's offset? */
    advance?: boolean
};

export class EkeReader {
    constructor(bytes: Uint8Array) {
        this.buffer = bytes;
        this.view = new DataView(bytes.buffer);
        this.limit = bytes.length;
    }

    /** Input bytes being decoded; schemas read this value but never mutate it. */
    public readonly buffer: Uint8Array;
    /** */
    public readonly view: DataView;

    /** The path to the member currently being decoded. */
    public path: Array<string | number> = [];
    /** The starting offset of the member currently being decoded. */
    public initialOffset: number = 0;
    /** The current offset within the buffer (how many were bytes consumed). */
    public offset: number = 0;
    /** Exclusive boundary imposed by the innermost framed schema. */
    public limit: number;

   	/** Reads a little-endian unsigned integer, advancing by default. */
	uint(bits: IntegerBits, { advance = true }: ReadOptions = {}) {
		const start = this.offset;
        const end = start + bits / 8;

        if (end > this.limit) {
            throw this.addIssue(`u${bits}() out of bounds`);
		}

		const value =
			this.buffer[start]! |
			(bits >= 16 ? this.buffer[start + 1]! << 8 : 0) |
			(bits >= 24 ? this.buffer[start + 2]! << 16 : 0) |
			(bits === 32 ? this.buffer[start + 3]! << 24 : 0);
		if (advance) this.offset = end;
		return value >>> 0;
    }

    /** Reads a little-endian signed integer, advancing by default. */
	int(bits: IntegerBits, { advance = true }: ReadOptions = {}) {
		const start = this.offset;
		const end = start + bits / 8;
        if (end > this.limit) {
             throw this.addIssue(`i${bits}() out of bounds`);
		}

		const value = this.uint(bits, { advance: false });
		if (advance) this.offset = end;
		const shift = 32 - bits;
		return (value << shift) >> shift;
    }

    /** Reads a little-endian unsigned bigint, advancing by default. */
	biguint(bits: BigIntegerBits, { advance = true }: ReadOptions = {}) {
		const start = this.offset;
		const end = start + bits / 8;
        if (end > this.limit) {
            throw this.addIssue(`u${bits}() out of bounds`);
		}

		const value = this.view.getBigUint64(start, true);
		if (advance) this.offset = end;
		return value;
    }

    /** Reads a little-endian signed bigint, advancing by default. */
	bigint(bits: BigIntegerBits, { advance = true }: ReadOptions = {}) {
		const start = this.offset;
		const end = start + bits / 8;
        if (end > this.limit) {
            throw this.addIssue(`i${bits}() out of bounds`);
		}

		const view = new DataView(this.buffer.buffer, this.buffer.byteOffset + start, bits / 8);
		const value = view.getBigInt64(0, true);
		if (advance) this.offset = end;
		return value;
    }

   	/** Reads a little-endian IEEE-754 float, advancing by default. */
	float(bits: FloatBits, { advance = true }: ReadOptions = {}) {
		const start = this.offset;
		const end = start + bits / 8;
		if (end > this.limit) throw this.addIssue(`f${bits}() out of bounds`);

		const view = new DataView(this.buffer.buffer, this.buffer.byteOffset + start, bits / 8);
		const value = bits === 32 ? view.getFloat32(0, true) : view.getFloat64(0, true);
		if (advance) this.offset = end;
		return value;
    }

    /** Reads `bits` as one-byte character codes, advancing by default. */
	ascii(bits: number, { advance = true }: ReadOptions = {}) {
		const start = this.offset;
		const byteLength = bits / 8;
		const end = start + byteLength;
		if (end > this.limit) {
			throw this.addIssue(`ascii() expected ${byteLength} bytes, got ${this.limit - start}`);
		}

		let value = "";
		for (let offset = start; offset < end; offset++) {
			value += String.fromCharCode(this.buffer[offset]!);
		}
		if (advance) this.offset = end;
		return value;
	}

    /**
     * Shortcut for throwing an `EkeError` with the current
     * context (offset and path).
     */
    addIssue(message: string) {
        throw new EkeError(this.initialOffset, this.path, message);
    }
}
