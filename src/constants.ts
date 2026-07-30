/**
 * This symbol is reserved for array length paths.
 *
 * @example
 * ```typescript
 * // If decoding fails on the u8(), the BsdIssue should
 * // indicate the length path:
 * array(u8(), u16()).decode(Uint8Array.of());
 * // BsdIssue { path: [BSD_LENGTH] }
 * ```
 */
export const BSD_LENGTH = Symbol.for("@bsd/length");

/**
 * Symbol reserved for the `read()` method in all BsdTypes.
 *
 * We use a symbol to ensure that the method ends up at the
 * end of the autocomplete, but it's still exposed for users
 * who need an escape hatch.
 */
export const BSD_READ = Symbol.for("@bsd/read");
