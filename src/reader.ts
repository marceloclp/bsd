import { Buffer } from "node:buffer";
import { ZedError } from "./error";

/** Integer widths supported by Eke's number-backed readers. */
type IntegerBits = 8 | 16 | 24 | 32;
/** Big-integer widths supported by Eke's bigint-backed readers. */
type BigIntegerBits = 64;
/** IEEE-754 widths supported by Eke's float reader. */
type FloatBits = 32 | 64;

export class ZedReader {
	constructor(bytes: Uint8Array) {
		this.buffer = bytes;
		this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		this.byteBuffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		this.length = bytes.length;
	}

	/** Input bytes being decoded; schemas read this value but never mutate it. */
	public readonly buffer: Uint8Array;
	/** A view scoped to exactly the input bytes. */
	public readonly view: DataView;
	/** A zero-copy Buffer view used for fast Latin-1 decoding. */
	private readonly byteBuffer: Buffer;

	/** The path to the member currently being decoded. */
	public path: Array<string | number | bigint> = [];
	/** The starting offset of the member currently being decoded. */
	public position: number = 0;
	/** The current offset within the buffer (how many were bytes consumed). */
	public offset: number = 0;
	/** Exclusive boundary imposed by the innermost framed schema. */
	public length: number;

	/** Reads a little-endian unsigned integer, advancing by default. */
	uint(bits: IntegerBits, advance = true) {
		const start = this.offset;
		const end = start + bits / 8;
		if (!Number.isSafeInteger(start) || start < 0) {
			this.addIssue(`u${bits}() cannot read from invalid offset ${start}`);
		}
		if (!Number.isSafeInteger(this.length) || this.length < 0) {
			this.addIssue(`u${bits}() cannot read with invalid limit ${this.length}`);
		}
		if (end > this.length || end > this.buffer.length) {
			this.addIssue(`u${bits}() out of bounds`);
		}

		let value: number;
		switch (bits) {
			case 8:
				value = this.view.getUint8(start);
				break;
			case 16:
				value = this.view.getUint16(start, true);
				break;
			case 24:
				value = this.view.getUint16(start, true)
					| (this.view.getUint8(start + 2) << 16);
				break;
			case 32:
				value = this.view.getUint32(start, true);
				break;
		}
		if (advance) this.offset = end;
		return value;
	}

	/** Reads a little-endian signed integer, advancing by default. */
	int(bits: IntegerBits, advance = true) {
		const start = this.offset;
		const end = start + bits / 8;
		if (!Number.isSafeInteger(start) || start < 0) {
			this.addIssue(`i${bits}() cannot read from invalid offset ${start}`);
		}
		if (!Number.isSafeInteger(this.length) || this.length < 0) {
			this.addIssue(`i${bits}() cannot read with invalid limit ${this.length}`);
		}
		if (end > this.length || end > this.buffer.length) {
			this.addIssue(`i${bits}() out of bounds`);
		}

		const value =
			this.buffer[start]! |
			(bits >= 16 ? this.buffer[start + 1]! << 8 : 0) |
			(bits >= 24 ? this.buffer[start + 2]! << 16 : 0) |
			(bits === 32 ? this.buffer[start + 3]! << 24 : 0);
		const shift = 32 - bits;
		const signed = (value << shift) >> shift;
		if (advance) this.offset = end;
		return signed;
	}

	/** Reads a little-endian unsigned bigint, advancing by default. */
	biguint(bits: BigIntegerBits, advance = true) {
		const start = this.offset;
		const end = start + bits / 8;
		if (!Number.isSafeInteger(start) || start < 0) {
			this.addIssue(`u${bits}() cannot read from invalid offset ${start}`);
		}
		if (!Number.isSafeInteger(this.length) || this.length < 0) {
			this.addIssue(`u${bits}() cannot read with invalid limit ${this.length}`);
		}
		if (end > this.length || end > this.buffer.length) {
			this.addIssue(`u${bits}() out of bounds`);
		}

		const value = this.view.getBigUint64(start, true);
		if (advance) this.offset = end;
		return value;
	}

