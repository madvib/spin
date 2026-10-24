/**
 * This app's markup uses the spin element vocabulary directly, so it pulls
 * in the one shared augmentation rather than a second copy that would drift
 * from it.
 *
 * The REFERENCE is what does it, and it cannot be an import: the file it
 * points at declares a global augmentation, and a global script — a file with
 * no import of its own — is the only kind the compiler pulls into EVERY
 * program it builds. An import would make this file a module, and a module
 * reaches only the programs that import it, so the elements would go missing
 * from the files that never name this one.
 *
 * The lint reads the reference as a deprecated form of an import. Here it is
 * not that: it is the only spelling that carries the augmentation to every
 * file, so the finding is declared and dismissed where it is correct.
 */
// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="../../../packages/spin/src/preset/solid.d.ts" />
