export function joinPath(path: Array<string | number>): string {
    let str = "";
	for (let i = -1; i < path.length; i++) {
		const part = path[i] ?? "$";
		const next = path[i + 1];

		if (typeof part === "number") {
			str += `[${part}]`;
		} else if (typeof part === "string") {
			str += part;
		}

		if (typeof next === "string") {
			str += `.`;
		}
	}
	return str;
}