	/** Reads a little-endian signed bigint, advancing by default. */
	bigint(bits: BigIntegerBits, advance = true) {
		const start = this.offset;
		const end = start + bits / 8;
		if (!Number.isSafeInteger(start) || start < 0) {
			this.addIssue(`i${bits}() cannot read from invalid offset ${start}`);
		}
		if (!Number.isSafeInteger(this.length) || this.length < 0) {
			this.addIssue(`i${bits}() cannot read with invalid limit ${this.length}`);
		}
		if (end > this.length || end > this.buffer.length) {
			this.addIssue(`i${bits}() out of bounds`);
		}

		const value = this.view.getBigInt64(start, true);
		if (advance) this.offset = end;
		return value;
	}

	/** Reads a little-endian IEEE-754 float, advancing by default. */
	float(bits: FloatBits, advance = true) {
		const start = this.offset;
		const end = start + bits / 8;
		if (!Number.isSafeInteger(start) || start < 0) {
			this.addIssue(`f${bits}() cannot read from invalid offset ${start}`);
		}
		if (!Number.isSafeInteger(this.length) || this.length < 0) {
			this.addIssue(`f${bits}() cannot read with invalid limit ${this.length}`);
		}
		if (end > this.length || end > this.buffer.length) {
			this.addIssue(`f${bits}() out of bounds`);
		}

		const value = bits === 32
			? this.view.getFloat32(start, true)
			: this.view.getFloat64(start, true);
		if (advance) this.offset = end;
		return value;
	}

	/** Reads `bytes` as one-byte character codes, advancing by default. */
	ascii(bytes: number, advance = true) {
		if (!Number.isSafeInteger(bytes) || bytes < 0) {
			this.addIssue(`ascii() requires a non-negative byte count; got ${bytes}`);
		}

		const start = this.offset;
		const end = start + bytes;
		if (!Number.isSafeInteger(start) || start < 0) {
			this.addIssue(`ascii() cannot read from invalid offset ${start}`);
		}
		if (!Number.isSafeInteger(this.length) || this.length < 0) {
			this.addIssue(`ascii() cannot read with invalid limit ${this.length}`);
		}
		if (end > this.length || end > this.buffer.length) {
			this.addIssue(`ascii() out of bounds`);
		}

		const value = bytes === 0
			? ""
			: bytes === 1
				? String.fromCharCode(this.buffer[start]!)
				: this.byteBuffer.toString("latin1", start, end);
		if (advance) this.offset = end;
		return value;
	}

	/** Reads `bytes` as UTF-8 text, advancing by default. */
	utf8(bytes: number, advance = true) {
		if (!Number.isSafeInteger(bytes) || bytes < 0) {
			this.addIssue(`utf8() requires a non-negative byte count; got ${bytes}`);
		}

		const start = this.offset;
		const end = start + bytes;
		if (!Number.isSafeInteger(start) || start < 0) {
			this.addIssue(`utf8() cannot read from invalid offset ${start}`);
		}
		if (!Number.isSafeInteger(this.length) || this.length < 0) {
			this.addIssue(`utf8() cannot read with invalid limit ${this.length}`);
		}
		if (end > this.length || end > this.buffer.length) {
			this.addIssue(`utf8() out of bounds`);
		}

		const value = this.byteBuffer.toString("utf8", start, end);
		if (advance) this.offset = end;
		return value;
	}

	/** Reads `bytes` as little-endian UTF-16 text, advancing by default. */
	utf16le(bytes: number, advance = true) {
		if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes % 2 !== 0) {
			this.addIssue(`utf16le() requires a non-negative, even byte count; got ${bytes}`);
		}

		const start = this.offset;
		const end = start + bytes;
		if (!Number.isSafeInteger(start) || start < 0) {
			this.addIssue(`utf16le() cannot read from invalid offset ${start}`);
		}
		if (!Number.isSafeInteger(this.length) || this.length < 0) {
			this.addIssue(`utf16le() cannot read with invalid limit ${this.length}`);
		}
		if (end > this.length || end > this.buffer.length) {
			this.addIssue(`utf16le() out of bounds`);
		}

		const value = this.byteBuffer.toString("utf16le", start, end);
		if (advance) this.offset = end;
		return value;
	}

	/** Throws an `EkeError` with the current offset and path context. */
	addIssue(message: string): never {
		throw new ZedError(this.position, this.path, message);
	}
}
