import { Buffer } from "node:buffer";

type NumberReader = (offset: number, bits: 8 | 16 | 24 | 32) => number;
type BigIntReader = (offset: number) => bigint;
type FloatReader = (offset: number, bits: 32 | 64) => number;
type AsciiReader = (offset: number, byteLength: number) => string;

type Candidate<T> = {
	name: string;
	read: T;
};

const iterations = Number(Bun.env.BENCH_ITERATIONS ?? 500_000);
const samples = Number(Bun.env.BENCH_SAMPLES ?? 7);
const bytes = new Uint8Array(8_192);
for (let index = 0, value = 0x12345678; index < bytes.length; index++) {
	value = (Math.imul(value, 1_664_525) + 1_013_904_223) >>> 0;
	bytes[index] = value >>> 24;
}

const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
let sink = 0;

const uintCandidates: Array<Candidate<NumberReader>> = [
	{
		name: "manual bytes",
		read(offset, bits) {
			return (
				bytes[offset]! |
				(bits >= 16 ? bytes[offset + 1]! << 8 : 0) |
				(bits >= 24 ? bytes[offset + 2]! << 16 : 0) |
				(bits === 32 ? bytes[offset + 3]! << 24 : 0)
			) >>> 0;
		},
	},
	{
		name: "DataView",
		read(offset, bits) {
			switch (bits) {
				case 8: return view.getUint8(offset);
				case 16: return view.getUint16(offset, true);
				case 24: return view.getUint16(offset, true) | (view.getUint8(offset + 2) << 16);
				case 32: return view.getUint32(offset, true);
			}
		},
	},
	{
		name: "Buffer.readUIntLE",
		read: (offset, bits) => buffer.readUIntLE(offset, bits / 8),
	},
];

const intCandidates: Array<Candidate<NumberReader>> = [
	{
		name: "manual bytes + shift",
		read(offset, bits) {
			const value =
				bytes[offset]! |
				(bits >= 16 ? bytes[offset + 1]! << 8 : 0) |
				(bits >= 24 ? bytes[offset + 2]! << 16 : 0) |
				(bits === 32 ? bytes[offset + 3]! << 24 : 0);
			const shift = 32 - bits;
			return (value << shift) >> shift;
		},
	},
	{
		name: "DataView",
		read(offset, bits) {
			switch (bits) {
				case 8: return view.getInt8(offset);
				case 16: return view.getInt16(offset, true);
				case 24: return view.getUint16(offset, true) | (view.getInt8(offset + 2) << 16);
				case 32: return view.getInt32(offset, true);
			}
		},
	},
	{
		name: "Buffer.readIntLE",
		read: (offset, bits) => buffer.readIntLE(offset, bits / 8),
	},
];

const biguintCandidates: Array<Candidate<BigIntReader>> = [
	{ name: "DataView", read: offset => view.getBigUint64(offset, true) },
	{ name: "Buffer.readBigUInt64LE", read: offset => buffer.readBigUInt64LE(offset) },
	{
		name: "two uint32 reads",
		read(offset) {
			return BigInt(view.getUint32(offset, true))
				| (BigInt(view.getUint32(offset + 4, true)) << 32n);
		},
	},
];

const bigintCandidates: Array<Candidate<BigIntReader>> = [
	{ name: "DataView", read: offset => view.getBigInt64(offset, true) },
	{ name: "Buffer.readBigInt64LE", read: offset => buffer.readBigInt64LE(offset) },
	{
		name: "two uint32 reads + asIntN",
		read(offset) {
			const unsigned = BigInt(view.getUint32(offset, true))
				| (BigInt(view.getUint32(offset + 4, true)) << 32n);
			return BigInt.asIntN(64, unsigned);
		},
	},
];

const floatCandidates: Array<Candidate<FloatReader>> = [
	{
		name: "DataView",
		read: (offset, bits) => bits === 32
			? view.getFloat32(offset, true)
			: view.getFloat64(offset, true),
	},
	{
		name: "Buffer",
		read: (offset, bits) => bits === 32
			? buffer.readFloatLE(offset)
			: buffer.readDoubleLE(offset),
	},
];

