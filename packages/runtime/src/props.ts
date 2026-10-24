/**
 * The prop grammar's coercion, owned by the syntax.
 *
 * One implementation serves every boundary: the parser calls in at build
 * time to turn a declared prop's text into a value, and the element bridge
 * builds its attribute parsers here. No other module parses a prop's text
 * form.
 *
 * The module is deliberately pure (no signals, no DOM) so the runtime can
 * depend on it without a cycle back.
 *
 * `@spin/runtime/props` re-exports this module, so hosts written against
 * the runtime's subpath keep working.
 */
export * from "@spin/syntax/props";
