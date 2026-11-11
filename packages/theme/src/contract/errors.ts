/**
 * Why a mutation was refused.
 *
 * A closed set rather than free text, because every caller is an editor or an
 * agent: a studio renders the failure, an MCP client branches on it, and
 * neither should be pattern-matching a sentence to find out what went wrong.
 * `path` says which token, `detail` carries whatever makes this particular
 * occurrence readable.
 *
 * The list is a value, not just a type, because the contract's wire schema
 * reads it: a code cannot exist in the vocabulary and not on the wire.
 */
export const MUTATION_ERROR_CODES = [
  "empty-path",
  "group-not-token",
  "missing-token",
  "occupied-target",
  // The path names a token the contract requires, so removing it leaves a
  // theme that does not build.
  "required-token",
  "type-mismatch",
  "type-required",
] as const;

export type MutationErrorCode = (typeof MUTATION_ERROR_CODES)[number];
