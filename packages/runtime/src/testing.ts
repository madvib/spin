/**
 * The test-only DOM.
 *
 * A second `Window` type, which is the point of keeping it behind a
 * subpath: a browser consumer importing `@spin/runtime` never loads this
 * module, so the two `Window` types never coexist in one program and Zag's
 * `Scope` stays assignable. Exposing it from the package root instead put
 * it in every consumer's program and broke the whole workspace check.
 */
export { parseHTML } from "linkedom";
