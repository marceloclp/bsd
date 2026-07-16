import { describe, expect, test } from "bun:test";
import { ZedError } from "./error";
import { ZedReader } from "./reader";

describe(ZedReader, () => {
	test.each([
		[8, [0xab], 0xab],
		[16, [0x34, 0x12], 0x1234],
		[24, [0x56, 0x34, 0x12], 0x123456],
		[32, [0x78, 0x56, 0x34, 0x12], 0x12345678],
	] as const)("reads u%i", (bits, bytes, expected) => {
		const reader = new ZedReader(Uint8Array.from(bytes));

		expect(reader.uint(bits)).toBe(expected);
		expect(reader.offset).toBe(bits / 8);
	});

	test.each([
		[8, [0xff], -1],
		[16, [0xfe, 0xff], -2],
		[24, [0xfd, 0xff, 0xff], -3],
		[32, [0xfc, 0xff, 0xff, 0xff], -4],
	] as const)("reads i%i", (bits, bytes, expected) => {
		const reader = new ZedReader(Uint8Array.from(bytes));

		expect(reader.int(bits)).toBe(expected);
	});

	test("scopes DataView reads to Uint8Array subarrays", () => {
		const backing = Uint8Array.from([
			0xff, 0xff,
			0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01,
		]);
		const reader = new ZedReader(backing.subarray(2));

		expect(reader.biguint(64)).toBe(0x0102030405060708n);
	});

	test("reads signed big integers and both float widths", () => {
		const signedBytes = new Uint8Array(8);
		new DataView(signedBytes.buffer).setBigInt64(0, -123456789n, true);
		expect(new ZedReader(signedBytes).bigint(64)).toBe(-123456789n);

		const float32Bytes = new Uint8Array(4);
		new DataView(float32Bytes.buffer).setFloat32(0, 1.5, true);
		expect(new ZedReader(float32Bytes).float(32)).toBe(1.5);

		const float64Bytes = new Uint8Array(8);
		new DataView(float64Bytes.buffer).setFloat64(0, Math.PI, true);
		expect(new ZedReader(float64Bytes).float(64)).toBe(Math.PI);
	});

	test("does not advance when advance is false", () => {
		const reader = new ZedReader(Uint8Array.from([0x34, 0x12]));

		expect(reader.uint(16, false)).toBe(0x1234);
		expect(reader.offset).toBe(0);
	});

	test("reads ASCII by byte count and rejects invalid counts", () => {
		const reader = new ZedReader(Uint8Array.from([65, 66]));

		expect(reader.ascii(0)).toBe("");
		expect(reader.ascii(2)).toBe("AB");
		expect(new ZedReader(Uint8Array.of(65)).ascii(1)).toBe("A");
		const backing = Uint8Array.from([0, 0x80, 0xff]);
		expect(new ZedReader(backing.subarray(1)).ascii(2)).toBe("\x80\xff");
		for (const bytes of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(() => new ZedReader(Uint8Array.of(65)).ascii(bytes)).toThrow(ZedError);
		}
	});

	test("reads UTF-8 by byte count", () => {
		const backing = Uint8Array.from([
			0,
			0x41,
			0xe2, 0x82, 0xac,
			0xf0, 0x9f, 0x98, 0x80,
		]);
		const reader = new ZedReader(backing.subarray(1));

		expect(reader.utf8(8, false)).toBe("A€😀");
		expect(reader.offset).toBe(0);
		expect(reader.utf8(8)).toBe("A€😀");
		expect(reader.offset).toBe(8);
		for (const bytes of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(() => new ZedReader(Uint8Array.of()).utf8(bytes)).toThrow(ZedError);
		}
	});

	test("reads little-endian UTF-16 by byte count", () => {
		const backing = Uint8Array.from([
			0,
			0x41, 0x00,
			0xac, 0x20,
			0x3d, 0xd8, 0x00, 0xde,
		]);
		const reader = new ZedReader(backing.subarray(1));

		expect(reader.utf16le(8, false)).toBe("A€😀");
		expect(reader.offset).toBe(0);
		expect(reader.utf16le(8)).toBe("A€😀");
		expect(reader.offset).toBe(8);
		for (const bytes of [-2, 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(() => new ZedReader(Uint8Array.of()).utf16le(bytes)).toThrow(ZedError);
		}
	});

	test("rejects invalid offsets and reads beyond either boundary", () => {
		for (const offset of [-1, 0.5, Number.NaN]) {
			const reader = new ZedReader(Uint8Array.of(1));
			reader.offset = offset;
			expect(() => reader.uint(8)).toThrow(ZedError);
		}

		const framed = new ZedReader(Uint8Array.of(1, 2));
		framed.limit = 1;
		expect(() => framed.uint(16)).toThrow(ZedError);

		const oversizedLimit = new ZedReader(Uint8Array.of(1));
		oversizedLimit.limit = 2;
		expect(() => oversizedLimit.uint(16)).toThrow(ZedError);
	});

	test("every reader enforces its inlined bounds check", () => {
		const reads: Array<(reader: ZedReader) => unknown> = [
			reader => reader.uint(8),
			reader => reader.int(8),
			reader => reader.biguint(64),
			reader => reader.bigint(64),
			reader => reader.float(32),
			reader => reader.ascii(1),
			reader => reader.utf8(1),
			reader => reader.utf16le(2),
		];

		for (const read of reads) {
			expect(() => read(new ZedReader(Uint8Array.of()))).toThrow(ZedError);
		}
	});
});
