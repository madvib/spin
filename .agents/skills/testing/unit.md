# Unit tests

One function, co-located beside it (`<name>.test.ts` next to `<name>.ts`). The
test imports the function, calls it, asserts the value. Nothing else.

## Good: behavior of one function

```ts
// scope() runs a body and disposes everything it created (signal.ts).
// GOOD: calls the function, asserts the observable result.
it("Given a scope with an effect inside / When disposed / Then the effect stops", () => {
  const count = signal(0);
  let seen = 0;
  const owner = scope();
  owner.run(() =>
    effect(() => {
      seen = count();
    })
  );
  count.set(1);
  owner.dispose();
  count.set(2);
  assertEquals(seen, 1);
});
```

The test survives a rewrite of the disposal mechanism — a list, a tree, a
WeakRef — because it asserts what a caller observes, not how it is tracked.

## Bad: the same test, coupled

```ts
// BAD: reaches past the observable into internals.
it("disposes", () => {
  const owner = scope();
  owner.run(() => effect(() => {}));
  owner.dispose();
  assertEquals((owner as any)._effects.length, 0);
});
```

Renaming `_effects`, changing the container, or disposing lazily breaks this
with zero behavior change. Delete and rewrite through the interface.

## Bad: the same test, tautological

```ts
// BAD: recomputes the expectation the way the code does.
it("resolves a spacing token", () => {
  const expected = `var(--${theme.prefix}-spacing-4)`;
  assertEquals(spacingVar(4), expected);
});

// GOOD: the expectation is an independent literal.
it("Given step 4 / When the spacing variable is named / Then it is the token", () => {
  assertEquals(spacingVar(4), "var(--spacing-4)");
});
```

## Bad: the same test, existence-only

```ts
// BAD: proves the generator emitted something, not what.
it("generates preset css", async () => {
  const { css } = await uno.generate("p-4");
  assert(css.length > 0);
});

// GOOD: asserts the declaration a consumer reads.
it("Given the p-4 utility / When generated / Then it is the spacing step", async () => {
  const { css } = await uno.generate("p-4");
  assert(css.includes("padding: var(--spacing-4)"));
});
```

## Bad: the same test, mocking what you own

```ts
// BAD: the mock IS the collaborator — this proves the mock, not the code.
it("checks a class against the vocabulary", () => {
  const manifest = mock(PrimitiveManifest);
  manifest.claimedElements.returns(new Set(["button"]));
  assertEquals(violates("h1", manifest), false);
});

// GOOD: the real manifest, built from the real rules.
it("Given a utility on a claimed element / When checked / Then it is refused", () => {
  const claimed = claimedElements();
  assertEquals(claimed.has("button"), true);
  assertEquals(claimed.has("marquee"), false);
});
```

If the unit needs a double of something we own, the design is wrong — inject at
a real boundary or test the real thing.

## Bad: the same test, someone else's code

```ts
// BAD: asserts on the dependency, not our contract.
it("unocss expands at-apply", async () => {
  const { css } = await uno.generate("p-4");
  assert(css.includes("padding"));
});

// GOOD: asserts what OUR preset does with OUR vocabulary.
it("Given the p-4 utility / When generated / Then it is the spacing step", async () => {
  const { css } = await uno.generate("p-4");
  assert(css.includes("padding: var(--spacing-4)"));
});
```

## What earns a unit test

Behavior, boundaries, invariants, transitions, precedence, real errors — one
function at a time. A deterministic, isolated case a plausible bug could fail.
Table-driven over literals where the law is general (a round-trip over a table
of token trees, not one pinned string).
