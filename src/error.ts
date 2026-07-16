import { joinPath } from "./common";

export class EkeError extends Error {
    override readonly name = "EkeError";

    constructor(
        /** The byte offset of the member that failed to decode. */
        public readonly offset: number,
        /** The path to the member that failed to decode. */
        public readonly path: Array<string | number>,
        message: string,
    ) {
        super(`+${offset}: ${joinPath(path)}: ${message}`);
    }
}
