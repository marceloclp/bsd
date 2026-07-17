import { Buffer } from "node:buffer";
import { ZedError } from "./error";
import { ZedReader } from "./reader";
import type {
    ZedArray,
    ZedBytes,
    ZedCheck,
    ZedDecoder,
    ZedNumber,
    ZedString,
    ZedStruct,
    ZedTransform,
    ZedType,
} from "./zed";

export class Zed
    implements ZedType, ZedNumber, ZedString, ZedBytes, ZedStruct, ZedArray
{
    constructor(
        /** The base decoder function. */
        private readonly decoder: ZedDecoder<any>,

        /** The transformation pipeline. */
        private readonly transformers: ZedTransform<any, any>[] = [],
    ) {}

    decode(bytes: Uint8Array): any {
        const reader = new ZedReader(bytes);
        const result = this.decodeInternal(reader);

        if (reader.offset !== reader.length) {
            reader.position = reader.offset;
            reader.addIssue(
                `decoded ${reader.offset} bytes, but expected ${reader.length}`,
            );
        }

        return result;
    }

    undo(): any {
        return this.addTransform(undo);
    }

    skip(
        bytes: number | bigint | ZedNumber<number> | ZedNumber<bigint>,
    ): any {
        return this.addTransform((value, reader) => {
            const decodedLength =
                typeof bytes === "number" || typeof bytes === "bigint"
                    ? bytes
                    : (bytes as unknown as Zed).decodeInternal(reader);

            if (
                (typeof decodedLength === "bigint" && decodedLength < 0n)
                || (typeof decodedLength === "number" && (
                    !Number.isSafeInteger(decodedLength) || decodedLength < 0
                ))
            ) {
                reader.addIssue(
                    `skip() requires a non-negative byte count, got ${decodedLength}`,
                );
            }

            const remaining = reader.length - reader.offset;
            if (
                typeof decodedLength === "bigint"
                && decodedLength > BigInt(remaining)
            ) {
                reader.addIssue(
                    `skip() expected ${decodedLength} bytes, got ${remaining}`,
                );
            }

            const length = Number(decodedLength);
            const end = reader.offset + length;
            if (end > reader.length) {
                reader.addIssue(
                    `skip() expected ${decodedLength} bytes, got ${remaining}`,
                );
            }

            reader.offset = end;
            return value;
        });
    }

    check(check: ZedCheck<any>): any {
        return this.addTransform((value, reader) => {
            if (check(value, reader) === false) {
                reader.addIssue(check.name);
            }
            return value;
        });
    }

    is(expected: any): any {
        return this.addTransform((value, reader) => {
            if (value !== expected) {
                reader.addIssue(`expected ${value} to be ${expected}`);
            }
            return value;
        });
    }

    in(iter: Array<any> | Set<any> | Map<any, any>): any {
        return this.addTransform((value, reader) => {
            if (Array.isArray(iter)) {
                if (iter.includes(value)) return value;
            } else if (iter.has(value)) {
                return value;
            }
            reader.addIssue(
                `expected ${value} to be one of ${Array.from(iter).join(", ")}`,
            );
        });
    }

    transform<R>(transform: ZedTransform<any, R>): any {
        return this.addTransform((value, reader) => {
            try {
                return transform(value, reader);
            } catch (error) {
                if (error instanceof ZedError) {
                    throw error;
                }
                if (error instanceof Error) {
                    reader.addIssue(error.message);
                } else {
                    reader.addIssue(`transform() failed`);
                }
            }
        });
    }

    gt(n: number | bigint): any {
        return this.addTransform((value: number | bigint, reader) => {
            if (value > n) {
                return value;
            }
            reader.addIssue(`expected ${value} to be greater than ${n}`);
        });
    }

    lt(n: number | bigint): any {
        return this.addTransform((value: number | bigint, reader) => {
            if (value < n) {
                return value;
            }
            reader.addIssue(`expected ${value} to be less than ${n}`);
        });
    }

    gte(n: number | bigint): any {
        return this.addTransform((value: number | bigint, reader) => {
            if (value >= n) {
                return value;
            }
            reader.addIssue(
                `expected ${value} to be greater than or equal to ${n}`,
            );
        });
    }

    lte(n: number | bigint): any {
        return this.addTransform((value: number | bigint, reader) => {
            if (value <= n) {
                return value;
            }
            reader.addIssue(
                `expected ${value} to be less than or equal to ${n}`,
            );
        });
    }

    positive() {
        return this.gt(0);
    }

    negative() {
        return this.lt(0);
    }

    ascii(): any {
        return this.addTransform((value: Uint8Array) => {
            return Buffer.from(
                value.buffer,
                value.byteOffset,
                value.byteLength,
            ).toString("latin1");
        });
    }

    utf8(): any {
        return this.addTransform((value: Uint8Array) => {
            return Buffer.from(
                value.buffer,
                value.byteOffset,
                value.byteLength,
            ).toString("utf8");
        });
    }

    utf16le(): any {
        return this.addTransform((value: Uint8Array, reader) => {
            if (value.length % 2 !== 0) {
                reader.addIssue(
                    `utf16le() expected an even byte length, got ${value.length}`,
                );
            }
            return Buffer.from(
                value.buffer,
                value.byteOffset,
                value.byteLength,
            ).toString("utf16le");
        });
    }

    pick(mask: Partial<Record<string, true>>): any {
        return this.addTransform((value: Record<string, any>) => {
            for (const key in value) {
                if (mask[key] !== true) {
                    delete value[key];
                }
            }
            return value;
        });
    }

    omit(mask: Partial<Record<string, true>>): any {
        return this.addTransform((value: Record<string, any>) => {
            for (const key in mask) {
                if (mask[key] === true) {
                    delete value[key];
                }
            }
            return value;
        });
    }

    decodeInternal(reader: ZedReader) {
        // Save the initial offset, before the member is
        // decoded, so we can reset the offset for each
        // transformation.
        const initialOffset = reader.offset;

        // Set the next new position - this is the final
        // boundary of the previous member:
        reader.position = reader.offset;

        let result = this.decoder(reader);
        for (const fn of this.transformers) {
            // Reset the starting position on every
            // iteration, so every transform is theoretically
            // applied to the original decoder range.
            reader.position = initialOffset;
            result = fn(result, reader);
        }

        return result;
    }

    private addTransform(transform: ZedTransform<any, any>): Zed {
        return new Zed(this.decoder, this.transformers.concat(transform));
    }
}

function undo(value: any, reader: ZedReader) {
    reader.offset = reader.position;
    return value;
}
