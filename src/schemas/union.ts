import type { BsdAny, BsdFor, BsdInfer } from "../bsd";
import { BsdType } from "../bsd-type";
import { BSD_READ } from "../constants";

export function union<const S extends readonly [BsdAny, BsdAny, ...BsdAny[]]>(
    ...schemas: S
): BsdFor<BsdInfer<S[number]>> {
    return BsdType.make((reader) => {
        const schemaOffset = reader.schemaOffset;
        const byteOffset = reader.byteOffset;
        const pathLength = reader.path.length;

        for (const schema of schemas) {
            try {
                return schema[BSD_READ](reader);
            } catch {
                // Reset the reader's state so we can try
                // the next schema in the union:
                while (reader.path.length > pathLength) {
                    reader.path.pop();
                }
                reader.schemaOffset = schemaOffset;
                reader.byteOffset = byteOffset;
            }
        }

        throw reader.fail(`union() failed to match any schema`);
    }) as any;
}
