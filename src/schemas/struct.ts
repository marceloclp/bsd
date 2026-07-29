import {
    BsdType,
    type BsdAny,
    type BsdInfer,
    type BsdShape,
    type BsdStruct,
} from "../bsd";
import { asInternal } from "../common";

export function struct<const S extends BsdShape>(
    shape: S,
): BsdStruct<{ -readonly [K in keyof S]: BsdInfer<S[K]> }> {
    const entries = Object.entries(shape) as [string, BsdAny][];

    return new BsdType((reader) => {
        const value: Record<string, any> = {};
        for (const [k, s] of entries) {
            const schema = asInternal(s);
            reader.path.push(k);
            value[k] = schema.read(reader);
            reader.path.pop();
        }
        return value;
    });
}
