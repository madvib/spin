# Integration tests

Multiple modules across an internal boundary: theme → preset → generator, preset
→ lint vocabulary, runtime → machine → DOM. They live with the root or
composition package that owns the boundary — not beside one leaf module.

The system under test is the composition. Everything inside it is real: the real
theme document, the real preset, a real UnoCSS generator, a real browser for
anything that renders. The only doubles are at third-party boundaries — a
network call, a clock. Never mock our own modules.

## Good: the preset styles a document through the real pipeline

```ts
// A theme in, CSS out, through the real generator. A token that does not
// resolve, a rule that stops claiming its element, or a preflight that
// stops emitting all fail here.
it("Given a theme / When a document is generated / Then the elements are styled", async () => {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { default: theme } })],
  });
  const { css } = await uno.generate("<button>Save</button>");
  assert(css.includes("background-color: var(--color-primary)"));
});
```

Three plausible bugs, one test: the token stops resolving, the button rule stops
claiming `button`, the theme stops reaching the rule.

## Bad: the same test, mocked at our boundary

```ts
// BAD: the generator is a stub, so the CSS is the stub's.
it("styles a button", async () => {
  const uno = {
    generate: () => ({ css: "background-color: var(--color-primary)" }),
  };
  const { css } = await uno.generate("<button>");
  assert(css.includes("var(--color-primary)"));
});
```

This proves the stub returns what it was told. The real preset, the real theme
resolution, the real preflight are all unexercised. Delete it; run the real
generator.

## Good: the machine renders into a real DOM

```ts
// runtime + a Zag machine + a real element, in a real browser. The parts
// the anatomy declares are the parts that appear, and a state change
// repaints rather than rebuilding.
it("Given a tree machine / When the branch is clicked / Then its content is shown", () => {
  const el = mount("<tree-view></tree-view>");
  const control = el.querySelector('[data-part="branch-control"]');
  control.click();
  assertEquals(control.getAttribute("data-state"), "open");
  assertEquals(
    el.querySelector("ul[data-part=branch-content]").hasAttribute("hidden"),
    false,
  );
});
```

The first click is the case worth keeping: a rebuild-on-state-change swallows
it, and only a real DOM with a real event order shows that.

## Bad: the same test, through the unit instead of the seam

```ts
// BAD: calls the rule function directly. The preset could stop wiring the
// rule entirely and this stays green.
it("claims buttons", () => {
  assert(buttonRules([])[0].selector.includes("button"));
});
```

The unit test for the rule earns its place beside the rule. The integration
claim — "the generator emits it for a document" — needs the generator.

## Bad: the same test, asserting the other module

```ts
// BAD: this file owns the composition; the theme's own suite already covers
// alias resolution. Asserting theme internals here duplicates that suite and
// breaks when it refactors.
it("resolves aliases", async () => {
  await generate(theme);
  assert((theme as any)._aliases.has("primary"));
});
```

Assert what the composition produces — the CSS, the emitted variables — and
leave the theme's internals to the theme's tests.

## Paired governance: both directions

A registry, router, or contract test asserts both ways so neither side can
drift: every declared thing has a handler AND the handler carries nothing
undeclared. One direction is a pin; two directions is a proof.

```ts
// GOOD: neither side can drift silently.
it("Given the catalog / When a rule is looked up / Then every declared group resolves", () => {
  for (const group of catalogGroups(catalog)) {
    assert(ruleFor(group) !== undefined);
  }
});
it("Given the rules / When inspected / Then nothing undeclared rides along", () => {
  for (const name of ruleNames()) assert(isDeclared(catalog, name));
});
```

## Where they live

With the package that owns the boundary. `@spin/preset` owns the theme→utility
composition, so its suite drives a real generator. A test needing the runtime
_and_ the preset lives where they meet, which is the components package — not
beside either one.
