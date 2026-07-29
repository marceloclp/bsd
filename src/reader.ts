import type { BsdAny, BsdInfer } from "./bsd";

type Path = Array<string | symbol | number>;

export type BsdIntegerBits = 8 | 16 | 24 | 32;
export type BsdBigIntegerBits = 64;
export type BsdFloatBits = 32 | 64;

export class BsdIssue extends Error {
    public override readonly name = "BsdIssue";

    constructor(
        /** Offset to the schema that caused the issue. */
        public readonly schemaOffset: number,
        /** Offset to the byte that caused the issue. */
        public readonly byteOffset: number,
        /** Path to the schema that caused the issue. */
        public readonly path: Path,
        message: string,
    ) {
        super(message);
    }

    static from(reader: BsdReader, msg: string) {
        return new BsdIssue(
            reader.schemaOffset,
            reader.byteOffset,
            reader.path,
            msg,
        );
    }
}

export class BsdReader {
    /** Input bytes. Schemas never copy this array. */
    public readonly buffer: Uint8Array;

    /** DataView scoped to exactly the input byte range. */
    public readonly view: DataView;

    /** Path to the current schema being decoded. */
    public readonly path: Path = [];

    /** Exclusive boundary of the active frame. */
    public readonly limit: number;

    /** Starting offset of the current schema being decoded. */
    public schemaOffset = 0;

    /** Current absolute cursor within `buffer`. */
    public byteOffset = 0;

    /** Number of bytes available in the active frame. */
    public get remaining() {
        return this.limit - this.byteOffset;
    }

    constructor(buffer: Uint8Array) {
        this.buffer = buffer;
        this.limit = buffer.byteLength;
        this.view = new DataView(
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength,
        );
    }

    uint(bits: BsdIntegerBits, advance = true): number {
        const offset = this.byteOffset;

        if (advance) {
            this.byteOffset += bits / 8;
        }

        switch (bits) {
            case 8:
                return this.view.getUint8(offset);
            case 16:
                return this.view.getUint16(offset, true);
            case 24:
                return this.view.getUint32(offset, true) & 0xffffff;
            case 32:
                return this.view.getUint32(offset, true);
        }
    }

    int(bits: BsdIntegerBits, advance = true): number {
        const offset = this.byteOffset;

        if (advance) {
            this.byteOffset += bits / 8;
        }

        switch (bits) {
            case 8:
                return this.view.getInt8(offset);
            case 16:
                return this.view.getInt16(offset, true);
            case 24:
                return this.view.getInt32(offset, true) & 0xffffff;
            case 32:
                return this.view.getInt32(offset, true);
        }
    }

    biguint(bits: BsdBigIntegerBits, advance = true): bigint {
        const offset = this.byteOffset;

        if (advance) {
            this.byteOffset += bits / 8;
        }

        switch (bits) {
            case 64:
                return this.view.getBigUint64(offset, true);
        }
    }

    bigint(bits: BsdBigIntegerBits, advance = true): bigint {
        const offset = this.byteOffset;

        if (advance) {
            this.byteOffset += bits / 8;
        }

        switch (bits) {
            case 64:
                return this.view.getBigInt64(offset, true);
        }
    }

    float(bits: BsdFloatBits, advance = true): number {
        const offset = this.byteOffset;

        if (this.remaining < bits / 8) {
            throw BsdIssue.from(this, `float(${bits}) out of bounds`);
        }

        if (advance) {
            this.byteOffset += bits / 8;
        }

        switch (bits) {
            case 32:
                return this.view.getFloat32(offset, true);
            case 64:
                return this.view.getFloat64(offset, true);
        }
    }

    bool(advance = true): boolean {
        const offset = this.byteOffset;

        if (this.remaining < 1) {
            throw BsdIssue.from(this, `bool() out of bounds`);
        }

        if (advance) {
            this.byteOffset += 1;
        }

        const flag = this.view.getUint8(offset);

        if (flag !== 0 && flag !== 1) {
            throw BsdIssue.from(this, `bool() expected 0 or 1, got ${flag}`);
        }

        return flag === 1;
    }

    bytes(byteLength: number, advance = true): Uint8Array {
        const offset = this.byteOffset;

        if (this.remaining < byteLength) {
            throw BsdIssue.from(this, `bytes(${byteLength}) out of bounds`);
        }

        if (advance) {
            this.byteOffset += byteLength;
        }

        return this.buffer.subarray(offset, offset + byteLength);
    }
}

function join(path: Path): string {
    // We use `$` to represet the root:
    let result = "$";
    for (const segment of path) {
        if (typeof segment === "number") {
            result += `[${segment}]`;
        } else {
            result += `.${String(segment)}`;
        }
    }
    return result;
}
