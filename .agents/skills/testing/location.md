# Where tests live

Location is part of the claim: the file a test sits in says which seam it
guards. A unit test beside the function says "this function's contract". An
integration test in the package that owns the boundary says "this
composition holds". A test in the wrong place either duplicates another
suite or guards a seam nobody owns.

## Unit: co-located, one per source file

For every `<name>.ts`, a `<name>.test.ts` right next to it. An editor shows
them side by side; a move carries both; a delete removes both. The test
imports the sibling and nothing above it.

```
packages/runtime/src/signal.ts
packages/runtime/src/signal.test.ts
```

`describe` per exported function when a module exports several; never nest
more than one level — a deeper tree means the module does too much. Split a
file past a few hundred lines by theme (`creation` vs `disposal`), not by
level.

## Integration: in the package that owns the boundary

A test needing two modules lives where they meet, in that package's `tests/`
directory.

```
packages/preset/tests/          theme -> rules -> generated CSS
packages/theme/tests/           parse -> validate -> emit
packages/api/tests/             contract -> router
```

The package that owns the boundary is the one that would change if the seam
moved. `@spin/preset` owns theme→utility composition, so its suite drives a
real generator. A test needing the runtime *and* the preset belongs to the
package that composes them — not beside either one.

## E2E: outside default green, declared

Stranger-run proofs sit beside the entry they drive, gated from outside (a
task name, a binary check at the runner) — never skipped from inside. The
exclusion is declared at the runner, not hidden in the test.

## What this repo gets wrong today

`packages/lint` has no suite at all, and it is the package whose rules decide
what authored code is allowed to say. Its vocabulary is imported from
`@spin/preset` rather than restated, which is right, but nothing asserts that
a rule fires when it should and stays quiet when it should not. A lint rule
is a contract like any other and earns a fixture that fails without it.

`packages/runtime` is the mirror image: three unit files and no integration
suite, so nothing drives a machine into a real DOM. Both real regressions in
this repo — the swallowed first click, the collapse that did not hide — lived
in exactly that gap. The unit tests passed throughout.