const asciiCandidates: Array<Candidate<AsciiReader>> = [
	{
		name: "character loop",
		read(offset, byteLength) {
			let value = "";
			for (let index = offset; index < offset + byteLength; index++) {
				value += String.fromCharCode(bytes[index]!);
			}
			return value;
		},
	},
	{
		name: "String.fromCharCode spread",
		read: (offset, byteLength) => String.fromCharCode(...bytes.subarray(offset, offset + byteLength)),
	},
	{
		name: "Buffer.from(...).toString",
		read: (offset, byteLength) => Buffer
			.from(view.buffer, view.byteOffset + offset, byteLength)
			.toString("latin1"),
	},
	{
		name: "cached Buffer.toString",
		read: (offset, byteLength) => buffer.toString("latin1", offset, offset + byteLength),
	},
];

function median(values: number[]): number {
	const sorted = values.toSorted((left, right) => left - right);
	return sorted[Math.floor(sorted.length / 2)]!;
}

function measure(name: string, run: (count: number) => number, count = iterations): number {
	run(Math.max(10_000, Math.floor(count / 10)));
	const timings: number[] = [];
	for (let sample = 0; sample < samples; sample++) {
		const start = Bun.nanoseconds();
		sink ^= run(count);
		timings.push((Bun.nanoseconds() - start) / count);
	}
	const result = median(timings);
	console.log(`${name.padEnd(31)} ${result.toFixed(2).padStart(9)} ns/op`);
	return result;
}

function assertEquivalent<T extends (...args: never[]) => unknown>(
	candidates: Array<Candidate<T>>,
	args: Parameters<T>,
): void {
	const expected = candidates[0]!.read(...args);
	for (const candidate of candidates.slice(1)) {
		const actual = candidate.read(...args);
		if (!Object.is(actual, expected)) {
			throw new Error(`${candidate.name} returned ${String(actual)}; expected ${String(expected)}`);
		}
	}
}

function benchmarkNumbers(label: string, candidates: Array<Candidate<NumberReader>>): void {
	for (const bits of [8, 16, 24, 32] as const) {
		console.log(`\n${label}(${bits})`);
		assertEquivalent(candidates, [16, bits]);
		for (const candidate of candidates) {
			measure(candidate.name, count => {
				let checksum = 0;
				for (let index = 0; index < count; index++) {
					checksum = (checksum + candidate.read((index & 1_023) * 8, bits)) | 0;
				}
				return checksum;
			});
		}
	}
}

function benchmarkBigInts(label: string, candidates: Array<Candidate<BigIntReader>>): void {
	console.log(`\n${label}(64)`);
	assertEquivalent(candidates, [16]);
	for (const candidate of candidates) {
		measure(candidate.name, count => {
			let checksum = 0;
			for (let index = 0; index < count; index++) {
				checksum ^= Number(candidate.read((index & 1_023) * 8) & 0xffffn);
			}
			return checksum;
		});
	}
}

function benchmarkFloats(): void {
	for (const bits of [32, 64] as const) {
		console.log(`\nfloat(${bits})`);
		assertEquivalent(floatCandidates, [16, bits]);
		for (const candidate of floatCandidates) {
			measure(candidate.name, count => {
				let checksum = 0;
				for (let index = 0; index < count; index++) {
					const value = candidate.read((index & 1_023) * 8, bits);
					checksum = (checksum + (Number.isNaN(value) ? 0 : value)) | 0;
				}
				return checksum;
			});
		}
	}
}

function benchmarkAscii(): void {
	for (const byteLength of [1, 2, 3, 4, 8, 16, 64]) {
		console.log(`\nascii(${byteLength} bytes)`);
		assertEquivalent(asciiCandidates, [16, byteLength]);
		for (const candidate of asciiCandidates) {
			measure(candidate.name, count => {
				let checksum = 0;
				for (let index = 0; index < count; index++) {
					const value = candidate.read((index & 127) * 64, byteLength);
					checksum = (checksum + value.charCodeAt(0) + value.length) | 0;
				}
				return checksum;
			}, Math.max(50_000, Math.floor(iterations / 4)));
		}
	}
}

console.log(`Bun ${Bun.version}; ${iterations.toLocaleString()} iterations; ${samples} samples (median)`);
benchmarkNumbers("uint", uintCandidates);
benchmarkNumbers("int", intCandidates);
benchmarkBigInts("biguint", biguintCandidates);
benchmarkBigInts("bigint", bigintCandidates);
benchmarkFloats();
benchmarkAscii();
console.log(`\nchecksum: ${sink}`);
