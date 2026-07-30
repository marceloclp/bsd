import type { BsdAny, BsdFor, BsdInfer, BsdShape, BsdStruct } from "../bsd";
import { BsdType } from "../bsd-type";
import { BSD_READ } from "../constants";

/**
 * Creates a struct schema.
 *
 * @param shape
 * @returns
 */
export function struct<const S extends BsdShape>(
    shape: S,
): BsdStruct<{ -readonly [K in keyof S]: BsdInfer<S[K]> }> {
    const entries = Object.entries(shape) as [string, BsdAny][];

    return BsdType.make((reader) => {
        const value: Record<string, any> = {};
        for (const [k, s] of entries) {
            reader.path.push(k);
            value[k] = s[BSD_READ](reader);
            reader.path.pop();
        }
        return value;
    }) as any;
}
