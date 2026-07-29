import type { BsdAny, BsdFor, BsdInfer, BsdShape } from "../bsd";
import { BsdType } from "../bsd-type";

export function struct<const S extends BsdShape>(
    shape: S,
): BsdFor<{ -readonly [K in keyof S]: BsdInfer<S[K]> }> {
    const entries = Object.entries(shape) as [string, BsdAny][];

    return BsdType.make((reader) => {
        const value: Record<string, any> = {};
        for (const [k, s] of entries) {
            reader.path.push(k);
            value[k] = s["~type"].read(reader);
            reader.path.pop();
        }
        return value;
    }) as any;
}
