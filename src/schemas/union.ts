import { BsdType, type BsdAny, type BsdFor, type BsdInfer } from "../bsd";
import { asInternal } from "../common";
import { BsdIssue } from "../reader";

export function union<const S extends readonly [BsdAny, BsdAny, ...BsdAny[]]>(
    ...schemas: S
): BsdFor<BsdInfer<S[number]>> {
    return new BsdType((reader) => {
        const schemaOffset = reader.schemaOffset;
        const byteOffset = reader.byteOffset;
        const pathLength = reader.path.length;

        for (const schema of schemas) {
            try {
                return asInternal(schema).read(reader);
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

        throw BsdIssue.from(reader, `union() failed to match any schema`);
    }) as any;
}
